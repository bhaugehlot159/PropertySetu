(function () {
  const BAR_ID = "propertysetu-app-launch-bar";
  let deferredPrompt = null;

  const createLaunchBar = () => {
    if (document.getElementById(BAR_ID)) {
      return {
        container: document.getElementById(BAR_ID),
        status: document.getElementById(`${BAR_ID}-status`),
        installButton: document.getElementById(`${BAR_ID}-install`)
      };
    }

    const container = document.createElement("div");
    container.id = BAR_ID;
    container.style.position = "fixed";
    container.style.right = "16px";
    container.style.bottom = "16px";
    container.style.zIndex = "9999";
    container.style.width = "min(360px, calc(100vw - 24px))";
    container.style.border = "1px solid #c8daf1";
    container.style.borderRadius = "14px";
    container.style.background = "#ffffff";
    container.style.boxShadow = "0 12px 30px rgba(8, 54, 88, 0.18)";
    container.style.padding = "12px";
    container.style.fontFamily = "Segoe UI, Arial, sans-serif";

    const title = document.createElement("div");
    title.textContent = "App Launch Readiness";
    title.style.fontSize = "13px";
    title.style.fontWeight = "700";
    title.style.color = "#134f79";
    title.style.marginBottom = "8px";

    const status = document.createElement("div");
    status.id = `${BAR_ID}-status`;
    status.textContent = "Checking mobile launch setup...";
    status.style.fontSize = "12px";
    status.style.color = "#285277";
    status.style.lineHeight = "1.35";

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "8px";
    actions.style.marginTop = "10px";

    const installButton = document.createElement("button");
    installButton.id = `${BAR_ID}-install`;
    installButton.type = "button";
    installButton.hidden = true;
    installButton.textContent = "Install App";
    installButton.style.background = "#0f5e95";
    installButton.style.color = "#ffffff";
    installButton.style.border = "none";
    installButton.style.borderRadius = "8px";
    installButton.style.padding = "7px 10px";
    installButton.style.cursor = "pointer";
    installButton.style.fontWeight = "600";

    const openButton = document.createElement("a");
    openButton.href = "propertysetu://open/home";
    openButton.textContent = "Open Deep Link";
    openButton.style.display = "inline-flex";
    openButton.style.alignItems = "center";
    openButton.style.justifyContent = "center";
    openButton.style.textDecoration = "none";
    openButton.style.border = "1px solid #b8cfe9";
    openButton.style.borderRadius = "8px";
    openButton.style.padding = "6px 10px";
    openButton.style.color = "#1d4f77";
    openButton.style.fontSize = "12px";
    openButton.style.fontWeight = "600";

    actions.appendChild(installButton);
    actions.appendChild(openButton);
    container.appendChild(title);
    container.appendChild(status);
    container.appendChild(actions);
    document.body.appendChild(container);

    return { container, status, installButton };
  };

  const ui = createLaunchBar();
  if (!ui?.status || !ui?.installButton) return;

  const setStatus = (message, isReady) => {
    ui.status.textContent = message;
    ui.status.style.color = isReady ? "#1d7f4b" : "#285277";
  };

  const inStandaloneMode = () => {
    const mql = window.matchMedia ? window.matchMedia("(display-mode: standalone)") : null;
    return Boolean(mql?.matches || window.navigator.standalone === true);
  };

  const registerServiceWorker = () => {
    if (!("serviceWorker" in navigator)) {
      return Promise.resolve(false);
    }
    return navigator.serviceWorker.register("/service-worker.js")
      .then(() => true)
      .catch(() => false);
  };

  const loadReadiness = async () => {
    const probes = ["/api/system/app-launch-readiness", "/api/v3/system/app-launch-readiness"];
    for (const endpoint of probes) {
      try {
        const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
        if (!response.ok) continue;
        const payload = await response.json();
        window.PropertySetuAppLaunch = payload;
        const ready = String(payload?.stage || "").toLowerCase() === "launch-ready";
        const platformMessage = ready
          ? "Android/iOS app launch setup ready."
          : "App launch setup in progress. Update package IDs, fingerprints, and team ID.";
        setStatus(platformMessage, ready);
        return true;
      } catch {
        // Try next endpoint.
      }
    }
    setStatus("Readiness API unavailable. Web setup is still active.", false);
    return false;
  };

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    ui.installButton.hidden = false;
  });

  ui.installButton.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } catch {
      // Ignore choice rejection.
    }
    deferredPrompt = null;
    ui.installButton.hidden = true;
  });

  const init = async () => {
    if (inStandaloneMode()) {
      setStatus("Installed mode active. App shell is running.", true);
      return;
    }
    const swReady = await registerServiceWorker();
    if (swReady) {
      setStatus("Web app shell ready. Checking app launch configuration...", false);
    }
    await loadReadiness();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
