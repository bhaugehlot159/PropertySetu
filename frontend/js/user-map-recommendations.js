(() => {
  if (document.getElementById('userMapRecoCard')) return;

  const live = window.PropertySetuLive || {};
  const propertySelect = document.getElementById('propertySelect');
  if (!propertySelect) return;

  const STYLE_ID = 'user-map-reco-style';
  const CARD_ID = 'userMapRecoCard';
  const LISTINGS_KEY = 'propertySetu:listings';

  const text = (value, fallback = '') => {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  };

  const numberFrom = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const inr = (value) => `₹${numberFrom(value, 0).toLocaleString('en-IN')}`;

  const escapeHtml = (value) => (
    String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  );

  const readJson = live.readJson || ((key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  });

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${CARD_ID} .umr-status { margin: 0 0 10px; color: #1f6d3d; font-size: 14px; }
#${CARD_ID} .umr-layout { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
#${CARD_ID} .umr-block { border: 1px solid #dce5f1; border-radius: 10px; padding: 10px; background: #fff; }
#${CARD_ID} .umr-block h3 { margin: 0 0 8px; color: #11466e; font-size: 16px; }
#${CARD_ID} .umr-toolbar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
#${CARD_ID} .umr-btn {
  border: 1px solid #0b3d91;
  border-radius: 8px;
  background: #0b3d91;
  color: #fff;
  padding: 7px 11px;
  font-weight: 700;
  cursor: pointer;
}
#${CARD_ID} .umr-btn.alt { background: #fff; color: #0b3d91; }
#${CARD_ID} .umr-links { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
#${CARD_ID} .umr-links a {
  border-radius: 999px;
  border: 1px solid #cddcf2;
  padding: 4px 10px;
  text-decoration: none;
  color: #13486f;
  font-size: 12px;
  background: #f8fbff;
}
#${CARD_ID} .umr-map { width: 100%; height: 260px; border: 1px solid #cddcf2; border-radius: 8px; background: #f7fbff; }
#${CARD_ID} .umr-grid { display: grid; gap: 8px; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); margin-bottom: 8px; }
#${CARD_ID} .umr-grid label { font-size: 12px; color: #35597d; display: block; margin-bottom: 4px; }
#${CARD_ID} .umr-grid input, #${CARD_ID} .umr-grid select {
  width: 100%;
  border: 1px solid #cad9ef;
  border-radius: 8px;
  padding: 7px 9px;
}
#${CARD_ID} .umr-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
#${CARD_ID} .umr-item { border: 1px solid #dce5f1; border-radius: 8px; padding: 8px; background: #f8fbff; }
#${CARD_ID} .umr-title { font-weight: 700; color: #12395f; }
#${CARD_ID} .umr-meta { margin-top: 4px; color: #4a617b; font-size: 13px; line-height: 1.35; }
#${CARD_ID} .umr-pick-btn {
  margin-top: 7px;
  border-radius: 999px;
  border: 1px solid #b8cfee;
  background: #fff;
  color: #103f66;
  font-size: 12px;
  padding: 4px 10px;
  cursor: pointer;
}
    `;
    document.head.appendChild(style);
  }

  const card = document.createElement('div');
  card.className = 'container';
  card.id = CARD_ID;
  card.innerHTML = `
    <h2>Map & Similar Properties</h2>
    <p id="umrStatus" class="umr-status">Select a property to load map and recommendations.</p>
    <div class="umr-layout">
      <section class="umr-block">
        <h3>Map View</h3>
        <div class="umr-toolbar">
          <button id="umrLoadSelectedBtn" class="umr-btn" type="button">Load Selected Property</button>
          <button id="umrRefreshMapBtn" class="umr-btn alt" type="button">Refresh Map</button>
        </div>
        <div class="umr-grid">
          <div>
            <label for="umrQueryInput">Map Query</label>
            <input id="umrQueryInput" placeholder="e.g. Hiran Magri Udaipur" />
          </div>
        </div>
        <div class="umr-links">
          <a id="umrOpenMapLink" href="#" target="_blank" rel="noopener noreferrer">Open Map</a>
          <a id="umrDirectionsLink" href="#" target="_blank" rel="noopener noreferrer">Directions</a>
        </div>
        <iframe id="umrMapFrame" class="umr-map" title="Property map"></iframe>
      </section>
      <section class="umr-block">
        <h3>Similar Recommendations</h3>
        <div class="umr-grid">
          <div>
            <label for="umrBudgetInput">Budget (Max)</label>
            <input id="umrBudgetInput" type="number" min="0" step="1000" placeholder="Auto from selected property" />
          </div>
          <div>
            <label for="umrCategoryInput">Category</label>
            <select id="umrCategoryInput">
              <option value="all">All</option>
              <option value="house">House</option>
              <option value="apartment">Apartment</option>
              <option value="villa">Villa</option>
              <option value="plot">Plot</option>
              <option value="commercial">Commercial</option>
            </select>
          </div>
          <div>
            <label for="umrLimitInput">Limit</label>
            <select id="umrLimitInput">
              <option value="4">4</option>
              <option value="5" selected>5</option>
              <option value="6">6</option>
              <option value="8">8</option>
            </select>
          </div>
        </div>
        <div class="umr-toolbar">
          <button id="umrRecoBtn" class="umr-btn" type="button">Load Recommendations</button>
        </div>
        <ul id="umrRecoList" class="umr-list"><li class="umr-item">No recommendations yet.</li></ul>
      </section>
    </div>
  `;

  const containers = Array.from(document.querySelectorAll('.container'));
  const anchor = containers[containers.length - 1];
  if (anchor) {
    anchor.insertAdjacentElement('afterend', card);
  } else {
    document.body.appendChild(card);
  }

  const statusEl = document.getElementById('umrStatus');
  const queryInput = document.getElementById('umrQueryInput');
  const mapFrame = document.getElementById('umrMapFrame');
  const openMapLink = document.getElementById('umrOpenMapLink');
  const directionsLink = document.getElementById('umrDirectionsLink');
  const budgetInput = document.getElementById('umrBudgetInput');
  const categoryInput = document.getElementById('umrCategoryInput');
  const limitInput = document.getElementById('umrLimitInput');
  const recoList = document.getElementById('umrRecoList');
  const loadSelectedBtn = document.getElementById('umrLoadSelectedBtn');
  const refreshMapBtn = document.getElementById('umrRefreshMapBtn');
  const recoBtn = document.getElementById('umrRecoBtn');

  const setStatus = (message, ok = true) => {
    statusEl.textContent = message;
    statusEl.style.color = ok ? '#1f6d3d' : '#8d1e1e';
  };

  const getListingsMap = () => {
    const rows = readJson(LISTINGS_KEY, []);
    const map = new Map();
    (Array.isArray(rows) ? rows : []).forEach((item) => {
      const id = text(item?.id);
      if (!id) return;
      map.set(id, {
        id,
        title: text(item?.title, 'Property'),
        city: text(item?.city, 'Udaipur'),
        location: text(item?.location || item?.locality, 'Udaipur'),
        price: numberFrom(item?.price, 0),
        category: text(item?.category, '').toLowerCase(),
        verified: Boolean(item?.verified || item?.verifiedByPropertySetu),
      });
    });
    return map;
  };

  const getSelectedProperty = () => {
    const selectedId = text(propertySelect.value);
    const selectedLabel = text(propertySelect.selectedOptions?.[0]?.textContent);
    const map = getListingsMap();
    const fromMap = map.get(selectedId);
    if (fromMap) return fromMap;
    return {
      id: selectedId,
      title: selectedLabel || selectedId || 'Property',
      city: 'Udaipur',
      location: 'Udaipur',
      price: 0,
      category: '',
      verified: false,
    };
  };

  const setMap = (queryText) => {
    const query = text(queryText, 'Udaipur');
    const encoded = encodeURIComponent(query);
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
    const dirUrl = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
    const embedUrl = `https://www.google.com/maps?q=${encoded}&output=embed`;
    mapFrame.src = embedUrl;
    openMapLink.href = mapUrl;
    directionsLink.href = dirUrl;
  };

  const loadFromSelected = () => {
    const selected = getSelectedProperty();
    const query = `${selected.title} ${selected.location} ${selected.city}`.trim();
    queryInput.value = query;
    setMap(query);
    if (!numberFrom(budgetInput.value, 0) && numberFrom(selected.price, 0) > 0) {
      budgetInput.value = String(Math.round(selected.price * 1.15));
    }
    setStatus(`Loaded map context from ${selected.title}.`);
  };

  const normalizeRecoItems = (items = []) => (
    (Array.isArray(items) ? items : [])
      .map((item) => ({
        id: text(item?.id || item?._id),
        title: text(item?.title, 'Property'),
        location: text(item?.location, 'Udaipur'),
        city: text(item?.city, 'Udaipur'),
        price: numberFrom(item?.price, 0),
        score: numberFrom(item?.recommendationScore, 0),
        reason: text(item?.recommendationReason),
        verified: Boolean(item?.verified),
      }))
      .filter((item) => item.id)
  );

  const runLocalRecommendations = ({ selected, maxBudget, category, limit }) => {
    const map = getListingsMap();
    let rows = [...map.values()].filter((row) => row.id !== selected.id);
    if (category && category !== 'all') {
      rows = rows.filter((row) => text(row.category).toLowerCase().includes(category));
    }
    if (maxBudget > 0) {
      rows = rows.filter((row) => row.price <= maxBudget);
    }
    const refPrice = numberFrom(selected.price, maxBudget);
    rows.sort((a, b) => {
      const aDiff = Math.abs(numberFrom(a.price, 0) - refPrice);
      const bDiff = Math.abs(numberFrom(b.price, 0) - refPrice);
      if (aDiff !== bDiff) return aDiff - bDiff;
      if (a.verified !== b.verified) return a.verified ? -1 : 1;
      return numberFrom(b.price, 0) - numberFrom(a.price, 0);
    });
    return rows.slice(0, limit).map((row, index) => ({
      ...row,
      score: Math.max(55, 100 - (index * 8)),
      reason: row.verified ? 'verified + local price similarity' : 'local price similarity',
    }));
  };

  const renderRecommendations = (items = [], mode = 'local') => {
    if (!items.length) {
      recoList.innerHTML = '<li class="umr-item">No recommendations found.</li>';
      return;
    }
    recoList.innerHTML = items.map((item) => `
      <li class="umr-item">
        <div class="umr-title">${escapeHtml(item.title)}</div>
        <div class="umr-meta">${escapeHtml(item.location)}, ${escapeHtml(item.city)} • ${inr(item.price)}</div>
        <div class="umr-meta">Score: ${numberFrom(item.score, 0)}${item.reason ? ` • ${escapeHtml(item.reason)}` : ''}${item.verified ? ' • Verified' : ''}</div>
        <button class="umr-pick-btn" type="button" data-reco-id="${escapeHtml(item.id)}">Select This Property</button>
      </li>
    `).join('');
    setStatus(`Recommendations loaded (${mode} mode).`);
  };

  const loadRecommendations = async () => {
    const selected = getSelectedProperty();
    const locality = text(selected.location || queryInput.value || 'Udaipur');
    const maxBudget = numberFrom(budgetInput.value, 0);
    const category = text(categoryInput.value, 'all').toLowerCase();
    const limit = Math.max(1, Math.min(8, numberFrom(limitInput.value, 5)));

    if (!selected.id) {
      setStatus('Please select a property first.', false);
      return;
    }

    if (live.ai && typeof live.ai.recommendations === 'function') {
      try {
        const response = await live.ai.recommendations({
          locality,
          category,
          excludeId: selected.id,
          price: maxBudget > 0 ? maxBudget : selected.price,
          limit,
        });
        const liveItems = normalizeRecoItems(response?.items);
        if (liveItems.length) {
          renderRecommendations(liveItems, 'live');
          return;
        }
      } catch {
        // fallback below
      }
    }

    const localItems = runLocalRecommendations({
      selected,
      maxBudget,
      category,
      limit,
    });
    renderRecommendations(localItems, 'local');
  };

  recoList?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const id = text(target.getAttribute('data-reco-id'));
    if (!id) return;
    const option = Array.from(propertySelect.options).find((item) => text(item.value) === id);
    if (!option) {
      setStatus('Selected recommendation is not available in current property selector.', false);
      return;
    }
    propertySelect.value = id;
    propertySelect.dispatchEvent(new Event('change'));
    loadFromSelected();
  });

  queryInput?.addEventListener('change', () => {
    setMap(queryInput.value);
  });

  loadSelectedBtn?.addEventListener('click', () => {
    loadFromSelected();
  });

  refreshMapBtn?.addEventListener('click', () => {
    setMap(queryInput.value);
    setStatus('Map refreshed.');
  });

  recoBtn?.addEventListener('click', () => {
    loadRecommendations().catch((error) => {
      setStatus(`Recommendations failed: ${text(error?.message, 'unknown error')}`, false);
    });
  });

  propertySelect?.addEventListener('change', () => {
    loadFromSelected();
  });

  loadFromSelected();
})();
