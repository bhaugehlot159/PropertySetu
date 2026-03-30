(() => {
  const live = window.PropertySetuLive || {};
  const capabilityStatus = document.getElementById("capabilityStatus");
  const capabilityList = document.getElementById("capabilityList");
  const rootStatus = document.getElementById("rootStatus");
  const rootRouteList = document.getElementById("rootRouteList");
  const healthStatus = document.getElementById("healthStatus");
  const healthList = document.getElementById("healthList");
  const uploadProbeName = document.getElementById("uploadProbeName");
  const runUploadProbeBtn = document.getElementById("runUploadProbeBtn");
  const uploadProbeStatus = document.getElementById("uploadProbeStatus");
  const matrixSummary = document.getElementById("matrixSummary");
  const featureMatrixBody = document.getElementById("featureMatrixBody");
  const matrixTimeline = document.getElementById("matrixTimeline");

  if (!live.request) return;

  const state = {
    capabilities: {},
    modules: {},
    routes: [],
    health: null,
    plans: [],
    bootstrap: null,
    aiProbeOk: false,
    reviewProbeOk: false,
    ownerVerificationProbe: { available: false, authRequired: false, message: "Not checked" },
  };

  const setPill = (el, text, ok = true) => {
    if (!el) return;
    el.innerHTML = `<span class="pill ${ok ? "ok" : "err"}">${text}</span>`;
  };

  const renderPairs = (el, pairs) => {
    if (!el) return;
    el.innerHTML = pairs.map((line) => `<li>${line}</li>`).join("");
  };

  const toSampleBase64 = (text) => {
    try {
      return btoa(unescape(encodeURIComponent(text)));
    } catch {
      return btoa(text);
    }
  };
  const SAMPLE_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2fR2wAAAAASUVORK5CYII=";

  const hasRoute = (path) => state.routes.some((route) => route.path === path);
  const capabilityEnabled = (key) => Boolean(state.capabilities?.[key]);
  const moduleAvailable = (key) => Boolean(state.modules?.[key]);

  const probeAuthEndpoint = async (path) => {
    try {
      const token = live.getAnyToken ? live.getAnyToken() : "";
      await live.request(path, { token });
      return { available: true, authRequired: false, message: "Endpoint responded successfully." };
    } catch (error) {
      const message = String(error?.message || "").toLowerCase();
      const authRequired = Number(error?.status) === 401
        || Number(error?.status) === 403
        || message.includes("missing auth token")
        || message.includes("invalid or expired token")
        || message.includes("admin access required");
      if (authRequired) {
        return { available: true, authRequired: true, message: "Endpoint is live and access controlled by auth." };
      }
      return { available: false, authRequired: false, message: error?.message || "Endpoint failed." };
    }
  };

  const loadCapability = async () => {
    try {
      const response = await live.request("/system/capabilities");
      state.capabilities = response?.capabilities || {};
      state.modules = response?.modules || {};
      const lines = Object.entries(state.capabilities).map(([key, value]) => `${key}: ${value ? "Enabled" : "Disabled"}`);
      renderPairs(capabilityList, lines);
      setPill(capabilityStatus, "Capability API live", true);
    } catch (error) {
      setPill(capabilityStatus, `Capability API failed: ${error.message || "Unknown"}`, false);
    }
  };

  const loadRoots = async () => {
    try {
      const response = await live.request("/system/live-roots");
      state.routes = Array.isArray(response?.routes) ? response.routes : [];
      const lines = state.routes.slice(0, 40).map((route) => `${route.path} -> ${route.file} (${route.live ? "live" : "future-ready"})`);
      renderPairs(rootRouteList, lines.length ? lines : ["No mapped routes found"]);
      setPill(rootStatus, `${response?.frontendMode || "unknown"} | frontend root ${response?.frontendRoot || "-"}`, true);
    } catch (error) {
      setPill(rootStatus, `Live root API failed: ${error.message || "Unknown"}`, false);
    }
  };

  const loadHealth = async () => {
    try {
      const response = await live.request("/health");
      state.health = response || null;
      const c = response?.counts || {};
      renderPairs(healthList, [
        `Users: ${c.users || 0}`,
        `Properties: ${c.properties || 0}`,
        `Reviews: ${c.reviews || 0}`,
        `Messages: ${c.messages || 0}`,
        `Subscriptions: ${c.subscriptions || 0}`,
        `Bids: ${c.bids || 0}`,
      ]);
      setPill(healthStatus, `API health live | uptime ${response?.uptimeSeconds || 0}s`, true);
    } catch (error) {
      setPill(healthStatus, `Health API failed: ${error.message || "Unknown"}`, false);
    }
  };

  const runUploadProbe = async () => {
    const token = live.getAnyToken ? live.getAnyToken() : "";
    if (!token) {
      setPill(uploadProbeStatus, "Upload probe requires login token", false);
      return;
    }
    const nameRaw = String(uploadProbeName?.value || "").trim() || "sample-upload.png";
    const safeName = /\.png$/i.test(nameRaw) ? nameRaw : `${nameRaw.replace(/\.[^.]+$/, "")}.png`;
    const body = `PropertySetu upload probe at ${new Date().toISOString()}`;
    const base64 = SAMPLE_PNG_BASE64 || toSampleBase64(body);
    try {
      const response = await live.request("/uploads/property-media", {
        method: "POST",
        token,
        data: {
          files: [
            {
              name: safeName,
              type: "image/png",
              category: "probe",
              dataBase64: base64,
            },
          ],
        },
      });
      const first = Array.isArray(response?.items) ? response.items[0] : null;
      setPill(uploadProbeStatus, `Upload probe live success (${first?.url || "saved"})`, true);
    } catch (error) {
      setPill(uploadProbeStatus, `Upload probe failed: ${error.message || "Unknown"}`, false);
    }
  };

  const loadSupplementary = async () => {
    const probePropertyId = (() => {
      const localListings = (live.readJson ? live.readJson('propertySetu:listings', []) : []);
      const first = Array.isArray(localListings) ? localListings.find((item) => item?.id) : null;
      return String(first?.id || '').trim();
    })();
    const [plansResult, bootstrapResult, aiResult, reviewResult, ownerVerificationResult] = await Promise.all([
      live.request("/subscriptions/plans").catch(() => null),
      live.request("/bootstrap").catch(() => null),
      live.request("/ai/market-trend?locality=Udaipur").catch(() => null),
      (probePropertyId ? live.request(`/reviews/${encodeURIComponent(probePropertyId)}`).catch(() => null) : Promise.resolve(null)),
      probeAuthEndpoint("/owner-verification/me"),
    ]);
    state.plans = Array.isArray(plansResult?.plans) ? plansResult.plans : [];
    state.bootstrap = bootstrapResult || null;
    state.aiProbeOk = Boolean(aiResult?.ok || Array.isArray(aiResult?.trend));
    state.reviewProbeOk = Boolean(reviewResult?.ok || Array.isArray(reviewResult?.items));
    state.ownerVerificationProbe = ownerVerificationResult;
  };

  const getStatus = (tests) => {
    const total = tests.length;
    const passed = tests.filter((test) => test.ok).length;
    if (!total) return { label: "Missing", className: "missing", passed, total };
    if (passed === total) return { label: "Live", className: "live", passed, total };
    if (passed > 0) return { label: "Partial", className: "partial", passed, total };
    return { label: "Missing", className: "missing", passed, total };
  };

  const rowToHtml = (row) => {
    const status = getStatus(row.tests || []);
    const signals = (row.tests || [])
      .map((test) => `${test.ok ? "OK" : "MISS"} - ${test.label}`)
      .join("<br>");
    const links = (row.links || [])
      .map((link) => `<a href="${link.href}">${link.label}</a>`)
      .join("");
    return {
      status,
      html: `
        <tr>
          <td><b>${row.title}</b><br><small>${row.note || ""}</small></td>
          <td><span class="stack-chip ${status.className}">${status.label}</span><br><small>${status.passed}/${status.total} checks</small></td>
          <td>${signals}</td>
          <td><span class="matrix-links">${links}</span></td>
        </tr>
      `,
    };
  };

  const renderFeatureMatrix = () => {
    if (!featureMatrixBody) return;

    const legalTemplates = Array.isArray(state.bootstrap?.legalTemplates) ? state.bootstrap.legalTemplates : [];
    const featuredPricing = state.bootstrap?.featuredPricing && typeof state.bootstrap.featuredPricing === "object";

    const rows = [
      {
        title: "User Dashboard",
        note: "Wishlist, visit booking, chat and user-side actions",
        tests: [
          { label: "Route mapped (/customer-dashboard)", ok: hasRoute("/customer-dashboard") },
          { label: "Secure chat capability enabled", ok: capabilityEnabled("secureChat") },
          { label: "Backend system enabled", ok: capabilityEnabled("backendSystem") },
        ],
        links: [
          { label: "Open User Dashboard", href: "../user-dashboard.html" },
        ],
      },
      {
        title: "Add Property Form",
        note: "Multi-step listing form with advanced structure",
        tests: [
          { label: "Route mapped (/add-property)", ok: hasRoute("/add-property") },
          { label: "Backend listing module available", ok: moduleAvailable("listings") },
          { label: "Multi-page app capability enabled", ok: capabilityEnabled("multipageWebApp") },
        ],
        links: [
          { label: "Open Add Property", href: "../add-property.html" },
        ],
      },
      {
        title: "Photo Upload",
        note: "Minimum photo validation + upload pipeline",
        tests: [
          { label: "File upload handling enabled", ok: capabilityEnabled("fileUploadHandling") },
          { label: "Upload API module available", ok: moduleAvailable("mediaUpload") },
          { label: "Upload probe tool available on this page", ok: true },
        ],
        links: [
          { label: "Open Add Property", href: "../add-property.html" },
        ],
      },
      {
        title: "Video Upload",
        note: "Short video workflow for virtual/live visit",
        tests: [
          { label: "File upload handling enabled", ok: capabilityEnabled("fileUploadHandling") },
          { label: "Add property route mapped", ok: hasRoute("/add-property") },
          { label: "Media upload module available", ok: moduleAvailable("mediaUpload") },
        ],
        links: [
          { label: "Open Add Property", href: "../add-property.html" },
        ],
      },
      {
        title: "Verification System",
        note: "Owner KYC + admin review + status workflow",
        tests: [
          { label: "Verification capability enabled", ok: capabilityEnabled("verificationLogic") },
          { label: "Owner verification module available", ok: moduleAvailable("ownerVerification") },
          { label: "Owner verification endpoint live (auth-gated)", ok: state.ownerVerificationProbe.available },
        ],
        links: [
          { label: "Open Add Property", href: "../add-property.html" },
          { label: "Open Admin Dashboard", href: "../admin-dashboard.html" },
        ],
      },
      {
        title: "Reviews System",
        note: "Property feedback + ratings endpoints",
        tests: [
          { label: "Reviews module mapped", ok: moduleAvailable("reviews") },
          { label: "Review probe endpoint responsive", ok: state.reviewProbeOk },
          { label: "Property details route mapped", ok: hasRoute("/property-details") },
        ],
        links: [
          { label: "Open Property Details", href: "../property-details.html" },
        ],
      },
      {
        title: "Featured Listing System",
        note: "Admin featured controls + pricing model",
        tests: [
          { label: "Subscription logic enabled", ok: capabilityEnabled("subscriptionLogic") },
          { label: "Featured pricing config available", ok: featuredPricing },
          { label: "Admin dashboard route mapped", ok: hasRoute("/admin-dashboard") },
        ],
        links: [
          { label: "Open Admin Dashboard", href: "../admin-dashboard.html" },
          { label: "Open Subscriptions", href: "../subscription.html" },
        ],
      },
      {
        title: "Legal Pages",
        note: "Terms, Privacy, Refund, Service Agreement",
        tests: [
          { label: "Legal help route mapped", ok: hasRoute("/legal-help") },
          { label: "Legal templates available in bootstrap", ok: legalTemplates.length > 0 },
          { label: "Multi-page app capability enabled", ok: capabilityEnabled("multipageWebApp") },
        ],
        links: [
          { label: "Terms", href: "../legal/terms.html" },
          { label: "Privacy", href: "../legal/privacy.html" },
          { label: "Refund", href: "../legal/refund.html" },
          { label: "Service Agreement", href: "../legal/service-agreement.html" },
        ],
      },
      {
        title: "Subscription Plans",
        note: "Basic/Pro/Premium + featured subscriptions",
        tests: [
          { label: "Subscription module mapped", ok: moduleAvailable("subscriptions") },
          { label: "Plans API responded", ok: state.plans.length > 0 },
          { label: "Subscription logic enabled", ok: capabilityEnabled("subscriptionLogic") },
        ],
        links: [
          { label: "Open Subscription", href: "../subscription.html" },
        ],
      },
      {
        title: "AI Features",
        note: "Pricing suggestion, description, fraud scan, trend, recommendations",
        tests: [
          { label: "AI integration capability enabled", ok: capabilityEnabled("aiIntegration") },
          { label: "AI module mapped", ok: moduleAvailable("ai") || Array.isArray(state.modules?.ai) },
          { label: "AI market trend probe responsive", ok: state.aiProbeOk },
        ],
        links: [
          { label: "Open Marketplace", href: "../index.html#marketplace" },
          { label: "Open Add Property AI", href: "../add-property.html" },
        ],
      },
    ];

    const rendered = rows.map((row) => rowToHtml(row));
    featureMatrixBody.innerHTML = rendered.map((row) => row.html).join("");

    const liveCount = rendered.filter((row) => row.status.className === "live").length;
    const partialCount = rendered.filter((row) => row.status.className === "partial").length;
    const missingCount = rendered.filter((row) => row.status.className === "missing").length;

    if (matrixSummary) {
      matrixSummary.innerHTML = [
        `<span class="stack-chip live">Live ${liveCount}</span>`,
        `<span class="stack-chip partial">Partial ${partialCount}</span>`,
        `<span class="stack-chip missing">Missing ${missingCount}</span>`,
      ].join(" ");
    }
    if (matrixTimeline) {
      const verificationMode = state.ownerVerificationProbe.authRequired ? "auth-gated endpoint check included" : "direct endpoint check included";
      matrixTimeline.textContent = `Last refreshed: ${new Date().toLocaleString()} | Verification mode: ${verificationMode}.`;
    }
  };

  const boot = async () => {
    await Promise.all([
      loadCapability(),
      loadRoots(),
      loadHealth(),
      loadSupplementary(),
    ]);
    renderFeatureMatrix();
  };

  runUploadProbeBtn?.addEventListener("click", runUploadProbe);
  boot();
})();
