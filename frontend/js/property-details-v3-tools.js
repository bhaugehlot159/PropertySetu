(function () {
  const live = window.PropertySetuLive || {};
  const rootSection = document.querySelector('section.section');
  if (!rootSection) return;

  const params = new URLSearchParams(window.location.search || '');
  const hashId = String(window.location.hash || '').replace('#', '').trim();
  const propertyId = String(params.get('id') || '').trim() || hashId;
  if (!propertyId) return;

  const CORE_API_BASE = String(live.CORE_API_BASE || `${window.location.origin}/api/v3`);

  const text = (value, fallback = '') => {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  };

  const escapeHtml = (value) => text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const inr = (value) => `₹${toNumber(value, 0).toLocaleString('en-IN')}`;

  const getSession = () => (typeof live.getAnySession === 'function' ? live.getAnySession() : null) || null;
  const getToken = () => (typeof live.getAnyToken === 'function' ? live.getAnyToken() : '') || '';

  async function coreRequest(path, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const token = String(options.token || getToken()).trim();
    const normalizedPath = String(path || '').startsWith('/') ? String(path) : `/${String(path || '')}`;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${CORE_API_BASE}${normalizedPath}`, {
      method,
      headers,
      ...(options.data ? { body: JSON.stringify(options.data) } : {}),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || `Request failed (${response.status})`);
    }
    return payload;
  }

  const block = document.createElement('section');
  block.style.maxWidth = '900px';
  block.style.margin = '18px auto 0';
  block.style.textAlign = 'left';
  block.style.display = 'grid';
  block.style.gap = '14px';
  block.innerHTML = `
<section style="border:1px solid #d6e1f5;border-radius:10px;padding:14px;background:#fff;">
  <h3 style="margin:0 0 10px;">Verified + Map View</h3>
  <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
    <span id="verifiedBadgeChip" style="display:inline-block;padding:6px 12px;border-radius:999px;background:#eef2f8;color:#30415d;font-weight:700;">Verification Pending</span>
    <small id="verifiedBadgeMeta" style="color:#58729a;">Admin verification status loading...</small>
  </div>
  <p id="mapQueryLabel" style="margin:10px 0 8px;color:#1d4068;">Map location loading...</p>
  <div style="display:flex;gap:8px;flex-wrap:wrap;">
    <a id="mapOpenLink" target="_blank" style="padding:8px 12px;background:#0b5c8a;color:#fff;border-radius:6px;text-decoration:none;">Open on Google Maps</a>
    <a id="mapDirectionsLink" target="_blank" style="padding:8px 12px;background:#0b3d91;color:#fff;border-radius:6px;text-decoration:none;">Directions</a>
  </div>
  <iframe id="mapEmbedFrame" title="Property Map" style="margin-top:10px;width:100%;height:280px;border:1px solid #cdd8ef;border-radius:8px;background:#f7faff;"></iframe>
</section>

<section style="border:1px solid #d6e1f5;border-radius:10px;padding:14px;background:#fff;">
  <h3 style="margin:0 0 10px;">Direct Chat (Buyer ↔ Seller)</h3>
  <div id="chatThread" style="max-height:220px;overflow:auto;border:1px solid #dbe5f8;border-radius:8px;padding:8px;background:#f8fbff;"></div>
  <div style="display:grid;gap:8px;margin-top:10px;">
    <textarea id="chatMessageInput" placeholder="Type your message (direct phone/email allowed nahi hai)" style="width:100%;padding:8px;"></textarea>
    <input id="chatReceiverIdInput" placeholder="Optional receiverId (owner/admin reply use-case)" style="padding:8px;" />
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button id="chatSendBtn" style="padding:8px 12px;background:#0b5c8a;color:#fff;border:none;border-radius:6px;">Send Message</button>
      <button id="chatRefreshBtn" style="padding:8px 12px;background:#3c5f8b;color:#fff;border:none;border-radius:6px;">Refresh Chat</button>
      <button id="chatWhatsAppBtn" style="padding:8px 12px;background:#25D366;color:#fff;border:none;border-radius:6px;">Get WhatsApp Link</button>
    </div>
    <p id="chatStatus" style="margin:0;color:#1d4068;"></p>
  </div>
</section>

<section style="border:1px solid #d6e1f5;border-radius:10px;padding:14px;background:#fff;">
  <h3 style="margin:0 0 10px;">Property Compare (2-3 IDs)</h3>
  <input id="compareIdsInput" style="width:100%;padding:8px;" placeholder="Enter comma-separated property IDs" />
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
    <button id="compareRunBtn" style="padding:8px 12px;background:#0b3d91;color:#fff;border:none;border-radius:6px;">Run Compare</button>
    <small style="color:#58729a;align-self:center;">Example: id1,id2,id3</small>
  </div>
  <p id="compareStatus" style="margin:8px 0 0;color:#1d4068;"></p>
  <div id="compareResult" style="margin-top:10px;"></div>
</section>

<section style="border:1px solid #d6e1f5;border-radius:10px;padding:14px;background:#fff;">
  <h3 style="margin:0 0 10px;">EMI Calculator</h3>
  <div style="display:grid;gap:8px;grid-template-columns:repeat(3,minmax(0,1fr));">
    <input id="emiLoanInput" type="number" min="1" step="1000" value="3500000" placeholder="Loan Amount" style="padding:8px;" />
    <input id="emiRateInput" type="number" min="0" step="0.1" value="8.6" placeholder="Annual Rate %" style="padding:8px;" />
    <input id="emiYearsInput" type="number" min="1" step="1" value="20" placeholder="Tenure Years" style="padding:8px;" />
  </div>
  <button id="emiCalcBtn" style="margin-top:8px;padding:8px 12px;background:#1f7a45;color:#fff;border:none;border-radius:6px;">Calculate EMI</button>
  <div id="emiResult" style="margin-top:10px;color:#1d4068;"></div>
</section>
`;

  rootSection.appendChild(block);

  const verifiedBadgeChip = document.getElementById('verifiedBadgeChip');
  const verifiedBadgeMeta = document.getElementById('verifiedBadgeMeta');
  const mapQueryLabel = document.getElementById('mapQueryLabel');
  const mapOpenLink = document.getElementById('mapOpenLink');
  const mapDirectionsLink = document.getElementById('mapDirectionsLink');
  const mapEmbedFrame = document.getElementById('mapEmbedFrame');

  const chatThread = document.getElementById('chatThread');
  const chatMessageInput = document.getElementById('chatMessageInput');
  const chatReceiverIdInput = document.getElementById('chatReceiverIdInput');
  const chatSendBtn = document.getElementById('chatSendBtn');
  const chatRefreshBtn = document.getElementById('chatRefreshBtn');
  const chatWhatsAppBtn = document.getElementById('chatWhatsAppBtn');
  const chatStatus = document.getElementById('chatStatus');

  const compareIdsInput = document.getElementById('compareIdsInput');
  const compareRunBtn = document.getElementById('compareRunBtn');
  const compareStatus = document.getElementById('compareStatus');
  const compareResult = document.getElementById('compareResult');

  const emiLoanInput = document.getElementById('emiLoanInput');
  const emiRateInput = document.getElementById('emiRateInput');
  const emiYearsInput = document.getElementById('emiYearsInput');
  const emiCalcBtn = document.getElementById('emiCalcBtn');
  const emiResult = document.getElementById('emiResult');

  if (compareIdsInput) compareIdsInput.value = propertyId;

  const setChatStatus = (message, isError = false) => {
    if (!chatStatus) return;
    chatStatus.style.color = isError ? '#8d1e1e' : '#1d4068';
    chatStatus.textContent = message;
  };

  const renderChatItems = (items) => {
    if (!chatThread) return;
    const rows = Array.isArray(items) ? items : [];
    if (!rows.length) {
      chatThread.innerHTML = '<p style="margin:0;color:#607da8;">No chat yet for this property.</p>';
      return;
    }
    const currentUserId = text(getSession()?.id);
    chatThread.innerHTML = rows.map((item) => {
      const mine = text(item.senderId) && text(item.senderId) === currentUserId;
      const senderLabel = mine ? 'You' : (item.senderRole || 'User');
      return `<div style="margin:0 0 8px;padding:8px;border-radius:8px;background:${mine ? '#e9f7ef' : '#f1f6ff'};border:1px solid ${mine ? '#cfead8' : '#d8e6fb'};">
        <b>${escapeHtml(senderLabel)}</b>
        <span style="font-size:12px;color:#607da8;margin-left:6px;">${escapeHtml(new Date(item.createdAt || Date.now()).toLocaleString('en-IN'))}</span>
        <div style="margin-top:4px;">${escapeHtml(item.message || '')}</div>
      </div>`;
    }).join('');
  };

  async function loadPropertyMeta() {
    try {
      const token = getToken();
      const response = await coreRequest(`/properties/${encodeURIComponent(propertyId)}`, {
        method: 'GET',
        token,
      });
      const property = response?.item || {};
      const verifiedBadge = property?.verifiedBadge || {};
      const verified = Boolean(verifiedBadge.show || property.verifiedByPropertySetu || property.verified);

      if (verifiedBadgeChip) {
        verifiedBadgeChip.textContent = verified ? 'Verified by PropertySetu' : 'Verification Pending';
        verifiedBadgeChip.style.background = verified ? '#d9f8e5' : '#eef2f8';
        verifiedBadgeChip.style.color = verified ? '#0f6940' : '#30415d';
      }
      if (verifiedBadgeMeta) {
        const approvedAt = text(verifiedBadge.approvedAt);
        verifiedBadgeMeta.textContent = verified
          ? `Approved ${approvedAt ? new Date(approvedAt).toLocaleString('en-IN') : 'by admin'}`
          : 'Admin approval required before verified badge shows.';
      }

      const mapView = property?.mapView || {};
      const mapQuery = text(mapView.query, `${text(property.location)}, ${text(property.city)}`);
      if (mapQueryLabel) mapQueryLabel.textContent = mapQuery ? `Map Query: ${mapQuery}` : 'Map query unavailable.';

      const mapsUrl = text(mapView.googleMapsUrl);
      const directionsUrl = text(mapView.googleDirectionsUrl);
      const embedUrl = text(mapView.googleEmbedUrl);

      if (mapOpenLink) mapOpenLink.href = mapsUrl || '#';
      if (mapDirectionsLink) mapDirectionsLink.href = directionsUrl || mapsUrl || '#';
      if (mapEmbedFrame) {
        if (embedUrl) {
          mapEmbedFrame.src = embedUrl;
          mapEmbedFrame.style.display = 'block';
        } else {
          mapEmbedFrame.style.display = 'none';
        }
      }
    } catch (error) {
      if (verifiedBadgeMeta) verifiedBadgeMeta.textContent = `Meta load failed: ${error.message || 'Unknown error'}`;
      if (mapQueryLabel) mapQueryLabel.textContent = 'Map data unavailable.';
      if (mapEmbedFrame) mapEmbedFrame.style.display = 'none';
    }
  }

  async function loadChat() {
    const token = getToken();
    if (!token) {
      renderChatItems([]);
      setChatStatus('Chat use karne ke liye login required.', true);
      return;
    }

    try {
      const response = await coreRequest(`/chat/${encodeURIComponent(propertyId)}`, {
        method: 'GET',
        token,
      });
      renderChatItems(response?.items || []);
      setChatStatus('Chat synced successfully.');
    } catch (error) {
      setChatStatus(`Chat load failed: ${error.message || 'Unknown error'}`, true);
    }
  }

  async function sendChat() {
    const token = getToken();
    if (!token) {
      setChatStatus('Message bhejne ke liye login required.', true);
      return;
    }
    const message = text(chatMessageInput?.value);
    if (!message) {
      setChatStatus('Message empty nahi hona chahiye.', true);
      return;
    }
    const receiverId = text(chatReceiverIdInput?.value);

    try {
      const payload = {
        propertyId,
        message,
        whatsappHandoff: false,
      };
      if (receiverId) payload.receiverId = receiverId;

      const response = await coreRequest('/chat/send', {
        method: 'POST',
        token,
        data: payload,
      });

      if (chatMessageInput) chatMessageInput.value = '';
      setChatStatus('Message sent.');

      const wa = response?.whatsapp || {};
      const waUrl = text(wa.url);
      const existingWaLink = document.getElementById('whatsappLink');
      if (waUrl && existingWaLink) {
        existingWaLink.href = waUrl;
      }
      await loadChat();
    } catch (error) {
      setChatStatus(`Message failed: ${error.message || 'Unknown error'}`, true);
    }
  }

  async function getWhatsAppHandoff() {
    const token = getToken();
    if (!token) {
      setChatStatus('WhatsApp handoff ke liye login required.', true);
      return;
    }
    const receiverId = text(chatReceiverIdInput?.value);
    const query = new URLSearchParams();
    if (receiverId) query.set('receiverId', receiverId);

    try {
      const response = await coreRequest(
        `/chat/${encodeURIComponent(propertyId)}/whatsapp-link${query.toString() ? `?${query.toString()}` : ''}`,
        {
          method: 'GET',
          token,
        }
      );
      const waUrl = text(response?.whatsapp?.url);
      if (!waUrl) throw new Error('WhatsApp link unavailable.');

      const existingWaLink = document.getElementById('whatsappLink');
      if (existingWaLink) existingWaLink.href = waUrl;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
      setChatStatus('WhatsApp link generated and opened.');
    } catch (error) {
      setChatStatus(`WhatsApp handoff failed: ${error.message || 'Unknown error'}`, true);
    }
  }

  async function runCompare() {
    const raw = text(compareIdsInput?.value);
    const ids = [...new Set(raw.split(',').map((item) => text(item)).filter(Boolean))].slice(0, 3);
    if (ids.length < 2) {
      if (compareStatus) compareStatus.textContent = 'Compare ke liye minimum 2 property IDs chahiye.';
      if (compareResult) compareResult.innerHTML = '';
      return;
    }

    if (compareStatus) compareStatus.textContent = 'Compare loading...';
    try {
      const response = await coreRequest(`/properties/compare?propertyIds=${encodeURIComponent(ids.join(','))}`, {
        method: 'GET',
      });
      const items = Array.isArray(response?.items) ? response.items : [];
      const table = Array.isArray(response?.compareTable) ? response.compareTable : [];
      if (!items.length) throw new Error('Compare data not found.');

      const header = `<tr><th style="border:1px solid #d6e1f5;padding:8px;background:#f4f8ff;">Field</th>${items.map((item) => `<th style="border:1px solid #d6e1f5;padding:8px;background:#f4f8ff;">${escapeHtml(item.title || item.id)}</th>`).join('')}</tr>`;
      const rows = table.map((row) => `<tr><td style="border:1px solid #d6e1f5;padding:8px;"><b>${escapeHtml(row.label || row.key)}</b></td>${(row.values || []).map((value) => `<td style="border:1px solid #d6e1f5;padding:8px;">${escapeHtml(typeof value === 'number' && row.key === 'price' ? inr(value) : String(value))}</td>`).join('')}</tr>`).join('');

      const highlights = response?.highlights || {};
      const bestPrice = highlights?.bestPrice?.price;
      const largestSize = highlights?.largestSize?.size;

      if (compareResult) {
        compareResult.innerHTML = `
<div style="margin-bottom:8px;color:#1d4068;">
  <b>Highlights:</b>
  Best Price: ${bestPrice ? inr(bestPrice) : 'N/A'} |
  Largest Size: ${largestSize ? `${largestSize} sqft` : 'N/A'} |
  Verified Count: ${toNumber(highlights?.verifiedCount, 0)}
</div>
<div style="overflow:auto;">
  <table style="border-collapse:collapse;min-width:640px;width:100%;">${header}${rows}</table>
</div>`;
      }
      if (compareStatus) compareStatus.textContent = 'Compare completed.';
    } catch (error) {
      if (compareStatus) compareStatus.textContent = `Compare failed: ${error.message || 'Unknown error'}`;
      if (compareResult) compareResult.innerHTML = '';
    }
  }

  async function calculateEmi() {
    const loanAmount = toNumber(emiLoanInput?.value, 0);
    const annualRatePercent = toNumber(emiRateInput?.value, 0);
    const tenureYears = toNumber(emiYearsInput?.value, 0);

    if (loanAmount <= 0 || tenureYears <= 0 || annualRatePercent < 0) {
      if (emiResult) emiResult.textContent = 'Valid loan amount, interest rate aur tenure enter karein.';
      return;
    }

    if (emiResult) emiResult.textContent = 'Calculating EMI...';
    try {
      const response = await coreRequest(
        `/ai/emi-calculator?loanAmount=${encodeURIComponent(loanAmount)}&annualRatePercent=${encodeURIComponent(annualRatePercent)}&tenureYears=${encodeURIComponent(tenureYears)}`,
        {
          method: 'GET',
        }
      );
      const emi = response?.emi || {};
      if (emiResult) {
        emiResult.innerHTML = `Monthly EMI: <b>${inr(emi.monthlyEmi)}</b><br>Total Interest: <b>${inr(emi.totalInterest)}</b><br>Total Amount: <b>${inr(emi.totalAmount)}</b>`;
      }
    } catch (error) {
      if (emiResult) emiResult.textContent = `EMI calculation failed: ${error.message || 'Unknown error'}`;
    }
  }

  chatSendBtn?.addEventListener('click', sendChat);
  chatRefreshBtn?.addEventListener('click', loadChat);
  chatWhatsAppBtn?.addEventListener('click', getWhatsAppHandoff);
  compareRunBtn?.addEventListener('click', runCompare);
  emiCalcBtn?.addEventListener('click', calculateEmi);

  loadPropertyMeta();
  loadChat();
  calculateEmi();
})();
