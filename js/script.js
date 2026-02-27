(() => {
  const authKey = 'propertySetu:session';

  const renderAuth = () => {
    const session = JSON.parse(localStorage.getItem(authKey) || 'null');
    const strip = document.getElementById('authStrip');
    const logoutBtn = document.getElementById('logoutBtn');

  const setCanvasSize = () => {
    canvas.width = window.innerWidth;
    canvas.height = canvas.parentElement ? canvas.parentElement.offsetHeight : window.innerHeight;
  };

  const buildStars = () => {
    stars.length = 0;
    for (let index = 0; index < 140; index += 1) {
    for (let i = 0; i < 140; i += 1) {
      stars.push({
        x: (Math.random() - 0.5) * canvas.width,
        y: (Math.random() - 0.5) * canvas.height,
        z: Math.random() * canvas.width,
      });
    if (!strip || !logoutBtn) return;

    if (!session) {
      strip.textContent = 'Not logged in';
      logoutBtn.style.display = 'none';
      return;
    }

    strip.textContent = `Logged in as ${session.role}: ${session.username}`;
    logoutBtn.style.display = 'inline-block';
  };

  const login = (role) => {
    const username = window.prompt(`Enter ${role} username`, role === 'admin' ? 'admin' : 'customer');
    if (!username) return;

    localStorage.setItem(authKey, JSON.stringify({ role, username }));
    renderAuth();
  };

  document.getElementById('customerAuthBtn')?.addEventListener('click', () => login('customer'));
  document.getElementById('adminAuthBtn')?.addEventListener('click', () => login('admin'));
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem(authKey);
    renderAuth();
  });

  renderAuth();

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
  });
}

const locations = window.PROPERTYSETU_LOCATIONS || [];
const input = document.getElementById('locationSearch');
const citySelect = document.getElementById('citySelect');
const slugPreview = document.getElementById('slugPreview');
const suggestionList = document.getElementById('suggestionList');
const searchButton = document.getElementById('searchButton');
const tabButtons = document.querySelectorAll('.tab-btn');
const authBtn = document.getElementById('authBtn');
const locationSuggestions = document.getElementById('locationSuggestions');
const tabButtons = document.querySelectorAll('.tab-btn');

if (locationSuggestions) {
  locationSuggestions.innerHTML = locations.map((location) => `<option value="${location}"></option>`).join('');
}

if (citySelect && slugPreview) {
  citySelect.addEventListener('change', () => {
    slugPreview.textContent = `SEO path preview: propertysetu.in/${citySelect.value}`;
  });
}

if (input) {
  input.addEventListener('input', () => {
    if (!suggestionList) return;

    const value = input.value.toLowerCase().trim();
    if (value.length < 2) {
      suggestionList.innerHTML = '';
      return;
    }

    const filtered = locations.filter((location) => location.toLowerCase().includes(value)).slice(0, 8);
    suggestionList.innerHTML = filtered.map((location) => `<li>${location}</li>`).join('');
    const filtered = locations.filter((loc) => loc.toLowerCase().includes(value)).slice(0, 8);
    suggestionList.innerHTML = filtered.map((loc) => `<li>${loc}</li>`).join('');

    suggestionList.querySelectorAll('li').forEach((item) => {
      item.addEventListener('click', () => {
        input.value = item.textContent || '';
        suggestionList.innerHTML = '';
      });
    });
  });
}

tabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    tabButtons.forEach((tab) => tab.classList.remove('active'));
    button.classList.add('active');
  });
});

if (searchButton) {
  searchButton.addEventListener('click', () => {
    const selectedMode = document.querySelector('.tab-btn.active')?.dataset.mode || 'buy';
    const city = citySelect?.value || 'udaipur';
    const location = input?.value.trim() || 'all-areas';
    const normalizedLocation = location.toLowerCase().replace(/\s+/g, '-');

    window.location.hash = `search/${city}/${selectedMode}/${normalizedLocation}`;

    window.location.hash = `search/${city}/${selectedMode}/${normalizedLocation}`;
  });
}

