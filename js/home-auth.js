(() => {
  const API_BASE = `${window.location.origin}/api`;

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
  const authSubmitButton = document.getElementById('authSubmitButton');
  const authLoginTab = document.getElementById('authLoginTab');
  const authSignupTab = document.getElementById('authSignupTab');

  let authMode = 'customer';
  let authAction = 'login';

  const read = (k, f = null) => {
    try {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : f;
    } catch {
      return f;
    }
  };

  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  const getState = (role) => read(`propertysetu-${role}-session`, null);
  const setState = (role, payload) => {
    if (!payload) localStorage.removeItem(`propertysetu-${role}-session`);
    else write(`propertysetu-${role}-session`, payload);
  };

  const apiRequest = async (path, payload, token) => {
    const response = await fetch(`${API_BASE}${path}`, {
      method: payload ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Request failed');
    return data;
  };

  const setAuthAction = (mode) => {
    authAction = mode === 'signup' ? 'signup' : 'login';
    authLoginTab?.classList.toggle('active', authAction === 'login');
    authSignupTab?.classList.toggle('active', authAction === 'signup');
    if (authSubmitButton) authSubmitButton.textContent = authAction === 'signup' ? 'Create Account' : 'Login';
    if (authNameInput) authNameInput.style.display = authAction === 'signup' ? 'block' : 'none';
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
        ? `✅ Customer ${customer.name} logged in. Udaipur Add Property, Dashboard, Chat sab unlock hai.`
        : 'Customer login ke baad Udaipur customer features unlock honge.';
    }

    if (adminBoardStatus) {
      adminBoardStatus.textContent = admin
        ? `✅ Admin ${admin.name} logged in. Udaipur moderation, portals, chat oversight unlock hai.`
        : 'Admin login ke baad Udaipur control features unlock honge.';
    }

    if (customerFeatureStatus) {
      if (admin && customer) {
        customerFeatureStatus.textContent = `✅ Customer (${customer.name}) + Admin (${admin.name}) login active. Udaipur role features available.`;
      } else if (admin) {
        customerFeatureStatus.textContent = `✅ Admin ${admin.name} logged in. Udaipur admin board unlocked.`;
      } else if (customer) {
        customerFeatureStatus.textContent = `✅ Customer ${customer.name} logged in. Udaipur customer board unlocked.`;
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
    authModalTitle.textContent = role === 'admin' ? 'Admin Login' : 'Customer Login';
    authModalHint.textContent = 'Udaipur portal access: Email/mobile se login ya signup karein. OTP: 123456';
    authNameInput.value = '';
    authEmailInput.value = '';
    authMobileInput.value = '';
    authPasswordInput.value = '';
    authOtpInput.value = '123456';
    authErrorMessage.textContent = '';
    setAuthAction('login');
    authModal.classList.add('show');
    authModal.setAttribute('aria-hidden', 'false');
  };

  const closeAuthModal = () => {
    authModal?.classList.remove('show');
    authModal?.setAttribute('aria-hidden', 'true');
  };

  const doAuthFlow = async () => {
    const name = authNameInput?.value.trim() || '';
    const email = authEmailInput?.value.trim().toLowerCase() || '';
    const mobile = authMobileInput?.value.trim() || '';
    const password = authPasswordInput?.value || '';
    const otp = authOtpInput?.value.trim() || '';

    if (!email && !mobile) return (authErrorMessage.textContent = 'Email ya mobile dena zaruri hai.');
    if (authAction === 'signup' && !name) return (authErrorMessage.textContent = 'Signup ke liye full name required hai.');
    if (password.length < 6 || !otp) return (authErrorMessage.textContent = 'Password 6+ aur OTP required hai.');

    try {
      const endpoint = authAction === 'signup' ? '/auth/register' : '/auth/login';
      const response = await apiRequest(endpoint, { name, email, mobile, password, otp, role: authMode });
      setState(authMode, { ...response.user, token: response.token, loggedInAt: new Date().toISOString() });
      closeAuthModal();
      updateAuthButtons();
    } catch (error) {
      authErrorMessage.textContent = error.message;
    }
  };

  const logoutRole = async (role) => {
    const current = getState(role);
    if (!current) return;
    try {
      await apiRequest('/auth/logout', { role }, current.token);
    } catch {
      // ignore and clear local state anyway
    }
    setState(role, null);
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

  updateAuthButtons();
})();
