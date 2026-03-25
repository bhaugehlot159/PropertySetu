(function () {
  const storageKey = "propertysetu.admin.simple.token";
  const state = {
    token: localStorage.getItem(storageKey) || "",
    user: null,
  };

  const el = {
    statusBox: document.getElementById("statusBox"),
    identityInput: document.getElementById("identityInput"),
    passwordInput: document.getElementById("passwordInput"),
    otpInput: document.getElementById("otpInput"),
    requestOtpBtn: document.getElementById("requestOtpBtn"),
    loginBtn: document.getElementById("loginBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    sessionBox: document.getElementById("sessionBox"),
    refreshBtn: document.getElementById("refreshBtn"),
    overviewBtn: document.getElementById("overviewBtn"),
    pendingBtn: document.getElementById("pendingBtn"),
    verificationBtn: document.getElementById("verificationBtn"),
    usersBtn: document.getElementById("usersBtn"),
    reloadPropertiesBtn: document.getElementById("reloadPropertiesBtn"),
    reloadVerificationBtn: document.getElementById("reloadVerificationBtn"),
    reloadUsersBtn: document.getElementById("reloadUsersBtn"),
    metricsGrid: document.getElementById("metricsGrid"),
    pendingList: document.getElementById("pendingList"),
    verificationList: document.getElementById("verificationList"),
    usersList: document.getElementById("usersList"),
  };

  const txt = (v) => String(v || "").trim();
  const money = (v) => `INR ${Number(v || 0).toLocaleString("en-IN")}`;
  const prettyDate = (iso) => {
    const d = new Date(iso || Date.now());
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  };

  const status = (message, tone) => {
    el.statusBox.textContent = message;
    el.statusBox.className = `status ${tone || ""}`.trim();
  };

  const setSessionBox = () => {
    if (!state.token || !state.user) {
      el.sessionBox.innerHTML = "Session inactive.";
      return;
    }
    const tokenPreview = `${state.token.slice(0, 14)}...${state.token.slice(-8)}`;
    el.sessionBox.innerHTML = [
      `<b>Logged in:</b> ${txt(state.user.name)} (${txt(state.user.role)})`,
      `<br/><b>Email:</b> ${txt(state.user.email || "-")}`,
      `<br/><b>Mobile:</b> ${txt(state.user.mobile || "-")}`,
      `<br/><b>Token:</b> ${tokenPreview}`,
    ].join("");
  };

  const setToken = (token) => {
    state.token = token || "";
    if (state.token) localStorage.setItem(storageKey, state.token);
    else localStorage.removeItem(storageKey);
    setSessionBox();
  };

  const parseIdentity = () => {
    const identity = txt(el.identityInput.value);
    if (!identity) {
      throw new Error("Email ya mobile required.");
    }
    if (identity.includes("@")) return { email: identity.toLowerCase() };
    return { mobile: identity.replace(/\D/g, "").slice(-10) };
  };

  const api = async (url, options) => {
    const opts = options || {};
    const headers = { "Content-Type": "application/json" };
    if (opts.auth) {
      if (!state.token) throw new Error("Please login first.");
      headers.Authorization = `Bearer ${state.token}`;
    }
    const res = await fetch(url, {
      method: opts.method || "GET",
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let data = {};
    try {
      data = await res.json();
    } catch (_err) {
      data = {};
    }
    if (!res.ok || data.ok === false) {
      throw new Error(data.message || `Request failed (${res.status})`);
    }
    return data;
  };

  const empty = (label) => `<div class="empty">${label}</div>`;

  const renderOverview = (overview) => {
    const cards = [
      { key: "users", label: "Users" },
      { key: "blockedUsers", label: "Blocked Users" },
      { key: "pending", label: "Pending Listings" },
      { key: "approved", label: "Approved Listings" },
      { key: "featured", label: "Featured Listings" },
      { key: "ownerVerificationPending", label: "Verification Queue" },
      { key: "activeSubs", label: "Active Subscriptions" },
      { key: "totalBids", label: "Total Sealed Bids" },
    ];
    el.metricsGrid.innerHTML = cards
      .map((item) => `<article class="metric"><b>${Number(overview[item.key] || 0).toLocaleString("en-IN")}</b><span>${item.label}</span></article>`)
      .join("");
  };

  const loadOverview = async () => {
    const data = await api("/api/admin/overview", { auth: true });
    renderOverview(data.overview || {});
  };

  const loadPendingProperties = async () => {
    const data = await api("/api/admin/properties?status=pending%20approval", { auth: true });
    const items = Array.isArray(data.items) ? data.items : [];
    if (!items.length) {
      el.pendingList.innerHTML = empty("No pending properties right now.");
      return;
    }
    el.pendingList.innerHTML = items.map((p) => `
      <article class="item">
        <h4>${txt(p.title || "Untitled Property")}</h4>
        <p class="meta">ID: ${txt(p.id)}</p>
        <p class="meta">City: ${txt(p.city || "-")} | Category: ${txt(p.category || "-")} | Type: ${txt(p.type || p.listingType || "-")}</p>
        <p class="meta">Price: ${money(p.price)} | Created: ${prettyDate(p.createdAt)}</p>
        <div class="actions">
          <button class="mini primary" data-action="approve" data-id="${txt(p.id)}">Approve</button>
          <button class="mini" data-action="feature" data-id="${txt(p.id)}">Feature 30 Days</button>
        </div>
      </article>
    `).join("");
  };

  const loadVerificationQueue = async () => {
    const data = await api("/api/admin/owner-verification?status=pending%20review", { auth: true });
    const items = Array.isArray(data.items) ? data.items : [];
    if (!items.length) {
      el.verificationList.innerHTML = empty("No pending verification requests.");
      return;
    }
    el.verificationList.innerHTML = items.map((item) => `
      <article class="item">
        <h4>${txt(item.userName || "Unknown User")} (${txt(item.role || "user")})</h4>
        <p class="meta">Request ID: ${txt(item.id)} | Property: ${txt(item.propertyTitle || item.propertyId || "N/A")}</p>
        <p class="meta">KYC: ${txt(item.ownerAadhaarPanStatus || "Submitted")} | Address: ${txt(item.addressVerificationStatus || "Submitted")}</p>
        <p class="meta">Created: ${prettyDate(item.createdAt)}</p>
        <div class="actions">
          <button class="mini primary" data-action="verify-owner" data-id="${txt(item.id)}">Mark Verified</button>
          <button class="mini" data-action="needs-info-owner" data-id="${txt(item.id)}">Needs Info</button>
          <button class="mini danger" data-action="reject-owner" data-id="${txt(item.id)}">Reject</button>
        </div>
      </article>
    `).join("");
  };

  const loadUsers = async () => {
    const data = await api("/api/admin/users", { auth: true });
    const items = (Array.isArray(data.items) ? data.items : []).slice(0, 30);
    if (!items.length) {
      el.usersList.innerHTML = empty("No users found.");
      return;
    }
    el.usersList.innerHTML = items.map((user) => {
      const action = user.blocked ? "unblock-user" : "block-user";
      const label = user.blocked ? "Unblock" : "Block";
      const own = state.user && state.user.id === user.id;
      return `
      <article class="item">
        <h4>${txt(user.name || "Unknown")} (${txt(user.role || "user")})</h4>
        <p class="meta">Email: ${txt(user.email || "-")} | Mobile: ${txt(user.mobile || "-")}</p>
        <p class="meta">Created: ${prettyDate(user.createdAt)} | Last login: ${prettyDate(user.lastLoginAt)}</p>
        <div class="actions">
          <button class="mini ${user.blocked ? "" : "danger"}" data-action="${action}" data-id="${txt(user.id)}" ${own ? "disabled" : ""}>${label}</button>
        </div>
      </article>
      `;
    }).join("");
  };

  const runAll = async () => {
    await loadOverview();
    await loadPendingProperties();
    await loadVerificationQueue();
    await loadUsers();
  };

  const requireAdmin = async () => {
    const data = await api("/api/auth/me", { auth: true });
    if (!data.user || data.user.role !== "admin") {
      throw new Error("Admin role required for this panel.");
    }
    state.user = data.user;
    setSessionBox();
    return data.user;
  };

  const requestOtp = async () => {
    const identity = parseIdentity();
    const data = await api("/api/auth/request-otp", {
      method: "POST",
      body: { role: "admin", ...identity },
    });
    status(data.message || "OTP sent.", "ok");
  };

  const login = async () => {
    const identity = parseIdentity();
    const body = {
      role: "admin",
      password: txt(el.passwordInput.value),
      otp: txt(el.otpInput.value) || "123456",
      ...identity,
    };
    const data = await api("/api/auth/login", { method: "POST", body });
    if (!data.user || data.user.role !== "admin") {
      throw new Error("This account is not admin.");
    }
    setToken(data.token || "");
    state.user = data.user;
    setSessionBox();
    status(`Login successful. Welcome ${txt(data.user.name)}.`, "ok");
    await runAll();
  };

  const logout = () => {
    setToken("");
    state.user = null;
    setSessionBox();
    renderOverview({});
    el.pendingList.innerHTML = empty("Login required.");
    el.verificationList.innerHTML = empty("Login required.");
    el.usersList.innerHTML = empty("Login required.");
    status("Session cleared.", "warn");
  };

  const actionDispatch = async (action, id) => {
    if (!action || !id) return;
    if (action === "approve") {
      await api(`/api/properties/${encodeURIComponent(id)}/approve`, { method: "POST", auth: true, body: {} });
      status("Property approved.", "ok");
      await loadPendingProperties();
      await loadOverview();
      return;
    }
    if (action === "feature") {
      await api(`/api/properties/${encodeURIComponent(id)}/feature`, { method: "POST", auth: true, body: { days: 30 } });
      status("Featured flag updated for 30 days.", "ok");
      await loadPendingProperties();
      await loadOverview();
      return;
    }
    if (action === "verify-owner" || action === "reject-owner" || action === "needs-info-owner") {
      const map = {
        "verify-owner": "verified",
        "reject-owner": "rejected",
        "needs-info-owner": "needs-info",
      };
      await api(`/api/admin/owner-verification/${encodeURIComponent(id)}/decision`, {
        method: "POST",
        auth: true,
        body: { status: map[action] },
      });
      status("Owner verification decision saved.", "ok");
      await loadVerificationQueue();
      await loadOverview();
      return;
    }
    if (action === "block-user" || action === "unblock-user") {
      const endpoint = action === "block-user" ? "block" : "unblock";
      await api(`/api/admin/users/${encodeURIComponent(id)}/${endpoint}`, { method: "POST", auth: true, body: {} });
      status("User status updated.", "ok");
      await loadUsers();
      await loadOverview();
      return;
    }
  };

  const safeRun = async (task, fallbackMessage) => {
    try {
      await task();
    } catch (err) {
      status(err.message || fallbackMessage || "Something went wrong.", "err");
    }
  };

  const bindEvents = () => {
    el.requestOtpBtn.addEventListener("click", () => safeRun(requestOtp, "OTP request failed."));
    el.loginBtn.addEventListener("click", () => safeRun(login, "Login failed."));
    el.logoutBtn.addEventListener("click", logout);
    el.refreshBtn.addEventListener("click", () => safeRun(async () => {
      await requireAdmin();
      await runAll();
      status("All panels refreshed.", "ok");
    }, "Refresh failed."));
    el.overviewBtn.addEventListener("click", () => safeRun(async () => {
      await requireAdmin();
      await loadOverview();
      status("Overview refreshed.", "ok");
    }, "Overview load failed."));
    el.pendingBtn.addEventListener("click", () => safeRun(async () => {
      await requireAdmin();
      await loadPendingProperties();
      status("Pending approvals loaded.", "ok");
    }, "Pending properties load failed."));
    el.verificationBtn.addEventListener("click", () => safeRun(async () => {
      await requireAdmin();
      await loadVerificationQueue();
      status("Verification queue loaded.", "ok");
    }, "Verification load failed."));
    el.usersBtn.addEventListener("click", () => safeRun(async () => {
      await requireAdmin();
      await loadUsers();
      status("Users loaded.", "ok");
    }, "Users load failed."));
    el.reloadPropertiesBtn.addEventListener("click", () => safeRun(loadPendingProperties, "Pending properties load failed."));
    el.reloadVerificationBtn.addEventListener("click", () => safeRun(loadVerificationQueue, "Verification load failed."));
    el.reloadUsersBtn.addEventListener("click", () => safeRun(loadUsers, "Users load failed."));
    document.addEventListener("click", (evt) => {
      const button = evt.target.closest("button[data-action]");
      if (!button) return;
      const action = button.getAttribute("data-action");
      const id = button.getAttribute("data-id");
      safeRun(async () => {
        await requireAdmin();
        await actionDispatch(action, id);
      }, "Action failed.");
    });
  };

  const init = async () => {
    bindEvents();
    renderOverview({});
    el.pendingList.innerHTML = empty("Login required.");
    el.verificationList.innerHTML = empty("Login required.");
    el.usersList.innerHTML = empty("Login required.");
    setSessionBox();
    if (!state.token) return;
    await safeRun(async () => {
      const user = await requireAdmin();
      status(`Session restored for ${txt(user.name)}.`, "ok");
      await runAll();
    }, "Existing session invalid. Please login again.");
  };

  init();
})();
