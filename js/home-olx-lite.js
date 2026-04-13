(() => {
  const shell = document.getElementById("olxQuickHome");
  if (!shell) return;

  const SEARCH_KEY = "propertysetu:global-search";
  const input = document.getElementById("olxQuickSearchInput");
  const button = document.getElementById("olxQuickSearchBtn");
  const menuButton = shell.querySelector(".olx-menu-btn");

  const persistSearch = () => {
    const query = String(input?.value || "").trim();
    if (!query) return;
    try {
      localStorage.setItem(SEARCH_KEY, query);
    } catch {
      // ignore storage restrictions
    }
  };

  const openMarketplace = () => {
    persistSearch();
    const folders = window.PropertySetuHomeFolders;
    if (folders && typeof folders.openTarget === "function") {
      folders.openTarget("#marketplace", { behavior: "smooth" });
      return;
    }
    window.location.hash = "#marketplace";
  };

  button?.addEventListener("click", openMarketplace);
  input?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    openMarketplace();
  });

  shell.querySelectorAll(".olx-category-strip a[href=\"#marketplace\"]").forEach((link) => {
    link.addEventListener("click", () => {
      persistSearch();
    });
  });

  menuButton?.addEventListener("click", () => {
    const folders = window.PropertySetuHomeFolders;
    if (folders && typeof folders.openFolder === "function") {
      folders.openFolder("discovery", { scrollToFirst: true });
      return;
    }
    document.getElementById("homeFolderNavigator")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
})();
