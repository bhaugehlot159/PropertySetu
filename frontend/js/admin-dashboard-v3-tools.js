(function () {
  const live = window.PropertySetuLive || {};
  const pendingRoot = document.getElementById('pendingProperties');
  const approvedRoot = document.getElementById('approvedProperties');
  if (!pendingRoot || !approvedRoot) return;

  const CORE_BASE = `${window.location.origin}/api/v3`;
  const LISTINGS_KEY = 'propertySetu:listings';
  const STYLE_ID = 'admin-v3-tools-style';

  if (!document.getElementById(STYLE_ID)) {
    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
.admin-v3-shell input,
.admin-v3-shell textarea,
.admin-v3-shell select {
  box-sizing: border-box;
}
.admin-v3-shell button { cursor: pointer; }
@media (max-width: 768px) {
  .admin-v3-shell .admin-v3-topbar {
    display: grid !important;
    grid-template-columns: 1fr;
  }
  .admin-v3-shell .admin-v3-topbar > * {
    width: 100%;
    min-width: 0 !important;
    margin: 0;
  }
  .admin-v3-shell .actions-row {
    display: grid !important;
    grid-template-columns: 1fr;
  }
  .admin-v3-shell .emi-grid {
    grid-template-columns: 1fr !important;
  }
  .admin-v3-shell iframe {
    height: 220px !important;
  }
}
`;
    document.head.appendChild(styleEl);
  }

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
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const readJson = live.readJson || ((key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  });

  const getAdminToken = () => {
    const roleToken = typeof live.getToken === 'function' ? text(live.getToken('admin')) : '';
    if (roleToken) return roleToken;
    const anyToken = typeof live.getAnyToken === 'function' ? text(live.getAnyToken()) : '';
    if (anyToken) return anyToken;
    const adminSession = readJson('propertysetu-admin-session', {});
    return text(adminSession?.token);
  };

  async function coreRequest(path, { method = 'GET', data = null, token = '' } = {}) {
    const authToken = text(token || getAdminToken());
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    const response = await fetch(`${CORE_BASE}${path}`, {
      method,
      headers,
      ...(data ? { body: JSON.stringify(data) } : {}),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || `Request failed (${response.status})`);
    }
    return payload;
  }

  function normalizeProperty(item = {}) {
    return {
      id: text(item.id || item._id),
      title: text(item.title, 'Property'),
      location: text(item.location || item.locality, 'Udaipur'),
      city: text(item.city, 'Udaipur'),
      price: toNumber(item.price, 0),
    };
  }

  async function loadPropertyOptions() {
    try {
      const response = await coreRequest('/properties?city=Udaipur&limit=100', {
        method: 'GET',
      });
      const items = Array.isArray(response?.items) ? response.items : [];
      return items.map(normalizeProperty).filter((row) => row.id);
    } catch {
      const local = readJson(LISTINGS_KEY, []);
      if (!Array.isArray(local)) return [];
      return local
        .filter((item) => item && typeof item === 'object')
        .map(normalizeProperty)
        .filter((row) => row.id);
    }
  }

  const panel = document.createElement('div');
  panel.className = 'container';
  panel.classList.add('admin-v3-shell');
  panel.id = 'adminV3ToolsPanel';
  panel.innerHTML = `
    <h2>Admin V3 Live Controls</h2>
    <div class="admin-v3-topbar" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
      <label for="adminV3PropertyIdInput" style="font-weight:700;">Property ID</label>
      <input id="adminV3PropertyIdInput" type="text" placeholder="Enter property id" style="flex:1 1 220px;min-width:180px;padding:6px;border:1px solid #ccd6e7;border-radius:4px;" />
      <select id="adminV3PropertySelect" style="flex:1 1 240px;min-width:180px;padding:6px;border:1px solid #ccd6e7;border-radius:4px;"></select>
      <button id="adminV3LoadBtn" type="button">Load</button>
      <button id="adminV3VerifyBtn" type="button">Mark Verified Badge</button>
    </div>

    <div style="margin-top:12px;border:1px solid #d6e1f5;border-radius:8px;padding:10px;background:#f8fbff;">
      <h3 style="margin:0 0 8px;">Verified + Map</h3>
      <span id="adminV3BadgeChip" style="display:inline-block;padding:4px 10px;border-radius:999px;background:#eef2f8;color:#30415d;font-weight:700;">Pending</span>
      <small id="adminV3BadgeMeta" style="display:block;margin-top:6px;color:#58729a;">Meta not loaded.</small>
      <p id="adminV3MapQuery" style="margin:8px 0;color:#1d4068;"></p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <a id="adminV3MapOpen" target="_blank" style="padding:6px 10px;background:#0b5c8a;color:#fff;border-radius:6px;text-decoration:none;">Open Map</a>
        <a id="adminV3MapDir" target="_blank" style="padding:6px 10px;background:#0b3d91;color:#fff;border-radius:6px;text-decoration:none;">Directions</a>
      </div>
      <iframe id="adminV3MapFrame" title="Admin Property Map" style="margin-top:8px;width:100%;height:260px;border:1px solid #cfdcf2;border-radius:8px;background:#fff;"></iframe>
    </div>

    <div style="margin-top:12px;border:1px solid #d6e1f5;border-radius:8px;padding:10px;background:#fff;">
      <h3 style="margin:0 0 8px;">Direct Chat + WhatsApp Handoff</h3>
      <div id="adminV3ChatThread" style="max-height:220px;overflow:auto;border:1px solid #dae6fb;border-radius:8px;padding:8px;background:#f8fbff;"></div>
      <textarea id="adminV3ChatMessage" placeholder="Type message" style="width:100%;margin-top:8px;padding:8px;border:1px solid #ccd6e7;border-radius:4px;"></textarea>
      <input id="adminV3ReceiverId" type="text" placeholder="Optional receiverId for admin message" style="width:100%;margin-top:6px;padding:8px;border:1px solid #ccd6e7;border-radius:4px;" />
      <div class="actions-row" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
        <button id="adminV3SendChatBtn" type="button">Send</button>
        <button id="adminV3RefreshChatBtn" type="button">Refresh</button>
        <button id="adminV3WaBtn" type="button">Get WhatsApp Link</button>
      </div>
      <p id="adminV3ChatStatus" style="margin:8px 0 0;color:#1d4068;"></p>
    </div>

    <div style="margin-top:12px;border:1px solid #d6e1f5;border-radius:8px;padding:10px;background:#fff;">
      <h3 style="margin:0 0 8px;">Property Compare (2-3 IDs)</h3>
      <input id="adminV3CompareIds" type="text" placeholder="id1,id2,id3" style="width:100%;padding:8px;border:1px solid #ccd6e7;border-radius:4px;" />
      <button id="adminV3CompareBtn" type="button" style="margin-top:8px;">Run Compare</button>
      <p id="adminV3CompareStatus" style="margin:8px 0 0;color:#1d4068;"></p>
      <div id="adminV3CompareResult" style="margin-top:8px;"></div>
    </div>

    <div style="margin-top:12px;border:1px solid #d6e1f5;border-radius:8px;padding:10px;background:#fff;">
      <h3 style="margin:0 0 8px;">EMI Calculator</h3>
      <div class="emi-grid" style="display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));">
        <input id="adminV3Loan" type="number" min="1" step="1000" value="3500000" placeholder="Loan amount" style="padding:8px;border:1px solid #ccd6e7;border-radius:4px;" />
        <input id="adminV3Rate" type="number" min="0" step="0.1" value="8.6" placeholder="Rate %" style="padding:8px;border:1px solid #ccd6e7;border-radius:4px;" />
        <input id="adminV3Years" type="number" min="1" step="1" value="20" placeholder="Years" style="padding:8px;border:1px solid #ccd6e7;border-radius:4px;" />
      </div>
      <button id="adminV3EmiBtn" type="button" style="margin-top:8px;">Calculate EMI</button>
      <div id="adminV3EmiResult" style="margin-top:8px;color:#1d4068;"></div>
    </div>
  `;

  const approvedContainer = approvedRoot.closest('.container');
  if (approvedContainer && approvedContainer.parentNode) {
    approvedContainer.parentNode.insertBefore(panel, approvedContainer.nextSibling);
  } else {
    document.body.appendChild(panel);
  }

  const ui = {
    propertyIdInput: document.getElementById('adminV3PropertyIdInput'),
    propertySelect: document.getElementById('adminV3PropertySelect'),
    loadBtn: document.getElementById('adminV3LoadBtn'),
    verifyBtn: document.getElementById('adminV3VerifyBtn'),
    badgeChip: document.getElementById('adminV3BadgeChip'),
    badgeMeta: document.getElementById('adminV3BadgeMeta'),
    mapQuery: document.getElementById('adminV3MapQuery'),
    mapOpen: document.getElementById('adminV3MapOpen'),
    mapDir: document.getElementById('adminV3MapDir'),
    mapFrame: document.getElementById('adminV3MapFrame'),
    chatThread: document.getElementById('adminV3ChatThread'),
    chatMessage: document.getElementById('adminV3ChatMessage'),
    chatReceiverId: document.getElementById('adminV3ReceiverId'),
    sendChatBtn: document.getElementById('adminV3SendChatBtn'),
    refreshChatBtn: document.getElementById('adminV3RefreshChatBtn'),
    waBtn: document.getElementById('adminV3WaBtn'),
    chatStatus: document.getElementById('adminV3ChatStatus'),
    compareIds: document.getElementById('adminV3CompareIds'),
    compareBtn: document.getElementById('adminV3CompareBtn'),
    compareStatus: document.getElementById('adminV3CompareStatus'),
    compareResult: document.getElementById('adminV3CompareResult'),
    loanInput: document.getElementById('adminV3Loan'),
    rateInput: document.getElementById('adminV3Rate'),
    yearsInput: document.getElementById('adminV3Years'),
    emiBtn: document.getElementById('adminV3EmiBtn'),
    emiResult: document.getElementById('adminV3EmiResult'),
  };

  function getActivePropertyId() {
    return text(ui.propertyIdInput?.value || ui.propertySelect?.value);
  }

  function setBadge(verified, approvedAt = '') {
    if (ui.badgeChip) {
      ui.badgeChip.textContent = verified ? 'Verified by PropertySetu' : 'Verification Pending';
      ui.badgeChip.style.background = verified ? '#d9f8e5' : '#eef2f8';
      ui.badgeChip.style.color = verified ? '#0f6940' : '#30415d';
    }
    if (ui.badgeMeta) {
      ui.badgeMeta.textContent = verified
        ? `Approved ${approvedAt ? new Date(approvedAt).toLocaleString('en-IN') : 'by admin'}`
        : 'Admin verification pending.';
    }
  }

  function setMap(mapView = {}, property = {}) {
    const mapsUrl = text(mapView.googleMapsUrl);
    const dirUrl = text(mapView.googleDirectionsUrl);
    const embedUrl = text(mapView.googleEmbedUrl);
    const query = text(mapView.query, `${text(property.location)}, ${text(property.city)}`);

    if (ui.mapQuery) ui.mapQuery.textContent = query ? `Map Query: ${query}` : 'Map query unavailable.';
    if (ui.mapOpen) ui.mapOpen.href = mapsUrl || '#';
    if (ui.mapDir) ui.mapDir.href = dirUrl || mapsUrl || '#';

    if (ui.mapFrame) {
      if (embedUrl) {
        ui.mapFrame.src = embedUrl;
        ui.mapFrame.style.display = 'block';
      } else {
        ui.mapFrame.style.display = 'none';
      }
    }
  }

  function renderChat(items = []) {
    if (!ui.chatThread) return;
    const list = Array.isArray(items) ? items : [];
    if (!list.length) {
      ui.chatThread.innerHTML = '<p style="margin:0;color:#607da8;">No chat messages found.</p>';
      return;
    }

    ui.chatThread.innerHTML = list.map((item) => {
      const label = `${text(item.senderRole, 'user')} (${text(item.senderId).slice(-6) || 'n/a'})`;
      const at = item.createdAt ? new Date(item.createdAt).toLocaleString('en-IN') : '';
      return `
        <div style="margin:0 0 8px;padding:8px;border:1px solid #d8e6fb;border-radius:8px;background:#f1f6ff;">
          <b>${escapeHtml(label)}</b>
          <small style="margin-left:6px;color:#607da8;">${escapeHtml(at)}</small>
          <div style="margin-top:4px;">${escapeHtml(item.message || '')}</div>
        </div>
      `;
    }).join('');
    ui.chatThread.scrollTop = ui.chatThread.scrollHeight;
  }

  function setChatStatus(message, isError = false) {
    if (!ui.chatStatus) return;
    ui.chatStatus.style.color = isError ? '#8d1e1e' : '#1d4068';
    ui.chatStatus.textContent = message;
  }

  async function loadMetaAndChat(propertyId) {
    if (!propertyId) return;

    try {
      const meta = await coreRequest(`/properties/${encodeURIComponent(propertyId)}`, { method: 'GET' });
      const item = meta?.item || {};
      const badge = item?.verifiedBadge || {};
      const verified = Boolean(badge.show || item.verifiedByPropertySetu || item.verified);
      setBadge(verified, text(badge.approvedAt));
      setMap(item?.mapView || {}, item);
    } catch (error) {
      setBadge(false);
      if (ui.badgeMeta) ui.badgeMeta.textContent = `Meta load failed: ${error.message || 'Unknown error'}`;
    }

    try {
      const chat = await coreRequest(`/chat/${encodeURIComponent(propertyId)}`, {
        method: 'GET',
      });
      renderChat(chat?.items || []);
      setChatStatus('Chat synced.');
    } catch (error) {
      renderChat([]);
      setChatStatus(`Chat load failed: ${error.message || 'Unknown error'}`, true);
    }
  }

  async function markVerified(propertyId) {
    if (!propertyId) return;
    try {
      await coreRequest(`/properties/${encodeURIComponent(propertyId)}/verify`, {
        method: 'POST',
        data: { verified: true },
      });
      await loadMetaAndChat(propertyId);
      setChatStatus('Verified badge updated by admin.');
    } catch (error) {
      setChatStatus(`Verification failed: ${error.message || 'Unknown error'}`, true);
    }
  }

  async function sendChatMessage(propertyId) {
    const message = text(ui.chatMessage?.value);
    const receiverId = text(ui.chatReceiverId?.value);
    if (!propertyId || !message) {
      setChatStatus('Property ID and message required.', true);
      return;
    }

    try {
      const payload = { propertyId, message };
      if (receiverId) payload.receiverId = receiverId;
      await coreRequest('/chat/send', {
        method: 'POST',
        data: payload,
      });
      if (ui.chatMessage) ui.chatMessage.value = '';
      setChatStatus('Message sent.');
      await loadMetaAndChat(propertyId);
    } catch (error) {
      setChatStatus(`Send failed: ${error.message || 'Unknown error'}`, true);
    }
  }

  async function openWhatsapp(propertyId) {
    if (!propertyId) return;
    const receiverId = text(ui.chatReceiverId?.value);
    const q = new URLSearchParams();
    if (receiverId) q.set('receiverId', receiverId);

    try {
      const response = await coreRequest(
        `/chat/${encodeURIComponent(propertyId)}/whatsapp-link${q.toString() ? `?${q.toString()}` : ''}`,
        { method: 'GET' }
      );
      const url = text(response?.whatsapp?.url);
      if (!url) throw new Error('WhatsApp URL unavailable.');
      window.open(url, '_blank', 'noopener,noreferrer');
      setChatStatus('WhatsApp link opened.');
    } catch (error) {
      setChatStatus(`WhatsApp failed: ${error.message || 'Unknown error'}`, true);
    }
  }

  async function runCompare() {
    const raw = text(ui.compareIds?.value);
    const ids = [...new Set(raw.split(',').map((item) => text(item)).filter(Boolean))].slice(0, 3);
    if (ids.length < 2) {
      if (ui.compareStatus) ui.compareStatus.textContent = 'At least 2 property IDs required.';
      if (ui.compareResult) ui.compareResult.innerHTML = '';
      return;
    }

    if (ui.compareStatus) ui.compareStatus.textContent = 'Compare loading...';

    try {
      const response = await coreRequest(`/properties/compare?propertyIds=${encodeURIComponent(ids.join(','))}`, {
        method: 'GET',
      });

      const items = Array.isArray(response?.items) ? response.items : [];
      const table = Array.isArray(response?.compareTable) ? response.compareTable : [];
      const highlights = response?.highlights || {};

      if (!items.length || !table.length) throw new Error('Compare data unavailable.');

      const header = `<tr><th style="border:1px solid #d6e1f5;padding:8px;background:#f4f8ff;">Field</th>${items.map((item) => `<th style="border:1px solid #d6e1f5;padding:8px;background:#f4f8ff;">${escapeHtml(text(item.title, item.id))}</th>`).join('')}</tr>`;
      const rows = table.map((row) => {
        const values = Array.isArray(row.values) ? row.values : [];
        return `<tr><td style="border:1px solid #d6e1f5;padding:8px;"><b>${escapeHtml(text(row.label, row.key))}</b></td>${values.map((value) => `<td style="border:1px solid #d6e1f5;padding:8px;">${escapeHtml(typeof value === 'number' && text(row.key) === 'price' ? inr(value) : String(value))}</td>`).join('')}</tr>`;
      }).join('');

      if (ui.compareResult) {
        ui.compareResult.innerHTML = `
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

      if (ui.compareStatus) ui.compareStatus.textContent = 'Compare completed.';
    } catch (error) {
      if (ui.compareStatus) ui.compareStatus.textContent = `Compare failed: ${error.message || 'Unknown error'}`;
      if (ui.compareResult) ui.compareResult.innerHTML = '';
    }
  }

  async function calculateEmi() {
    const loanAmount = toNumber(ui.loanInput?.value, 0);
    const annualRatePercent = toNumber(ui.rateInput?.value, 0);
    const tenureYears = toNumber(ui.yearsInput?.value, 0);

    if (loanAmount <= 0 || tenureYears <= 0 || annualRatePercent < 0) {
      if (ui.emiResult) ui.emiResult.textContent = 'Valid loan amount, rate and years enter karein.';
      return;
    }

    if (ui.emiResult) ui.emiResult.textContent = 'Calculating...';

    try {
      const response = await coreRequest(
        `/ai/emi-calculator?loanAmount=${encodeURIComponent(loanAmount)}&annualRatePercent=${encodeURIComponent(annualRatePercent)}&tenureYears=${encodeURIComponent(tenureYears)}`,
        { method: 'GET' }
      );
      const emi = response?.emi || {};
      if (ui.emiResult) {
        ui.emiResult.innerHTML = `Monthly EMI: <b>${inr(emi.monthlyEmi)}</b><br>Total Interest: <b>${inr(emi.totalInterest)}</b><br>Total Amount: <b>${inr(emi.totalAmount)}</b>`;
      }
    } catch (error) {
      if (ui.emiResult) ui.emiResult.textContent = `EMI failed: ${error.message || 'Unknown error'}`;
    }
  }

  function populatePropertySelect(items = [], selectedId = '') {
    if (!ui.propertySelect) return;
    ui.propertySelect.innerHTML = '<option value="">Select property</option>' + items
      .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(`${item.title} (${item.location})`)}</option>`)
      .join('');

    if (selectedId && items.some((item) => item.id === selectedId)) {
      ui.propertySelect.value = selectedId;
    }
  }

  function getInitialIdFromPage() {
    const firstPendingButton = pendingRoot.querySelector('[data-id]');
    if (firstPendingButton) return text(firstPendingButton.getAttribute('data-id'));
    const firstApprovedButton = approvedRoot.querySelector('[data-id]');
    if (firstApprovedButton) return text(firstApprovedButton.getAttribute('data-id'));
    return '';
  }

  ui.propertySelect?.addEventListener('change', () => {
    const id = text(ui.propertySelect?.value);
    if (ui.propertyIdInput) ui.propertyIdInput.value = id;
  });

  ui.loadBtn?.addEventListener('click', async () => {
    const propertyId = getActivePropertyId();
    if (!propertyId) return;
    await loadMetaAndChat(propertyId);
  });

  ui.verifyBtn?.addEventListener('click', async () => {
    const propertyId = getActivePropertyId();
    if (!propertyId) return;
    await markVerified(propertyId);
  });

  ui.refreshChatBtn?.addEventListener('click', async () => {
    const propertyId = getActivePropertyId();
    if (!propertyId) return;
    await loadMetaAndChat(propertyId);
  });

  ui.sendChatBtn?.addEventListener('click', async () => {
    const propertyId = getActivePropertyId();
    await sendChatMessage(propertyId);
  });

  ui.waBtn?.addEventListener('click', async () => {
    const propertyId = getActivePropertyId();
    await openWhatsapp(propertyId);
  });

  ui.compareBtn?.addEventListener('click', async () => {
    await runCompare();
  });

  ui.emiBtn?.addEventListener('click', async () => {
    await calculateEmi();
  });

  (async () => {
    const options = await loadPropertyOptions();
    const initialId = getInitialIdFromPage() || text(options[0]?.id);
    populatePropertySelect(options, initialId);
    if (ui.propertyIdInput) ui.propertyIdInput.value = initialId;
    if (ui.compareIds && initialId) ui.compareIds.value = initialId;

    if (initialId) {
      await loadMetaAndChat(initialId);
    }

    await calculateEmi();
  })();
})();
