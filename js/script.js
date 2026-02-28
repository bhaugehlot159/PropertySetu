(() => {
  const API_BASE = `${window.location.origin}/api`;

  const canvas = document.getElementById('heroCanvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    const stars = [];

    const setCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = canvas.parentElement?.offsetHeight || window.innerHeight;
    };

    const buildStars = () => {
      stars.length = 0;
      for (let index = 0; index < 140; index += 1) {
        stars.push({
          x: (Math.random() - 0.5) * canvas.width,
          y: (Math.random() - 0.5) * canvas.height,
          z: Math.random() * canvas.width,
        });
      }
    };

    const animate = () => {
      ctx.fillStyle = '#0b2f6b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      stars.forEach((star) => {
        star.z -= 2;
        if (star.z <= 1) star.z = canvas.width;
        const scale = 128 / star.z;
        const px = star.x * scale + canvas.width / 2;
        const py = star.y * scale + canvas.height / 2;
        if (px >= 0 && px <= canvas.width && py >= 0 && py <= canvas.height) {
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.fillRect(px, py, 2, 2);
        }
      });
      requestAnimationFrame(animate);
    };

    setCanvasSize();
    buildStars();
    animate();
    window.addEventListener('resize', () => {
      setCanvasSize();
      buildStars();
    });
  }

  const readJsonStorage = (key, fallbackValue) => {
    const raw = localStorage.getItem(key);
    if (!raw) return fallbackValue;
    try {
      return JSON.parse(raw);
    } catch {
      return fallbackValue;
    }
  };

  const writeJsonStorage = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  };

  const locations = window.PROPERTYSETU_LOCATIONS || [];
  const citySelect = document.getElementById('citySelect');
  const locationSearch = document.getElementById('locationSearch');
  const locationSuggestions = document.getElementById('locationSuggestions');
  const suggestionList = document.getElementById('suggestionList');
  const slugPreview = document.getElementById('slugPreview');
  const tabButtons = document.querySelectorAll('.tab-btn');
  const searchButton = document.getElementById('searchButton');

  if (locationSuggestions) {
    locationSuggestions.innerHTML = locations.map((loc) => `<option value="${loc}"></option>`).join('');
  }

  citySelect?.addEventListener('change', () => {
    if (slugPreview) slugPreview.textContent = `SEO path preview: propertysetu.in/${citySelect.value}`;
  });

  locationSearch?.addEventListener('input', () => {
    if (!suggestionList) return;
    const value = locationSearch.value.toLowerCase().trim();
    if (value.length < 2) {
      suggestionList.innerHTML = '';
      return;
    }

    const filtered = locations
      .filter((loc) => loc.toLowerCase().includes(value))
      .sort((a, b) => {
        const aStarts = a.toLowerCase().startsWith(value) ? 0 : 1;
        const bStarts = b.toLowerCase().startsWith(value) ? 0 : 1;
        return aStarts - bStarts || a.localeCompare(b);
      })
      .slice(0, 25);

    suggestionList.innerHTML = filtered.map((loc) => `<li>${loc}</li>`).join('');
    suggestionList.querySelectorAll('li').forEach((item) => {
      item.addEventListener('click', () => {
        locationSearch.value = item.textContent || '';
        suggestionList.innerHTML = '';
      });
    });
  });

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabButtons.forEach((tab) => tab.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  searchButton?.addEventListener('click', () => {
    const mode = document.querySelector('.tab-btn.active')?.dataset.mode || 'buy';
    const city = citySelect?.value || 'udaipur';
    const location = locationSearch?.value.trim() || 'all-areas';
    window.location.hash = `search/${city}/${mode}/${location.toLowerCase().replace(/\s+/g, '-')}`;
  });

  const customerAuthButton = document.getElementById('customerAuthButton');
  const adminAuthButton = document.getElementById('adminAuthButton');
  const sessionBadge = document.getElementById('sessionBadge');
  const customerFeatureStatus = document.getElementById('customerFeatureStatus');
  const liveDashboard = document.getElementById('liveDashboard');

  const authModal = document.getElementById('authModal');
  const authModalTitle = document.getElementById('authModalTitle');
  const authModalHint = document.getElementById('authModalHint');
  const authActionSelect = document.getElementById('authActionSelect');
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

  const getState = (role) => readJsonStorage(`propertysetu-${role}-session`, null);
  const setState = (role, payload) => {
    if (!payload) {
      localStorage.removeItem(`propertysetu-${role}-session`);
      return;
    }
    writeJsonStorage(`propertysetu-${role}-session`, payload);
  };


  const renderLiveDashboard = () => {
    if (!liveDashboard) return;
    const customerState = getState('customer');
    const adminState = getState('admin');

    if (!customerState && !adminState) {
      liveDashboard.classList.add('locked');
      liveDashboard.innerHTML = '<p class="dashboard-empty">Login karo to dashboard modules unlock ho jayenge.</p>';
      return;
    }

    liveDashboard.classList.remove('locked');

    if (adminState) {
      liveDashboard.innerHTML = `
        <h3>Welcome Admin, ${adminState.name}</h3>
        <div class="dashboard-grid">
          <article class="dashboard-card"><h4>Verification Queue</h4><p>Property approvals, user KYC aur suspicious activity moderation.</p></article>
          <article class="dashboard-card"><h4>Bid Oversight</h4><p>Hidden bids reveal, winner validation aur secure audit trail.</p></article>
          <article class="dashboard-card"><h4>Platform Controls</h4><p>Reports handling, featured listings, fraud prevention controls.</p></article>
        </div>
        <div class="dashboard-links">
          <a href="admin-dashboard.html">Open Admin Dashboard</a>
          <a href="client/pages/admin-portal.html">Open Admin Portal</a>
        </div>
      `;
      return;
    }

    liveDashboard.innerHTML = `
      <h3>Welcome Customer, ${customerState.name}</h3>
      <div class="dashboard-grid">
        <article class="dashboard-card"><h4>Wishlist & Compare</h4><p>Favorite listings manage karo aur side-by-side comparison karo.</p></article>
        <article class="dashboard-card"><h4>Visit & Chat</h4><p>Site visits schedule karo, support chat aur property care services use karo.</p></article>
        <article class="dashboard-card"><h4>Bidding & AI Tools</h4><p>Sealed bid submit karo, location insights aur pricing AI signals dekho.</p></article>
      </div>
      <div class="dashboard-links">
        <a href="dashboard.html">Open Customer Dashboard</a>
        <a href="client/pages/customer-portal.html">Open Customer Portal</a>
      </div>
    `;
  };

  const updateAuthButtons = () => {
    const customerState = getState('customer');
    const adminState = getState('admin');

    if (customerAuthButton) customerAuthButton.textContent = customerState ? `Customer Logout (${customerState.name})` : 'Customer Login';
    if (adminAuthButton) adminAuthButton.textContent = adminState ? `Admin Logout (${adminState.name})` : 'Admin Login';

    if (sessionBadge) {
      if (adminState) sessionBadge.textContent = `Admin: ${adminState.name}`;
      else if (customerState) sessionBadge.textContent = `Customer: ${customerState.name}`;
      else sessionBadge.textContent = 'Guest Mode';
    }

    if (customerFeatureStatus) {
      customerFeatureStatus.textContent = customerState
        ? `✅ Welcome ${customerState.name}. All customer features unlocked: Wishlist, Compare, Visit, Chat, Bid, AI tools, Legal docs.`
        : 'Please login as customer to unlock this panel.';
    }

    renderLiveDashboard();
  };

  const setAuthAction = (mode) => {
    authAction = mode === 'signup' ? 'signup' : 'login';
    authLoginTab?.classList.toggle('active', authAction === 'login');
    authSignupTab?.classList.toggle('active', authAction === 'signup');
    if (authSubmitButton) authSubmitButton.textContent = authAction === 'signup' ? 'Create Account' : 'Login';
    if (authNameInput) authNameInput.style.display = authAction === 'signup' ? 'block' : 'none';
  };

  const setAuthAction = (mode) => {
    authAction = mode === 'signup' ? 'signup' : 'login';
    authLoginTab?.classList.toggle('active', authAction === 'login');
    authSignupTab?.classList.toggle('active', authAction === 'signup');
    if (authSubmitButton) authSubmitButton.textContent = authAction === 'signup' ? 'Create Account' : 'Login';
    if (authNameInput) authNameInput.style.display = authAction === 'signup' ? 'block' : 'none';
  };

  const openAuthModal = (role) => {
    authMode = role;
    if (!authModal || !authModalTitle || !authModalHint) return;
    authModalTitle.textContent = role === 'admin' ? 'Admin Secure Access' : 'Customer Secure Access';
    authModalHint.textContent = 'Email ya Mobile number se login/signup karein. Demo OTP: 123456';
    if (authErrorMessage) authErrorMessage.textContent = '';
    if (authActionSelect) authActionSelect.value = 'login';
    if (authNameInput) authNameInput.value = '';
    if (authEmailInput) authEmailInput.value = '';
    if (authMobileInput) authMobileInput.value = '';
    if (authPasswordInput) authPasswordInput.value = '';
    if (authOtpInput) authOtpInput.value = '123456';
    setAuthAction('login');
    authModal.classList.add('show');
    authModal.setAttribute('aria-hidden', 'false');
    authEmailInput?.focus();
  };

  const closeAuthModal = () => {
    if (!authModal) return;
    authModal.classList.remove('show');
    authModal.setAttribute('aria-hidden', 'true');
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

  const performLogout = async (role) => {
    const state = getState(role);
    if (state?.token) {
      try {
        await apiRequest('/auth/logout', null, state.token);
      } catch {
        // no-op for stateless logout
      }
    }
    setState(role, null);
    updateAuthButtons();
  };

  const doAuthFlow = async () => {
    const action = authActionSelect?.value || 'login';
    const name = authNameInput?.value.trim() || '';
    const email = authEmailInput?.value.trim().toLowerCase() || '';
    const mobile = authMobileInput?.value.trim() || '';
    const password = authPasswordInput?.value || '';
    const otp = authOtpInput?.value.trim() || '';

    if (!email && !mobile) {
      if (authErrorMessage) authErrorMessage.textContent = 'Email ya mobile number me se koi ek dena zaruri hai.';
      return;
    }

    if (authAction === 'signup' && !name) {
      if (authErrorMessage) authErrorMessage.textContent = 'Signup ke liye full name required hai.';
      return;
    }

    if (password.length < 6 || !otp) {
      if (authErrorMessage) authErrorMessage.textContent = 'Password 6+ characters aur OTP required hai.';
      return;
    }

    if (authErrorMessage) authErrorMessage.textContent = '';
    const payload = { name, email, mobile, password, otp, role: authMode };

    try {
      const endpoint = authAction === 'signup' ? '/auth/register' : '/auth/login';
      const authResponse = await apiRequest(endpoint, payload);
      setState(authMode, { ...authResponse.user, token: authResponse.token, loggedInAt: new Date().toISOString() });
      closeAuthModal();
      updateAuthButtons();
    } catch (authError) {
      if (authAction === 'login' && String(authError.message || '').includes('User not found')) {
        if (authErrorMessage) authErrorMessage.textContent = 'Account nahi mila. Signup tab pe jaake account banayein.';
        return;
      }
      if (authErrorMessage) authErrorMessage.textContent = authError.message;
    }
  };


  const logoutRole = async (role) => {
    const current = getState(role);
    if (!current) return;

    try {
      await apiRequest('/auth/logout', { role }, current.token);
    } catch {
      // ignore server error, still clear local session
    }

    setState(role, null);
    updateAuthButtons();
  };

  customerAuthButton?.addEventListener('click', async () => {
    const current = getState('customer');
    if (current) {
      await logoutRole('customer');
      return;
    }
    openAuthModal('customer', 'login');
  });

  adminAuthButton?.addEventListener('click', async () => {
    const current = getState('admin');
    if (current) {
      await logoutRole('admin');
      return;
    }
    openAuthModal('admin', 'login');
  });

  authLoginModeButton?.addEventListener('click', () => {
    authActionMode = 'login';
    updateAuthActionUI();
  });

  authSignupModeButton?.addEventListener('click', () => {
    authActionMode = 'signup';
    updateAuthActionUI();
  });

  authContactMethod?.addEventListener('change', updateContactPlaceholder);
  authLoginModeButton?.addEventListener('click', () => setAuthAction('login'));
  authSignupModeButton?.addEventListener('click', () => setAuthAction('signup'));
  authCancelButton?.addEventListener('click', closeAuthModal);
  authSubmitButton?.addEventListener('click', doAuthFlow);
  authLoginTab?.addEventListener('click', () => setAuthAction('login'));
  authSignupTab?.addEventListener('click', () => setAuthAction('signup'));

  authModal?.addEventListener('click', (event) => {
    if (event.target === authModal) closeAuthModal();
  });

  const marketplaceMessage = document.getElementById('marketplaceMessage');
  const wishlistCount = document.getElementById('wishlistCount');
  const compareCount = document.getElementById('compareCount');
  const visitCount = document.getElementById('visitCount');
  const sealedBidCount = document.getElementById('sealedBidCount');
  const revealBidsButton = document.getElementById('revealBidsButton');
  const clearWishlistButton = document.getElementById('clearWishlistButton');
  const clearCompareButton = document.getElementById('clearCompareButton');

  const initialMarketplace = readJsonStorage('propertysetu-marketplace-state', {
    wishlist: [],
    compare: [],
    visits: [],
    bids: [],
  });

  const marketplaceState = {
    wishlist: new Set(initialMarketplace.wishlist || []),
    compare: new Set(initialMarketplace.compare || []),
    visits: initialMarketplace.visits || [],
    bids: initialMarketplace.bids || [],
  };

  const persistMarketplaceState = () => {
    writeJsonStorage('propertysetu-marketplace-state', {
      wishlist: [...marketplaceState.wishlist],
      compare: [...marketplaceState.compare],
      visits: marketplaceState.visits,
      bids: marketplaceState.bids,
    });
  };

  const updateMarketplaceStats = () => {
    if (wishlistCount) wishlistCount.textContent = `${marketplaceState.wishlist.size}`;
    if (compareCount) compareCount.textContent = `${marketplaceState.compare.size}`;
    if (visitCount) visitCount.textContent = `${marketplaceState.visits.length}`;
    if (sealedBidCount) sealedBidCount.textContent = `${marketplaceState.bids.length}`;
  };

  const notify = (message) => {
    if (marketplaceMessage) marketplaceMessage.textContent = message;
  };

  const ensureCustomerSession = () => {
    const customer = getState('customer');
    if (customer) return customer;
    notify('Please login as Customer first to use this feature.');
    openAuthModal('customer');
    return null;
  };

  document.querySelectorAll('.listing-card').forEach((card) => {
    const propertyId = card.dataset.propertyId;
    const title = card.dataset.title || 'Property';

    card.querySelectorAll('.action-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        const action = button.dataset.action;
        const customer = ensureCustomerSession();
        if (!customer) return;

        if (action === 'wishlist') {
          if (marketplaceState.wishlist.has(propertyId)) {
            marketplaceState.wishlist.delete(propertyId);
            notify(`${title} removed from wishlist.`);
          } else {
            marketplaceState.wishlist.add(propertyId);
            notify(`${title} saved to wishlist.`);
          }
        }

        if (action === 'compare') {
          if (marketplaceState.compare.has(propertyId)) {
            marketplaceState.compare.delete(propertyId);
            notify(`${title} removed from compare.`);
          } else if (marketplaceState.compare.size >= 3) {
            notify('Compare supports up to 3 properties at once.');
          } else {
            marketplaceState.compare.add(propertyId);
            notify(`${title} added to compare.`);
          }
        }

        if (action === 'visit') {
          marketplaceState.visits.push({ propertyId, at: new Date().toISOString() });
          notify(`Visit request created for ${title}.`);
        }

        if (action === 'bid') {
          const bidValue = window.prompt(`Enter your sealed bid amount for ${title} (₹):`);
          const amount = Number(bidValue);
          if (!bidValue || Number.isNaN(amount) || amount <= 0) {
            notify('Please enter a valid positive bid amount.');
            return;
          }

          try {
            await apiRequest('/sealed-bids', { propertyId, propertyTitle: title, amount }, customer.token);
            marketplaceState.bids.push({ propertyId, title, amount, at: new Date().toISOString() });
            notify(`Sealed bid submitted for ${title}. Only admin can reveal winner.`);
          } catch (error) {
            notify(error.message);
            return;
          }
        }

        updateMarketplaceStats();
        persistMarketplaceState();
      });
    });
  });

  clearWishlistButton?.addEventListener('click', () => {
    marketplaceState.wishlist.clear();
    updateMarketplaceStats();
    persistMarketplaceState();
    notify('Wishlist cleared.');
  });

  clearCompareButton?.addEventListener('click', () => {
    marketplaceState.compare.clear();
    updateMarketplaceStats();
    persistMarketplaceState();
    notify('Compare list cleared.');
  });

  revealBidsButton?.addEventListener('click', async () => {
    const admin = getState('admin');
    if (!admin) {
      notify('Admin login required to reveal winning bid.');
      openAuthModal('admin');
      return;
    }

    try {
      const response = await apiRequest('/sealed-bids/reveal', null, admin.token);
      if (!response.winners?.length) {
        notify('No bids available yet.');
        return;
      }
      const summary = response.winners.map((entry) => `${entry.propertyTitle}: ₹${entry.amount.toLocaleString('en-IN')}`).join(' | ');
      notify(`Winning sealed bids revealed by ${admin.name} → ${summary}`);
    } catch (error) {
      notify(error.message);
    }
  });

  const aiPromptInput = document.getElementById('aiPromptInput');
  const aiGenerateButton = document.getElementById('aiGenerateButton');
  const aiOutput = document.getElementById('aiOutput');

  aiGenerateButton?.addEventListener('click', () => {
    const promptText = aiPromptInput?.value.trim();
    if (!promptText) {
      if (aiOutput) aiOutput.textContent = 'Please enter property details to generate description.';
      return;
    }

    if (aiOutput) {
      aiOutput.textContent = `Verified ${promptText}. Includes strong location connectivity, visit-booking support, hidden-bid option, and monthly property-care coverage for absentee owners.`;
    }
  });

  updateMarketplaceStats();
  updateAuthButtons();
})();
