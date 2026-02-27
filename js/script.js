(() => {
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

  const locations = window.PROPERTYSETU_LOCATIONS || [];
  const citySelect = document.getElementById('citySelect');
  const locationSearch = document.getElementById('locationSearch');
  const locationSuggestions = document.getElementById('locationSuggestions');
  const suggestionList = document.getElementById('suggestionList');
  const slugPreview = document.getElementById('slugPreview');
  const tabButtons = document.querySelectorAll('.tab-btn');
  const searchButton = document.getElementById('searchButton');

  if (locationSuggestions) {

    locationSuggestions.innerHTML = locations
      .map((loc) => `<option value="${String(loc).replace(/"/g, '&quot;')}"></option>`)
      .join('');

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

  const dialog = document.getElementById('authDialog');
  const authForm = document.getElementById('authForm');
  const authTitle = document.getElementById('authTitle');
  const authDescription = document.getElementById('authDescription');
  const authStatus = document.getElementById('authStatus');
  const authCancel = document.getElementById('authCancel');
  const authEmail = document.getElementById('authEmail');
  const authPassword = document.getElementById('authPassword');

  const customerAuthBtn = document.getElementById('customerAuthBtn');
  const adminAuthBtn = document.getElementById('adminAuthBtn');
  const customerLogoutBtn = document.getElementById('customerLogoutBtn');
  const adminLogoutBtn = document.getElementById('adminLogoutBtn');

  let activeRole = 'customer';

  const state = {
    customer: JSON.parse(localStorage.getItem('ps_customer_session') || 'null'),
    admin: JSON.parse(localStorage.getItem('ps_admin_session') || 'null'),
  };

  const syncAuthUi = () => {
    const customerLoggedIn = Boolean(state.customer?.email);
    const adminLoggedIn = Boolean(state.admin?.email);

    customerAuthBtn?.classList.toggle('hidden', customerLoggedIn);
    customerLogoutBtn?.classList.toggle('hidden', !customerLoggedIn);
    adminAuthBtn?.classList.toggle('hidden', adminLoggedIn);
    adminLogoutBtn?.classList.toggle('hidden', !adminLoggedIn);

    const customerLabel = customerLoggedIn ? `Customer: ${state.customer.email}` : 'Customer: Logged out';
    const adminLabel = adminLoggedIn ? `Admin: ${state.admin.email}` : 'Admin: Logged out';
    if (authStatus) authStatus.textContent = `Status: ${customerLabel} | ${adminLabel}`;
  };

  const openAuthDialog = (role) => {
    if (!dialog || !authForm || !authTitle || !authDescription) return;
    activeRole = role;
    authForm.reset();
    authTitle.textContent = role === 'admin' ? 'Admin Login' : 'Customer Login';
    authDescription.textContent = role === 'admin'
      ? 'Admin access demo session. Use any valid email/password.'
      : 'Customer access demo session. Use any valid email/password.';
    dialog.showModal();
    authEmail?.focus();
  };

  customerAuthBtn?.addEventListener('click', () => openAuthDialog('customer'));
  adminAuthBtn?.addEventListener('click', () => openAuthDialog('admin'));

  authCancel?.addEventListener('click', () => dialog?.close());

  authForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const email = authEmail?.value.trim();
    const password = authPassword?.value.trim();
    if (!email || !password) return;

    const sessionData = {
      email,
      loginAt: new Date().toISOString(),
      role: activeRole,
    };

    if (activeRole === 'admin') {
      state.admin = sessionData;
      localStorage.setItem('ps_admin_session', JSON.stringify(sessionData));
    } else {
      state.customer = sessionData;
      localStorage.setItem('ps_customer_session', JSON.stringify(sessionData));
    }

    dialog?.close();
    syncAuthUi();
  });

  customerLogoutBtn?.addEventListener('click', () => {
    state.customer = null;
    localStorage.removeItem('ps_customer_session');
    syncAuthUi();
  });

  adminLogoutBtn?.addEventListener('click', () => {
    state.admin = null;
    localStorage.removeItem('ps_admin_session');
    syncAuthUi();
  });

  syncAuthUi();
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
})();
