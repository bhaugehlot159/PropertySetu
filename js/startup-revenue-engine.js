(() => {
  const live = window.PropertySetuLive || {};
  if (!document.getElementById("srEnginePulseStatus")) return;

  const FEED_KEY = "propertySetu:startupRevenueFeed";
  const SNAPSHOT_KEY = "propertySetu:startupRevenueSnapshot";

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

  const text = live.text || ((value, fallback = "") => {
    const normalized = String(value || "").trim();
    return normalized || fallback;
  });

  const numberFrom = live.numberFrom || ((value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  });

  const toItems = (payload) => (Array.isArray(payload?.items) ? payload.items : []);
  const hasLiveRequest = () => typeof live.request === "function";
  const getToken = () => (typeof live.getAnyToken === "function" ? text(live.getAnyToken()) : "");

  const fallbackDocs = [
    { id: "agreement-service", name: "Agreement Drafting Service" },
    { id: "registry-service", name: "Registry Support Service" },
    { id: "legal-help-service", name: "Legal Help Service" }
  ];

  const fallbackBanks = [
    { id: "hdfc", name: "HDFC Bank" },
    { id: "sbi", name: "State Bank of India" },
    { id: "icici", name: "ICICI Bank" }
  ];

  const fallbackEcosystemServices = [
    { id: "movers-packers", name: "Movers & Packers Booking" },
    { id: "interior-designer", name: "Interior Designer Booking" }
  ];

  const ui = {
    pulseStatus: document.getElementById("srEnginePulseStatus"),
    kpiGrid: document.getElementById("srEngineKpiGrid"),
    feed: document.getElementById("srEngineFeed"),
    refreshBtn: document.getElementById("srEngineRefreshBtn"),

    docService: document.getElementById("srDocService"),
    docPropertyId: document.getElementById("srDocPropertyId"),
    docDetails: document.getElementById("srDocDetails"),
    docSubmitBtn: document.getElementById("srDocSubmitBtn"),
    docStatus: document.getElementById("srDocStatus"),

    loanBank: document.getElementById("srLoanBank"),
    loanAmount: document.getElementById("srLoanAmount"),
    propertyValue: document.getElementById("srPropertyValue"),
    loanLocality: document.getElementById("srLoanLocality"),
    loanSubmitBtn: document.getElementById("srLoanSubmitBtn"),
    loanStatus: document.getElementById("srLoanStatus"),

    ecoService: document.getElementById("srEcoService"),
    ecoPropertyId: document.getElementById("srEcoPropertyId"),
    ecoLocality: document.getElementById("srEcoLocality"),
    ecoDate: document.getElementById("srEcoDate"),
    ecoBudget: document.getElementById("srEcoBudget"),
    ecoSubmitBtn: document.getElementById("srEcoSubmitBtn"),
    ecoStatus: document.getElementById("srEcoStatus"),

    insuranceCompany: document.getElementById("srInsuranceCompany"),
    insuranceType: document.getElementById("srInsuranceType"),
    coverageAmount: document.getElementById("srCoverageAmount"),
    insuranceSubmitBtn: document.getElementById("srInsuranceSubmitBtn"),
    insuranceStatus: document.getElementById("srInsuranceStatus"),

    valuationLocality: document.getElementById("srValuationLocality"),
    valuationType: document.getElementById("srValuationType"),
    valuationArea: document.getElementById("srValuationArea"),
    valuationBeds: document.getElementById("srValuationBeds"),
    valuationAge: document.getElementById("srValuationAge"),
    valuationRunBtn: document.getElementById("srValuationRunBtn"),
    valuationStatus: document.getElementById("srValuationStatus"),

    franchiseCity: document.getElementById("srFranchiseCity"),
    franchiseBudget: document.getElementById("srFranchiseBudget"),
    franchiseExperience: document.getElementById("srFranchiseExperience"),
    franchiseSubmitBtn: document.getElementById("srFranchiseSubmitBtn"),
    franchiseStatus: document.getElementById("srFranchiseStatus"),

    rentOwner: document.getElementById("srRentOwner"),
    rentTenant: document.getElementById("srRentTenant"),
    rentAddress: document.getElementById("srRentAddress"),
    rentAmount: document.getElementById("srRentAmount"),
    rentDeposit: document.getElementById("srRentDeposit"),
    rentGenerateBtn: document.getElementById("srRentGenerateBtn"),
    rentDraft: document.getElementById("srRentDraft"),
    rentStatus: document.getElementById("srRentStatus")
  };

  const escapeHtml = (value) => String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const formatDate = (value) => {
    const date = new Date(value || "");
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  };

  const setStatus = (el, message, ok = true) => {
    if (!el) return;
    el.style.color = ok ? "#1f6d3d" : "#8d1e1e";
    el.textContent = message;
  };

  const renderFeed = () => {
    if (!ui.feed) return;
    const items = readJson(FEED_KEY, []);
    if (!Array.isArray(items) || !items.length) {
      ui.feed.innerHTML = "<li>No startup revenue actions yet.</li>";
      return;
    }
    ui.feed.innerHTML = items.slice(0, 25).map((item) => {
      const label = text(item?.label, "Action");
      const detail = text(item?.detail, "");
      const at = formatDate(item?.at);
      return `<li><b>${escapeHtml(label)}</b>${detail ? ` - ${escapeHtml(detail)}` : ""}<br><small>${escapeHtml(at)}</small></li>`;
    }).join("");
  };

  const pushFeed = (label, detail = "") => {
    const current = readJson(FEED_KEY, []);
    const next = Array.isArray(current) ? current : [];
    next.unshift({
      label: text(label, "Action"),
      detail: text(detail),
      at: new Date().toISOString()
    });
    while (next.length > 80) next.pop();
    writeJson(FEED_KEY, next);
    renderFeed();
  };

  const kpiMeta = [
    { key: "documentation", label: "Documentation" },
    { key: "loan", label: "Loan Leads" },
    { key: "booking", label: "Ecosystem Bookings" },
    { key: "insuranceTieups", label: "Insurance Tie-ups" },
    { key: "tenantDamage", label: "Tenant Damage" },
    { key: "rentDrafts", label: "Rent Drafts" },
    { key: "franchise", label: "Franchise Leads" },
    { key: "openPipeline", label: "Open Pipeline" }
  ];

  const renderKpis = (metrics = {}) => {
    if (!ui.kpiGrid) return;
    ui.kpiGrid.innerHTML = kpiMeta.map((item) => (
      `<div class="kpi"><small>${escapeHtml(item.label)}</small><b>${Number(numberFrom(metrics[item.key], 0)).toLocaleString("en-IN")}</b></div>`
    )).join("");
  };

  const fillSelect = (el, items, fallbackLabel = "Select option") => {
    if (!el) return;
    const rows = Array.isArray(items) ? items : [];
    el.innerHTML = `<option value="">${escapeHtml(fallbackLabel)}</option>`;
    rows.forEach((item) => {
      const option = document.createElement("option");
      option.value = text(item?.id);
      option.textContent = text(item?.name || item?.label || item?.city, "Unknown");
      el.appendChild(option);
    });
  };

  const requireLogin = (statusEl, actionName) => {
    const token = getToken();
    if (token) return token;
    setStatus(statusEl, `Login required for ${actionName}.`, false);
    return "";
  };

  const requestSafe = async (path, options = {}) => {
    if (!hasLiveRequest()) throw new Error("Live API connector not found.");
    return live.request(path, options);
  };

  const loadCatalogs = async () => {
    const [docsRes, banksRes, ecoRes] = await Promise.allSettled([
      (live.documentation && live.documentation.services ? live.documentation.services() : requestSafe("/documentation/services")),
      (live.loan && live.loan.banks ? live.loan.banks() : requestSafe("/loan/banks")),
      (live.ecosystem && live.ecosystem.services ? live.ecosystem.services() : requestSafe("/ecosystem/services"))
    ]);

    const docs = docsRes.status === "fulfilled" ? toItems(docsRes.value) : fallbackDocs;
    const banks = banksRes.status === "fulfilled" ? toItems(banksRes.value) : fallbackBanks;
    const ecoItemsRaw = ecoRes.status === "fulfilled" ? toItems(ecoRes.value) : fallbackEcosystemServices;
    const ecoItems = ecoItemsRaw.filter((item) => {
      const id = text(item?.id).toLowerCase();
      return id === "movers-packers" || id === "interior-designer";
    });

    fillSelect(ui.docService, docs, "Select documentation service");
    fillSelect(ui.loanBank, banks, "Select partner bank");
    fillSelect(ui.ecoService, ecoItems.length ? ecoItems : fallbackEcosystemServices, "Select ecosystem service");
  };

  const snapshotTotal = (snapshot = {}) => (
    numberFrom(snapshot.documentation, 0)
    + numberFrom(snapshot.loan, 0)
    + numberFrom(snapshot.booking, 0)
    + numberFrom(snapshot.insuranceTieups, 0)
    + numberFrom(snapshot.tenantDamage, 0)
    + numberFrom(snapshot.rentDrafts, 0)
    + numberFrom(snapshot.franchise, 0)
  );

  const refreshPulse = async () => {
    setStatus(ui.pulseStatus, "Refreshing live revenue pulse...");

    const token = getToken();
    const protectedPromises = token ? [
      (live.documentation && live.documentation.myRequests ? live.documentation.myRequests() : requestSafe("/documentation/requests", { token })),
      (live.loan && live.loan.myAssistance ? live.loan.myAssistance() : requestSafe("/loan/assistance", { token })),
      (live.ecosystem && live.ecosystem.myBookings ? live.ecosystem.myBookings() : requestSafe("/ecosystem/bookings", { token })),
      (live.rentAgreement && live.rentAgreement.drafts ? live.rentAgreement.drafts() : requestSafe("/rent-agreement/drafts", { token })),
      (live.franchise && live.franchise.myRequests ? live.franchise.myRequests() : requestSafe("/franchise/requests", { token }))
    ] : [];

    const openPromises = [
      requestSafe("/insurance/tieups"),
      requestSafe("/insurance/tenant-damage")
    ];

    const settledProtected = token ? await Promise.allSettled(protectedPromises) : [];
    const settledOpen = await Promise.allSettled(openPromises);

    let documentation = 0;
    let loan = 0;
    let booking = 0;
    let rentDrafts = 0;
    let franchise = 0;

    if (token && settledProtected.length === 5) {
      documentation = settledProtected[0].status === "fulfilled" ? toItems(settledProtected[0].value).length : 0;
      loan = settledProtected[1].status === "fulfilled" ? toItems(settledProtected[1].value).length : 0;
      booking = settledProtected[2].status === "fulfilled" ? toItems(settledProtected[2].value).length : 0;
      rentDrafts = settledProtected[3].status === "fulfilled" ? toItems(settledProtected[3].value).length : 0;
      franchise = settledProtected[4].status === "fulfilled" ? toItems(settledProtected[4].value).length : 0;
    } else {
      const snapshot = readJson(SNAPSHOT_KEY, {});
      documentation = numberFrom(snapshot.documentation, 0);
      loan = numberFrom(snapshot.loan, 0);
      booking = numberFrom(snapshot.booking, 0);
      rentDrafts = numberFrom(snapshot.rentDrafts, 0);
      franchise = numberFrom(snapshot.franchise, 0);
    }

    const insuranceTieups = settledOpen[0].status === "fulfilled" ? toItems(settledOpen[0].value).length : 0;
    const tenantDamage = settledOpen[1].status === "fulfilled" ? toItems(settledOpen[1].value).length : 0;

    const openPipeline = documentation + loan + booking + insuranceTieups + tenantDamage + franchise;

    const snapshot = {
      at: new Date().toISOString(),
      documentation,
      loan,
      booking,
      insuranceTieups,
      tenantDamage,
      rentDrafts,
      franchise,
      openPipeline
    };
    const previous = readJson(SNAPSHOT_KEY, {});
    writeJson(SNAPSHOT_KEY, snapshot);
    renderKpis(snapshot);

    const failedProtected = settledProtected.filter((entry) => entry.status === "rejected").length;
    const failedOpen = settledOpen.filter((entry) => entry.status === "rejected").length;
    const totalFailures = failedProtected + failedOpen;

    if (!token) {
      setStatus(ui.pulseStatus, "Login missing. Showing mixed mode (public + local snapshot).", false);
      return;
    }

    if (totalFailures > 0) {
      setStatus(ui.pulseStatus, `Pulse refreshed with ${totalFailures} warning module(s).`, false);
      return;
    }

    const prevTotal = snapshotTotal(previous);
    const currentTotal = snapshotTotal(snapshot);
    if (currentTotal > prevTotal) {
      setStatus(ui.pulseStatus, `Pulse refreshed. ${currentTotal - prevTotal} new pipeline item(s) detected.`);
      return;
    }
    setStatus(ui.pulseStatus, "Revenue pulse refreshed successfully.");
  };

  const submitDocumentation = async () => {
    const token = requireLogin(ui.docStatus, "documentation request");
    if (!token) return;

    const serviceId = text(ui.docService?.value);
    const details = text(ui.docDetails?.value);
    const propertyId = text(ui.docPropertyId?.value);

    if (!serviceId || !details) {
      setStatus(ui.docStatus, "Service and details are required.", false);
      return;
    }

    setStatus(ui.docStatus, "Submitting documentation request...");
    try {
      await (live.documentation && live.documentation.createRequest
        ? live.documentation.createRequest({ serviceId, details, propertyId, city: "Udaipur" })
        : requestSafe("/documentation/requests", {
            method: "POST",
            token,
            data: { serviceId, details, propertyId, city: "Udaipur" }
          }));

      setStatus(ui.docStatus, "Documentation request submitted.");
      pushFeed("Documentation Request", `Service: ${serviceId}`);
      if (ui.docDetails) ui.docDetails.value = "";
      await refreshPulse();
    } catch (error) {
      setStatus(ui.docStatus, error.message || "Documentation request failed.", false);
    }
  };

  const submitLoan = async () => {
    const token = requireLogin(ui.loanStatus, "loan assistance");
    if (!token) return;

    const bankId = text(ui.loanBank?.value);
    const requestedAmount = Math.max(0, numberFrom(ui.loanAmount?.value, 0));
    const propertyValue = Math.max(0, numberFrom(ui.propertyValue?.value, 0));
    const locality = text(ui.loanLocality?.value);

    if (!bankId || requestedAmount <= 0) {
      setStatus(ui.loanStatus, "Bank and requested loan amount are required.", false);
      return;
    }

    setStatus(ui.loanStatus, "Submitting loan lead...");
    try {
      await (live.loan && live.loan.createAssistance
        ? live.loan.createAssistance({
            bankId,
            requestedAmount,
            propertyValue,
            locality,
            city: "Udaipur",
            referralSource: "startup-revenue-engine"
          })
        : requestSafe("/loan/assistance", {
            method: "POST",
            token,
            data: {
              bankId,
              requestedAmount,
              propertyValue,
              locality,
              city: "Udaipur",
              referralSource: "startup-revenue-engine"
            }
          }));

      setStatus(ui.loanStatus, "Loan lead submitted.");
      pushFeed("Loan Assistance Lead", `Bank: ${bankId} | Amount: ₹${requestedAmount.toLocaleString("en-IN")}`);
      await refreshPulse();
    } catch (error) {
      setStatus(ui.loanStatus, error.message || "Loan lead submission failed.", false);
    }
  };

  const submitEcosystemBooking = async () => {
    const token = requireLogin(ui.ecoStatus, "ecosystem booking");
    if (!token) return;

    const serviceId = text(ui.ecoService?.value);
    const propertyId = text(ui.ecoPropertyId?.value);
    const locality = text(ui.ecoLocality?.value);
    const preferredDateRaw = text(ui.ecoDate?.value);
    const budget = Math.max(0, numberFrom(ui.ecoBudget?.value, 0));

    if (!serviceId || !preferredDateRaw) {
      setStatus(ui.ecoStatus, "Service and preferred date are required.", false);
      return;
    }

    setStatus(ui.ecoStatus, "Submitting ecosystem booking...");
    try {
      const preferredDate = new Date(preferredDateRaw);
      if (Number.isNaN(preferredDate.getTime())) {
        setStatus(ui.ecoStatus, "Preferred date is invalid.", false);
        return;
      }

      await (live.ecosystem && live.ecosystem.createBooking
        ? live.ecosystem.createBooking({
            serviceId,
            propertyId,
            locality,
            city: "Udaipur",
            preferredDate: preferredDate.toISOString(),
            budget
          })
        : requestSafe("/ecosystem/bookings", {
            method: "POST",
            token,
            data: {
              serviceId,
              propertyId,
              locality,
              city: "Udaipur",
              preferredDate: preferredDate.toISOString(),
              budget
            }
          }));

      setStatus(ui.ecoStatus, "Ecosystem booking submitted.");
      pushFeed("Ecosystem Booking", `Service: ${serviceId}`);
      await refreshPulse();
    } catch (error) {
      setStatus(ui.ecoStatus, error.message || "Ecosystem booking failed.", false);
    }
  };

  const submitInsuranceTieup = async () => {
    const token = requireLogin(ui.insuranceStatus, "insurance tie-up");
    if (!token) return;

    const company = text(ui.insuranceCompany?.value);
    const tieupType = text(ui.insuranceType?.value, "insurance-security");
    const coverageAmount = Math.max(0, numberFrom(ui.coverageAmount?.value, 0));

    if (!company) {
      setStatus(ui.insuranceStatus, "Company name is required.", false);
      return;
    }

    setStatus(ui.insuranceStatus, "Submitting insurance tie-up lead...");
    try {
      await requestSafe("/insurance/tieups", {
        method: "POST",
        token,
        data: {
          company,
          tieupType,
          coverageAmount,
          coverageType: "property-insurance",
          tenantDamageProtection: tieupType === "tenant-damage-protection",
          notes: "Submitted via startup revenue engine."
        }
      });

      setStatus(ui.insuranceStatus, "Insurance tie-up lead submitted.");
      pushFeed("Insurance Tie-up", `${company} (${tieupType})`);
      if (ui.insuranceCompany) ui.insuranceCompany.value = "";
      await refreshPulse();
    } catch (error) {
      setStatus(ui.insuranceStatus, error.message || "Insurance tie-up submission failed.", false);
    }
  };

  const runValuation = async () => {
    const locality = text(ui.valuationLocality?.value, "Udaipur");
    const propertyType = text(ui.valuationType?.value, "House");
    const areaSqft = Math.max(100, numberFrom(ui.valuationArea?.value, 1200));
    const bedrooms = Math.max(0, numberFrom(ui.valuationBeds?.value, 2));
    const ageYears = Math.max(0, numberFrom(ui.valuationAge?.value, 2));

    setStatus(ui.valuationStatus, "Running valuation...");
    try {
      const response = await (live.valuation && live.valuation.estimate
        ? live.valuation.estimate({
            locality,
            propertyType,
            areaSqft,
            bedrooms,
            ageYears,
            city: "Udaipur"
          })
        : requestSafe("/valuation/estimate", {
            method: "POST",
            data: { locality, propertyType, areaSqft, bedrooms, ageYears, city: "Udaipur" }
          }));

      const valuation = response?.valuation || response?.item || {};
      const estimatedPrice = numberFrom(valuation.estimatedPrice, 0);
      const band = valuation.suggestedBand || {};
      const low = numberFrom(band.min, 0);
      const high = numberFrom(band.max, 0);

      if (estimatedPrice > 0) {
        setStatus(
          ui.valuationStatus,
          `Estimated: ₹${estimatedPrice.toLocaleString("en-IN")} | Band: ₹${low.toLocaleString("en-IN")} - ₹${high.toLocaleString("en-IN")}.`
        );
      } else {
        setStatus(ui.valuationStatus, "Valuation completed.");
      }

      pushFeed("Valuation Tool", `${propertyType} in ${locality}`);
      await refreshPulse();
    } catch (error) {
      setStatus(ui.valuationStatus, error.message || "Valuation failed.", false);
    }
  };

  const submitFranchise = async () => {
    const token = requireLogin(ui.franchiseStatus, "franchise request");
    if (!token) return;

    const city = text(ui.franchiseCity?.value);
    const investmentBudget = Math.max(0, numberFrom(ui.franchiseBudget?.value, 0));
    const experienceYears = Math.max(0, numberFrom(ui.franchiseExperience?.value, 0));

    if (!city || investmentBudget <= 0) {
      setStatus(ui.franchiseStatus, "City and investment budget are required.", false);
      return;
    }

    setStatus(ui.franchiseStatus, "Submitting franchise lead...");
    try {
      await (live.franchise && live.franchise.createRequest
        ? live.franchise.createRequest({ city, investmentBudget, experienceYears })
        : requestSafe("/franchise/requests", {
            method: "POST",
            token,
            data: { city, investmentBudget, experienceYears }
          }));

      setStatus(ui.franchiseStatus, "Franchise lead submitted.");
      pushFeed("Franchise Lead", `${city} | ₹${investmentBudget.toLocaleString("en-IN")}`);
      await refreshPulse();
    } catch (error) {
      setStatus(ui.franchiseStatus, error.message || "Franchise request failed.", false);
    }
  };

  const generateRentDraft = async () => {
    const token = requireLogin(ui.rentStatus, "rent agreement generation");
    if (!token) return;

    const ownerName = text(ui.rentOwner?.value);
    const tenantName = text(ui.rentTenant?.value);
    const propertyAddress = text(ui.rentAddress?.value);
    const rentAmount = Math.max(0, numberFrom(ui.rentAmount?.value, 0));
    const depositAmount = Math.max(0, numberFrom(ui.rentDeposit?.value, 0));

    if (!ownerName || !tenantName || !propertyAddress || rentAmount <= 0) {
      setStatus(ui.rentStatus, "Owner, tenant, address and rent amount are required.", false);
      return;
    }

    setStatus(ui.rentStatus, "Generating rent agreement draft...");
    try {
      const response = await (live.rentAgreement && live.rentAgreement.generate
        ? live.rentAgreement.generate({
            ownerName,
            tenantName,
            propertyAddress,
            rentAmount,
            depositAmount,
            durationMonths: 11
          })
        : requestSafe("/rent-agreement/generate", {
            method: "POST",
            token,
            data: {
              ownerName,
              tenantName,
              propertyAddress,
              rentAmount,
              depositAmount,
              durationMonths: 11
            }
          }));

      const draft = response?.draft || response?.item || {};
      const draftText = text(draft.draftText || response?.draftText || "");
      if (ui.rentDraft) ui.rentDraft.value = draftText || "Draft generated successfully.";

      setStatus(ui.rentStatus, "Rent agreement draft generated.");
      pushFeed("Rent Agreement Draft", `${ownerName} -> ${tenantName}`);
      await refreshPulse();
    } catch (error) {
      setStatus(ui.rentStatus, error.message || "Rent draft generation failed.", false);
    }
  };

  const wireEvents = () => {
    ui.refreshBtn?.addEventListener("click", () => {
      refreshPulse().catch((error) => setStatus(ui.pulseStatus, error.message || "Pulse refresh failed.", false));
    });
    ui.docSubmitBtn?.addEventListener("click", () => {
      submitDocumentation().catch((error) => setStatus(ui.docStatus, error.message || "Documentation request failed.", false));
    });
    ui.loanSubmitBtn?.addEventListener("click", () => {
      submitLoan().catch((error) => setStatus(ui.loanStatus, error.message || "Loan submission failed.", false));
    });
    ui.ecoSubmitBtn?.addEventListener("click", () => {
      submitEcosystemBooking().catch((error) => setStatus(ui.ecoStatus, error.message || "Ecosystem booking failed.", false));
    });
    ui.insuranceSubmitBtn?.addEventListener("click", () => {
      submitInsuranceTieup().catch((error) => setStatus(ui.insuranceStatus, error.message || "Insurance tie-up failed.", false));
    });
    ui.valuationRunBtn?.addEventListener("click", () => {
      runValuation().catch((error) => setStatus(ui.valuationStatus, error.message || "Valuation failed.", false));
    });
    ui.franchiseSubmitBtn?.addEventListener("click", () => {
      submitFranchise().catch((error) => setStatus(ui.franchiseStatus, error.message || "Franchise request failed.", false));
    });
    ui.rentGenerateBtn?.addEventListener("click", () => {
      generateRentDraft().catch((error) => setStatus(ui.rentStatus, error.message || "Rent draft generation failed.", false));
    });
  };

  const boot = async () => {
    renderFeed();
    try {
      await loadCatalogs();
    } catch (error) {
      setStatus(ui.pulseStatus, error.message || "Catalog load failed.", false);
      fillSelect(ui.docService, fallbackDocs, "Select documentation service");
      fillSelect(ui.loanBank, fallbackBanks, "Select partner bank");
      fillSelect(ui.ecoService, fallbackEcosystemServices, "Select ecosystem service");
    }

    try {
      await refreshPulse();
    } catch (error) {
      setStatus(ui.pulseStatus, error.message || "Initial pulse load failed.", false);
      const snapshot = readJson(SNAPSHOT_KEY, null);
      if (snapshot && typeof snapshot === "object") renderKpis(snapshot);
    }
  };

  wireEvents();
  boot().catch((error) => {
    setStatus(ui.pulseStatus, error.message || "Startup revenue engine failed to initialize.", false);
  });
})();
