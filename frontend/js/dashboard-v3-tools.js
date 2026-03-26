(function () {
  const live = window.PropertySetuLive || {};
  const userPropertySelect = document.getElementById('propertySelect');
  const isUserPage = Boolean(document.getElementById('chatBox') && userPropertySelect);
  const isSellerPage = Boolean(document.getElementById('addPropertyForm') && document.getElementById('propertyList'));
  if (!isUserPage && !isSellerPage) return;

  const LISTINGS_KEY = 'propertySetu:listings';

  const text = (value, fallback = '') => {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  };

  const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const inr = (value) => `₹${toNumber(value, 0).toLocaleString('en-IN')}`;

  const escapeHtml = (value) => text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const readJson = live.readJson || ((key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  });

  const getToken = () => (typeof live.getAnyToken === 'function' ? live.getAnyToken() : '') || '';
  const getSession = () => (typeof live.getAnySession === 'function' ? live.getAnySession() : null) || null;

  async function requestV3(path, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const token = text(options.token || getToken());
    const data = options.data || null;

    if (typeof live.request === 'function') {
      return live.request(path, {
        method,
        token,
        ...(data ? { data } : {}),
      });
    }

    const normalizedPath = String(path || '').startsWith('/') ? String(path) : `/${String(path || '')}`;
    const response = await fetch(`${window.location.origin}/api/v3${normalizedPath}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || `Request failed (${response.status})`);
    }
    return payload;
  }

  function getLocalListings() {
    const items = readJson(LISTINGS_KEY, []);
    if (!Array.isArray(items)) return [];
    return items
      .filter((item) => item && typeof item === 'object' && text(item.id))
      .map((item) => ({
        id: text(item.id),
        title: text(item.title, 'Property'),
        city: text(item.city, 'Udaipur'),
        location: text(item.location || item.locality, 'Udaipur'),
        price: toNumber(item.price, 0),
      }));
  }

  function mergeProperties(items = []) {
    const map = new Map();
    items.forEach((item) => {
      const id = text(item.id || item._id);
      if (!id) return;
      map.set(id, {
        id,
        title: text(item.title, 'Property'),
        city: text(item.city, 'Udaipur'),
        location: text(item.location || item.locality, 'Udaipur'),
        price: toNumber(item.price, 0),
      });
    });
    return [...map.values()];
  }

  async function getSellerProperties() {
    const token = getToken();
    const local = getLocalListings();
    if (!token) return local;
    try {
      const response = await requestV3('/properties?city=Udaipur&mine=1', { token });
      const remote = Array.isArray(response?.items) ? response.items : [];
      return mergeProperties([...remote, ...local]);
    } catch {
      return local;
    }
  }

  function createContainer() {
    const container = document.createElement('div');
    container.className = 'container';
    container.id = isUserPage ? 'userV3ToolsContainer' : 'sellerV3ToolsContainer';
    container.innerHTML = `
      <h2>V3 Live Tools</h2>
      <div id="v3TopBar" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <label for="v3PropertyIdInput" style="font-weight:700;">Property ID</label>
        <input id="v3PropertyIdInput" type="text" placeholder="Enter property id" style="min-width:260px;padding:6px;border:1px solid #ccd6e7;border-radius:4px;" />
        <select id="v3PropertySelect" style="min-width:280px;padding:6px;border:1px solid #ccd6e7;border-radius:4px;"></select>
        <button id="v3LoadPropertyBtn" type="button">Load Meta + Chat</button>
      </div>

      <div style="margin-top:14px;border:1px solid #d6e1f5;border-radius:8px;padding:10px;background:#f8fbff;">
        <h3 style="margin:0 0 8px;">Verified + Map</h3>
        <span id="v3VerifiedBadgeChip" style="display:inline-block;padding:4px 10px;border-radius:999px;background:#eef2f8;color:#30415d;font-weight:700;">Pending</span>
        <small id="v3VerifiedMeta" style="display:block;margin-top:6px;color:#58729a;">Meta not loaded yet.</small>
        <p id="v3MapQuery" style="margin:8px 0;color:#1d4068;"></p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <a id="v3MapOpen" target="_blank" style="padding:7px 10px;background:#0b5c8a;color:#fff;border-radius:5px;text-decoration:none;">Open Map</a>
          <a id="v3MapDir" target="_blank" style="padding:7px 10px;background:#0b3d91;color:#fff;border-radius:5px;text-decoration:none;">Directions</a>
        </div>
        <iframe id="v3MapFrame" title="Property map" style="margin-top:8px;width:100%;height:250px;border:1px solid #cfdcf2;border-radius:8px;background:#fff;"></iframe>
      </div>

      <div style="margin-top:14px;border:1px solid #d6e1f5;border-radius:8px;padding:10px;background:#fff;">
        <h3 style="margin:0 0 8px;">Direct Chat + WhatsApp</h3>
        <div id="v3ChatThread" style="max-height:200px;overflow:auto;border:1px solid #dae6fb;border-radius:6px;padding:8px;background:#f8fbff;"></div>
        <textarea id="v3ChatMessage" placeholder="Type message" style="width:100%;margin-top:8px;padding:8px;border:1px solid #ccd6e7;border-radius:4px;"></textarea>
        <input id="v3ChatReceiverId" type="text" placeholder="Optional receiverId (seller/admin reply flow)" style="width:100%;margin-top:6px;padding:8px;border:1px solid #ccd6e7;border-radius:4px;" />
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
          <button id="v3ChatSendBtn" type="button">Send</button>
          <button id="v3ChatRefreshBtn" type="button">Refresh</button>
          <button id="v3ChatWaBtn" type="button">WhatsApp Link</button>
        </div>
        <p id="v3ChatStatus" style="margin:8px 0 0;color:#1d4068;"></p>
      </div>

      <div style="margin-top:14px;border:1px solid #d6e1f5;border-radius:8px;padding:10px;background:#fff;">
        <h3 style="margin:0 0 8px;">Property Compare (2-3)</h3>
        <input id="v3CompareIds" type="text" placeholder="id1,id2,id3" style="width:100%;padding:8px;border:1px solid #ccd6e7;border-radius:4px;" />
        <button id="v3CompareBtn" type="button" style="margin-top:8px;">Run Compare</button>
        <p id="v3CompareStatus" style="margin:8px 0 0;color:#1d4068;"></p>
        <div id="v3CompareResult" style="margin-top:8px;"></div>
      </div>

      <div style="margin-top:14px;border:1px solid #d6e1f5;border-radius:8px;padding:10px;background:#fff;">
        <h3 style="margin:0 0 8px;">EMI Calculator</h3>
        <div style="display:grid;gap:8px;grid-template-columns:repeat(3,minmax(0,1fr));">
          <input id="v3EmiLoan" type="number" min="1" step="1000" value="3500000" placeholder="Loan Amount" style="padding:8px;border:1px solid #ccd6e7;border-radius:4px;" />
          <input id="v3EmiRate" type="number" min="0" step="0.1" value="8.6" placeholder="Rate %" style="padding:8px;border:1px solid #ccd6e7;border-radius:4px;" />
          <input id="v3EmiYears" type="number" min="1" step="1" value="20" placeholder="Years" style="padding:8px;border:1px solid #ccd6e7;border-radius:4px;" />
        </div>
        <button id="v3EmiCalcBtn" type="button" style="margin-top:8px;">Calculate EMI</button>
        <div id="v3EmiResult" style="margin-top:8px;color:#1d4068;"></div>
      </div>
    `;
    return container;
  }

  function renderChat(threadEl, items = []) {
    if (!threadEl) return;
    const list = Array.isArray(items) ? items : [];
    const currentUserId = text(getSession()?.id);
    if (!list.length) {
      threadEl.innerHTML = '<p style="margin:0;color:#607da8;">No chat messages yet.</p>';
      return;
    }

    threadEl.innerHTML = list.map((item) => {
      const senderId = text(item.senderId);
      const mine = currentUserId && senderId && senderId === currentUserId;
      const sender = mine ? 'You' : text(item.senderRole, 'User');
      const timeLabel = item.createdAt ? new Date(item.createdAt).toLocaleString('en-IN') : '';
      return `
        <div style="margin:0 0 8px;padding:8px;border-radius:8px;background:${mine ? '#e9f7ef' : '#f1f6ff'};border:1px solid ${mine ? '#cfead8' : '#d8e6fb'};">
          <b>${escapeHtml(sender)}</b>
          <small style="margin-left:6px;color:#607da8;">${escapeHtml(timeLabel)}</small>
          <div style="margin-top:4px;">${escapeHtml(item.message || '')}</div>
        </div>
      `;
    }).join('');
    threadEl.scrollTop = threadEl.scrollHeight;
  }

  function setBadge(chipEl, metaEl, verified, approvedAt) {
    if (chipEl) {
      chipEl.textContent = verified ? 'Verified by PropertySetu' : 'Verification Pending';
      chipEl.style.background = verified ? '#d9f8e5' : '#eef2f8';
      chipEl.style.color = verified ? '#0f6940' : '#30415d';
    }
    if (metaEl) {
      metaEl.textContent = verified
        ? `Approved ${approvedAt ? new Date(approvedAt).toLocaleString('en-IN') : 'by admin'}`
        : 'Admin verification pending.';
    }
  }

  function setMap(mapState, mapView, property) {
    const mapsUrl = text(mapView?.googleMapsUrl);
    const dirUrl = text(mapView?.googleDirectionsUrl);
    const embedUrl = text(mapView?.googleEmbedUrl);
    const query = text(mapView?.query, `${text(property?.location)}, ${text(property?.city)}`);

    if (mapState.mapQueryEl) {
      mapState.mapQueryEl.textContent = query ? `Map Query: ${query}` : 'Map query unavailable.';
    }
    if (mapState.mapOpenEl) mapState.mapOpenEl.href = mapsUrl || '#';
    if (mapState.mapDirEl) mapState.mapDirEl.href = dirUrl || mapsUrl || '#';

    if (mapState.mapFrameEl) {
      if (embedUrl) {
        mapState.mapFrameEl.src = embedUrl;
        mapState.mapFrameEl.style.display = 'block';
      } else {
        mapState.mapFrameEl.style.display = 'none';
      }
    }
  }

  async function loadPropertyMeta(propertyId, ui) {
    if (!propertyId) return;
    try {
      const response = await requestV3(`/properties/${encodeURIComponent(propertyId)}`, {
        method: 'GET',
        token: getToken(),
      });
      const property = response?.item || response?.property || {};
      const badge = property?.verifiedBadge || {};
      const verified = Boolean(badge.show || property.verifiedByPropertySetu || property.verified);
      setBadge(ui.verifiedChipEl, ui.verifiedMetaEl, verified, text(badge.approvedAt));
      setMap(ui, property?.mapView || {}, property);

      if (ui.compareInput && !text(ui.compareInput.value)) {
        ui.compareInput.value = propertyId;
      }
    } catch (error) {
      setBadge(ui.verifiedChipEl, ui.verifiedMetaEl, false, '');
      if (ui.verifiedMetaEl) ui.verifiedMetaEl.textContent = `Meta load failed: ${error.message || 'Unknown error'}`;
    }
  }

  async function loadChat(propertyId, ui) {
    if (!propertyId) {
      renderChat(ui.chatThreadEl, []);
      return;
    }

    const token = getToken();
    if (!token) {
      renderChat(ui.chatThreadEl, []);
      if (ui.chatStatusEl) {
        ui.chatStatusEl.style.color = '#8d1e1e';
        ui.chatStatusEl.textContent = 'Chat use karne ke liye login required.';
      }
      return;
    }

    try {
      const response = await requestV3(`/chat/${encodeURIComponent(propertyId)}?limit=50`, {
        method: 'GET',
        token,
      });
      renderChat(ui.chatThreadEl, response?.items || []);
      if (ui.chatStatusEl) {
        ui.chatStatusEl.style.color = '#1d4068';
        ui.chatStatusEl.textContent = 'Chat synced.';
      }
    } catch (error) {
      if (ui.chatStatusEl) {
        ui.chatStatusEl.style.color = '#8d1e1e';
        ui.chatStatusEl.textContent = `Chat load failed: ${error.message || 'Unknown error'}`;
      }
    }
  }

  async function sendChat(propertyId, ui) {
    const token = getToken();
    if (!token) {
      if (ui.chatStatusEl) {
        ui.chatStatusEl.style.color = '#8d1e1e';
        ui.chatStatusEl.textContent = 'Login required for chat send.';
      }
      return;
    }

    const message = text(ui.chatMessageEl?.value);
    const receiverId = text(ui.chatReceiverEl?.value);
    if (!propertyId || !message) {
      if (ui.chatStatusEl) {
        ui.chatStatusEl.style.color = '#8d1e1e';
        ui.chatStatusEl.textContent = 'Property ID and message required.';
      }
      return;
    }

    try {
      const payload = { propertyId, message };
      if (receiverId) payload.receiverId = receiverId;
      const response = await requestV3('/chat/send', {
        method: 'POST',
        token,
        data: payload,
      });

      if (ui.chatMessageEl) ui.chatMessageEl.value = '';
      if (ui.chatStatusEl) {
        ui.chatStatusEl.style.color = '#1d4068';
        ui.chatStatusEl.textContent = 'Message sent.';
      }

      const waUrl = text(response?.whatsapp?.url);
      if (waUrl && ui.externalWhatsappLink) {
        ui.externalWhatsappLink.href = waUrl;
      }

      await loadChat(propertyId, ui);
    } catch (error) {
      if (ui.chatStatusEl) {
        ui.chatStatusEl.style.color = '#8d1e1e';
        ui.chatStatusEl.textContent = `Send failed: ${error.message || 'Unknown error'}`;
      }
    }
  }

  async function openWhatsapp(propertyId, ui) {
    const token = getToken();
    if (!token) {
      if (ui.chatStatusEl) {
        ui.chatStatusEl.style.color = '#8d1e1e';
        ui.chatStatusEl.textContent = 'Login required for WhatsApp handoff.';
      }
      return;
    }
    if (!propertyId) return;

    const receiverId = text(ui.chatReceiverEl?.value);
    const params = new URLSearchParams();
    if (receiverId) params.set('receiverId', receiverId);

    try {
      const response = await requestV3(
        `/chat/${encodeURIComponent(propertyId)}/whatsapp-link${params.toString() ? `?${params.toString()}` : ''}`,
        {
          method: 'GET',
          token,
        }
      );
      const url = text(response?.whatsapp?.url);
      if (!url) throw new Error('WhatsApp url not available.');

      if (ui.externalWhatsappLink) ui.externalWhatsappLink.href = url;
      window.open(url, '_blank', 'noopener,noreferrer');
      if (ui.chatStatusEl) {
        ui.chatStatusEl.style.color = '#1d4068';
        ui.chatStatusEl.textContent = 'WhatsApp link opened.';
      }
    } catch (error) {
      if (ui.chatStatusEl) {
        ui.chatStatusEl.style.color = '#8d1e1e';
        ui.chatStatusEl.textContent = `WhatsApp failed: ${error.message || 'Unknown error'}`;
      }
    }
  }

  async function runCompare(ui) {
    const raw = text(ui.compareInput?.value);
    const ids = [...new Set(raw.split(',').map((item) => text(item)).filter(Boolean))].slice(0, 3);
    if (ids.length < 2) {
      if (ui.compareStatusEl) ui.compareStatusEl.textContent = 'At least 2 property IDs required.';
      if (ui.compareResultEl) ui.compareResultEl.innerHTML = '';
      return;
    }

    if (ui.compareStatusEl) ui.compareStatusEl.textContent = 'Compare loading...';

    try {
      const response = await requestV3(`/properties/compare?propertyIds=${encodeURIComponent(ids.join(','))}`, {
        method: 'GET',
      });

      const items = Array.isArray(response?.items) ? response.items : [];
      const table = Array.isArray(response?.compareTable) ? response.compareTable : [];
      const highlights = response?.highlights || {};

      if (!items.length || !table.length) {
        throw new Error('Compare data not available.');
      }

      const header = `<tr><th style="border:1px solid #d6e1f5;padding:8px;background:#f4f8ff;">Field</th>${items.map((item) => `<th style="border:1px solid #d6e1f5;padding:8px;background:#f4f8ff;">${escapeHtml(text(item.title, item.id))}</th>`).join('')}</tr>`;
      const rows = table.map((row) => {
        const values = Array.isArray(row.values) ? row.values : [];
        const cells = values
          .map((value) => `<td style="border:1px solid #d6e1f5;padding:8px;">${escapeHtml(typeof value === 'number' && text(row.key) === 'price' ? inr(value) : String(value))}</td>`)
          .join('');
        return `<tr><td style="border:1px solid #d6e1f5;padding:8px;"><b>${escapeHtml(text(row.label, row.key))}</b></td>${cells}</tr>`;
      }).join('');

      if (ui.compareResultEl) {
        ui.compareResultEl.innerHTML = `
          <div style="margin-bottom:8px;color:#1d4068;">
            <b>Highlights:</b>
            Best Price ${highlights?.bestPrice?.price ? inr(highlights.bestPrice.price) : 'N/A'} |
            Largest Size ${highlights?.largestSize?.size ? `${highlights.largestSize.size} sqft` : 'N/A'} |
            Verified Count ${toNumber(highlights?.verifiedCount, 0)}
          </div>
          <div style="overflow:auto;">
            <table style="border-collapse:collapse;min-width:640px;width:100%;">${header}${rows}</table>
          </div>
        `;
      }
      if (ui.compareStatusEl) ui.compareStatusEl.textContent = 'Compare completed.';
    } catch (error) {
      if (ui.compareStatusEl) ui.compareStatusEl.textContent = `Compare failed: ${error.message || 'Unknown error'}`;
      if (ui.compareResultEl) ui.compareResultEl.innerHTML = '';
    }
  }

  async function calculateEmi(ui) {
    const loanAmount = toNumber(ui.emiLoanEl?.value, 0);
    const annualRatePercent = toNumber(ui.emiRateEl?.value, 0);
    const tenureYears = toNumber(ui.emiYearsEl?.value, 0);

    if (loanAmount <= 0 || tenureYears <= 0 || annualRatePercent < 0) {
      if (ui.emiResultEl) ui.emiResultEl.textContent = 'Valid loan amount, rate and years enter karein.';
      return;
    }

    if (ui.emiResultEl) ui.emiResultEl.textContent = 'Calculating...';

    try {
      const response = await requestV3(
        `/ai/emi-calculator?loanAmount=${encodeURIComponent(loanAmount)}&annualRatePercent=${encodeURIComponent(annualRatePercent)}&tenureYears=${encodeURIComponent(tenureYears)}`,
        { method: 'GET' }
      );

      const emi = response?.emi || {};
      if (ui.emiResultEl) {
        ui.emiResultEl.innerHTML = `Monthly EMI: <b>${inr(emi.monthlyEmi)}</b><br>Total Interest: <b>${inr(emi.totalInterest)}</b><br>Total Amount: <b>${inr(emi.totalAmount)}</b>`;
      }
    } catch (error) {
      if (ui.emiResultEl) ui.emiResultEl.textContent = `EMI failed: ${error.message || 'Unknown error'}`;
    }
  }

  function populateSelect(selectEl, items, selectedId = '') {
    if (!selectEl) return;
    const rows = Array.isArray(items) ? items : [];
    selectEl.innerHTML = '<option value="">Select property</option>' + rows
      .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(`${item.title} (${item.location})`)}</option>`)
      .join('');
    if (selectedId && rows.some((item) => item.id === selectedId)) {
      selectEl.value = selectedId;
    }
  }

  function resolveInitialPropertyId() {
    const query = new URLSearchParams(window.location.search || '');
    const fromQuery = text(query.get('propertyId') || query.get('id'));
    if (fromQuery) return fromQuery;
    if (isUserPage) {
      const fromSelect = text(userPropertySelect?.value);
      if (fromSelect) return fromSelect;
    }
    return '';
  }

  async function mount() {
    const container = createContainer();
    document.body.appendChild(container);

    const ui = {
      propertyInput: document.getElementById('v3PropertyIdInput'),
      propertySelect: document.getElementById('v3PropertySelect'),
      loadBtn: document.getElementById('v3LoadPropertyBtn'),
      verifiedChipEl: document.getElementById('v3VerifiedBadgeChip'),
      verifiedMetaEl: document.getElementById('v3VerifiedMeta'),
      mapQueryEl: document.getElementById('v3MapQuery'),
      mapOpenEl: document.getElementById('v3MapOpen'),
      mapDirEl: document.getElementById('v3MapDir'),
      mapFrameEl: document.getElementById('v3MapFrame'),
      chatThreadEl: document.getElementById('v3ChatThread'),
      chatMessageEl: document.getElementById('v3ChatMessage'),
      chatReceiverEl: document.getElementById('v3ChatReceiverId'),
      chatSendBtn: document.getElementById('v3ChatSendBtn'),
      chatRefreshBtn: document.getElementById('v3ChatRefreshBtn'),
      chatWaBtn: document.getElementById('v3ChatWaBtn'),
      chatStatusEl: document.getElementById('v3ChatStatus'),
      compareInput: document.getElementById('v3CompareIds'),
      compareBtn: document.getElementById('v3CompareBtn'),
      compareStatusEl: document.getElementById('v3CompareStatus'),
      compareResultEl: document.getElementById('v3CompareResult'),
      emiLoanEl: document.getElementById('v3EmiLoan'),
      emiRateEl: document.getElementById('v3EmiRate'),
      emiYearsEl: document.getElementById('v3EmiYears'),
      emiCalcBtn: document.getElementById('v3EmiCalcBtn'),
      emiResultEl: document.getElementById('v3EmiResult'),
      externalWhatsappLink: document.getElementById('whatsappLink'),
    };

    let propertyItems = [];
    if (isSellerPage) {
      propertyItems = await getSellerProperties();
    } else {
      const local = getLocalListings();
      const options = [...(userPropertySelect?.options || [])]
        .map((opt) => ({ id: text(opt.value), title: text(opt.textContent), city: 'Udaipur', location: 'Udaipur', price: 0 }))
        .filter((item) => item.id);
      propertyItems = mergeProperties([...options, ...local]);
    }

    const initialId = resolveInitialPropertyId();
    populateSelect(ui.propertySelect, propertyItems, initialId);

    if (ui.propertyInput) {
      ui.propertyInput.value = initialId;
      ui.propertyInput.addEventListener('input', () => {
        const id = text(ui.propertyInput.value);
        if (id && ui.propertySelect && [...ui.propertySelect.options].some((opt) => text(opt.value) === id)) {
          ui.propertySelect.value = id;
        }
      });
    }

    ui.propertySelect?.addEventListener('change', () => {
      const id = text(ui.propertySelect?.value);
      if (ui.propertyInput) ui.propertyInput.value = id;
      if (isUserPage && userPropertySelect) {
        userPropertySelect.value = id;
        userPropertySelect.dispatchEvent(new Event('change'));
      }
    });

    const getActivePropertyId = () => text(ui.propertyInput?.value || ui.propertySelect?.value || userPropertySelect?.value);

    ui.loadBtn?.addEventListener('click', async () => {
      const propertyId = getActivePropertyId();
      if (!propertyId) return;
      await loadPropertyMeta(propertyId, ui);
      await loadChat(propertyId, ui);
    });

    ui.chatRefreshBtn?.addEventListener('click', async () => {
      const propertyId = getActivePropertyId();
      await loadChat(propertyId, ui);
    });

    ui.chatSendBtn?.addEventListener('click', async () => {
      const propertyId = getActivePropertyId();
      await sendChat(propertyId, ui);
    });

    ui.chatWaBtn?.addEventListener('click', async () => {
      const propertyId = getActivePropertyId();
      await openWhatsapp(propertyId, ui);
    });

    ui.compareBtn?.addEventListener('click', async () => {
      await runCompare(ui);
    });

    ui.emiCalcBtn?.addEventListener('click', async () => {
      await calculateEmi(ui);
    });

    if (isUserPage && userPropertySelect) {
      userPropertySelect.addEventListener('change', () => {
        const id = text(userPropertySelect.value);
        if (ui.propertyInput) ui.propertyInput.value = id;
        if (ui.propertySelect && [...ui.propertySelect.options].some((opt) => text(opt.value) === id)) {
          ui.propertySelect.value = id;
        }
      });
    }

    const firstPropertyId = getActivePropertyId();
    if (firstPropertyId) {
      await loadPropertyMeta(firstPropertyId, ui);
      await loadChat(firstPropertyId, ui);
      if (ui.compareInput && !text(ui.compareInput.value)) {
        ui.compareInput.value = firstPropertyId;
      }
    }

    await calculateEmi(ui);
  }

  mount();
})();
