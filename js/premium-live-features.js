(() => {
  const live = window.PropertySetuLive || {};
  const ACTION_FEED_KEY = "propertySetu:premiumActionFeed";
  const LISTINGS_KEY = "propertySetu:listings";

  const visitPropertySelect = document.getElementById("visitPropertySelect");
  const tokenPropertySelect = document.getElementById("tokenPropertySelect");
  const subscriptionPropertySelect = document.getElementById("subscriptionPropertySelect");
  const visitPropertyIdInput = document.getElementById("visitPropertyId");
  const tokenPropertyIdInput = document.getElementById("tokenPropertyId");
  const scheduleVisitBtn = document.getElementById("scheduleVisitBtn");
  const activateCareSubscriptionBtn = document.getElementById("activateCareSubscriptionBtn");
  const createCareRequestBtn = document.getElementById("createCareRequestBtn");
  const carePlanSelect = document.getElementById("carePlanSelect");
  const careStatus = document.getElementById("careStatus");
  const premiumActionFeed = document.getElementById("premiumActionFeed");

  if (!visitPropertySelect && !tokenPropertySelect && !subscriptionPropertySelect) return;

  const readJson = live.readJson || ((key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  });

  const writeJson = live.writeJson || ((key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // no-op
    }
  });

  const text = (value) => String(value || "").trim();
  const numberFrom = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const hasLive = () => !!(live.request && live.getAnyToken && live.getAnyToken());
  const formatPrice = (price) => `₹${numberFrom(price, 0).toLocaleString("en-IN")}`;
  const nowLabel = () => new Date().toLocaleString("en-IN");
  const mapPlanToName = (id) => ({
    "care-basic": "Basic Visit",
    "care-plus": "Cleaning + Visit",
    "care-full": "Full Maintenance",
  }[id] || id);

  const pushFeed = (message) => {
    const items = readJson(ACTION_FEED_KEY, []);
    const next = Array.isArray(items) ? items : [];
    next.unshift({ message, at: new Date().toISOString() });
    while (next.length > 40) next.pop();
    writeJson(ACTION_FEED_KEY, next);
    renderFeed();
  };

  const renderFeed = () => {
    if (!premiumActionFeed) return;
    const items = readJson(ACTION_FEED_KEY, []);
    premiumActionFeed.innerHTML = Array.isArray(items) && items.length
      ? items.slice(0, 10).map((item) => `<li>${item.message} <small>(${new Date(item.at).toLocaleString("en-IN")})</small></li>`).join("")
      : "<li>No premium actions yet.</li>";
  };

  const getFallbackListings = () => {
    const local = readJson(LISTINGS_KEY, []);
    return (Array.isArray(local) ? local : [])
      .filter((item) => String(item?.city || "Udaipur").toLowerCase().includes("udaipur"))
      .map((item) => ({
        id: text(item.id),
        title: text(item.title || "Property"),
        locality: text(item.location || item.locality || "Udaipur"),
        price: numberFrom(item.price, 0),
      }))
      .filter((item) => item.id);
  };

  const fetchListings = async () => {
    if (!live.request) return getFallbackListings();
    try {
      const response = await live.request("/properties?city=Udaipur");
      const items = Array.isArray(response?.items) ? response.items : [];
      const normalized = items.map((item) => ({
        id: text(item.id),
        title: text(item.title || "Property"),
        locality: text(item.location || item.locality || "Udaipur"),
        price: numberFrom(item.price, 0),
      })).filter((item) => item.id);
      if (normalized.length) return normalized;
    } catch {
      // fallback below
    }
    return getFallbackListings();
  };

  const optionHtml = (item) => `<option value="${item.id}">${item.title} • ${item.locality} • ${formatPrice(item.price)}</option>`;

  const hydrateSelect = (selectEl, items, includeEmpty = true, emptyLabel = "Select property") => {
    if (!selectEl) return;
    const head = includeEmpty ? `<option value="">${emptyLabel}</option>` : "";
    selectEl.innerHTML = head + items.map(optionHtml).join("");
  };

  const syncSelectedIds = () => {
    const visitId = text(visitPropertySelect?.value);
    const tokenId = text(tokenPropertySelect?.value);
    if (visitId && visitPropertyIdInput) visitPropertyIdInput.value = visitId;
    if (tokenId && tokenPropertyIdInput) tokenPropertyIdInput.value = tokenId;
  };

  const setCareStatus = (message, ok = true) => {
    if (!careStatus) return;
    careStatus.style.color = ok ? "#1f6d3d" : "#8d1e1e";
    careStatus.textContent = message;
  };

  const scheduleVisit = async () => {
    const propertyId = text(visitPropertyIdInput?.value || visitPropertySelect?.value);
    const dateInput = document.getElementById("visitDate");
    const preferredAt = text(dateInput?.value) || new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString();
    if (!propertyId) {
      pushFeed("Schedule Visit failed: property id missing.");
      return;
    }
    if (!hasLive()) {
      pushFeed(`Schedule Visit queued local (${propertyId}) at ${nowLabel()}.`);
      return;
    }
    try {
      await live.request(`/properties/${encodeURIComponent(propertyId)}/visit`, {
        method: "POST",
        token: live.getAnyToken(),
        data: {
          preferredAt: preferredAt.includes("T") ? new Date(preferredAt).toISOString() : preferredAt,
          note: "Scheduled from Premium Feature Ideas panel",
        },
      });
      pushFeed(`Schedule Visit live booked (${propertyId}) at ${nowLabel()}.`);
    } catch (error) {
      pushFeed(`Schedule Visit failed (${propertyId}): ${error.message || "Unknown error"}`);
    }
  };

  const activateCareSubscription = async () => {
    const planId = text(carePlanSelect?.value || "care-basic");
    const propertyId = text(subscriptionPropertySelect?.value);
    if (!hasLive()) {
      setCareStatus("Login required for live care subscription.", false);
      pushFeed(`Care subscription pending login (${mapPlanToName(planId)}).`);
      return;
    }
    try {
      await live.request("/subscriptions/activate", {
        method: "POST",
        token: live.getAnyToken(),
        data: {
          planId,
          propertyId: propertyId || undefined,
        },
      });
      setCareStatus(`Care subscription activated: ${mapPlanToName(planId)}.`, true);
      pushFeed(`Care subscription activated live (${mapPlanToName(planId)}) at ${nowLabel()}.`);
    } catch (error) {
      setCareStatus(`Care subscription failed: ${error.message || "Unknown error"}`, false);
      pushFeed(`Care subscription failed (${mapPlanToName(planId)}): ${error.message || "Unknown error"}`);
    }
  };

  const createCareRequest = async () => {
    const planId = text(carePlanSelect?.value || "care-basic");
    const propertyId = text(subscriptionPropertySelect?.value || visitPropertyIdInput?.value);
    if (!propertyId) {
      setCareStatus("Property select karein to create care request.", false);
      pushFeed("Care request failed: property missing.");
      return;
    }
    if (!hasLive()) {
      setCareStatus("Login required for live care request.", false);
      pushFeed(`Care request queued local (${propertyId}) at ${nowLabel()}.`);
      return;
    }
    try {
      await live.request("/property-care/requests", {
        method: "POST",
        token: live.getAnyToken(),
        data: {
          planId,
          propertyId,
          location: "Udaipur",
          notes: "Care request from Premium Feature Ideas panel",
        },
      });
      setCareStatus(`Care service request submitted (${mapPlanToName(planId)}).`, true);
      pushFeed(`Care request submitted live (${propertyId}) at ${nowLabel()}.`);
    } catch (error) {
      setCareStatus(`Care request failed: ${error.message || "Unknown error"}`, false);
      pushFeed(`Care request failed (${propertyId}): ${error.message || "Unknown error"}`);
    }
  };

  const init = async () => {
    const listings = await fetchListings();
    hydrateSelect(visitPropertySelect, listings, true, "Select property for visit");
    hydrateSelect(tokenPropertySelect, listings, true, "Select property for token");
    hydrateSelect(subscriptionPropertySelect, listings, true, "Select property for care (optional)");
    syncSelectedIds();
    renderFeed();
  };

  visitPropertySelect?.addEventListener("change", syncSelectedIds);
  tokenPropertySelect?.addEventListener("change", syncSelectedIds);
  scheduleVisitBtn?.addEventListener("click", scheduleVisit);
  activateCareSubscriptionBtn?.addEventListener("click", activateCareSubscription);
  createCareRequestBtn?.addEventListener("click", createCareRequest);

  init();
})();

