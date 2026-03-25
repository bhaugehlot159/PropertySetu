function text(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function toSlug(value) {
  return text(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const DEFAULT_CITIES = ["Udaipur", "Jaipur", "Jodhpur", "Ahmedabad", "Delhi"];

export function getCoreCitySeoStructure(_req, res) {
  const routes = DEFAULT_CITIES.map((city) => ({
    city,
    slug: toSlug(city),
    route: `https://propertysetu.in/${toSlug(city)}`,
    status: city.toLowerCase() === "udaipur" ? "live" : "planned"
  }));

  return res.json({
    success: true,
    baseDomain: "propertysetu.in",
    routePattern: "propertysetu.in/{city-slug}",
    liveCity: routes.find((item) => item.city.toLowerCase() === "udaipur") || routes[0],
    cityRoutes: routes
  });
}
