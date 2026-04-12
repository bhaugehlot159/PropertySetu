(() => {
  const dock = document.getElementById("desktopQuickDock");
  if (!dock) return;

  const input = document.getElementById("dockCommandInput");
  const goButton = document.getElementById("dockCommandGo");
  const jumpLinks = Array.from(dock.querySelectorAll("[data-dock-jump]"));
  const commandRoutes = [
    { keys: ["feature", "finder"], href: "#featureCommandCenter" },
    { keys: ["market", "search", "filter"], href: "#marketplace" },
    { keys: ["wishlist", "compare", "emi", "tools"], href: "#decisionTools" },
    { keys: ["visit", "chat", "user"], href: "user-dashboard.html" },
    { keys: ["post", "sell", "upload"], href: "add-property.html" },
    { keys: ["seller"], href: "seller-dashboard.html" },
    { keys: ["admin", "verify", "moderation"], href: "admin-dashboard.html" },
    { keys: ["plan", "subscription", "payment"], href: "subscription.html" },
    { keys: ["bid", "auction", "sealed"], href: "auction.html" },
  ];

  const normalize = (value = "") =>
    String(value || "")
      .trim()
      .toLowerCase();

  const goTo = (href = "") => {
    if (!href) return;
    if (href.startsWith("#")) {
      const folderApi = window.PropertySetuHomeFolders;
      if (folderApi && typeof folderApi.openTarget === "function" && folderApi.openTarget(href, { behavior: "smooth" })) {
        return;
      }
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }
    window.location.href = href;
  };

  const resolveCommandHref = (value = "") => {
    const query = normalize(value);
    if (!query) return "";
    for (const route of commandRoutes) {
      if (route.keys.some((key) => query.includes(key))) return route.href;
    }
    return "";
  };

  const setActiveJump = (id = "") => {
    jumpLinks.forEach((link) => {
      const target = String(link.getAttribute("data-target") || "");
      link.classList.toggle("active", target === id);
    });
  };

  const sections = jumpLinks
    .map((link) => document.getElementById(String(link.getAttribute("data-target") || "")))
    .filter(Boolean);

  let ticking = false;
  const evaluateActive = () => {
    const focusY = window.scrollY + window.innerHeight * 0.24;
    const visibleSections = sections.filter((section) => !section.hidden);
    let activeId = String((visibleSections[0] || sections[0])?.id || jumpLinks[0]?.getAttribute("data-target") || "");
    visibleSections.forEach((section) => {
      if (section.offsetTop <= focusY) activeId = section.id;
    });
    setActiveJump(activeId);
    ticking = false;
  };

  const scheduleEvaluate = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(evaluateActive);
  };

  jumpLinks.forEach((link) => {
    link.addEventListener("click", () => {
      setActiveJump(String(link.getAttribute("data-target") || ""));
    });
  });

  const submitCommand = () => {
    const href = resolveCommandHref(input?.value);
    if (!href) return;
    goTo(href);
  };

  goButton?.addEventListener("click", submitCommand);
  input?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    submitCommand();
  });

  window.addEventListener("scroll", scheduleEvaluate, { passive: true });
  window.addEventListener("resize", scheduleEvaluate);
  evaluateActive();
})();
