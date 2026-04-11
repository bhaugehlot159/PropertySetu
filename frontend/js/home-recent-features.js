(() => {
  const grid = document.getElementById("recentFeatureGrid");
  if (!grid) return;

  const hint = document.getElementById("recentFeatureHint");
  const mostUsedGrid = document.getElementById("mostUsedFeatureGrid");
  const mostUsedHint = document.getElementById("mostUsedFeatureHint");
  const mostUsedRoleTabs = Array.from(document.querySelectorAll("[data-most-role]"));
  const STORAGE_KEY = "propertysetu:home-recent-features";
  const USAGE_STORAGE_KEY = "propertysetu:home-feature-usage";
  const LIMIT = 6;
  const SAME_PAGE = `${window.location.pathname.split("/").pop() || "index.html"}`;
  let currentMostRole = "all";

  const defaults = [
    {
      label: "Open Marketplace Filters",
      href: "#marketplace",
      note: "Fast property search with smart filters.",
      source: "Smart Search",
      role: "customer",
      at: new Date().toISOString(),
    },
    {
      label: "Use Feature Finder",
      href: "#featureCommandCenter",
      note: "Role-wise all features ek jagah.",
      source: "Feature Command",
      role: "all",
      at: new Date().toISOString(),
    },
    {
      label: "Compare + EMI Tools",
      href: "#decisionTools",
      note: "Compare listings and calculate EMI quickly.",
      source: "Decision Tools",
      role: "customer",
      at: new Date().toISOString(),
    },
  ];

  const safeRead = (key = STORAGE_KEY) => {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const safeWrite = (items = [], key = STORAGE_KEY) => {
    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch {
      // ignore storage write failures
    }
  };

  const relativeTime = (iso = "") => {
    const time = new Date(iso).getTime();
    if (!Number.isFinite(time)) return "just now";
    const diff = Math.max(0, Date.now() - time);
    const minutes = Math.round(diff / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
  };

  const shortText = (value = "", max = 72) => {
    const text = String(value || "").trim().replace(/\s+/g, " ");
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1)}...`;
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
        const file = url.pathname.split("/").pop() || SAME_PAGE;
        return `${file}${url.hash || ""}`;
      } catch {
        return "";
      }
    }
    return raw;
  };

  const makeItemKey = (item = {}) => `${String(item.href || "").trim()}|${String(item.label || "").trim()}`;
  const validRoles = new Set(["all", "customer", "seller", "admin"]);
  const formatCount = (count = 0) => {
    const safe = Math.max(0, Number(count) || 0);
    return `${safe} ${safe === 1 ? "use" : "uses"}`;
  };
  const normalizeRole = (value = "all") => {
    const role = String(value || "all").trim().toLowerCase();
    return validRoles.has(role) ? role : "all";
  };
  const roleLabel = (value = "all") => {
    const role = normalizeRole(value);
    if (role === "customer") return "Customer";
    if (role === "seller") return "Seller";
    if (role === "admin") return "Admin";
    return "All";
  };
  const roleFromText = (value = "") => {
    const text = String(value || "").toLowerCase();
    if (!text) return "all";
    if (/(admin|moderation|verification|report|commission|control|dashboard admin)/.test(text)) return "admin";
    if (/(seller|listing|post property|boost|renewal|upload|analytics)/.test(text)) return "seller";
    if (/(customer|wishlist|compare|visit|chat|emi|marketplace|search|filter|buy|rent)/.test(text)) return "customer";
    return "all";
  };
  const inferRole = (item = {}) => {
    const explicit = normalizeRole(item.role);
    if (explicit !== "all") return explicit;
    const composed = `${item.label || ""} ${item.source || ""} ${item.note || ""} ${item.href || ""}`;
    return roleFromText(composed);
  };
  const setMostRoleTab = (role = "all") => {
    currentMostRole = normalizeRole(role);
    mostUsedRoleTabs.forEach((btn) => {
      const value = normalizeRole(btn.getAttribute("data-most-role") || "all");
      btn.classList.toggle("active", value === currentMostRole);
    });
  };

  const sourceFromElement = (el) => {
    if (!el) return "Homepage";
    const section = el.closest("section");
    const heading = section?.querySelector("h2");
    if (heading && heading.textContent) return shortText(heading.textContent, 34);
    if (el.closest("#desktopQuickDock")) return "Quick Dock";
    if (el.closest(".home-top-nav")) return "Top Navigation";
    return "Homepage";
  };

  const noteFromElement = (el) => {
    const parentCard = el?.closest("article, .card, .hub-box, .feature-finder-card");
    const paragraph = parentCard?.querySelector("p");
    if (paragraph?.textContent) return shortText(paragraph.textContent, 78);
    return "Tap to continue from your last used action.";
  };

  const addRecentItem = (item = {}) => {
    if (!item.href || !item.label) return;
    const current = safeRead(STORAGE_KEY);
    const key = makeItemKey(item);
    const filtered = current.filter((row) => makeItemKey(row) !== key);
    filtered.unshift(item);
    safeWrite(filtered.slice(0, LIMIT), STORAGE_KEY);
    render();
  };

  const trackFeatureUsage = (item = {}) => {
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
          role: normalizeRole(item.role || existing.role || inferRole(item)),
        }
      : {
          ...item,
          count: 1,
          role: normalizeRole(item.role || inferRole(item)),
          at: now,
        };
    const filtered = current.filter((row) => makeItemKey(row) !== key);
    filtered.unshift(nextItem);
    safeWrite(filtered.slice(0, 80), USAGE_STORAGE_KEY);
    render();
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

  const render = () => {
    const stored = safeRead(STORAGE_KEY);
    const list = stored.length ? stored : defaults;
    grid.innerHTML = "";

    list.slice(0, LIMIT).forEach((item) => {
      const card = document.createElement("article");
      card.className = "recent-feature-card";

      const title = document.createElement("h3");
      title.textContent = shortText(item.label || "Quick Action", 64);

      const note = document.createElement("p");
      note.textContent = shortText(item.note || "Tap to continue where you left off.", 96);

      const meta = document.createElement("p");
      meta.className = "meta";
      meta.textContent = `${shortText(item.source || "Homepage", 24)} • ${relativeTime(item.at)}`;

      const action = document.createElement("a");
      action.className = "outline-btn dark-outline";
      action.href = item.href;
      action.textContent = "Open Again";
      action.addEventListener("click", (event) => {
        event.preventDefault();
        trackFeatureUsage({
          label: item.label,
          href: item.href,
          source: "Recent Features",
          note: item.note || "Repeated from recent features panel.",
          at: new Date().toISOString(),
        });
        openHref(item.href);
      });

      card.append(title, note, meta, action);
      grid.appendChild(card);
    });

    if (hint) {
      hint.textContent = stored.length
        ? "Recent panel auto update ho raha hai. Jitna zyada use, utna fast repeat workflow."
        : "Recent history abhi empty hai. Aapke next actions yahan automatically save honge.";
    }

    renderMostUsed();
  };

  const renderMostUsed = () => {
    if (!mostUsedGrid) return;
    const usage = safeRead(USAGE_STORAGE_KEY);
    const fallbackUsage = defaults.map((item, index) => ({
      ...item,
      count: Math.max(1, 3 - index),
      role: normalizeRole(item.role || inferRole(item)),
    }));
    const list = usage.length ? usage : fallbackUsage;
    const scoped = currentMostRole === "all"
      ? list
      : list.filter((item) => normalizeRole(item.role || inferRole(item)) === currentMostRole);
    const workingList = scoped.length ? scoped : list;
    const sorted = [...workingList]
      .sort((a, b) => {
        const countDiff = (Number(b.count) || 0) - (Number(a.count) || 0);
        if (countDiff !== 0) return countDiff;
        return new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime();
      })
      .slice(0, LIMIT);
    const maxCount = Math.max(1, ...sorted.map((item) => Number(item.count) || 0));
    mostUsedGrid.innerHTML = "";

    sorted.forEach((item, index) => {
      const card = document.createElement("article");
      card.className = "most-used-card";

      const rank = document.createElement("span");
      rank.className = "rank";
      rank.textContent = String(index + 1);

      const title = document.createElement("h3");
      title.textContent = shortText(item.label || "Top Feature", 64);

      const usageMeta = document.createElement("p");
      usageMeta.className = "usage-meta";
      usageMeta.textContent = `${formatCount(item.count)} • ${roleLabel(item.role || inferRole(item))} • ${shortText(item.source || "Homepage", 24)}`;

      const meter = document.createElement("div");
      meter.className = "usage-meter";
      const meterBar = document.createElement("span");
      const width = Math.max(12, Math.round(((Number(item.count) || 0) / maxCount) * 100));
      meterBar.style.width = `${width}%`;
      meter.appendChild(meterBar);

      const action = document.createElement("a");
      action.className = "outline-btn dark-outline";
      action.href = item.href || "#featureCommandCenter";
      action.textContent = "Open Feature";
      action.addEventListener("click", (event) => {
        event.preventDefault();
        trackFeatureUsage({
          label: item.label,
          href: item.href,
          source: "Most Used Features",
          note: item.note || "Opened from most-used ranking.",
          role: normalizeRole(item.role || inferRole(item)),
          at: new Date().toISOString(),
        });
        openHref(item.href);
      });

      card.append(rank, title, usageMeta, meter, action);
      mostUsedGrid.appendChild(card);
    });

    if (mostUsedHint) {
      mostUsedHint.textContent = usage.length
        ? `Top used features ${roleLabel(currentMostRole)} role filter ke saath update ho rahe hain.`
        : `Usage data build hone tak ${roleLabel(currentMostRole)} role ke liye starter ranking dikhayi ja rahi hai.`;
    }
  };

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const interactive = target.closest("a, button");
      if (!interactive) return;
      if (interactive.closest("#recentFeatureGrid")) return;

      let href = "";
      let label = "";
      if (interactive.tagName.toLowerCase() === "a") {
        href = normalizeHref(interactive.getAttribute("href") || "");
        label = shortText(interactive.textContent || interactive.getAttribute("aria-label") || "Open Feature", 62);
      } else if (interactive instanceof HTMLButtonElement) {
        if (interactive.matches("[data-feature-chip]")) {
          href = "#featureCommandCenter";
          label = shortText(interactive.textContent || "Feature Chip", 62);
        } else if (interactive.id === "dockCommandGo") {
          href = "#featureCommandCenter";
          label = "Quick Command Search";
        } else {
          return;
        }
      }

      if (!href || !label) return;
      const item = {
        label,
        href,
        source: sourceFromElement(interactive),
        note: noteFromElement(interactive),
        role: inferRole({
          label,
          href,
          source: sourceFromElement(interactive),
          note: noteFromElement(interactive),
        }),
        at: new Date().toISOString(),
      };
      trackFeatureUsage(item);
      addRecentItem(item);
    },
    true
  );

  mostUsedRoleTabs.forEach((button) => {
    button.addEventListener("click", () => {
      setMostRoleTab(button.getAttribute("data-most-role") || "all");
      renderMostUsed();
    });
  });

  setMostRoleTab("all");
  render();
})();
