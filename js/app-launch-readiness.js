(function () {
  const BAR_ID = "propertysetu-app-launch-bar";
  const HIDE_PREF_KEY = "propertySetu:hideReadinessBar";
  let deferredPrompt = null;

  const hostName = (window.location?.hostname || "").toLowerCase();
  const pathName = (window.location?.pathname || "").toLowerCase();
  const searchParams = new URLSearchParams(window.location?.search || "");
  const forceReadinessBar = searchParams.get("showReadiness") === "1";
  const isStaticPublicHost = /\.github\.io$/i.test(hostName);
  const isReadinessPage = /(admin|deploy|production|checklist|live-platform-app)/i.test(pathName);

  const getHidePreference = () => {
    try {
      return window.localStorage.getItem(HIDE_PREF_KEY) === "1";
    } catch {
      return false;
    }
  };

  const setHidePreference = (hidden) => {
    try {
      if (hidden) window.localStorage.setItem(HIDE_PREF_KEY, "1");
      else window.localStorage.removeItem(HIDE_PREF_KEY);
    } catch {
      // Ignore storage errors in restricted modes.
    }
  };

  if (!forceReadinessBar && getHidePreference()) return;
  if (isStaticPublicHost && !forceReadinessBar && !isReadinessPage) return;

  const createLaunchBar = () => {
    if (document.getElementById(BAR_ID)) {
      return {
        container: document.getElementById(BAR_ID),
        status: document.getElementById(`${BAR_ID}-status`),
        installButton: document.getElementById(`${BAR_ID}-install`),
        dismissButton: document.getElementById(`${BAR_ID}-dismiss`)
      };
    }

    const container = document.createElement("div");
    container.id = BAR_ID;
    container.style.position = "fixed";
    container.style.left = "16px";
    container.style.right = "auto";
    container.style.bottom = "calc(16px + env(safe-area-inset-bottom, 0px))";
    container.style.zIndex = "1440";
    container.style.width = "min(360px, calc(100vw - 24px))";
    container.style.border = "1px solid #c8daf1";
    container.style.borderRadius = "14px";
    container.style.background = "#ffffff";
    container.style.boxShadow = "0 12px 30px rgba(8, 54, 88, 0.18)";
    container.style.padding = "12px";
    container.style.fontFamily = "Segoe UI, Arial, sans-serif";

    const titleRow = document.createElement("div");
    titleRow.style.display = "flex";
    titleRow.style.alignItems = "center";
    titleRow.style.justifyContent = "space-between";
    titleRow.style.gap = "8px";
    titleRow.style.marginBottom = "8px";

    const title = document.createElement("div");
    title.textContent = "App Launch Readiness";
    title.style.fontSize = "13px";
    title.style.fontWeight = "700";
    title.style.color = "#134f79";

    const dismissButton = document.createElement("button");
    dismissButton.id = `${BAR_ID}-dismiss`;
    dismissButton.type = "button";
    dismissButton.textContent = "Hide";
    dismissButton.style.border = "1px solid #c8daf1";
    dismissButton.style.background = "#f7fbff";
    dismissButton.style.borderRadius = "8px";
    dismissButton.style.padding = "4px 8px";
    dismissButton.style.cursor = "pointer";
    dismissButton.style.fontSize = "11px";
    dismissButton.style.fontWeight = "700";
    dismissButton.style.color = "#1d4f77";

    titleRow.appendChild(title);
    titleRow.appendChild(dismissButton);

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
    container.appendChild(titleRow);
    container.appendChild(status);
    container.appendChild(actions);
    document.body.appendChild(container);

    const syncResponsiveLayout = () => {
      if (window.matchMedia("(max-width: 760px)").matches) {
        container.style.left = "8px";
        container.style.width = "calc(100vw - 16px)";
        container.style.bottom = "calc(86px + env(safe-area-inset-bottom, 0px))";
      } else {
        container.style.left = "16px";
        container.style.width = "min(360px, calc(100vw - 24px))";
        container.style.bottom = "calc(16px + env(safe-area-inset-bottom, 0px))";
      }
    };

    syncResponsiveLayout();
    window.addEventListener("resize", syncResponsiveLayout);

    dismissButton.addEventListener("click", () => {
      setHidePreference(true);
      container.remove();
    });

    return { container, status, installButton, dismissButton };
  };

  const ui = createLaunchBar();
  if (!ui?.status || !ui?.installButton) return;
  if (forceReadinessBar) setHidePreference(false);

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
    return navigator.serviceWorker.register("service-worker.js")
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
    if (isStaticPublicHost) {
      setStatus("Public web mode active. Readiness check admin/deploy pages par available hai.", false);
      return false;
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
