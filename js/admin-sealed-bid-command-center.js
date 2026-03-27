(function () {
  const live = window.PropertySetuLive || {};
  const path = String(window.location.pathname || '').toLowerCase();
  const isAdminPage = path.includes('admin-dashboard') || Boolean(document.getElementById('adminOverview'));
  if (!isAdminPage) return;
  if (document.getElementById('sealedBidAdminCommandCenter')) return;

  const CORE_API_BASE = String(live.CORE_API_BASE || `${window.location.origin}/api/v3`);
  const STYLE_ID = 'sealed-bid-admin-command-center-style';
  const PREF_KEY = 'propertySetu:sealedBidAdminCenterPrefs';
  const AUDIT_KEY = 'propertySetu:sealedBidAdminCenterAudit';
  const SNAPSHOT_KEY = 'propertySetu:sealedBidAdminCenterSnapshot';

  const text = (value, fallback = '') => {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  };

  const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const toEpoch = (value) => {
    if (!value) return 0;
    const ts = new Date(value).getTime();
    return Number.isFinite(ts) ? ts : 0;
  };

  const inr = (value) => `Rs ${Math.round(toNumber(value, 0)).toLocaleString('en-IN')}`;

  const escapeHtml = (value) => text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const readJson = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const writeJson = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore quota/storage errors in fallback mode.
    }
  };

  const nowIso = () => new Date().toISOString();

  function statusLabel(value) {
    const raw = text(value).toLowerCase();
    if (!raw) return 'Unknown';
    if (raw === 'submitted') return 'Submitted';
    if (raw === 'accepted') return 'Accepted';
    if (raw === 'rejected') return 'Rejected';
    if (raw === 'revealed') return 'Revealed';
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  function getAdminToken() {
    if (typeof live.getToken === 'function') {
      return text(live.getToken('admin') || live.getToken());
    }
    if (typeof live.getAnyToken === 'function') {
      return text(live.getAnyToken());
    }
    return '';
  }

  function getAdminSession() {
    if (typeof live.getSession === 'function') {
      const session = live.getSession('admin');
      if (session) return session;
    }
    if (typeof live.getAnySession === 'function') {
      const session = live.getAnySession();
      if (session) return session;
    }
    return (
      readJson('propertysetu-admin-session', null)
      || readJson('propertySetu:adminSession', null)
      || null
    );
  }

  async function requestCore(pathname, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const token = text(options.token || getAdminToken());
    const data = options.data || null;
    const normalizedPath = String(pathname || '').startsWith('/') ? String(pathname) : `/${String(pathname || '')}`;

    if (typeof live.request === 'function') {
      return live.request(normalizedPath, {
        method,
        token,
        ...(data ? { data } : {}),
      });
    }

    const response = await fetch(`${CORE_API_BASE}${normalizedPath}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.message || `Request failed (${response.status})`);
    }
    return payload;
  }

  if (!document.getElementById(STYLE_ID)) {
    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
#sealedBidAdminCommandCenter {
  margin-top: 18px;
}
#sealedBidAdminCommandCenter input,
#sealedBidAdminCommandCenter select,
#sealedBidAdminCommandCenter button {
  box-sizing: border-box;
  border-radius: 8px;
}
#sealedBidAdminCommandCenter input,
#sealedBidAdminCommandCenter select {
  border: 1px solid #cfdcf2;
  padding: 8px;
}
#sealedBidAdminCommandCenter button {
  border: none;
  padding: 8px 12px;
  cursor: pointer;
}
#sealedBidAdminCommandCenter .sbacc-grid {
  display: grid;
  gap: 10px;
}
#sealedBidAdminCommandCenter .sbacc-top {
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
}
#sealedBidAdminCommandCenter .sbacc-kpi {
  grid-template-columns: repeat(auto-fit, minmax(165px, 1fr));
  margin-top: 10px;
}
#sealedBidAdminCommandCenter .sbacc-card {
  border: 1px solid #d6e1f5;
  background: #fff;
  border-radius: 10px;
  padding: 10px;
}
#sealedBidAdminCommandCenter .sbacc-kpi-card {
  border: 1px solid #cfe0ff;
  background: #f8fbff;
  border-radius: 10px;
  padding: 10px;
}
#sealedBidAdminCommandCenter .sbacc-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
#sealedBidAdminCommandCenter table {
  width: 100%;
  border-collapse: collapse;
}
#sealedBidAdminCommandCenter th,
#sealedBidAdminCommandCenter td {
  border: 1px solid #d6e1f5;
  padding: 8px;
  text-align: left;
  vertical-align: top;
}
#sealedBidAdminCommandCenter .risk-pill {
  display: inline-block;
  margin: 2px 6px 2px 0;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  background: #fff4cc;
  color: #7a4e00;
}
#sealedBidAdminCommandCenter .risk-pill.high {
  background: #ffe0e0;
  color: #8d1e1e;
}
#sealedBidAdminCommandCenter .code-pill {
  display: inline-block;
  margin: 2px 6px 2px 0;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  background: #e9f0ff;
  color: #1f3e7a;
}
@media (max-width: 768px) {
  #sealedBidAdminCommandCenter .sbacc-row {
    display: grid;
    grid-template-columns: 1fr;
  }
}
`;
    document.head.appendChild(styleEl);
  }

  function getMountTarget() {
    const adminPanel = document.getElementById('adminV3ToolsPanel');
    if (adminPanel?.parentElement) {
      const wrapper = document.createElement('div');
      adminPanel.parentElement.insertBefore(wrapper, adminPanel.nextSibling);
      return wrapper;
    }
    return document.body;
  }

  const mount = getMountTarget();
  const shell = document.createElement('section');
  shell.id = 'sealedBidAdminCommandCenter';
  shell.className = 'container';
  shell.innerHTML = `
<div class="sbacc-card">
  <h2 style="margin:0 0 8px;">Sealed Bid Admin Command Center</h2>
  <p style="margin:0;color:#1d4068;">Hidden bids remain private for buyer/seller/owner. Only admin actions can accept, reject, or reveal winner.</p>
</div>

<div class="sbacc-card" style="margin-top:10px;">
  <div class="sbacc-grid sbacc-top">
    <label>Load Limit
      <input id="sbaccLimit" type="number" min="20" max="2000" step="20" value="300" />
    </label>
    <label>Property Filter
      <input id="sbaccQuery" placeholder="Property title or id" />
    </label>
    <label>Status
      <select id="sbaccStatusFilter">
        <option value="all">All</option>
        <option value="submitted">Submitted</option>
        <option value="accepted">Accepted</option>
        <option value="rejected">Rejected</option>
        <option value="revealed">Revealed</option>
      </select>
    </label>
    <label>Min Bids
      <input id="sbaccMinBids" type="number" min="1" max="100" step="1" value="1" />
    </label>
    <label>Auto Refresh
      <select id="sbaccAutoSec">
        <option value="0">Off</option>
        <option value="20">20 sec</option>
        <option value="30">30 sec</option>
        <option value="60">60 sec</option>
      </select>
    </label>
    <label>Risk Only
      <select id="sbaccRiskOnly">
        <option value="0">No</option>
        <option value="1">Yes</option>
      </select>
    </label>
  </div>

  <div class="sbacc-row" style="margin-top:10px;">
    <button id="sbaccRefreshBtn" style="background:#0b3d91;color:#fff;">Refresh Board</button>
    <button id="sbaccExportBtn" style="background:#1f7a45;color:#fff;">Export CSV</button>
    <button id="sbaccClearAuditBtn" style="background:#8d1e1e;color:#fff;">Clear Audit</button>
    <span id="sbaccStatus" style="color:#1d4068;"></span>
  </div>
</div>

<div class="sbacc-card" style="margin-top:10px;">
  <h3 style="margin:0 0 8px;">Quick Decision</h3>
  <div class="sbacc-row">
    <input id="sbaccDecisionProperty" placeholder="Property ID" style="flex:1 1 180px;" />
    <select id="sbaccDecisionAction" style="min-width:180px;">
      <option value="accept">Accept Highest Bid</option>
      <option value="reject">Reject All Bids</option>
      <option value="reveal">Reveal Winner</option>
    </select>
    <input id="sbaccDecisionNote" placeholder="Audit note (optional)" style="flex:1 1 220px;" />
    <button id="sbaccApplyBtn" style="background:#4b2c82;color:#fff;">Apply Decision</button>
  </div>
</div>

<div id="sbaccKpiWrap" class="sbacc-grid sbacc-kpi"></div>

<div class="sbacc-card" style="margin-top:10px;">
  <h3 style="margin:0 0 8px;">Risk Watchlist</h3>
  <div id="sbaccRiskWrap"></div>
</div>

<div class="sbacc-card" style="margin-top:10px;">
  <h3 style="margin:0 0 8px;">Bid Board</h3>
  <div id="sbaccBoardWrap" style="overflow:auto;"></div>
</div>

<div class="sbacc-card" style="margin-top:10px;">
  <h3 style="margin:0 0 8px;">Bid Detail</h3>
  <div id="sbaccDetailWrap" style="overflow:auto;color:#325176;">Select a property from board.</div>
</div>

<div class="sbacc-card" style="margin-top:10px;">
  <h3 style="margin:0 0 8px;">Admin Audit Trail</h3>
  <div id="sbaccAuditWrap" style="max-height:220px;overflow:auto;"></div>
</div>
`;
  mount.appendChild(shell);

  const ui = {
    limitInput: document.getElementById('sbaccLimit'),
    queryInput: document.getElementById('sbaccQuery'),
    statusFilter: document.getElementById('sbaccStatusFilter'),
    minBidsInput: document.getElementById('sbaccMinBids'),
    autoSecSelect: document.getElementById('sbaccAutoSec'),
    riskOnlySelect: document.getElementById('sbaccRiskOnly'),
    refreshBtn: document.getElementById('sbaccRefreshBtn'),
    exportBtn: document.getElementById('sbaccExportBtn'),
    clearAuditBtn: document.getElementById('sbaccClearAuditBtn'),
    statusText: document.getElementById('sbaccStatus'),
    decisionPropertyInput: document.getElementById('sbaccDecisionProperty'),
    decisionActionSelect: document.getElementById('sbaccDecisionAction'),
    decisionNoteInput: document.getElementById('sbaccDecisionNote'),
    applyBtn: document.getElementById('sbaccApplyBtn'),
    kpiWrap: document.getElementById('sbaccKpiWrap'),
    riskWrap: document.getElementById('sbaccRiskWrap'),
    boardWrap: document.getElementById('sbaccBoardWrap'),
    detailWrap: document.getElementById('sbaccDetailWrap'),
    auditWrap: document.getElementById('sbaccAuditWrap'),
  };

  const defaultPrefs = {
    limit: 300,
    query: '',
    status: 'all',
    minBids: 1,
    autoSec: 0,
    riskOnly: false,
  };

  const state = {
    rows: [],
    rawItems: [],
    selectedPropertyId: '',
    autoTimer: null,
    prefs: { ...defaultPrefs, ...readJson(PREF_KEY, {}) },
  };

  function setStatus(message, isError = false) {
    if (!ui.statusText) return;
    ui.statusText.textContent = text(message);
    ui.statusText.style.color = isError ? '#8d1e1e' : '#1d4068';
  }

  function persistPrefs() {
    writeJson(PREF_KEY, state.prefs);
  }

  function readControlsToPrefs() {
    state.prefs.limit = Math.min(2000, Math.max(20, Math.round(toNumber(ui.limitInput?.value, 300))));
    state.prefs.query = text(ui.queryInput?.value);
    state.prefs.status = text(ui.statusFilter?.value, 'all').toLowerCase();
    state.prefs.minBids = Math.max(1, Math.round(toNumber(ui.minBidsInput?.value, 1)));
    state.prefs.autoSec = Math.max(0, Math.round(toNumber(ui.autoSecSelect?.value, 0)));
    state.prefs.riskOnly = text(ui.riskOnlySelect?.value) === '1';
    persistPrefs();
  }

  function applyPrefsToControls() {
    if (ui.limitInput) ui.limitInput.value = String(state.prefs.limit);
    if (ui.queryInput) ui.queryInput.value = state.prefs.query;
    if (ui.statusFilter) ui.statusFilter.value = state.prefs.status;
    if (ui.minBidsInput) ui.minBidsInput.value = String(state.prefs.minBids);
    if (ui.autoSecSelect) ui.autoSecSelect.value = String(state.prefs.autoSec);
    if (ui.riskOnlySelect) ui.riskOnlySelect.value = state.prefs.riskOnly ? '1' : '0';
  }

  function appendAudit(entry) {
    const current = readJson(AUDIT_KEY, []);
    const next = [entry, ...current].slice(0, 250);
    writeJson(AUDIT_KEY, next);
    renderAudit();
  }

  function renderAudit() {
    if (!ui.auditWrap) return;
    const audit = readJson(AUDIT_KEY, []);
    if (!Array.isArray(audit) || !audit.length) {
      ui.auditWrap.innerHTML = '<p style="margin:0;color:#607da8;">No audit records yet.</p>';
      return;
    }
    ui.auditWrap.innerHTML = audit.slice(0, 40).map((item) => `
<div style="border-bottom:1px solid #e1e9f8;padding:8px 0;">
  <b>${escapeHtml(statusLabel(item.action))}</b> - ${escapeHtml(text(item.propertyTitle, item.propertyId))}<br>
  By: <b>${escapeHtml(text(item.by, 'Admin'))}</b> | At: ${escapeHtml(new Date(item.at || nowIso()).toLocaleString('en-IN'))}<br>
  Before: ${escapeHtml(statusLabel(item.beforeStatus))} | After: ${escapeHtml(statusLabel(item.afterStatus))}
  ${item.note ? `<br>Note: ${escapeHtml(item.note)}` : ''}
</div>`).join('');
  }

  function deriveRows(items) {
    return (Array.isArray(items) ? items : []).map((item) => {
      const bids = Array.isArray(item.bids) ? item.bids : [];
      const sorted = [...bids].sort((a, b) => {
        const diff = toNumber(b.amount, 0) - toNumber(a.amount, 0);
        if (diff !== 0) return diff;
        return toEpoch(a.createdAt) - toEpoch(b.createdAt);
      });

      const top = sorted[0] || null;
      const second = sorted[1] || null;
      const totalBids = Math.max(toNumber(item.totalBids, sorted.length), sorted.length);
      const status = text(item.status, 'submitted').toLowerCase();
      const winningBidRevealed = Boolean(item.winningBidRevealed);

      const bidderCount = sorted.reduce((acc, bid) => {
        const key = text(bid.bidderId || bid.bidderName, 'unknown');
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      let maxBidderLabel = 'n/a';
      let maxBidderCount = 0;
      Object.entries(bidderCount).forEach(([key, count]) => {
        if (count > maxBidderCount) {
          maxBidderCount = count;
          maxBidderLabel = key;
        }
      });

      const topAmount = toNumber(top?.amount, 0);
      const secondAmount = toNumber(second?.amount, 0);
      const gapPercent = secondAmount > 0 ? ((topAmount - secondAmount) / secondAmount) * 100 : null;
      const ageHours = top?.createdAt
        ? Math.max(0, (Date.now() - toEpoch(top.createdAt)) / 3600000)
        : null;

      const flags = [];
      let riskScore = 0;

      if (totalBids >= 5 && gapPercent !== null && gapPercent <= 1.5) {
        flags.push('Very close top bids');
        riskScore += 2;
      }
      if (maxBidderCount >= 3) {
        flags.push(`Repeat bidder concentration (${maxBidderCount})`);
        riskScore += 2;
      }
      if (topAmount > 0 && secondAmount > 0 && topAmount >= secondAmount * 2.5) {
        flags.push('Top bid outlier spike');
        riskScore += 2;
      }
      if (status === 'submitted' && ageHours !== null && ageHours >= 72) {
        flags.push('Pending decision over 72h');
        riskScore += 1;
      }
      if (status === 'accepted' && !winningBidRevealed) {
        flags.push('Accepted but winner not revealed');
        riskScore += 1;
      }

      return {
        propertyId: text(item.propertyId),
        propertyTitle: text(item.propertyTitle, 'Property'),
        totalBids,
        status,
        winningBidRevealed,
        winnerBid: item.winnerBid || null,
        bids: sorted,
        top,
        second,
        topAmount,
        secondAmount,
        gapPercent,
        ageHours,
        maxBidderLabel,
        maxBidderCount,
        flags,
        riskScore,
      };
    }).sort((a, b) => {
      const riskDiff = b.riskScore - a.riskScore;
      if (riskDiff !== 0) return riskDiff;
      const amountDiff = b.topAmount - a.topAmount;
      if (amountDiff !== 0) return amountDiff;
      return toEpoch(b.top?.createdAt) - toEpoch(a.top?.createdAt);
    });
  }

  function filterRows(rows) {
    const query = text(state.prefs.query).toLowerCase();
    const statusFilter = text(state.prefs.status, 'all').toLowerCase();
    const minBids = Math.max(1, toNumber(state.prefs.minBids, 1));

    return rows.filter((row) => {
      if (row.totalBids < minBids) return false;
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (state.prefs.riskOnly && !row.flags.length) return false;
      if (!query) return true;
      return (
        row.propertyTitle.toLowerCase().includes(query)
        || row.propertyId.toLowerCase().includes(query)
      );
    });
  }

  function renderKpi(rows) {
    if (!ui.kpiWrap) return;
    const totalProperties = rows.length;
    const totalBids = rows.reduce((sum, row) => sum + row.totalBids, 0);
    const submitted = rows.filter((row) => row.status === 'submitted').length;
    const accepted = rows.filter((row) => row.status === 'accepted').length;
    const rejected = rows.filter((row) => row.status === 'rejected').length;
    const revealed = rows.filter((row) => row.winningBidRevealed).length;
    const highRisk = rows.filter((row) => row.riskScore >= 3).length;

    const cards = [
      ['Properties', totalProperties],
      ['Total Bids', totalBids],
      ['Submitted', submitted],
      ['Accepted', accepted],
      ['Rejected', rejected],
      ['Revealed', revealed],
      ['High Risk', highRisk],
    ];

    ui.kpiWrap.innerHTML = cards.map(([label, value]) => `
<div class="sbacc-kpi-card">
  <div style="font-size:12px;color:#325176;">${escapeHtml(String(label))}</div>
  <div style="font-size:22px;font-weight:700;color:#0b3d91;">${escapeHtml(String(value))}</div>
</div>`).join('');
  }

  function renderRiskWatch(rows) {
    if (!ui.riskWrap) return;
    const risky = rows
      .filter((row) => row.flags.length)
      .sort((a, b) => b.riskScore - a.riskScore || b.topAmount - a.topAmount)
      .slice(0, 10);

    if (!risky.length) {
      ui.riskWrap.innerHTML = '<p style="margin:0;color:#1f7a45;">No major anomalies detected in current filter.</p>';
      return;
    }

    ui.riskWrap.innerHTML = risky.map((row) => `
<div style="border-bottom:1px solid #e1e9f8;padding:8px 0;">
  <b>${escapeHtml(row.propertyTitle)}</b> (${escapeHtml(row.propertyId)})<br>
  ${row.flags.map((flag) => `<span class="risk-pill ${row.riskScore >= 3 ? 'high' : ''}">${escapeHtml(flag)}</span>`).join('')}
</div>`).join('');
  }

  function renderBoard(rows) {
    if (!ui.boardWrap) return;
    if (!rows.length) {
      ui.boardWrap.innerHTML = '<p style="margin:0;color:#607da8;">No properties match current filters.</p>';
      return;
    }

    ui.boardWrap.innerHTML = `
<table>
  <thead>
    <tr>
      <th>Property</th>
      <th>Status</th>
      <th>Bids</th>
      <th>Top / Second</th>
      <th>Gap</th>
      <th>Risk</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    ${rows.map((row) => `
      <tr>
        <td>
          <b>${escapeHtml(row.propertyTitle)}</b><br>
          <span style="color:#546f96;">${escapeHtml(row.propertyId)}</span>
        </td>
        <td>
          <span class="code-pill">${escapeHtml(statusLabel(row.status))}</span>
          ${row.winningBidRevealed ? '<span class="code-pill">Winner Revealed</span>' : ''}
        </td>
        <td>${row.totalBids}</td>
        <td>
          ${row.top ? `${inr(row.topAmount)} / ${row.second ? inr(row.secondAmount) : '-'}` : '-'}
        </td>
        <td>${row.gapPercent === null ? '-' : `${row.gapPercent.toFixed(2)}%`}</td>
        <td>
          ${row.flags.length
            ? row.flags.map((flag) => `<span class="risk-pill ${row.riskScore >= 3 ? 'high' : ''}">${escapeHtml(flag)}</span>`).join('')
            : '<span style="color:#1f7a45;">Normal</span>'}
        </td>
        <td>
          <div class="sbacc-row" style="gap:6px;">
            <button data-action="details" data-property-id="${escapeHtml(row.propertyId)}" style="background:#0b5c8a;color:#fff;">Details</button>
            <button data-action="accept" data-property-id="${escapeHtml(row.propertyId)}" style="background:#1f7a45;color:#fff;">Accept</button>
            <button data-action="reject" data-property-id="${escapeHtml(row.propertyId)}" style="background:#8d1e1e;color:#fff;">Reject</button>
            <button data-action="reveal" data-property-id="${escapeHtml(row.propertyId)}" style="background:#4b2c82;color:#fff;">Reveal</button>
          </div>
        </td>
      </tr>
    `).join('')}
  </tbody>
</table>`;
  }

  function renderDetail(propertyId) {
    if (!ui.detailWrap) return;
    const row = state.rows.find((entry) => entry.propertyId === propertyId);
    if (!row) {
      ui.detailWrap.innerHTML = '<p style="margin:0;color:#607da8;">Select a property from board.</p>';
      return;
    }

    ui.detailWrap.innerHTML = `
<div style="margin-bottom:8px;">
  <b>${escapeHtml(row.propertyTitle)}</b> (${escapeHtml(row.propertyId)})<br>
  Status: <b>${escapeHtml(statusLabel(row.status))}</b> | Total bids: <b>${row.totalBids}</b>
</div>
<div style="overflow:auto;">
  <table>
    <thead>
      <tr>
        <th>Bidder</th>
        <th>Role</th>
        <th>Amount</th>
        <th>Status</th>
        <th>Time</th>
      </tr>
    </thead>
    <tbody>
      ${row.bids.map((bid) => `
        <tr>
          <td>${escapeHtml(text(bid.bidderName, bid.bidderId || 'Bidder'))}</td>
          <td>${escapeHtml(text(bid.bidderRole, '-'))}</td>
          <td>${inr(bid.amount)}</td>
          <td>${escapeHtml(statusLabel(bid.status))}${bid.winnerRevealed ? ' (revealed)' : ''}</td>
          <td>${escapeHtml(bid.createdAt ? new Date(bid.createdAt).toLocaleString('en-IN') : '-')}</td>
        </tr>
      `).join('') || '<tr><td colspan="5">No bids.</td></tr>'}
    </tbody>
  </table>
</div>`;
  }

  function renderAll() {
    const filtered = filterRows(state.rows);
    renderKpi(filtered);
    renderRiskWatch(filtered);
    renderBoard(filtered);
    if (state.selectedPropertyId) renderDetail(state.selectedPropertyId);
  }

  function exportCsv(rows) {
    const header = [
      'propertyId',
      'propertyTitle',
      'status',
      'winningBidRevealed',
      'totalBids',
      'topBidAmount',
      'secondBidAmount',
      'gapPercent',
      'riskScore',
      'riskFlags',
    ];

    const lines = rows.map((row) => [
      row.propertyId,
      row.propertyTitle,
      row.status,
      row.winningBidRevealed ? 'yes' : 'no',
      row.totalBids,
      row.topAmount,
      row.secondAmount,
      row.gapPercent === null ? '' : row.gapPercent.toFixed(2),
      row.riskScore,
      row.flags.join(' | '),
    ].map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','));

    const csv = `${header.join(',')}\n${lines.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sealed-bid-admin-board-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }

  async function loadBoard() {
    const token = getAdminToken();
    readControlsToPrefs();

    if (!token) {
      const snapshot = readJson(SNAPSHOT_KEY, null);
      if (snapshot?.items?.length) {
        state.rawItems = snapshot.items;
        state.rows = deriveRows(snapshot.items);
        renderAll();
        setStatus('Admin token missing. Showing cached sealed bid board.', true);
        return;
      }
      setStatus('Admin login required for live sealed bid board.', true);
      return;
    }

    try {
      const query = new URLSearchParams();
      query.set('limit', String(state.prefs.limit));
      const response = await requestCore(`/sealed-bids/admin?${query.toString()}`, {
        method: 'GET',
        token,
      });
      const items = Array.isArray(response?.items) ? response.items : [];
      state.rawItems = items;
      state.rows = deriveRows(items);
      writeJson(SNAPSHOT_KEY, {
        updatedAt: nowIso(),
        items,
      });
      renderAll();
      setStatus(`Board refreshed (${items.length} properties).`);

      const adminRole = text(getAdminSession()?.role).toLowerCase();
      if (adminRole && adminRole !== 'admin') {
        setStatus('Current session is not admin. Decision actions may fail.', true);
      }
    } catch (error) {
      const snapshot = readJson(SNAPSHOT_KEY, null);
      if (snapshot?.items?.length) {
        state.rawItems = snapshot.items;
        state.rows = deriveRows(snapshot.items);
        renderAll();
        setStatus(`Live board failed: ${error.message || 'Unknown error'}. Showing cached board.`, true);
      } else {
        setStatus(`Board load failed: ${error.message || 'Unknown error'}`, true);
      }
    }
  }

  async function applyDecision(propertyId, action, note = '') {
    const token = getAdminToken();
    if (!token) {
      setStatus('Admin login required to apply decision.', true);
      return;
    }

    const normalizedAction = text(action).toLowerCase();
    if (!propertyId || !normalizedAction) {
      setStatus('Property ID and decision action required.', true);
      return;
    }

    if (normalizedAction === 'reject' && !window.confirm('Reject all bids for this property?')) return;
    if (normalizedAction === 'reveal' && !window.confirm('Reveal winning bid publicly for this property?')) return;

    const row = state.rows.find((entry) => entry.propertyId === propertyId);
    const beforeStatus = row?.status || 'unknown';

    try {
      const response = await requestCore('/sealed-bids/decision', {
        method: 'POST',
        token,
        data: {
          propertyId,
          action: normalizedAction,
        },
      });

      appendAudit({
        at: nowIso(),
        by: text(getAdminSession()?.name, 'Admin'),
        propertyId,
        propertyTitle: text(row?.propertyTitle, propertyId),
        action: normalizedAction,
        beforeStatus,
        afterStatus: text(response?.status, normalizedAction),
        note: text(note),
      });

      setStatus(`Decision applied: ${normalizedAction} for ${text(row?.propertyTitle, propertyId)}.`);
      await loadBoard();
      state.selectedPropertyId = propertyId;
      renderDetail(propertyId);
    } catch (error) {
      setStatus(`Decision failed: ${error.message || 'Unknown error'}`, true);
    }
  }

  function setAutoRefresh(seconds) {
    if (state.autoTimer) {
      clearInterval(state.autoTimer);
      state.autoTimer = null;
    }
    if (seconds > 0) {
      state.autoTimer = setInterval(() => {
        loadBoard();
      }, seconds * 1000);
    }
  }

  ui.refreshBtn?.addEventListener('click', () => {
    loadBoard();
  });

  ui.exportBtn?.addEventListener('click', () => {
    const filtered = filterRows(state.rows);
    exportCsv(filtered);
    setStatus(`CSV exported (${filtered.length} rows).`);
  });

  ui.clearAuditBtn?.addEventListener('click', () => {
    if (!window.confirm('Clear sealed bid admin audit trail?')) return;
    writeJson(AUDIT_KEY, []);
    renderAudit();
    setStatus('Audit trail cleared.');
  });

  ui.applyBtn?.addEventListener('click', () => {
    const propertyId = text(ui.decisionPropertyInput?.value);
    const action = text(ui.decisionActionSelect?.value);
    const note = text(ui.decisionNoteInput?.value);
    applyDecision(propertyId, action, note);
  });

  ui.boardWrap?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = text(target.getAttribute('data-action')).toLowerCase();
    const propertyId = text(target.getAttribute('data-property-id'));
    if (!action || !propertyId) return;

    if (ui.decisionPropertyInput) ui.decisionPropertyInput.value = propertyId;

    if (action === 'details') {
      state.selectedPropertyId = propertyId;
      renderDetail(propertyId);
      return;
    }

    applyDecision(propertyId, action, text(ui.decisionNoteInput?.value));
  });

  [
    ui.limitInput,
    ui.queryInput,
    ui.statusFilter,
    ui.minBidsInput,
    ui.riskOnlySelect,
  ].forEach((element) => {
    element?.addEventListener('input', () => {
      readControlsToPrefs();
      renderAll();
    });
    element?.addEventListener('change', () => {
      readControlsToPrefs();
      renderAll();
    });
  });

  ui.autoSecSelect?.addEventListener('change', () => {
    readControlsToPrefs();
    setAutoRefresh(state.prefs.autoSec);
    setStatus(state.prefs.autoSec > 0 ? `Auto refresh enabled (${state.prefs.autoSec}s).` : 'Auto refresh disabled.');
  });

  applyPrefsToControls();
  renderAudit();
  setAutoRefresh(Math.max(0, toNumber(state.prefs.autoSec, 0)));
  loadBoard();

  window.addEventListener('beforeunload', () => {
    if (state.autoTimer) clearInterval(state.autoTimer);
  });
})();
