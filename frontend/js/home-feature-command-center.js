(() => {
  const grid = document.getElementById("featureFinderGrid");
  if (!grid) return;

  const input = document.getElementById("featureFinderInput");
  const roleFilter = document.getElementById("featureRoleFilter");
  const resetButton = document.getElementById("featureFinderReset");
  const chips = Array.from(document.querySelectorAll("[data-feature-chip]"));
  const meta = document.getElementById("featureFinderMeta");
  const empty = document.getElementById("featureFinderEmpty");
  const cards = Array.from(grid.querySelectorAll("[data-feature-card]"));

  const normalize = (value = "") =>
    String(value || "")
      .trim()
      .toLowerCase();

  const tokenize = (value = "") =>
    normalize(value)
      .split(/\s+/)
      .filter(Boolean);

  const setMeta = (visible, total, role, query) => {
    if (!meta) return;
    const roleLabel = role === "all" ? "all roles" : role;
    if (!query) {
      meta.textContent = `Showing ${visible}/${total} features (${roleLabel}).`;
      return;
    }
    meta.textContent = `Showing ${visible}/${total} features for "${query}" in ${roleLabel}.`;
  };

  const clearChipActive = () => {
    chips.forEach((chip) => chip.classList.remove("active"));
  };

  const applyFilters = () => {
    const query = normalize(input?.value);
    const tokens = tokenize(query);
    const role = normalize(roleFilter?.value || "all");
    let visible = 0;

    cards.forEach((card) => {
      const roles = tokenize(card.getAttribute("data-role"));
      const haystack = normalize(`${card.getAttribute("data-tags")} ${card.textContent}`);
      const roleMatch = role === "all" || roles.includes(role);
      const queryMatch = !tokens.length || tokens.every((token) => haystack.includes(token));
      const show = roleMatch && queryMatch;
      card.hidden = !show;
      if (show) visible += 1;
    });

    setMeta(visible, cards.length, role, query);
    if (empty) empty.hidden = visible > 0;
  };

  input?.addEventListener("input", () => {
    clearChipActive();
    applyFilters();
  });

  roleFilter?.addEventListener("change", applyFilters);

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      clearChipActive();
      chip.classList.add("active");
      if (input) input.value = String(chip.getAttribute("data-chip-query") || "").trim();
      applyFilters();
      grid.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  resetButton?.addEventListener("click", () => {
    if (input) input.value = "";
    if (roleFilter) roleFilter.value = "all";
    clearChipActive();
    applyFilters();
  });

  applyFilters();
})();
