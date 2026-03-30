(() => {
  if (document.getElementById('customerEngagementSuiteCard')) return;

  const live = window.PropertySetuLive || {};
  const allowDemoFallback = Boolean(live.allowDemoFallback);
  const wishlistRoot = document.getElementById('wishlist');
  const propertySelect = document.getElementById('propertySelect');
  const chatInput = document.getElementById('chatInput');
  const chatBox = document.getElementById('chatBox');
  if (!wishlistRoot || !propertySelect || !chatInput || !chatBox) return;

  const STYLE_ID = 'customer-engagement-suite-style';
  const CARD_ID = 'customerEngagementSuiteCard';
  const LISTINGS_KEY = 'propertySetu:listings';
  const MARKET_STATE_KEY = 'propertysetu-marketplace-state';
  const CHAT_KEY_PREFIX = 'propertySetu:userChat:';
  const TEMPLATE_KEY = 'propertySetu:customerChatTemplatesUsed';

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

  const getToken = () => {
    if (typeof live.getAnyToken === 'function') return text(live.getAnyToken());
    if (typeof live.getToken === 'function') {
      return text(live.getToken('customer') || live.getToken('seller') || live.getToken('admin'));
    }
    return '';
  };

  const toDateLabel = (value) => {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const toTs = (value) => {
    const date = new Date(value || '');
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  };

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${CARD_ID} .ces-status { margin: 0 0 10px; color: #1f6d3d; font-size: 14px; }
#${CARD_ID} .ces-toolbar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; align-items: center; }
#${CARD_ID} .ces-btn {
  border: 1px solid #0b3d91;
  border-radius: 8px;
  background: #0b3d91;
  color: #fff;
  padding: 7px 11px;
  font-weight: 700;
  cursor: pointer;
}
#${CARD_ID} .ces-btn.alt { background: #fff; color: #0b3d91; }
#${CARD_ID} .ces-btn.warn { background: #8f4f00; border-color: #8f4f00; }
#${CARD_ID} .ces-grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
#${CARD_ID} .ces-card { border: 1px solid #dce5f1; border-radius: 10px; padding: 10px; background: #fff; }
#${CARD_ID} .ces-card h3 { margin: 0 0 8px; color: #11466e; font-size: 16px; }
#${CARD_ID} .ces-meta { color: #4a617b; font-size: 12px; line-height: 1.45; margin-bottom: 8px; }
#${CARD_ID} .ces-template-row { display: flex; flex-wrap: wrap; gap: 6px; }
#${CARD_ID} .ces-chip-btn {
  border: 1px solid #c4d7f2;
  border-radius: 999px;
  background: #f6faff;
  color: #12395f;
  font-size: 12px;
  padding: 4px 9px;
  cursor: pointer;
}
#${CARD_ID} .ces-candidate-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; max-height: 240px; overflow: auto; }
#${CARD_ID} .ces-candidate-item { border: 1px solid #dce5f1; border-radius: 8px; padding: 8px; background: #f8fbff; }
#${CARD_ID} .ces-candidate-head { display: flex; gap: 8px; align-items: start; }
#${CARD_ID} .ces-candidate-title { font-weight: 700; color: #12395f; }
#${CARD_ID} .ces-candidate-meta { font-size: 12px; color: #4a617b; margin-top: 4px; }
#${CARD_ID} .ces-result { margin-top: 8px; font-size: 13px; color: #20466d; }
#${CARD_ID} .ces-result table { width: 100%; border-collapse: collapse; margin-top: 8px; }
#${CARD_ID} .ces-result th, #${CARD_ID} .ces-result td { border: 1px solid #d6e1f5; padding: 7px; text-align: left; }
#${CARD_ID} .ces-result th { background: #f4f8ff; }
#${CARD_ID} .ces-route-list { margin: 8px 0 0; padding-left: 18px; color: #3f5d79; font-size: 13px; }
@media (max-width: 900px) {
  #${CARD_ID} .ces-grid { grid-template-columns: 1fr; }
}
    `;
    document.head.appendChild(style);
  }

  const card = document.createElement('div');
  card.className = 'container';
  card.id = CARD_ID;
  card.innerHTML = `
    <h2>Customer Engagement Suite</h2>
    <p id="cesStatus" class="ces-status">Loading chat, compare and map intelligence...</p>
    <div class="ces-toolbar">
      <button id="cesRefreshBtn" class="ces-btn" type="button">Refresh Suite</button>
      <button id="cesLiveCompareBtn" class="ces-btn alt" type="button">Run Live Compare</button>
      <button id="cesRouteBtn" class="ces-btn alt" type="button">Open Route Planner</button>
      <button id="cesFollowupBtn" class="ces-btn warn" type="button">Send Smart Follow-up</button>
    </div>
    <div class="ces-grid">
      <section class="ces-card">
        <h3>Direct Chat Enhancer</h3>
        <div id="cesChatMeta" class="ces-meta">Select property to see chat intelligence.</div>
        <div class="ces-template-row" id="cesTemplateRow"></div>
      </section>
      <section class="ces-card">
        <h3>Compare Intelligence</h3>
        <ul id="cesCandidateList" class="ces-candidate-list"><li class="ces-candidate-item">No compare candidates.</li></ul>
        <div id="cesCompareResult" class="ces-result">Select 2-4 properties to compare.</div>
      </section>
      <section class="ces-card">
        <h3>Map Route Planner</h3>
        <div id="cesRouteMeta" class="ces-meta">Select properties and open optimized visit route in Google Maps.</div>
        <ol id="cesRouteList" class="ces-route-list"></ol>
      </section>
    </div>
  `;

  const mapCard = document.getElementById('userMapRecoCard');
  const wishlistContainer = wishlistRoot.closest('.container');
  const anchor = mapCard || wishlistContainer;
  if (anchor) {
    anchor.insertAdjacentElement('afterend', card);
  } else {
    document.body.appendChild(card);
  }

  const statusEl = document.getElementById('cesStatus');
  const refreshBtn = document.getElementById('cesRefreshBtn');
  const liveCompareBtn = document.getElementById('cesLiveCompareBtn');
  const routeBtn = document.getElementById('cesRouteBtn');
  const followupBtn = document.getElementById('cesFollowupBtn');
  const chatMetaEl = document.getElementById('cesChatMeta');
  const templateRowEl = document.getElementById('cesTemplateRow');
  const candidateListEl = document.getElementById('cesCandidateList');
  const compareResultEl = document.getElementById('cesCompareResult');
  const routeMetaEl = document.getElementById('cesRouteMeta');
  const routeListEl = document.getElementById('cesRouteList');

  const templates = [
    'Hi, please share today availability for site visit.',
    'Can we discuss best negotiable price and payment timeline?',
    'Please share property legal/doc readiness status.',
    'Can we schedule a short live video tour this evening?',
  ];

  let listingsMap = new Map();
  let selectedIds = [];

  const setStatus = (message, ok = true) => {
    statusEl.textContent = message;
    statusEl.style.color = ok ? '#1f6d3d' : '#8d1e1e';
  };

  const getState = () => {
    const state = readJson(MARKET_STATE_KEY, { wishlist: [], compare: [] });
    return {
      wishlist: Array.isArray(state?.wishlist) ? state.wishlist.map((id) => text(id)).filter(Boolean) : [],
      compare: Array.isArray(state?.compare) ? state.compare.map((id) => text(id)).filter(Boolean) : [],
    };
  };

  const saveTemplateUsage = (template) => {
    const rows = readJson(TEMPLATE_KEY, []);
    const next = Array.isArray(rows) ? rows : [];
    next.unshift({ template, at: new Date().toISOString() });
    while (next.length > 120) next.pop();
    writeJson(TEMPLATE_KEY, next);
  };

  const getCandidateIds = () => {
    const state = getState();
    const seen = new Set();
    const ids = [];
    [...state.compare, ...state.wishlist].forEach((id) => {
      if (!id || seen.has(id)) return;
      seen.add(id);
      ids.push(id);
    });
    if (!ids.length) {
      Array.from(propertySelect.options || []).forEach((opt) => {
        const id = text(opt.value);
        if (!id || seen.has(id)) return;
        seen.add(id);
        ids.push(id);
      });
    }
    return ids.slice(0, 8);
  };

  const normalizeListing = (item = {}) => {
    const id = text(item.id);
    if (!id) return null;
    const size = numberFrom(item.size || item.builtUpArea || item.areaSqft, 0);
    const price = numberFrom(item.price, 0);
    return {
      id,
      title: text(item.title, id),
      location: text(item.location || item.locality, 'Udaipur'),
      city: text(item.city, 'Udaipur'),
      category: text(item.category, '-'),
      size,
      price,
      pricePerSqft: size > 0 ? Math.round(price / size) : 0,
      verified: Boolean(item.verified || item.verifiedByPropertySetu),
      featured: Boolean(item.featured),
    };
  };

  const refreshListingsMap = async () => {
    if (typeof live.syncLocalListingsFromApi === 'function') {
      try {
        await live.syncLocalListingsFromApi();
      } catch (error) {
        if (!allowDemoFallback) {
          setStatus(text(error?.message, 'Live listing sync failed.'), false);
        }
      }
    }
    const rows = readJson(LISTINGS_KEY, []);
    const map = new Map();
    (Array.isArray(rows) ? rows : [])
      .map(normalizeListing)
      .filter(Boolean)
      .forEach((item) => map.set(item.id, item));
    listingsMap = map;
  };

  const getSelectedListings = () => selectedIds.map((id) => listingsMap.get(id)).filter(Boolean);

  const getChatItems = (propertyId) => {
    const key = `${CHAT_KEY_PREFIX}${propertyId}`;
    const rows = readJson(key, []);
    return Array.isArray(rows) ? rows : [];
  };

  const getChatStats = (propertyId) => {
    const rows = getChatItems(propertyId);
    const msgCount = rows.length;
    const last = rows.reduce((latest, item) => {
      const currentTs = toTs(item?.at || item?.createdAt || item?.timestamp);
      return currentTs > latest ? currentTs : latest;
    }, 0);
    return {
      msgCount,
      lastAt: last ? new Date(last).toISOString() : '',
    };
  };

  const renderTemplates = () => {
    templateRowEl.innerHTML = templates
      .map((template) => `<button type="button" class="ces-chip-btn" data-template="${escapeHtml(template)}">${escapeHtml(template.slice(0, 28))}${template.length > 28 ? '...' : ''}</button>`)
      .join('');
  };

  const renderChatMeta = () => {
    const propertyId = text(propertySelect.value);
    if (!propertyId) {
      chatMetaEl.textContent = 'Select property to view chat stats and quick templates.';
      return;
    }
    const listing = listingsMap.get(propertyId);
    const stats = getChatStats(propertyId);
    chatMetaEl.innerHTML = `
      <b>${escapeHtml(listing?.title || propertyId)}</b><br>
      Messages: <b>${numberFrom(stats.msgCount, 0)}</b> |
      Last Activity: <b>${escapeHtml(stats.lastAt ? toDateLabel(stats.lastAt) : '-')}</b><br>
      Tip: templates use karein for faster and professional replies.
    `;
  };

  const renderCandidates = () => {
    const ids = getCandidateIds();
    if (!selectedIds.length) {
      selectedIds = ids.slice(0, 3);
    }
    selectedIds = selectedIds.filter((id) => ids.includes(id)).slice(0, 4);
    if (!selectedIds.length && ids.length) selectedIds = [ids[0]];

    if (!ids.length) {
      candidateListEl.innerHTML = '<li class="ces-candidate-item">No wishlist/compare/property candidates found.</li>';
      return;
    }

    candidateListEl.innerHTML = ids.map((id) => {
      const item = listingsMap.get(id);
      const title = item?.title || id;
      const checked = selectedIds.includes(id) ? 'checked' : '';
      return `
        <li class="ces-candidate-item">
          <label class="ces-candidate-head">
            <input type="checkbox" data-candidate-id="${escapeHtml(id)}" ${checked} />
            <span>
              <span class="ces-candidate-title">${escapeHtml(title)}</span>
              <span class="ces-candidate-meta">${escapeHtml(item?.location || 'Udaipur')} • ₹${numberFrom(item?.price, 0).toLocaleString('en-IN')} • ${item?.verified ? 'Verified' : 'Unverified'}</span>
            </span>
          </label>
        </li>
      `;
    }).join('');
  };

  const renderLocalCompare = () => {
    const items = getSelectedListings();
    if (items.length < 2) {
      compareResultEl.textContent = 'Select minimum 2 properties for compare intelligence.';
      return;
    }
    const bestPrice = [...items].sort((a, b) => a.price - b.price)[0];
    const bestValue = [...items].sort((a, b) => {
      const av = a.pricePerSqft || Number.MAX_SAFE_INTEGER;
      const bv = b.pricePerSqft || Number.MAX_SAFE_INTEGER;
      return av - bv;
    })[0];
    compareResultEl.innerHTML = `
      <div>
        <b>Local Intelligence</b> |
        Best Price: ${escapeHtml(bestPrice?.title || 'N/A')} |
        Best Value (₹/sqft): ${escapeHtml(bestValue?.title || 'N/A')}
      </div>
      <table>
        <thead>
          <tr>
            <th>Property</th>
            <th>Price</th>
            <th>Size</th>
            <th>₹/sqft</th>
            <th>Verified</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item) => `
            <tr>
              <td>${escapeHtml(item.title)}</td>
              <td>₹${numberFrom(item.price, 0).toLocaleString('en-IN')}</td>
              <td>${numberFrom(item.size, 0) || '-'}</td>
              <td>${numberFrom(item.pricePerSqft, 0) || '-'}</td>
              <td>${item.verified ? 'Yes' : 'No'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  const renderRoutePreview = () => {
    const items = getSelectedListings();
    if (items.length < 2) {
      routeMetaEl.textContent = 'Select 2+ properties to generate route.';
      routeListEl.innerHTML = '';
      return;
    }
    const ordered = [...items].sort((a, b) => a.location.localeCompare(b.location));
    routeMetaEl.textContent = `Route readiness: ${ordered.length} stops. Click "Open Route Planner".`;
    routeListEl.innerHTML = ordered
      .map((item) => `<li>${escapeHtml(item.title)} — ${escapeHtml(`${item.location}, ${item.city}`)}</li>`)
      .join('');
  };

  const openRoute = () => {
    const items = getSelectedListings();
    if (items.length < 2) {
      setStatus('Route planner ke liye minimum 2 properties select karein.', false);
      return;
    }
    const ordered = [...items].sort((a, b) => a.location.localeCompare(b.location));
    const queries = ordered.map((item) => `${item.location}, ${item.city}`);
    const origin = queries[0];
    const destination = queries[queries.length - 1];
    const waypoints = queries.slice(1, -1);
    const params = new URLSearchParams({
      api: '1',
      origin,
      destination,
      travelmode: 'driving',
    });
    if (waypoints.length) params.set('waypoints', waypoints.join('|'));
    const url = `https://www.google.com/maps/dir/?${params.toString()}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setStatus(`Route opened for ${queries.length} properties.`);
  };

  const pushLocalChat = (propertyId, message, source = 'suite') => {
    const key = `${CHAT_KEY_PREFIX}${propertyId}`;
    const rows = readJson(key, []);
    const next = Array.isArray(rows) ? rows : [];
    next.push({
      sender: 'You',
      senderId: 'customer',
      message,
      at: new Date().toISOString(),
      source,
    });
    while (next.length > 200) next.shift();
    writeJson(key, next);
  };

  const applyTemplate = (template) => {
    const current = text(chatInput.value);
    chatInput.value = current ? `${current} ${template}` : template;
    chatInput.focus();
    saveTemplateUsage(template);
    setStatus('Template inserted in chat box.');
  };

  const sendSmartFollowup = async () => {
    const propertyId = text(propertySelect.value);
    if (!propertyId) {
      setStatus('Smart follow-up se pehle property select karein.', false);
      return;
    }
    const listing = listingsMap.get(propertyId);
    const message = `Hi, I wanted to follow up on ${listing?.title || 'this property'}. Please share latest availability and best possible price update.`;
    const token = getToken();
    let sentLive = false;

    if ((!token || typeof live.request !== 'function') && !allowDemoFallback) {
      setStatus('Smart follow-up ke liye login + live backend required hai.', false);
      return;
    }

    if (token && typeof live.request === 'function') {
      try {
        await live.request('/chat/send', {
          method: 'POST',
          token,
          data: { propertyId, message },
        });
        sentLive = true;
      } catch (error) {
        if (!allowDemoFallback) {
          setStatus(error.message || 'Smart follow-up failed.', false);
          return;
        }
        if (!(live.shouldFallbackToLocal && live.shouldFallbackToLocal(error))) {
          setStatus(error.message || 'Smart follow-up failed.', false);
          return;
        }
      }
    }
    pushLocalChat(propertyId, message, sentLive ? 'live' : 'local');
    if (typeof window.sendMessage === 'function' && !text(chatInput.value)) {
      // keep existing flow unchanged; only fill input if empty
      chatInput.value = message;
    }
    renderChatMeta();
    setStatus(`Smart follow-up sent (${sentLive ? 'live' : 'backup queue'}).`);
  };

  const runLiveCompare = async () => {
    const ids = selectedIds.slice(0, 4);
    if (ids.length < 2) {
      setStatus('Live compare ke liye minimum 2 properties select karein.', false);
      return;
    }
    const token = getToken();
    if (!token || typeof live.request !== 'function') {
      if (!allowDemoFallback) {
        setStatus('Live compare ke liye login + backend required hai.', false);
        return;
      }
      renderLocalCompare();
      setStatus('Live login unavailable. Local compare shown.', false);
      return;
    }
    setStatus('Running live compare...');
    try {
      const response = await live.request(`/properties/compare?propertyIds=${encodeURIComponent(ids.join(','))}`, { token });
      const items = Array.isArray(response?.items) ? response.items : [];
      const table = Array.isArray(response?.compareTable) ? response.compareTable : [];
      if (!items.length || !table.length) {
        renderLocalCompare();
        setStatus('Live compare empty. Local compare shown.', false);
        return;
      }
      compareResultEl.innerHTML = `
        <div><b>Live Compare</b> | Selected: ${items.length}</div>
        <table>
          <thead>
            <tr>
              <th>Field</th>
              ${items.map((item) => `<th>${escapeHtml(text(item?.title, item?.id))}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${table.slice(0, 8).map((row) => `
              <tr>
                <td>${escapeHtml(text(row?.label, row?.key))}</td>
                ${(Array.isArray(row?.values) ? row.values : []).map((value) => `<td>${escapeHtml(String(value ?? '-'))}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      setStatus('Live compare completed.');
    } catch (error) {
      if (!allowDemoFallback) {
        setStatus(`Live compare failed: ${text(error?.message, 'Unknown error')}.`, false);
        return;
      }
      renderLocalCompare();
      setStatus(`Live compare failed: ${text(error?.message, 'Unknown error')}. Local compare shown.`, false);
    }
  };

  const refreshSuite = async () => {
    await refreshListingsMap();
    renderTemplates();
    renderCandidates();
    renderChatMeta();
    renderLocalCompare();
    renderRoutePreview();
    setStatus('Customer engagement suite refreshed.');
  };

  templateRowEl?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const template = target.getAttribute('data-template');
    if (!template) return;
    applyTemplate(template);
  });

  candidateListEl?.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const id = text(target.getAttribute('data-candidate-id'));
    if (!id) return;
    if (target.checked) {
      if (!selectedIds.includes(id)) selectedIds.push(id);
    } else {
      selectedIds = selectedIds.filter((item) => item !== id);
    }
    selectedIds = selectedIds.slice(0, 4);
    renderCandidates();
    renderLocalCompare();
    renderRoutePreview();
  });

  propertySelect?.addEventListener('change', () => {
    renderChatMeta();
  });

  refreshBtn?.addEventListener('click', () => {
    refreshSuite().catch((error) => setStatus(text(error?.message, 'Refresh failed.'), false));
  });
  liveCompareBtn?.addEventListener('click', () => {
    runLiveCompare().catch((error) => setStatus(text(error?.message, 'Live compare failed.'), false));
  });
  routeBtn?.addEventListener('click', openRoute);
  followupBtn?.addEventListener('click', () => {
    sendSmartFollowup().catch((error) => setStatus(text(error?.message, 'Follow-up failed.'), false));
  });

  refreshSuite().catch((error) => {
    setStatus(text(error?.message, 'Unable to load engagement suite.'), false);
  });
})();
