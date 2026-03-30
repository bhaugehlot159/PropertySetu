(() => {
  const live = window.PropertySetuLive || {};
  const allowDemoFallback = Boolean(live.allowDemoFallback);

  const readJson = live.readJson || ((key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  });

  const text = (value, fallback = '') => {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  };

  const numberFrom = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const formatPrice = (value) => `₹${numberFrom(value, 0).toLocaleString('en-IN')}`;

  const toCardModel = (item = {}) => ({
    id: text(item.id),
    title: text(item.title, 'Property Listing'),
    place: text(item.location || item.locality, 'Udaipur'),
    price: formatPrice(item.price),
    type: text(item.type || item.purpose, 'Buy'),
    aiTag: text(item.verifiedByPropertySetu ? 'AI Verified + Trusted' : 'AI Monitored'),
  });

  const loadListings = async () => {
    if (typeof live.syncLocalListingsFromApi === 'function') {
      try {
        await live.syncLocalListingsFromApi();
      } catch {
        // local listing cache remains available
      }
    }
    const local = readJson('propertySetu:listings', [])
      .filter((item) => String(item?.city || 'Udaipur').toLowerCase().includes('udaipur'))
      .map(toCardModel)
      .filter((item) => item.id || item.title)
      .slice(0, 12);
    return local;
  };

  const renderLiveProperties = (items = []) => {
    const grid = document.getElementById('demoPropertyGrid');
    if (!grid) return;

    if (!items.length) {
      grid.innerHTML = '<article class="card"><h3>No live properties yet</h3><p>Start backend + add listing to populate this block.</p></article>';
      return;
    }

    grid.innerHTML = items
      .map(
        (property) => `
      <article class="card">
        <h3>${property.title}</h3>
        <p><strong>${property.type}</strong> • ${property.place}</p>
        <p>${property.price}</p>
        <p>${property.aiTag}</p>
      </article>
    `,
      )
      .join('');
  };

  const defaultNotifications = allowDemoFallback
    ? [
      'Welcome to PropertySetu notifications.',
      'AI safety monitor active.',
      'Live listing stream will auto-refresh as new properties are added.',
    ]
    : [];

  const loadNotifications = () => {
    const feed = document.getElementById('liveNotifications');
    const status = document.getElementById('notificationStatus');
    if (!feed) return;

    const dynamic = readJson('propertySetu:notifications', []);
    const merged = [
      ...(Array.isArray(dynamic) ? dynamic.map((item) => item?.message).filter(Boolean) : []),
      ...defaultNotifications,
    ].slice(0, 8);

    if (!merged.length) {
      feed.innerHTML = '<li>No live notifications yet.</li>';
      if (status) status.textContent = 'Notification service: waiting for live events';
      return;
    }

    feed.innerHTML = merged.map((msg) => `<li>${msg}</li>`).join('');
    if (status) status.textContent = `Notification service: active (${merged.length} updates)`;
  };

  const broadcastBrowserNotification = () => {
    if (!('Notification' in window)) return;

    const shouldShow = !localStorage.getItem('propertySetu:notified');
    if (!shouldShow) return;

    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        // eslint-disable-next-line no-new
        new Notification('PropertySetu', {
          body: 'Live listing, AI safety and visit notifications are now active.',
        });
        localStorage.setItem('propertySetu:notified', 'yes');
      }
    });
  };

  const setupGlobalAutocomplete = () => {
    const locations = window.PROPERTYSETU_LOCATIONS || [];
    const searchableInputs = [
      document.getElementById('locationSearch'),
      document.getElementById('searchInput'),
    ].filter(Boolean);

    searchableInputs.forEach((input) => {
      const listId = `${input.id || 'search'}-auto-list`;
      let dataList = document.getElementById(listId);

      if (!dataList) {
        dataList = document.createElement('datalist');
        dataList.id = listId;
        input.insertAdjacentElement('afterend', dataList);
      }

      input.setAttribute('list', listId);
      dataList.innerHTML = locations.map((loc) => `<option value="${loc}"></option>`).join('');
    });
  };

  window.addEventListener('storage', (event) => {
    if (event.key === 'propertySetu:notifications') {
      loadNotifications();
    }
  });

  loadListings().then(renderLiveProperties).catch(() => renderLiveProperties([]));
  loadNotifications();
  setupGlobalAutocomplete();
  broadcastBrowserNotification();
})();
