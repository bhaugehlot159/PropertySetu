(() => {
  const live = window.PropertySetuLive || {};
  const propertyContainer = document.getElementById('propertyContainer');
  const searchInput = document.getElementById('searchInput');
  const locationFilter = document.getElementById('locationFilter');
  const minPrice = document.getElementById('minPrice');
  const maxPrice = document.getElementById('maxPrice');
  const noResult = document.getElementById('noResult');

  if (!propertyContainer || !searchInput || !locationFilter || !minPrice || !maxPrice || !noResult) return;

  const LIST_KEY = 'properties';
  const LEGACY_LIST_KEY = 'propertySetu:listings';
  const FAVORITES_KEY = 'favorites';
  let properties = [];
  let didBoot = false;

  const isCorePropertyId = (value) => /^[a-f0-9]{24}$/i.test(text(value));
  const getLiveToken = () => {
    if (typeof live.getAnyToken === 'function') return text(live.getAnyToken());
    if (typeof live.getToken === 'function') {
      return text(live.getToken('customer') || live.getToken('seller') || live.getToken('admin'));
    }
    return '';
  };

  const readJson = live.readJson || ((key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  });

  const writeJson = live.writeJson || ((key, value) => localStorage.setItem(key, JSON.stringify(value)));

  const text = (value, fallback = '') => {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  };

  const numberFrom = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));

  const normalizeProperty = (item = {}, index = 0) => ({
    id: text(item.id || item._id || item.propertyId, `listing-${index + 1}`),
    title: text(item.title, 'Property Listing'),
    location: text(item.location || item.locality || item.city, 'Udaipur'),
    price: numberFrom(item.price, 0),
    image: text((Array.isArray(item.images) ? item.images[0] : '') || item.image || ''),
    featured: Boolean(item.featured || item.isFeatured || item.highlighted),
  });

  const loadLocalProperties = () => {
    const latestShape = readJson(LEGACY_LIST_KEY, []);
    const oldShape = readJson(LIST_KEY, []);
    const merged = [...(Array.isArray(oldShape) ? oldShape : []), ...(Array.isArray(latestShape) ? latestShape : [])];

    return merged
      .map(normalizeProperty)
      .filter((item) => item.id || item.title)
      .filter((item) => item.location.toLowerCase().includes('udaipur'));
  };

  const getFavoriteSet = () => {
    const list = readJson(FAVORITES_KEY, []);
    const normalized = Array.isArray(list)
      ? list.map((entry) => text(entry)).filter(Boolean)
      : [];
    return new Set(normalized);
  };

  const saveFavoriteSet = (favoriteSet) => {
    writeJson(FAVORITES_KEY, Array.from(favoriteSet));
  };

  const syncFavoritesFromLive = async (visiblePropertyIds = []) => {
    const token = getLiveToken();
    if (!token || typeof live.request !== 'function') return;
    const localSet = getFavoriteSet();
    const visibleSet = new Set((visiblePropertyIds || []).map((id) => text(id)).filter(Boolean));

    try {
      const response = await live.request('/wishlist', { token });
      const items = Array.isArray(response?.items) ? response.items : [];
      const serverIds = new Set(
        items
          .map((item) => text(item?.propertyId || item?.property?.id || item?.property?._id))
          .filter(Boolean)
      );

      for (const id of localSet) {
        const candidate = text(id);
        if (!candidate || !isCorePropertyId(candidate)) continue;
        if (visibleSet.size && !visibleSet.has(candidate)) continue;
        if (serverIds.has(candidate)) continue;
        try {
          await live.request(`/wishlist/${encodeURIComponent(candidate)}`, {
            method: 'POST',
            token,
          });
          serverIds.add(candidate);
        } catch {
          // keep local favorite as safe fallback
        }
      }

      const merged = new Set([...localSet, ...serverIds]);
      saveFavoriteSet(merged);
    } catch {
      // keep local favorites when live API is unavailable
    }
  };

  const renderProperties = () => {
    const searchVal = text(searchInput.value).toLowerCase();
    const locVal = text(locationFilter.value, 'all').toLowerCase();
    const min = numberFrom(minPrice.value, 0);
    const maxInput = text(maxPrice.value);
    const max = maxInput ? numberFrom(maxInput, Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
    const favorites = getFavoriteSet();

    propertyContainer.innerHTML = '';
    let visibleCount = 0;

    properties.forEach((property) => {
      const titleLower = property.title.toLowerCase();
      const locationLower = property.location.toLowerCase();
      const matchSearch = titleLower.includes(searchVal) || locationLower.includes(searchVal);
      const matchLocation = locVal === 'all' || locationLower.includes(locVal);
      const matchPrice = property.price >= min && property.price <= max;
      if (!matchSearch || !matchLocation || !matchPrice) return;

      visibleCount += 1;
      const card = document.createElement('div');
      card.className = 'property-card';
      const safeTitle = escapeHtml(property.title);
      const safeLocation = escapeHtml(property.location);
      const safeImage = property.image
        ? `<img src="${escapeHtml(property.image)}" alt="${safeTitle}">`
        : '<div style="height:160px;display:flex;align-items:center;justify-content:center;background:#f1f5fb;border:1px solid #dce7ff;">No image</div>';
      const isSaved = favorites.has(property.id);
      card.innerHTML = `
        <div style="position:relative">
          ${property.featured ? '<span class="tag">FEATURED</span>' : ''}
          ${safeImage}
        </div>
        <h3>${safeTitle}</h3>
        <p>Location: ${safeLocation}</p>
        <p>Price: ₹${property.price.toLocaleString('en-IN')}</p>
        <button type="button" data-favorite-id="${escapeHtml(property.id)}">${isSaved ? '✅ Saved' : '❤️ Save'}</button>
      `;
      propertyContainer.appendChild(card);
    });

    noResult.style.display = visibleCount === 0 ? 'block' : 'none';
  };

  const toggleFavorite = async (propertyId, button) => {
    const normalizedId = text(propertyId);
    if (!normalizedId) return;
    const token = getLiveToken();
    const canLiveSync = Boolean(token && typeof live.request === 'function' && isCorePropertyId(normalizedId));
    const favorites = getFavoriteSet();
    const shouldSave = !favorites.has(normalizedId);
    if (favorites.has(normalizedId)) {
      favorites.delete(normalizedId);
      if (button) button.textContent = '❤️ Save';
    } else {
      favorites.add(normalizedId);
      if (button) button.textContent = '✅ Saved';
    }
    saveFavoriteSet(favorites);

    if (!canLiveSync) return;
    try {
      await live.request(`/wishlist/${encodeURIComponent(normalizedId)}`, {
        method: shouldSave ? 'POST' : 'DELETE',
        token,
      });
    } catch (error) {
      if (live.strictRealMode) {
        const next = getFavoriteSet();
        if (shouldSave) next.delete(normalizedId);
        else next.add(normalizedId);
        saveFavoriteSet(next);
        if (button) button.textContent = shouldSave ? '❤️ Save' : '✅ Saved';
        window.alert(`Wishlist sync failed: ${text(error?.message, 'Unknown error')}`);
      }
    }
  };

  const loadProperties = async () => {
    if (typeof live.syncLocalListingsFromApi === 'function') {
      try {
        await live.syncLocalListingsFromApi();
      } catch {
        // keep local cache
      }
    }

    let liveItems = [];
    if (typeof live.request === 'function') {
      try {
        const response = await live.request('/properties?city=Udaipur');
        liveItems = (Array.isArray(response?.items) ? response.items : []).map(normalizeProperty);
      } catch {
        liveItems = [];
      }
    }

    properties = liveItems.length ? liveItems : loadLocalProperties();
    writeJson(LIST_KEY, properties);
    await syncFavoritesFromLive(properties.map((item) => item.id));
    renderProperties();
  };

  propertyContainer.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest('button[data-favorite-id]');
    if (!button) return;
    const propertyId = button.getAttribute('data-favorite-id');
    void toggleFavorite(propertyId, button);
  });

  searchInput.addEventListener('input', renderProperties);
  locationFilter.addEventListener('change', renderProperties);
  minPrice.addEventListener('input', renderProperties);
  maxPrice.addEventListener('input', renderProperties);

  const boot = () => {
    if (didBoot) return;
    didBoot = true;
    loadProperties();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
