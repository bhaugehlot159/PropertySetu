(() => {
  const live = window.PropertySetuLive || {};
  const userPropertiesDiv = document.getElementById('userProperties');
  const LISTINGS_KEY = 'propertySetu:listings';
  const BASE_BACKUP_KEYS = [
    'propertySetu:listings',
    'propertySetu:addPropertyDraft',
    'propertySetu:notifications',
    'propertySetu:notified',
    'propertysetu-marketplace-state',
    'propertysetu-customer-session',
    'propertysetu-admin-session',
    'propertysetu-seller-session',
    'properties',
    'favorites',
  ];
  const backupStatus = document.getElementById('backupStatus');

  const readJson = live.readJson || ((key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  });

  const writeJson = live.writeJson || ((key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  });

  const pushNotification = (message, audience = ['all'], title = 'PropertySetu Update', type = 'info') => {
    if (!message) return;
    const notifyApi = window.PropertySetuNotify;
    if (notifyApi && typeof notifyApi.emit === 'function') {
      notifyApi.emit({ title, message, audience, type });
      return;
    }
    const existing = readJson('propertySetu:notifications', []);
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
    writeJson('propertySetu:notifications', list);
    try {
      localStorage.setItem('propertySetu:notifications:ping', String(Date.now()));
    } catch {
      // no-op
    }
  };

  const isUdaipurListing = (item) => {
    const city = String(item?.city || 'Udaipur').trim().toLowerCase();
    return city.includes('udaipur');
  };

  const safeParse = (value) => {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  };

  const normalizePurpose = live.normalizePurpose || ((value) => String(value || '').trim() || 'Buy');

  const normalizeListing = (item) => {
    if (!item || typeof item !== 'object') return null;
    if (!isUdaipurListing(item)) return null;
    return {
      ...item,
      city: 'Udaipur',
      locality: item.locality || item.location || 'Udaipur',
      purpose: item.purpose || normalizePurpose(item.type),
      price: Number(item.price || 0),
      listedAt: item.listedAt || item.createdAt || new Date().toISOString(),
    };
  };

  const getBackupKeys = () => {
    const keys = new Set(BASE_BACKUP_KEYS);
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;
      const normalized = key.toLowerCase();
      if (normalized.includes('propertysetu') || key === 'properties' || key === 'favorites') {
        keys.add(key);
      }
    }
    return [...keys];
  };

  const downloadLocalData = () => {
    const storageData = {};
    const keys = getBackupKeys();

    keys.forEach((key) => {
      const value = localStorage.getItem(key);
      if (value !== null) storageData[key] = safeParse(value);
    });

    if (!Object.keys(storageData).length) {
      if (backupStatus) backupStatus.textContent = 'Backup skipped: local data nahi mila.';
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `propertysetu-local-data-${timestamp}.json`;
    const payload = {
      app: 'PropertySetu',
      exportedAt: new Date().toISOString(),
      storage: storageData,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    if (backupStatus) backupStatus.textContent = `Backup saved: ${fileName}`;
    pushNotification(
      `Local data backup downloaded: ${fileName}`,
      ['customer', 'seller', 'admin'],
      'Backup Downloaded',
      'info',
    );
  };

  const syncApiListings = async () => {
    if (!live.request) return;
    const token = live.getAnyToken ? live.getAnyToken() : '';
    if (!token) return;
    try {
      const response = await live.request('/properties?city=Udaipur&mine=1', { token });
      const apiItems = (response?.items || [])
        .map((entry) => (live.normalizeApiListing ? live.normalizeApiListing(entry) : normalizeListing(entry)))
        .filter(Boolean);
      const merged = live.mergeById
        ? live.mergeById(apiItems, readJson(LISTINGS_KEY, []))
        : [...apiItems, ...readJson(LISTINGS_KEY, []).filter((item) => !apiItems.some((x) => x.id === item.id))];
      writeJson(LISTINGS_KEY, merged);
    } catch (error) {
      if (backupStatus) backupStatus.textContent = `Live sync skipped: ${error.message}`;
    }
  };

  const getVisibleListings = () => {
    const allListings = readJson(LISTINGS_KEY, []);
    const normalized = allListings.map(normalizeListing).filter(Boolean);
    const session = live.getAnySession ? live.getAnySession() : null;
    if (session?.id) {
      const mine = normalized.filter((item) => item.ownerId === session.id);
      if (mine.length) return mine;
    }
    return normalized;
  };

  const renderProperties = () => {
    if (!userPropertiesDiv) return;
    const listings = getVisibleListings()
      .sort((a, b) => new Date(b.listedAt).getTime() - new Date(a.listedAt).getTime());

    userPropertiesDiv.innerHTML = '';
    if (!listings.length) {
      userPropertiesDiv.innerHTML = '<p>Udaipur listing abhi nahi hai. Add Property page se new listing create karein.</p>';
      return;
    }

    listings.forEach((prop) => {
      const card = document.createElement('div');
      card.className = 'property-card';
      card.innerHTML = `
        <h3>${prop.title || 'Untitled'} ${prop.status === 'Approved' ? '<span class="badge">Verified</span>' : ''}</h3>
        <p><b>Category:</b> ${prop.category || '-'}</p>
        <p><b>City:</b> Udaipur</p>
        <p><b>Location:</b> ${prop.location || prop.locality || '-'}</p>
        <p><b>Price:</b> ₹${Number(prop.price || 0).toLocaleString('en-IN')}</p>
        <p><b>Status:</b> ${prop.status || 'Pending Approval'}</p>
        <button data-id="${prop.id}" class="edit-btn">Edit ✏️</button>
        <button data-id="${prop.id}" class="delete-btn">Delete 🗑️</button>
      `;
      userPropertiesDiv.appendChild(card);
    });
  };

  const deleteListing = async (id) => {
    let apiDeleted = false;
    const token = live.getAnyToken ? live.getAnyToken() : '';
    if (id && token && live.request) {
      try {
        await live.request(`/properties/${encodeURIComponent(id)}`, { method: 'DELETE', token });
        apiDeleted = true;
      } catch (error) {
        if (!live.shouldFallbackToLocal || !live.shouldFallbackToLocal(error)) {
          window.alert(error.message || 'Delete failed.');
          return false;
        }
      }
    }

    const allListings = readJson(LISTINGS_KEY, []);
    const next = allListings.filter((item) => item.id !== id);
    writeJson(LISTINGS_KEY, next);
    if (apiDeleted && backupStatus) backupStatus.textContent = 'Listing deleted from live API and local cache.';
    pushNotification(
      `Listing ${id} deleted ${apiDeleted ? 'from live and local cache' : 'from local cache'}.`,
      ['customer', 'seller', 'admin'],
      'Listing Deleted',
      apiDeleted ? 'warn' : 'info',
    );
    return true;
  };

  userPropertiesDiv?.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.classList.contains('edit-btn')) {
      window.alert('Edit flow Add Property page ke through continue karein.');
      return;
    }

    if (target.classList.contains('delete-btn')) {
      const id = target.dataset.id;
      if (!id) return;
      const ok = await deleteListing(id);
      if (ok) renderProperties();
    }
  });

  document.getElementById('downloadLocalDataBtn')?.addEventListener('click', downloadLocalData);
  window.downloadLocalData = downloadLocalData;

  syncApiListings().finally(renderProperties);
})();
