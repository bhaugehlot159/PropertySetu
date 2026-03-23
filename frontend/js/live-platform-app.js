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

  if (!live.request) return;

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

  const loadCapability = async () => {
    try {
      const response = await live.request("/system/capabilities");
      const capabilities = response?.capabilities || {};
      const lines = Object.entries(capabilities).map(([key, value]) => `${key}: ${value ? "Enabled" : "Disabled"}`);
      renderPairs(capabilityList, lines);
      setPill(capabilityStatus, "Capability API live", true);
    } catch (error) {
      setPill(capabilityStatus, `Capability API failed: ${error.message || "Unknown"}`, false);
    }
  };

  const loadRoots = async () => {
    try {
      const response = await live.request("/system/live-roots");
      const routes = Array.isArray(response?.routes) ? response.routes : [];
      const lines = routes.slice(0, 40).map((route) => `${route.path} -> ${route.file} (${route.live ? "live" : "future-ready"})`);
      renderPairs(rootRouteList, lines.length ? lines : ["No mapped routes found"]);
      setPill(rootStatus, `${response?.frontendMode || "unknown"} | frontend root ${response?.frontendRoot || "-"}`, true);
    } catch (error) {
      setPill(rootStatus, `Live root API failed: ${error.message || "Unknown"}`, false);
    }
  };

  const loadHealth = async () => {
    try {
      const response = await live.request("/health");
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

  runUploadProbeBtn?.addEventListener("click", runUploadProbe);
  loadCapability();
  loadRoots();
  loadHealth();
})();
