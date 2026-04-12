(() => {
  const sections = Array.from(document.querySelectorAll("section[data-home-folder]"));
  const tabs = Array.from(document.querySelectorAll("[data-home-folder-tab]"));
  const openButtons = Array.from(document.querySelectorAll("[data-home-folder-open]"));
  const statusLine = document.getElementById("homeFolderStatus");
  if (!sections.length || !tabs.length) return;

  const STORAGE_KEY = "propertysetu:home-active-folder";
  const GLOBAL_SEARCH_KEY = "propertysetu:global-search";
  const defaultFolder = "discovery";
  const compactByDefault = true;

  const folderInfo = {
    discovery: {
      label: "Discovery",
      hint: "Feature Finder, categories, recent usage aur top actions active hain.",
    },
    marketplace: {
      label: "Marketplace",
      hint: "Locality pulse, smart filters, AI recommendation aur listings active hain.",
    },
    tools: {
      label: "Tools",
      hint: "Compare board, saved searches aur EMI tools active hain.",
    },
    roleboards: {
      label: "Role Boards",
      hint: "Customer, seller, admin workflow panels active hain.",
    },
    insights: {
      label: "Insights",
      hint: "Trust, premium services, video visit aur business insights active hain.",
    },
  };

  const availableFolders = new Set(sections.map((section) => String(section.dataset.homeFolder || "").toLowerCase()));

  const normalizeFolder = (value = "") => {
    const folder = String(value || "").trim().toLowerCase();
    if (availableFolders.has(folder)) return folder;
    return defaultFolder;
  };

  const readStoredFolder = () => {
    try {
      return normalizeFolder(localStorage.getItem(STORAGE_KEY) || "");
    } catch {
      return defaultFolder;
    }
  };

  const writeStoredFolder = (folder = defaultFolder) => {
    try {
      localStorage.setItem(STORAGE_KEY, normalizeFolder(folder));
    } catch {
      // ignore storage policy failures
    }
  };

  const clearStoredFolder = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore storage policy failures
    }
  };

  const setStatus = (folder = "") => {
    if (!statusLine) return;
    if (!folder) {
      statusLine.textContent = "Compact home active hai. Jo feature chahiye us folder tab par click karke open karo.";
      return;
    }
    const info = folderInfo[folder] || folderInfo[defaultFolder];
    statusLine.textContent = `${info.label} folder active hai. ${info.hint}`;
  };

  const getFolderByElement = (target) => {
    if (!(target instanceof Element)) return "";
    const hostSection = target.closest("section[data-home-folder]");
    if (!hostSection) return "";
    return normalizeFolder(hostSection.dataset.homeFolder || "");
  };

  let activeFolder = "";

  const showCompactHome = (options = {}) => {
    activeFolder = "";

    sections.forEach((section) => {
      section.hidden = true;
      section.classList.remove("home-folder-active");
    });

    tabs.forEach((tab) => {
      tab.classList.remove("active");
      tab.setAttribute("aria-selected", "false");
    });

    openButtons.forEach((button) => button.classList.remove("active"));

    setStatus("");
    if (!options.skipPersist) clearStoredFolder();
  };

  const applyFolder = (folder = defaultFolder, options = {}) => {
    const nextFolder = normalizeFolder(folder);
    activeFolder = nextFolder;

    sections.forEach((section) => {
      const sectionFolder = normalizeFolder(section.dataset.homeFolder || "");
      const isActive = sectionFolder === nextFolder;
      section.hidden = !isActive;
      section.classList.toggle("home-folder-active", isActive);
    });

    tabs.forEach((tab) => {
      const tabFolder = normalizeFolder(tab.getAttribute("data-home-folder-tab") || "");
      tab.classList.toggle("active", tabFolder === nextFolder);
      tab.setAttribute("aria-selected", tabFolder === nextFolder ? "true" : "false");
    });

    openButtons.forEach((button) => {
      const buttonFolder = normalizeFolder(button.getAttribute("data-home-folder-open") || "");
      button.classList.toggle("active", buttonFolder === nextFolder);
    });

    setStatus(nextFolder);
    if (!options.skipPersist) writeStoredFolder(nextFolder);

    if (options.scrollToFirst) {
      const firstSection = sections.find((section) => normalizeFolder(section.dataset.homeFolder || "") === nextFolder);
      firstSection?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const openTarget = (target, options = {}) => {
    let node = null;
    if (target instanceof Element) {
      node = target;
    } else {
      const raw = String(target || "").trim();
      if (!raw.startsWith("#")) return false;
      const id = raw.slice(1);
      if (!id) return false;
      node = document.getElementById(id);
    }

    if (!node) return false;
    const folder = getFolderByElement(node);
    if (!folder) return false;

    applyFolder(folder, { skipPersist: Boolean(options.skipPersist) });
    const behavior = options.behavior || "smooth";
    window.requestAnimationFrame(() => {
      node.scrollIntoView({ behavior, block: "start" });
    });
    return true;
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const folder = tab.getAttribute("data-home-folder-tab") || defaultFolder;
      if (activeFolder === normalizeFolder(folder)) {
        showCompactHome();
        return;
      }
      applyFolder(folder, { scrollToFirst: true });
    });
  });

  openButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const folder = button.getAttribute("data-home-folder-open") || defaultFolder;
      applyFolder(folder, { scrollToFirst: true });
    });
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest("a[href^=\"#\"]");
    if (!(link instanceof HTMLAnchorElement)) return;
    const href = String(link.getAttribute("href") || "").trim();
    if (href.length <= 1) return;
    const node = document.getElementById(href.slice(1));
    if (!node) return;
    const folder = getFolderByElement(node);
    if (!folder) return;

    event.preventDefault();
    applyFolder(folder);
    if (window.history && typeof window.history.replaceState === "function") {
      window.history.replaceState(null, "", href);
    } else {
      window.location.hash = href;
    }
    window.requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  window.addEventListener("hashchange", () => {
    const hash = String(window.location.hash || "").trim();
    if (!hash) return;
    openTarget(hash, { behavior: "smooth" });
  });

  const initialHash = String(window.location.hash || "").trim();
  if (initialHash) {
    const opened = openTarget(initialHash, { behavior: "auto", skipPersist: true });
    if (!opened) {
      if (compactByDefault) showCompactHome({ skipPersist: true });
      else applyFolder(readStoredFolder(), { skipPersist: true });
    }
  } else {
    if (compactByDefault) showCompactHome({ skipPersist: true });
    else applyFolder(readStoredFolder(), { skipPersist: true });
  }

  window.PropertySetuHomeFolders = {
    getActiveFolder: () => activeFolder,
    openFolder: (folder = "", options = {}) => {
      if (!String(folder || "").trim()) {
        showCompactHome(options);
        return;
      }
      applyFolder(folder, options);
    },
    openTarget: (target, options = {}) => openTarget(target, options),
    compactHome: (options = {}) => showCompactHome(options),
  };

  const consumeGlobalSearch = () => {
    let query = "";
    try {
      query = String(localStorage.getItem(GLOBAL_SEARCH_KEY) || "").trim();
      if (query) localStorage.removeItem(GLOBAL_SEARCH_KEY);
    } catch {
      query = "";
    }
    if (!query) return;

    const marketInput = document.getElementById("marketQuery");
    if (marketInput) {
      marketInput.value = query;
      marketInput.dispatchEvent(new Event("input", { bubbles: true }));
      marketInput.dispatchEvent(new Event("change", { bubbles: true }));
    }
    openTarget("#marketplace", { behavior: "smooth" });
  };

  consumeGlobalSearch();
})();
