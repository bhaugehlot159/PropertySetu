(() => {
  const API_BASE = `${window.location.origin}/api`;
  const live = window.PropertySetuLive || null;
  const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

  const customerAuthButton = document.getElementById('customerAuthButton');
  const adminAuthButton = document.getElementById('adminAuthButton');
  const sessionBadge = document.getElementById('sessionBadge');
  const customerFeatureStatus = document.getElementById('customerFeatureStatus');
  const customerBoardStatus = document.getElementById('customerBoardStatus');
  const adminBoardStatus = document.getElementById('adminBoardStatus');

  const authModal = document.getElementById('authModal');
  const authModalTitle = document.getElementById('authModalTitle');
  const authModalHint = document.getElementById('authModalHint');
  const authNameInput = document.getElementById('authNameInput');
  const authEmailInput = document.getElementById('authEmailInput');
  const authMobileInput = document.getElementById('authMobileInput');
  const authPasswordInput = document.getElementById('authPasswordInput');
  const authOtpInput = document.getElementById('authOtpInput');
  const authErrorMessage = document.getElementById('authErrorMessage');
  const authCancelButton = document.getElementById('authCancelButton');
  const authRequestOtpButton = document.getElementById('authRequestOtpButton');
  const authSubmitButton = document.getElementById('authSubmitButton');
  const authLoginTab = document.getElementById('authLoginTab');
  const authSignupTab = document.getElementById('authSignupTab');

  let authMode = 'customer';
  let authAction = 'login';

  const setAuthError = (message) => {
    if (authErrorMessage) authErrorMessage.textContent = message || '';
  };

  const read = (key, fallback = null) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const write = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage can fail in strict browser settings
    }
  };

  const remove = (key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // no-op
    }
  };

  const pushNotification = (message, audience = ['all'], title = 'PropertySetu Update', type = 'info') => {
    if (!message) return;
    const notifyApi = window.PropertySetuNotify;
    if (notifyApi && typeof notifyApi.emit === 'function') {
      notifyApi.emit({ title, message, audience, type });
      return;
    }
    const existing = read('propertySetu:notifications', []);
    const list = Array.isArray(existing) ? existing : [];
    list.unshift({
      id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      message,
      audience: Array.isArray(audience) ? audience : ['all'],
      type,
      createdAt: new Date().toISOString(),
      readBy: {},
    });
    while (list.length > 400) list.pop();
    write('propertySetu:notifications', list);
    try {
      localStorage.setItem('propertySetu:notifications:ping', String(Date.now()));
    } catch {
      // no-op
    }
  };

  const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
  const normalizeMobile = (value) => String(value || '').replace(/\D/g, '');
  const isValidEmail = (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const getSessionKey = (role) => `propertysetu-${role}-session`;
  const getUsersKey = (role) => `propertysetu-${role}-users`;

  const getState = (role) => {
    const state = read(getSessionKey(role), null);
    if (!state) return null;
    const ts = Date.parse(state.loggedInAt || '');
    if (!Number.isFinite(ts) || Date.now() - ts > SESSION_TTL_MS) {
      remove(getSessionKey(role));
      return null;
    }
    return state;
  };

  const setState = (role, payload) => {
    const key = getSessionKey(role);
    if (!payload) {
      remove(key);
      return;
    }
    write(key, payload);
  };

  const getStoredUsers = (role) => read(getUsersKey(role), []);
  const setStoredUsers = (role, users) => write(getUsersKey(role), users);

  const findStoredUser = (users, email, mobile) => users.find((item) => (
    (email && item.email === email) || (mobile && item.mobile === mobile)
  ));

  const shapeUser = (rawUser, role) => ({
    id: rawUser.id || `local-${role}-${Date.now()}`,
    name: rawUser.name || role,
    email: rawUser.email || '',
    mobile: rawUser.mobile || rawUser.phone || '',
    role,
  });

  const localRegister = (role, payload) => {
    const users = getStoredUsers(role);
    const existing = findStoredUser(users, payload.email, payload.mobile);
    if (existing) throw new Error('Account already exists. Login kijiye.');

    const user = {
      id: `local-${role}-${Date.now()}`,
      name: payload.name,
      email: payload.email,
      mobile: payload.mobile,
      password: payload.password,
      role,
      provider: 'local',
      createdAt: new Date().toISOString(),
    };

    users.push(user);
    setStoredUsers(role, users);
    return {
      user: shapeUser(user, role),
      token: `local-${role}-${Date.now()}`,
    };
  };

  const localLogin = (role, payload) => {
    const users = getStoredUsers(role);
    const user = findStoredUser(users, payload.email, payload.mobile);
    if (!user) throw new Error('Account nahi mila. Signup kijiye.');
    if (payload.password && user.password !== payload.password) throw new Error('Password galat hai.');
    return {
      user: shapeUser(user, role),
      token: `local-${role}-${Date.now()}`,
    };
  };

  const apiRequest = async (path, payload, token, timeoutMs = 7000) => {
    if (live && typeof live.request === 'function') {
      return live.request(path, {
        method: payload ? 'POST' : 'GET',
        data: payload || null,
        token: token || '',
        timeoutMs,
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method: payload ? 'POST' : 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);
      return data;
    } finally {
      clearTimeout(timeout);
    }
  };

  const shouldFallbackToLocal = (error) => {
    const msg = String(error?.message || '').toLowerCase();
    return (
      msg.includes('failed to fetch')
      || msg.includes('network')
      || msg.includes('abort')
      || msg.includes('request failed (404)')
      || msg.includes('request failed (405)')
      || msg.includes('request failed (500)')
      || msg.includes('request failed (502)')
      || msg.includes('request failed (503)')
      || msg.includes('request failed (504)')
    );
  };

  const setAuthAction = (mode) => {
    authAction = mode === 'signup' ? 'signup' : 'login';
    authLoginTab?.classList.toggle('active', authAction === 'login');
    authSignupTab?.classList.toggle('active', authAction === 'signup');
    if (authSubmitButton) authSubmitButton.textContent = authAction === 'signup' ? 'Create Account' : 'Login';
    if (authNameInput) authNameInput.style.display = authAction === 'signup' ? 'block' : 'none';
    if (authPasswordInput) {
      authPasswordInput.placeholder = authAction === 'signup'
        ? 'Password (min 6 chars)'
        : 'Password (optional for OTP login)';
    }
    if (authRequestOtpButton) authRequestOtpButton.style.display = authAction === 'login' ? 'inline-flex' : 'none';
  };

  const requestOtp = async () => {
    const email = normalizeEmail(authEmailInput?.value);
    const mobile = normalizeMobile(authMobileInput?.value);
    setAuthError('');
    if (authAction !== 'login') {
      setAuthError('OTP request login mode me available hai.');
      return;
    }
    if (!email && !mobile) {
      setAuthError('OTP bhejne ke liye email ya mobile enter kijiye.');
      return;
    }
    if (!isValidEmail(email)) {
      setAuthError('Valid email enter kijiye.');
      return;
    }
    if (mobile && mobile.length < 10) {
      setAuthError('Valid mobile number enter kijiye.');
      return;
    }

    try {
      const response = await apiRequest('/auth/request-otp', {
        role: authMode,
        email,
        mobile,
      });
      if (authOtpInput) authOtpInput.value = '';
      setAuthError(response?.message || 'OTP sent successfully. Registered email/mobile check karein.');
    } catch (error) {
      setAuthError(error.message || 'OTP request failed.');
    }
  };

  const updateFeatureVisibility = () => {
    const customer = getState('customer');
    const admin = getState('admin');

    document.querySelectorAll('[data-lock-role="customer"]').forEach((el) => {
      const locked = !customer;
      el.classList.toggle('locked', locked);
      if (locked) el.setAttribute('aria-disabled', 'true');
      else el.removeAttribute('aria-disabled');
    });

    document.querySelectorAll('[data-lock-role="admin"]').forEach((el) => {
      const locked = !admin;
      el.classList.toggle('locked', locked);
      if (locked) el.setAttribute('aria-disabled', 'true');
      else el.removeAttribute('aria-disabled');
    });

    if (customerBoardStatus) {
      customerBoardStatus.textContent = customer
        ? `Customer ${customer.name} logged in.`
        : 'Customer login ke baad Udaipur customer features unlock honge.';
    }

    if (adminBoardStatus) {
      adminBoardStatus.textContent = admin
        ? `Admin ${admin.name} logged in.`
        : 'Admin login ke baad Udaipur control features unlock honge.';
    }

    if (customerFeatureStatus) {
      if (admin && customer) {
        customerFeatureStatus.textContent = `Customer (${customer.name}) + Admin (${admin.name}) active.`;
      } else if (admin) {
        customerFeatureStatus.textContent = `Admin ${admin.name} active.`;
      } else if (customer) {
        customerFeatureStatus.textContent = `Customer ${customer.name} active.`;
      } else {
        customerFeatureStatus.textContent = 'Please login as customer/admin to unlock Udaipur features.';
      }
    }
  };

  const updateAuthButtons = () => {
    const customer = getState('customer');
    const admin = getState('admin');

    if (customerAuthButton) customerAuthButton.textContent = customer ? `Logout ${customer.name}` : 'Customer Login';
    if (adminAuthButton) adminAuthButton.textContent = admin ? `Logout ${admin.name}` : 'Admin Login';

    if (sessionBadge) {
      if (admin) sessionBadge.textContent = `Admin: ${admin.name}`;
      else if (customer) sessionBadge.textContent = `Customer: ${customer.name}`;
      else sessionBadge.textContent = 'Guest Mode';
    }

    updateFeatureVisibility();
  };

  const openAuthModal = (role) => {
    authMode = role;
    if (!authModal) return;
    if (authModalTitle) authModalTitle.textContent = role === 'admin' ? 'Admin Login' : 'Customer Login';
    if (authModalHint) authModalHint.textContent = 'Udaipur portal access. OTP aapke registered email/mobile par bheja jayega.';
    if (authNameInput) authNameInput.value = '';
    if (authEmailInput) authEmailInput.value = '';
    if (authMobileInput) authMobileInput.value = '';
    if (authPasswordInput) authPasswordInput.value = '';
    if (authOtpInput) authOtpInput.value = '';
    if (authErrorMessage) authErrorMessage.textContent = '';
    setAuthAction('login');
    authModal.classList.add('show');
    authModal.setAttribute('aria-hidden', 'false');
  };

  const closeAuthModal = () => {
    authModal?.classList.remove('show');
    authModal?.setAttribute('aria-hidden', 'true');
  };

  const doAuthFlow = async () => {
    const name = String(authNameInput?.value || '').trim();
    const email = normalizeEmail(authEmailInput?.value);
    const mobile = normalizeMobile(authMobileInput?.value);
    const password = String(authPasswordInput?.value || '');
    const otp = String(authOtpInput?.value || '').trim();

    setAuthError('');
    if (!email && !mobile) return setAuthError('Email ya mobile dena zaruri hai.');
    if (!isValidEmail(email)) return setAuthError('Valid email enter kijiye.');
    if (mobile && mobile.length < 10) return setAuthError('Valid mobile number enter kijiye.');
    if (authAction === 'signup' && !name) return setAuthError('Signup ke liye full name required hai.');
    if (authAction === 'signup' && password.length < 6) return setAuthError('Password minimum 6 characters hona chahiye.');
    if (authAction === 'login' && password && password.length < 6) return setAuthError('Password blank rakhein ya minimum 6 characters rakhein.');
    if (!otp) return setAuthError('OTP enter kijiye.');

    const payload = { name, email, mobile, password, otp, role: authMode };
    const endpoint = authAction === 'signup' ? '/auth/register' : '/auth/login';

    try {
      const response = await apiRequest(endpoint, payload);
      if (!response?.token || !response?.user) {
        throw new Error('Authentication response invalid. Please try again.');
      }
      setState(authMode, {
        ...shapeUser(response.user || {}, authMode),
        token: response.token || '',
        provider: 'server',
        loggedInAt: new Date().toISOString(),
      });
    } catch (error) {
      setAuthError(error.message || 'Authentication failed.');
      return;
    }

    pushNotification(
      `${authMode === 'admin' ? 'Admin' : 'Customer'} ${shapeUser(getState(authMode) || {}, authMode).name} logged in successfully.`,
      [authMode, 'admin'],
      'Login Successful',
      'success',
    );

    closeAuthModal();
    updateAuthButtons();
  };

  const logoutRole = async (role) => {
    const current = getState(role);
    if (!current) return;
    if (current.provider !== 'local') {
      try {
        await apiRequest('/auth/logout', { role }, current.token, 4000);
      } catch {
        // no-op, clear local state below
      }
    }
    setState(role, null);
    pushNotification(
      `${role === 'admin' ? 'Admin' : 'Customer'} ${current.name || ''} logged out.`,
      [role, 'admin'],
      'Logout Update',
      'info',
    );
    updateAuthButtons();
  };

  customerAuthButton?.addEventListener('click', async () => {
    if (getState('customer')) return logoutRole('customer');
    openAuthModal('customer');
  });

  adminAuthButton?.addEventListener('click', async () => {
    if (getState('admin')) return logoutRole('admin');
    openAuthModal('admin');
  });

  authCancelButton?.addEventListener('click', closeAuthModal);
  authRequestOtpButton?.addEventListener('click', requestOtp);
  authSubmitButton?.addEventListener('click', doAuthFlow);
  authLoginTab?.addEventListener('click', () => setAuthAction('login'));
  authSignupTab?.addEventListener('click', () => setAuthAction('signup'));

  document.querySelectorAll('[data-lock-role]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const role = link.getAttribute('data-lock-role');
      if (!role) return;
      if (getState(role)) return;
      event.preventDefault();
      openAuthModal(role);
    });
  });

  authModal?.addEventListener('click', (event) => {
    if (event.target === authModal) closeAuthModal();
  });

  document.addEventListener('keydown', (event) => {
    if (!authModal?.classList.contains('show')) return;
    if (event.key === 'Escape') closeAuthModal();
    if (event.key === 'Enter') {
      event.preventDefault();
      doAuthFlow();
    }
  });

  window.addEventListener('storage', (event) => {
    if (!event.key) return;
    if (event.key === getSessionKey('customer') || event.key === getSessionKey('admin')) {
      updateAuthButtons();
    }
  });

  updateAuthButtons();
})();
