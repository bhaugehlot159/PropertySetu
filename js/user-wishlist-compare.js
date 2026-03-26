(() => {
  if (document.getElementById('wishlistCompareCard')) return;

  const live = window.PropertySetuLive || {};
  const wishlistRoot = document.getElementById('wishlist');
  if (!wishlistRoot) return;

  const MARKET_STATE_KEY = 'propertysetu-marketplace-state';
  const LISTINGS_KEY = 'propertySetu:listings';
  const STYLE_ID = 'wishlist-compare-style';
  const CARD_ID = 'wishlistCompareCard';
  const MAX_SELECT = 3;
  const MIN_SELECT = 2;

  const text = (value, fallback = '') => {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  };

  const numberFrom = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

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

  const writeJson = live.writeJson || ((key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // no-op
    }
  });

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${CARD_ID} .wc-status { margin: 0 0 10px; color: #1f6d3d; font-size: 14px; }
#${CARD_ID} .wc-toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
#${CARD_ID} .wc-btn {
  border: 1px solid #0b3d91;
  border-radius: 8px;
  background: #0b3d91;
  color: #fff;
  padding: 8px 12px;
  font-weight: 700;
  cursor: pointer;
}
#${CARD_ID} .wc-btn.alt { background: #fff; color: #0b3d91; }
#${CARD_ID} .wc-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
#${CARD_ID} .wc-item { border: 1px solid #dce5f1; border-radius: 8px; padding: 8px; background: #fff; }
#${CARD_ID} .wc-item-head { display: flex; gap: 8px; align-items: start; }
#${CARD_ID} .wc-item-title { font-weight: 700; color: #12395f; }
#${CARD_ID} .wc-item-meta { color: #4a617b; font-size: 13px; margin-top: 4px; }
#${CARD_ID} .wc-result { margin-top: 12px; }
#${CARD_ID} .wc-result table { width: 100%; border-collapse: collapse; min-width: 620px; }
#${CARD_ID} .wc-result th, #${CARD_ID} .wc-result td { border: 1px solid #d6e1f5; padding: 8px; text-align: left; }
#${CARD_ID} .wc-result th { background: #f4f8ff; color: #11466e; }
#${CARD_ID} .wc-highlight { margin-bottom: 8px; color: #1d4068; font-size: 13px; }
    `;
    document.head.appendChild(style);
  }

  const container = document.createElement('div');
  container.className = 'container';
  container.id = CARD_ID;
  container.innerHTML = `
    <h2>Compare Wishlist Properties</h2>
    <p id="wcStatus" class="wc-status">Select 2-3 properties and run compare.</p>
    <div class="wc-toolbar">
      <button id="wcCompareBtn" class="wc-btn" type="button">Compare Selected</button>
      <button id="wcRefreshBtn" class="wc-btn alt" type="button">Refresh Wishlist</button>
      <button id="wcClearBtn" class="wc-btn alt" type="button">Clear Selection</button>
    </div>
    <ul id="wcList" class="wc-list"><li class="wc-item">Loading wishlist...</li></ul>
    <div id="wcResult" class="wc-result"></div>
  `;

  const wishlistContainer = wishlistRoot.closest('.container');
  if (wishlistContainer) {
    wishlistContainer.insertAdjacentElement('afterend', container);
  } else {
    document.body.appendChild(container);
  }

  const statusEl = document.getElementById('wcStatus');
  const listEl = document.getElementById('wcList');
  const resultEl = document.getElementById('wcResult');
  const compareBtn = document.getElementById('wcCompareBtn');
  const refreshBtn = document.getElementById('wcRefreshBtn');
  const clearBtn = document.getElementById('wcClearBtn');

  let selectedIds = [];
  let stateSignature = '';

  const setStatus = (message, ok = true) => {
    statusEl.textContent = message;
    statusEl.style.color = ok ? '#1f6d3d' : '#8d1e1e';
  };

  const getMarketplaceState = () => {
    const current = readJson(MARKET_STATE_KEY, { wishlist: [], compare: [] });
    return current && typeof current === 'object'
      ? {
          wishlist: Array.isArray(current.wishlist) ? current.wishlist.map((id) => text(id)).filter(Boolean) : [],
          compare: Array.isArray(current.compare) ? current.compare.map((id) => text(id)).filter(Boolean) : [],
          ...current,
        }
      : { wishlist: [], compare: [] };
  };

  const setMarketplaceCompare = (ids = []) => {
    const current = getMarketplaceState();
    current.compare = ids.slice(0, MAX_SELECT);
    writeJson(MARKET_STATE_KEY, current);
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
        location: text(item?.location || item?.locality, 'Udaipur'),
        city: text(item?.city, 'Udaipur'),
        price: numberFrom(item?.price, 0),
        type: text(item?.type || item?.purpose, '-'),
        category: text(item?.category, '-'),
        size: numberFrom(item?.size || item?.builtUpArea || item?.areaSqft, 0),
        verified: Boolean(item?.verified || item?.verifiedByPropertySetu),
        featured: Boolean(item?.featured),
      });
    });
    return map;
  };

  const getWishlistRows = () => {
    const state = getMarketplaceState();
    const listings = getListingsMap();
    const rows = state.wishlist
      .map((id) => listings.get(id))
      .filter(Boolean);
    return {
      rows,
      wishlistIds: state.wishlist,
      compareIds: state.compare,
    };
  };

  const getSignature = ({ wishlistIds = [], compareIds = [] }) => `${wishlistIds.join('|')}__${compareIds.join('|')}`;

  const renderSelectionList = () => {
    const { rows, compareIds, wishlistIds } = getWishlistRows();
    const preselect = compareIds.filter((id) => wishlistIds.includes(id)).slice(0, MAX_SELECT);
    selectedIds = preselect.length ? preselect : selectedIds.filter((id) => wishlistIds.includes(id)).slice(0, MAX_SELECT);

    if (!rows.length) {
      listEl.innerHTML = '<li class="wc-item">No wishlist properties found.</li>';
      setStatus('Wishlist empty hai. Pehle properties save karein.', false);
      return;
    }

    listEl.innerHTML = rows.map((item) => {
      const checked = selectedIds.includes(item.id) ? 'checked' : '';
      return `
        <li class="wc-item">
          <label class="wc-item-head">
            <input type="checkbox" data-wc-id="${escapeHtml(item.id)}" ${checked} />
            <span>
              <span class="wc-item-title">${escapeHtml(item.title)}</span>
              <span class="wc-item-meta">${escapeHtml(item.location)} • ₹${numberFrom(item.price, 0).toLocaleString('en-IN')}</span>
            </span>
          </label>
        </li>
      `;
    }).join('');

    setStatus(selectedIds.length >= MIN_SELECT
      ? `${selectedIds.length} selected. Compare run kar sakte hain.`
      : `Select at least ${MIN_SELECT} properties.`);
  };

  const getComparisonFields = (items = []) => {
    const bestPrice = [...items].sort((a, b) => numberFrom(a.price, Number.MAX_SAFE_INTEGER) - numberFrom(b.price, Number.MAX_SAFE_INTEGER))[0];
    const largest = [...items].sort((a, b) => numberFrom(b.size, 0) - numberFrom(a.size, 0))[0];
    return {
      bestPrice,
      largest,
      verifiedCount: items.filter((item) => item.verified).length,
    };
  };

  const renderLocalCompare = (ids = [], modeText = 'Local compare') => {
    const map = getListingsMap();
    const items = ids.map((id) => map.get(id)).filter(Boolean);
    if (items.length < MIN_SELECT) {
      resultEl.innerHTML = '';
      setStatus('Compare ke liye 2 valid properties required.', false);
      return;
    }

    const highlights = getComparisonFields(items);
    const rows = [
      { label: 'Price', values: items.map((item) => `₹${numberFrom(item.price, 0).toLocaleString('en-IN')}`) },
      { label: 'Location', values: items.map((item) => `${item.location}, ${item.city}`) },
      { label: 'Type', values: items.map((item) => item.type || '-') },
      { label: 'Category', values: items.map((item) => item.category || '-') },
      { label: 'Size (sqft)', values: items.map((item) => numberFrom(item.size, 0) ? `${numberFrom(item.size, 0)}` : '-') },
      { label: 'Verified', values: items.map((item) => (item.verified ? 'Yes' : 'No')) },
      { label: 'Featured', values: items.map((item) => (item.featured ? 'Yes' : 'No')) },
    ];

    resultEl.innerHTML = `
      <div class="wc-highlight">
        <b>${escapeHtml(modeText)}</b> |
        Best Price: ${highlights.bestPrice ? escapeHtml(highlights.bestPrice.title) : 'N/A'} |
        Largest Size: ${highlights.largest ? escapeHtml(highlights.largest.title) : 'N/A'} |
        Verified Count: ${numberFrom(highlights.verifiedCount, 0)}
      </div>
      <div style="overflow:auto;">
        <table>
          <thead>
            <tr>
              <th>Field</th>
              ${items.map((item) => `<th>${escapeHtml(item.title)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td><b>${escapeHtml(row.label)}</b></td>
                ${row.values.map((value) => `<td>${escapeHtml(value)}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  };

  const renderLiveCompare = (payload, ids) => {
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const table = Array.isArray(payload?.compareTable) ? payload.compareTable : [];
    if (!items.length || !table.length) {
      renderLocalCompare(ids, 'Local compare fallback');
      return;
    }

    const highlights = payload?.highlights || {};
    const bestPrice = highlights?.bestPrice?.price
      ? `₹${numberFrom(highlights.bestPrice.price, 0).toLocaleString('en-IN')}`
      : 'N/A';
    const largestSize = highlights?.largestSize?.size
      ? `${numberFrom(highlights.largestSize.size, 0)} sqft`
      : 'N/A';

    resultEl.innerHTML = `
      <div class="wc-highlight">
        <b>Live compare</b> |
        Best Price: ${escapeHtml(bestPrice)} |
        Largest Size: ${escapeHtml(largestSize)} |
        Verified Count: ${numberFrom(highlights?.verifiedCount, 0)}
      </div>
      <div style="overflow:auto;">
        <table>
          <thead>
            <tr>
              <th>Field</th>
              ${items.map((item) => `<th>${escapeHtml(text(item?.title, item?.id))}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${table.map((row) => `
              <tr>
                <td><b>${escapeHtml(text(row?.label, row?.key))}</b></td>
                ${(Array.isArray(row?.values) ? row.values : []).map((value) => {
                  const key = text(row?.key).toLowerCase();
                  if (key === 'price') {
                    return `<td>₹${numberFrom(value, 0).toLocaleString('en-IN')}</td>`;
                  }
                  return `<td>${escapeHtml(String(value ?? '-'))}</td>`;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  };

  const runCompare = async () => {
    const ids = selectedIds.slice(0, MAX_SELECT);
    if (ids.length < MIN_SELECT) {
      setStatus(`Compare ke liye minimum ${MIN_SELECT} properties select karein.`, false);
      return;
    }
    setMarketplaceCompare(ids);
    setStatus('Comparing selected properties...');

    if (typeof live.request !== 'function') {
      renderLocalCompare(ids, 'Local compare');
      setStatus('Live compare unavailable. Local compare shown.', false);
      return;
    }

    try {
      const response = await live.request(`/properties/compare?propertyIds=${encodeURIComponent(ids.join(','))}`);
      renderLiveCompare(response, ids);
      setStatus('Compare completed successfully.');
    } catch (error) {
      renderLocalCompare(ids, 'Local compare fallback');
      setStatus(`Live compare unavailable: ${text(error?.message, 'unknown error')}. Local compare shown.`, false);
    }
  };

  const clearSelection = () => {
    selectedIds = [];
    setMarketplaceCompare([]);
    resultEl.innerHTML = '';
    renderSelectionList();
  };

  listEl.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.type !== 'checkbox') return;
    const id = text(target.getAttribute('data-wc-id'));
    if (!id) return;

    if (target.checked) {
      if (selectedIds.includes(id)) return;
      if (selectedIds.length >= MAX_SELECT) {
        target.checked = false;
        setStatus(`Maximum ${MAX_SELECT} properties compare ho sakti hain.`, false);
        return;
      }
      selectedIds.push(id);
    } else {
      selectedIds = selectedIds.filter((item) => item !== id);
    }
    setMarketplaceCompare(selectedIds);
    setStatus(selectedIds.length >= MIN_SELECT
      ? `${selectedIds.length} selected. Compare run kar sakte hain.`
      : `Select at least ${MIN_SELECT} properties.`);
  });

  compareBtn?.addEventListener('click', () => {
    runCompare().catch((error) => {
      setStatus(`Compare failed: ${text(error?.message, 'unknown error')}`, false);
    });
  });

  refreshBtn?.addEventListener('click', () => {
    renderSelectionList();
  });

  clearBtn?.addEventListener('click', clearSelection);

  const refreshIfChanged = () => {
    const state = getWishlistRows();
    const nextSignature = getSignature(state);
    if (nextSignature === stateSignature) return;
    stateSignature = nextSignature;
    renderSelectionList();
  };

  renderSelectionList();
  stateSignature = getSignature(getWishlistRows());
  window.setInterval(refreshIfChanged, 2500);
})();
