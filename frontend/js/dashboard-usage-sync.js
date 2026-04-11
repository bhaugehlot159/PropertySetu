(() => {
  const main = document.querySelector("main.dash-shell");
  if (!main) return;

  const USAGE_STORAGE_KEY = "propertysetu:home-feature-usage";
  const LIMIT = 6;
  const validRoles = new Set(["all", "customer", "seller", "admin"]);
  const validWindows = new Set(["today", "7d", "30d"]);
  const pageName = String(window.location.pathname.split("/").pop() || "").toLowerCase();
  const pageRole = pageName.includes("admin")
    ? "admin"
    : pageName.includes("seller")
      ? "seller"
      : "customer";
  let currentWindow = "7d";

  const safeRead = (key = USAGE_STORAGE_KEY) => {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const safeWrite = (items = [], key = USAGE_STORAGE_KEY) => {
    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch {
      // ignore
    }
  };

  const shortText = (value = "", max = 74) => {
    const text = String(value || "").trim().replace(/\s+/g, " ");
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1)}...`;
  };

  const normalizeRole = (value = "all") => {
    const role = String(value || "all").trim().toLowerCase();
    return validRoles.has(role) ? role : "all";
  };

  const roleLabel = (value = "all") => {
    const role = normalizeRole(value);
    if (role === "admin") return "Admin";
    if (role === "seller") return "Seller";
    if (role === "customer") return "Customer";
    return "All";
  };

  const normalizeWindow = (value = "7d") => {
    const key = String(value || "7d").trim().toLowerCase();
    return validWindows.has(key) ? key : "7d";
  };

  const windowLabel = (value = "7d") => {
    const key = normalizeWindow(value);
    if (key === "today") return "Today";
    if (key === "30d") return "30 Days";
    return "7 Days";
  };

  const toMs = (iso = "") => new Date(iso || 0).getTime();
  const isWithinWindow = (iso = "", windowKey = "7d") => {
    const stamp = toMs(iso);
    if (!Number.isFinite(stamp) || stamp <= 0) return false;
    const now = Date.now();
    const key = normalizeWindow(windowKey);
    if (key === "today") {
      const nowDate = new Date(now);
      const stampDate = new Date(stamp);
      return (
        nowDate.getFullYear() === stampDate.getFullYear() &&
        nowDate.getMonth() === stampDate.getMonth() &&
        nowDate.getDate() === stampDate.getDate()
      );
    }
    const days = key === "7d" ? 7 : 30;
    return now - stamp <= days * 24 * 60 * 60 * 1000;
  };

  const normalizeHref = (href = "") => {
    const raw = String(href || "").trim();
    if (!raw) return "";
    if (raw.startsWith("#")) return raw;
    if (raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("javascript:")) return "";
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      try {
        const url = new URL(raw);
        if (url.origin !== window.location.origin) return raw;
        const file = url.pathname.split("/").pop() || "index.html";
        return `${file}${url.hash || ""}`;
      } catch {
        return "";
      }
    }
    if (raw.startsWith("/")) {
      const file = raw.split("/").pop() || "index.html";
      return file;
    }
    return raw;
  };

  const makeItemKey = (item = {}) =>
    `${String(item.href || "").trim()}|${String(item.label || "").trim()}`;

  const formatCount = (count = 0) => {
    const safe = Math.max(0, Number(count) || 0);
    return `${safe} ${safe === 1 ? "use" : "uses"}`;
  };

  const pageRoleTitle = pageRole === "admin" ? "Admin" : pageRole === "seller" ? "Seller" : "Customer";

  const cards = Array.from(main.querySelectorAll(".container.dash-card"));
  cards.forEach((card, index) => {
    if (!card.id) card.id = `dash-${pageRole}-section-${index + 1}`;
  });

  const defaultsByRole = {
    customer: [
      { label: "Wishlist + Visits", href: "user-dashboard.html", source: "Dashboard", note: "Customer shortlist and visits.", role: "customer", count: 3 },
      { label: "Marketplace Search", href: "index.html#marketplace", source: "Dashboard", note: "Find listings fast.", role: "customer", count: 2 },
      { label: "Compare + EMI", href: "index.html#decisionTools", source: "Dashboard", note: "Decision tools.", role: "customer", count: 1 },
    ],
    seller: [
      { label: "Add New Property", href: "seller-dashboard.html", source: "Seller Dashboard", note: "Post and manage listings.", role: "seller", count: 3 },
      { label: "Boost Listing", href: "subscription.html", source: "Seller Dashboard", note: "Increase listing visibility.", role: "seller", count: 2 },
      { label: "Seller Analytics", href: "seller-dashboard.html", source: "Seller Dashboard", note: "Views, saves, inquiries.", role: "seller", count: 1 },
    ],
    admin: [
      { label: "Pending Approvals", href: "admin-dashboard.html", source: "Admin Dashboard", note: "Moderate listing queue.", role: "admin", count: 3 },
      { label: "Verified Badge Control", href: "admin-dashboard.html", source: "Admin Dashboard", note: "Verification workflows.", role: "admin", count: 2 },
      { label: "Reports + Commission", href: "admin-dashboard.html", source: "Admin Dashboard", note: "Operations analytics.", role: "admin", count: 1 },
    ],
  };

  const panel = document.createElement("div");
  panel.className = "container dash-card";
  panel.id = "dashboardUsageInsightsCard";
  panel.innerHTML = `
    <div class="dash-usage-head">
      <h2>Most Used Actions (${pageRoleTitle} Dashboard)</h2>
      <p class="dash-meta">Homepage analytics ke saath synced usage insights.</p>
    </div>
    <div class="dash-usage-tabs" role="tablist" aria-label="Dashboard usage windows">
      <button type="button" class="dash-usage-tab" data-dash-window="today">Today</button>
      <button type="button" class="dash-usage-tab active" data-dash-window="7d">7 Days</button>
      <button type="button" class="dash-usage-tab" data-dash-window="30d">30 Days</button>
    </div>
    <div class="dash-usage-tools">
      <button type="button" class="dash-usage-tab" id="dashUsageExportBtn">Export Usage CSV</button>
      <button type="button" class="dash-usage-tab" id="dashUsageResetBtn">Reset Usage Data</button>
    </div>
    <div class="dash-usage-items" id="dashUsageItems"></div>
    <p class="dash-usage-hint" id="dashUsageHint">Usage insights loading...</p>
    <p class="dash-usage-status" id="dashUsageStatus"></p>
  `;
  main.insertBefore(panel, main.firstElementChild || null);

  const usageItemsEl = panel.querySelector("#dashUsageItems");
  const usageHintEl = panel.querySelector("#dashUsageHint");
  const usageStatusEl = panel.querySelector("#dashUsageStatus");
  const windowTabs = Array.from(panel.querySelectorAll("[data-dash-window]"));
  const exportBtn = panel.querySelector("#dashUsageExportBtn");
  const resetBtn = panel.querySelector("#dashUsageResetBtn");

  const sourceFromElement = (el) => {
    if (!el) return `${pageRoleTitle} Dashboard`;
    const card = el.closest(".dash-card");
    const heading = card?.querySelector("h2, h3");
    if (heading?.textContent) return shortText(heading.textContent, 34);
    return `${pageRoleTitle} Dashboard`;
  };

  const noteFromElement = (el) => {
    const card = el?.closest(".dash-card");
    const paragraph = card?.querySelector("p");
    if (paragraph?.textContent) return shortText(paragraph.textContent, 78);
    return "Dashboard action usage captured for quick repeat.";
  };

  const trackUsage = (item = {}) => {
    if (!item.href || !item.label) return;
    const current = safeRead(USAGE_STORAGE_KEY);
    const key = makeItemKey(item);
    const now = new Date().toISOString();
    const existing = current.find((row) => makeItemKey(row) === key);
    const nextItem = existing
      ? {
          ...existing,
          count: Math.max(0, Number(existing.count) || 0) + 1,
          at: now,
          source: item.source || existing.source,
          note: item.note || existing.note,
          role: normalizeRole(item.role || existing.role || pageRole),
        }
      : {
          ...item,
          count: 1,
          role: normalizeRole(item.role || pageRole),
          at: now,
        };
    const filtered = current.filter((row) => makeItemKey(row) !== key);
    filtered.unshift(nextItem);
    safeWrite(filtered.slice(0, 120), USAGE_STORAGE_KEY);
    renderUsage();
  };

  const openHref = (href = "") => {
    if (!href) return;
    if (href.startsWith("#")) {
      const target = document.querySelector(href);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    window.location.href = href;
  };

  const setStatus = (message = "") => {
    if (!usageStatusEl) return;
    usageStatusEl.textContent = String(message || "").trim();
  };

  const csvEscape = (value = "") => {
    const text = String(value ?? "");
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const downloadCsv = (rows = [], fileName = "dashboard-usage.csv") => {
    if (!rows.length) return false;
    const csv = rows.map((row) => row.map((cell) => csvEscape(cell)).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return true;
  };

  const buildDisplayList = () => {
    const usage = safeRead(USAGE_STORAGE_KEY);
    const scopedRole = usage.filter((item) => {
      const role = normalizeRole(item.role || pageRole);
      return role === pageRole || role === "all";
    });
    const windowScoped = scopedRole.filter((item) => isWithinWindow(item.at, currentWindow));
    const fallback = (defaultsByRole[pageRole] || []).map((item) => ({ ...item, at: new Date().toISOString() }));
    const list = windowScoped.length ? windowScoped : fallback;
    const sorted = [...list]
      .sort((a, b) => {
        const countDiff = (Number(b.count) || 0) - (Number(a.count) || 0);
        if (countDiff !== 0) return countDiff;
        return toMs(b.at) - toMs(a.at);
      })
      .slice(0, LIMIT);
    return {
      usage,
      sorted,
      isFallback: !windowScoped.length,
    };
  };

  const renderUsage = () => {
    if (!usageItemsEl) return;
    setStatus("");
    const { usage, sorted, isFallback } = buildDisplayList();

    usageItemsEl.innerHTML = "";
    if (!sorted.length) {
      const empty = document.createElement("p");
      empty.className = "dash-usage-empty";
      empty.textContent = `No usage data found for ${pageRoleTitle} in ${windowLabel(currentWindow)}.`;
      usageItemsEl.appendChild(empty);
      if (usageHintEl) {
        usageHintEl.textContent = `Selected window: ${windowLabel(currentWindow)}. Actions use karte hi panel update ho jayega.`;
      }
      return;
    }

    const maxCount = Math.max(1, ...sorted.map((item) => Number(item.count) || 0), 1);
    sorted.forEach((item) => {
      const card = document.createElement("article");
      card.className = "dash-usage-item";

      const title = document.createElement("h3");
      title.textContent = shortText(item.label || "Action", 62);

      const meta = document.createElement("p");
      meta.className = "dash-usage-meta";
      meta.textContent = `${formatCount(item.count)} • ${shortText(item.source || `${pageRoleTitle} Dashboard`, 26)}`;

      const meter = document.createElement("div");
      meter.className = "dash-usage-meter";
      const meterBar = document.createElement("span");
      const width = Math.max(12, Math.round(((Number(item.count) || 0) / maxCount) * 100));
      meterBar.style.width = `${width}%`;
      meter.appendChild(meterBar);

      const action = document.createElement("a");
      action.className = "outline-btn dark-outline";
      action.href = item.href || "index.html";
      action.textContent = "Open";
      action.setAttribute("data-dash-usage-open", "1");
      action.addEventListener("click", (event) => {
        event.preventDefault();
        trackUsage({
          label: item.label,
          href: item.href,
          source: "Dashboard Usage Panel",
          note: item.note || "Opened from dashboard usage panel.",
          role: pageRole,
          at: new Date().toISOString(),
        });
        openHref(item.href);
      });

      card.append(title, meta, meter, action);
      usageItemsEl.appendChild(card);
    });

    if (usageHintEl) {
      usageHintEl.textContent = isFallback
        ? `Real usage not found for selected window, showing ${pageRoleTitle} starter actions.`
        : `Showing ${pageRoleTitle} actions for ${windowLabel(currentWindow)} window.`;
    }
  };

  windowTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      currentWindow = normalizeWindow(tab.getAttribute("data-dash-window") || "7d");
      windowTabs.forEach((btn) => {
        const value = normalizeWindow(btn.getAttribute("data-dash-window") || "7d");
        btn.classList.toggle("active", value === currentWindow);
      });
      renderUsage();
    });
  });

  exportBtn?.addEventListener("click", () => {
    const { sorted } = buildDisplayList();
    if (!sorted.length) {
      setStatus("No usage data to export for selected filters.");
      return;
    }
    const rows = [
      ["label", "href", "role", "count", "source", "note", "last_used_at", "window", "dashboard_role"],
      ...sorted.map((item) => [
        item.label || "",
        item.href || "",
        normalizeRole(item.role || pageRole),
        Number(item.count) || 0,
        item.source || "",
        item.note || "",
        item.at || "",
        windowLabel(currentWindow),
        pageRoleTitle,
      ]),
    ];
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = `propertysetu-${pageRole}-usage-${normalizeWindow(currentWindow)}-${stamp}.csv`;
    const ok = downloadCsv(rows, file);
    setStatus(ok ? "Usage CSV exported successfully." : "Usage CSV export failed.");
  });

  resetBtn?.addEventListener("click", () => {
    const allow = window.confirm(
      "Reset usage analytics? Ye homepage aur dashboard usage ranking clear karega."
    );
    if (!allow) return;
    try {
      localStorage.removeItem(USAGE_STORAGE_KEY);
      renderUsage();
      setStatus("Usage analytics reset completed.");
    } catch {
      setStatus("Unable to reset usage analytics.");
    }
  });

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const interactive = target.closest("a, button");
      if (!interactive) return;
      if (panel.contains(interactive) && interactive.hasAttribute("data-dash-usage-open")) return;

      let href = "";
      let label = "";
      if (interactive.tagName.toLowerCase() === "a") {
        href = normalizeHref(interactive.getAttribute("href") || "");
        label = shortText(interactive.textContent || interactive.getAttribute("aria-label") || "Open Action", 62);
      } else if (interactive instanceof HTMLButtonElement) {
        const ownerCard = interactive.closest(".dash-card");
        if (!ownerCard || ownerCard.id === panel.id) return;
        if (!ownerCard.id) ownerCard.id = `dash-${pageRole}-section-${Date.now()}`;
        href = `#${ownerCard.id}`;
        label = shortText(interactive.textContent || ownerCard.querySelector("h2, h3")?.textContent || "Dashboard Action", 62);
      }

      if (!href || !label) return;
      trackUsage({
        label,
        href,
        source: sourceFromElement(interactive),
        note: noteFromElement(interactive),
        role: pageRole,
        at: new Date().toISOString(),
      });
    },
    true
  );

  renderUsage();
})();