if (authBtn) {
  const setState = () => {
    const token = localStorage.getItem('propertySetu:session');
    authBtn.textContent = token ? 'Logout' : 'Login';
  };

  authBtn.addEventListener('click', () => {
    const token = localStorage.getItem('propertySetu:session');
    if (token) {
      localStorage.removeItem('propertySetu:session');
      localStorage.removeItem('propertySetu:userRole');
      setState();
      return;
    }

    const role = prompt('Login role (customer/seller/admin):', 'customer');
    if (!role) return;
    localStorage.setItem('propertySetu:session', `${Date.now()}`);
    localStorage.setItem('propertySetu:userRole', role.toLowerCase());
    setState();
  });

  setState();
}
    animate();
    window.addEventListener('resize', () => {
      setCanvasSize();
      buildStars();
    });
  }

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

    const filtered = locations.filter((loc) => loc.toLowerCase().includes(value)).slice(0, 10);
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
  const authModal = document.getElementById('authModal');
  const authModalTitle = document.getElementById('authModalTitle');
  const authModalHint = document.getElementById('authModalHint');
  const authNameInput = document.getElementById('authNameInput');
  const authCancelButton = document.getElementById('authCancelButton');
  const authSubmitButton = document.getElementById('authSubmitButton');
  let authMode = 'customer';

  const getState = (role) => {
    const raw = localStorage.getItem(`propertysetu-${role}-session`);
    return raw ? JSON.parse(raw) : null;
  };

  const setState = (role, payload) => {
    if (!payload) {
      localStorage.removeItem(`propertysetu-${role}-session`);
      return;
    }
    localStorage.setItem(`propertysetu-${role}-session`, JSON.stringify(payload));
  };

  const updateAuthButtons = () => {
    const customerState = getState('customer');
    const adminState = getState('admin');

    if (customerAuthButton) {
      customerAuthButton.textContent = customerState ? `Logout ${customerState.name}` : 'Customer Login';
    }
    if (adminAuthButton) {
      adminAuthButton.textContent = adminState ? `Logout ${adminState.name}` : 'Admin Login';
    }
  };

  const openAuthModal = (role) => {
    authMode = role;
    if (!authModal || !authModalTitle || !authModalHint || !authNameInput) return;
    authModalTitle.textContent = role === 'admin' ? 'Admin Login' : 'Customer Login';
    authModalHint.textContent = role === 'admin'
      ? 'Enter admin display name to start admin session.'
      : 'Enter customer display name to start customer session.';
    authNameInput.value = '';
    authModal.classList.add('show');
    authModal.setAttribute('aria-hidden', 'false');
    authNameInput.focus();
  };

  const closeAuthModal = () => {
    if (!authModal) return;
    authModal.classList.remove('show');
    authModal.setAttribute('aria-hidden', 'true');
  };

  customerAuthButton?.addEventListener('click', () => {
    const current = getState('customer');
    if (current) {
      setState('customer', null);
      updateAuthButtons();
      return;
    }
    openAuthModal('customer');
  });

  adminAuthButton?.addEventListener('click', () => {
    const current = getState('admin');
    if (current) {
      setState('admin', null);
      updateAuthButtons();
      return;
    }
    openAuthModal('admin');
  });

  authCancelButton?.addEventListener('click', closeAuthModal);

  authSubmitButton?.addEventListener('click', () => {
    const displayName = authNameInput?.value.trim();
    if (!displayName) return;
    setState(authMode, { name: displayName, loggedInAt: new Date().toISOString() });
    closeAuthModal();
    updateAuthButtons();
  });

  authModal?.addEventListener('click', (event) => {
    if (event.target === authModal) closeAuthModal();
  });

  updateAuthButtons();
})();
