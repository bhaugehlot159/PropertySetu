(() => {
  const nav = document.querySelector(".home-top-nav");
  if (!nav) return;

  const groups = Array.from(nav.querySelectorAll(".nav-group"));
  if (!groups.length) return;

  const closeAll = (except = null) => {
    groups.forEach((group) => {
      if (group === except) return;
      group.removeAttribute("open");
    });
  };

  groups.forEach((group) => {
    group.addEventListener("toggle", () => {
      if (!group.open) return;
      closeAll(group);
    });

    group.querySelectorAll(".nav-group-menu a").forEach((link) => {
      link.addEventListener("click", () => closeAll(null));
    });
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (nav.contains(target)) return;
    closeAll(null);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    closeAll(null);
  });
})();
