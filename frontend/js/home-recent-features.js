(() => {
  const grid = document.getElementById("recentFeatureGrid");
  if (!grid) return;

  const hint = document.getElementById("recentFeatureHint");
  const STORAGE_KEY = "propertysetu:home-recent-features";
  const LIMIT = 6;
  const SAME_PAGE = `${window.location.pathname.split("/").pop() || "index.html"}`;

  const defaults = [
    {
      label: "Open Marketplace Filters",
      href: "#marketplace",
      note: "Fast property search with smart filters.",
      source: "Smart Search",
      at: new Date().toISOString(),
    },
    {
      label: "Use Feature Finder",
      href: "#featureCommandCenter",
      note: "Role-wise all features ek jagah.",
      source: "Feature Command",
      at: new Date().toISOString(),
    },
    {
      label: "Compare + EMI Tools",
      href: "#decisionTools",
      note: "Compare listings and calculate EMI quickly.",
      source: "Decision Tools",
      at: new Date().toISOString(),
    },
  ];

  const safeRead = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const safeWrite = (items = []) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
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
    const current = safeRead();
    const key = makeItemKey(item);
    const filtered = current.filter((row) => makeItemKey(row) !== key);
    filtered.unshift(item);
    safeWrite(filtered.slice(0, LIMIT));
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
    const stored = safeRead();
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
        at: new Date().toISOString(),
      };
      addRecentItem(item);
    },
    true
  );

  render();
})();
