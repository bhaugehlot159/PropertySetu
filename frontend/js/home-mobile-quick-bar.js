(() => {
  const bar = document.getElementById("mobileQuickBar");
  if (!bar) return;

  const jumpLinks = Array.from(bar.querySelectorAll("[data-mobile-jump]"));
  const sections = jumpLinks
    .map((link) => document.getElementById(String(link.getAttribute("data-target") || "")))
    .filter(Boolean);

  if (!jumpLinks.length || !sections.length) return;

  const setActive = (id = "") => {
    jumpLinks.forEach((link) => {
      const target = String(link.getAttribute("data-target") || "");
      link.classList.toggle("active", target === id);
    });
  };

  let ticking = false;
  const evaluateActiveSection = () => {
    const focusY = window.scrollY + window.innerHeight * 0.28;
    let activeId = String(jumpLinks[0].getAttribute("data-target") || "");
    sections.forEach((section) => {
      if (section.offsetTop <= focusY) activeId = section.id;
    });
    setActive(activeId);
    ticking = false;
  };

  const handleScroll = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(evaluateActiveSection);
  };

  jumpLinks.forEach((link) => {
    link.addEventListener("click", () => {
      setActive(String(link.getAttribute("data-target") || ""));
    });
  });

  window.addEventListener("scroll", handleScroll, { passive: true });
  window.addEventListener("resize", handleScroll);
  evaluateActiveSection();
})();
