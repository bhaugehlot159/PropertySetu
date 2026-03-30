(() => {
  if (document.getElementById('adminModerationCommandCenterCard')) return;

  const live = window.PropertySetuLive || {};
  const path = String(window.location.pathname || '').toLowerCase();
  const isAdminPage = path.includes('admin-dashboard') || Boolean(document.getElementById('adminOverview'));
  if (!isAdminPage) return;

  const CARD_ID = 'adminModerationCommandCenterCard';
  const STYLE_ID = 'admin-moderation-command-center-style';
  const LISTINGS_KEY = 'propertySetu:listings';
  const USER_CACHE_KEY = 'propertySetu:adminUsersCache';
  const REPORT_CACHE_KEY = 'propertySetu:adminReportsCache';
  const PREF_KEY = 'propertySetu:adminModerationPrefs';
  const AUDIT_KEY = 'propertySetu:adminModerationAudit';

  const text = (value, fallback = '') => {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  };
  const numberFrom = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const epoch = (value) => {
    const ts = new Date(value || '').getTime();
    return Number.isFinite(ts) ? ts : 0;
  };
  const nowIso = () => new Date().toISOString();
  const shortTime = (value) => {
    const ts = epoch(value);
    if (!ts) return '-';
    return new Date(ts).toLocaleString('en-IN');
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

  const getAdminToken = () => {
    if (typeof live.getToken === 'function') return text(live.getToken('admin') || live.getToken());
    if (typeof live.getAnyToken === 'function') return text(live.getAnyToken());
    return '';
  };
  const getAdminName = () => {
    if (typeof live.getSession === 'function') {
      const session = live.getSession('admin');
      if (session?.name) return text(session.name);
    }
    if (typeof live.getAnySession === 'function') {
      const session = live.getAnySession();
      if (session?.name) return text(session.name);
    }
    const local = readJson('propertysetu-admin-session', null);
    return text(local?.name, 'Admin');
  };

  const pushNotification = (title, message, audience = ['admin'], type = 'info') => {
    if (!title || !message) return;
    if (window.PropertySetuNotify && typeof window.PropertySetuNotify.emit === 'function') {
      window.PropertySetuNotify.emit({ title, message, audience, type });
      return;
    }
    const rows = readJson('propertySetu:notifications', []);
    const list = Array.isArray(rows) ? rows : [];
    list.unshift({
      id: `moderation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      message,
      audience,
      type,
      createdAt: nowIso(),
      readBy: {},
    });
    writeJson('propertySetu:notifications', list.slice(0, 1000));
  };

  const getPrefs = () => {
    const value = readJson(PREF_KEY, {});
    return {
      query: text(value?.query),
      role: text(value?.role, 'all').toLowerCase(),
      blockState: text(value?.blockState, 'all').toLowerCase(),
      riskState: text(value?.riskState, 'all').toLowerCase(),
      reportState: text(value?.reportState, 'all').toLowerCase(),
      autoSec: clamp(Math.round(numberFrom(value?.autoSec, 45)), 0, 300),
    };
  };
  const setPrefs = (next) => {
    writeJson(PREF_KEY, { ...getPrefs(), ...(next || {}) });
  };

  const getAudit = () => {
    const rows = readJson(AUDIT_KEY, []);
    return Array.isArray(rows) ? rows : [];
  };
  const pushAudit = (entry = {}) => {
    const rows = getAudit();
    rows.unshift({
      id: `mod-audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: nowIso(),
      by: text(entry.by, getAdminName()),
      action: text(entry.action, 'refresh'),
      target: text(entry.target),
      detail: text(entry.detail),
      status: text(entry.status, 'ok'),
    });
    writeJson(AUDIT_KEY, rows.slice(0, 800));
  };

  const normalizeUser = (item = {}) => ({
    id: text(item.id || item._id || item.userId),
    name: text(item.name || item.fullName || 'Unknown'),
    email: text(item.email),
    phone: text(item.phone),
    role: text(item.role, 'user').toLowerCase(),
    blocked: Boolean(item.blocked),
    verified: Boolean(item.verified),
    createdAt: text(item.createdAt),
    lastLoginAt: text(item.lastLoginAt),
  });
  const normalizeReport = (item = {}) => ({
    id: text(item.id),
    propertyId: text(item.propertyId),
    propertyTitle: text(item.propertyTitle),
    reportedBy: text(item.reportedBy),
    reportedByName: text(item.reportedByName),
    reason: text(item.reason),
    status: text(item.status, 'open').toLowerCase(),
    createdAt: text(item.createdAt),
    resolvedAt: text(item.resolvedAt),
  });

  const fetchData = async () => {
    const token = getAdminToken();
    let users = [];
    let reports = [];

    if (token && live.request) {
      try {
        const [usersRes, reportsRes] = await Promise.all([
          live.request('/admin/users', { token }),
          live.request('/admin/reports', { token }),
        ]);
        users = (usersRes?.items || []).map(normalizeUser).filter((row) => row.id);
        reports = (reportsRes?.items || []).map(normalizeReport).filter((row) => row.id);
        writeJson(USER_CACHE_KEY, users);
        writeJson(REPORT_CACHE_KEY, reports);
      } catch {
        users = (Array.isArray(readJson(USER_CACHE_KEY, [])) ? readJson(USER_CACHE_KEY, []) : []).map(normalizeUser).filter((row) => row.id);
        reports = (Array.isArray(readJson(REPORT_CACHE_KEY, [])) ? readJson(REPORT_CACHE_KEY, []) : []).map(normalizeReport).filter((row) => row.id);
      }
    } else {
      users = (Array.isArray(readJson(USER_CACHE_KEY, [])) ? readJson(USER_CACHE_KEY, []) : []).map(normalizeUser).filter((row) => row.id);
      reports = (Array.isArray(readJson(REPORT_CACHE_KEY, [])) ? readJson(REPORT_CACHE_KEY, []) : []).map(normalizeReport).filter((row) => row.id);
    }
    return { users, reports };
  };

  const buildModel = (rawUsers, rawReports) => {
    const users = Array.isArray(rawUsers) ? rawUsers : [];
    const reports = Array.isArray(rawReports) ? rawReports : [];
    const listings = Array.isArray(readJson(LISTINGS_KEY, [])) ? readJson(LISTINGS_KEY, []) : [];

    const ownerByProperty = new Map();
    const listingCountByOwner = new Map();
    listings.forEach((item) => {
      const propertyId = text(item?.id || item?._id);
      const ownerId = text(item?.ownerId || item?.userId || item?.owner?.id);
      if (!propertyId || !ownerId) return;
      ownerByProperty.set(propertyId, ownerId);
      listingCountByOwner.set(ownerId, numberFrom(listingCountByOwner.get(ownerId), 0) + 1);
    });

    const reportByReporter = new Map();
    const reportByOwner = new Map();
    const openReportByReporter = new Map();
    const openReportByOwner = new Map();
    reports.forEach((report) => {
      const reporter = text(report.reportedBy);
      const owner = text(ownerByProperty.get(report.propertyId));
      const isOpen = text(report.status, 'open') !== 'resolved';
      if (reporter) {
        reportByReporter.set(reporter, numberFrom(reportByReporter.get(reporter), 0) + 1);
        if (isOpen) openReportByReporter.set(reporter, numberFrom(openReportByReporter.get(reporter), 0) + 1);
      }
      if (owner) {
        reportByOwner.set(owner, numberFrom(reportByOwner.get(owner), 0) + 1);
        if (isOpen) openReportByOwner.set(owner, numberFrom(openReportByOwner.get(owner), 0) + 1);
      }
    });

    const userRows = users.map((user) => {
      const listingCount = numberFrom(listingCountByOwner.get(user.id), 0);
      const reportsByOwner = numberFrom(reportByOwner.get(user.id), 0);
      const reportsByReporter = numberFrom(reportByReporter.get(user.id), 0);
      const openReportsByOwner = numberFrom(openReportByOwner.get(user.id), 0);
      const openReportsByReporter = numberFrom(openReportByReporter.get(user.id), 0);
      const lastLoginEpoch = epoch(user.lastLoginAt);
      const inactivityDays = lastLoginEpoch > 0 ? Math.floor((Date.now() - lastLoginEpoch) / 86400000) : null;
      const riskScore = (
        (openReportsByOwner * 3)
        + (openReportsByReporter * 1)
        + (reportsByOwner > 0 && listingCount > 0 && (reportsByOwner / Math.max(1, listingCount)) >= 2 ? 2 : 0)
        + (user.blocked ? 2 : 0)
      );
      const riskBand = riskScore >= 8 ? 'critical' : riskScore >= 4 ? 'high' : riskScore >= 2 ? 'medium' : 'low';
      return {
        ...user,
        listingCount,
        reportsByOwner,
        reportsByReporter,
        openReportsByOwner,
        openReportsByReporter,
        inactivityDays,
        riskScore,
        riskBand,
      };
    }).sort((a, b) => {
      if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
      return epoch(b.createdAt) - epoch(a.createdAt);
    });

    const reportRows = reports.map((report) => {
      const ownerId = text(ownerByProperty.get(report.propertyId));
      const owner = userRows.find((user) => user.id === ownerId);
      return {
        ...report,
        ownerId,
        ownerName: text(owner?.name, ownerId),
        ownerBlocked: Boolean(owner?.blocked),
        ageHours: Math.max(0, Math.round((Date.now() - epoch(report.createdAt)) / 3600000)),
      };
    }).sort((a, b) => {
      const openRank = text(a.status) === 'resolved' ? 1 : 0;
      const openRankB = text(b.status) === 'resolved' ? 1 : 0;
      if (openRank !== openRankB) return openRank - openRankB;
      return epoch(b.createdAt) - epoch(a.createdAt);
    });

    return { userRows, reportRows };
  };

  const actionUserBlock = async (userId, action) => {
    const id = text(userId);
    const act = text(action).toLowerCase();
    if (!id || !['block', 'unblock'].includes(act)) {
      return { ok: false, message: 'Invalid user action.' };
    }
    const reason = text(window.prompt(`${act === 'block' ? 'Block' : 'Unblock'} user reason (minimum 12 characters):`, ''), '');
    if (reason.length < 12) {
      return { ok: false, message: 'Reason minimum 12 characters required.' };
    }
    const token = getAdminToken();

    if (token && live.request) {
      try {
        await live.request(`/admin/users/${encodeURIComponent(id)}/${act}`, {
          method: 'POST',
          token,
          data: { moderationReason: reason, reason },
        });
      } catch (error) {
        return { ok: false, message: text(error?.message, `Failed to ${act} user.`) };
      }
    } else {
      const users = (Array.isArray(readJson(USER_CACHE_KEY, [])) ? readJson(USER_CACHE_KEY, []) : []).map(normalizeUser);
      const next = users.map((user) => {
        if (user.id !== id) return user;
        return { ...user, blocked: act === 'block', updatedAt: nowIso() };
      });
      writeJson(USER_CACHE_KEY, next);
    }
    return { ok: true, message: `User ${act}ed.` };
  };

  const actionResolveReport = async (reportId) => {
    const id = text(reportId);
    if (!id) return { ok: false, message: 'Invalid report id.' };
    const reason = text(window.prompt('Resolve report reason (minimum 12 characters):', ''), '');
    if (reason.length < 12) {
      return { ok: false, message: 'Reason minimum 12 characters required.' };
    }
    const token = getAdminToken();

    if (token && live.request) {
      try {
        await live.request(`/admin/reports/${encodeURIComponent(id)}/resolve`, {
          method: 'POST',
          token,
          data: { moderationReason: reason, reason },
        });
      } catch (error) {
        return { ok: false, message: text(error?.message, 'Report resolve failed.') };
      }
    } else {
      const reports = (Array.isArray(readJson(REPORT_CACHE_KEY, [])) ? readJson(REPORT_CACHE_KEY, []) : []).map(normalizeReport);
      const next = reports.map((report) => {
        if (report.id !== id) return report;
        return { ...report, status: 'resolved', resolvedAt: nowIso() };
      });
      writeJson(REPORT_CACHE_KEY, next);
    }
    return { ok: true, message: 'Report resolved.' };
  };

  const exportCsv = (users, reports) => {
    const userHeader = ['id', 'name', 'role', 'blocked', 'riskBand', 'riskScore', 'listingCount', 'openReportsByOwner', 'openReportsByReporter', 'createdAt', 'lastLoginAt'];
    const userLines = users.map((row) => [
      row.id, row.name, row.role, String(row.blocked), row.riskBand, String(row.riskScore),
      String(row.listingCount), String(row.openReportsByOwner), String(row.openReportsByReporter),
      row.createdAt, row.lastLoginAt,
    ].map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(','));

    const reportHeader = ['id', 'status', 'propertyId', 'propertyTitle', 'ownerId', 'ownerName', 'reportedBy', 'reportedByName', 'reason', 'ageHours', 'createdAt', 'resolvedAt'];
    const reportLines = reports.map((row) => [
      row.id, row.status, row.propertyId, row.propertyTitle, row.ownerId, row.ownerName,
      row.reportedBy, row.reportedByName, row.reason, String(row.ageHours), row.createdAt, row.resolvedAt,
    ].map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(','));

    const csv = [
      '## USER_MODERATION',
      userHeader.join(','),
      ...userLines,
      '',
      '## REPORT_MANAGEMENT',
      reportHeader.join(','),
      ...reportLines,
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `admin-moderation-command-center-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${CARD_ID}{margin-top:16px}
#${CARD_ID} .amcc-card{border:1px solid #d6e1f5;border-radius:10px;background:#fff;padding:10px}
#${CARD_ID} .amcc-grid{display:grid;gap:10px}
#${CARD_ID} .amcc-grid.cols{grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}
#${CARD_ID} label{display:block;font-size:12px;color:#35597d;margin-bottom:4px}
#${CARD_ID} input,#${CARD_ID} select{width:100%;border:1px solid #cad9ef;border-radius:8px;padding:8px 10px;box-sizing:border-box}
#${CARD_ID} .amcc-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
#${CARD_ID} .amcc-btn{border:1px solid #0b3d91;background:#0b3d91;color:#fff;border-radius:8px;padding:8px 12px;cursor:pointer;font-weight:700}
#${CARD_ID} .amcc-btn.alt{background:#fff;color:#0b3d91}
#${CARD_ID} .amcc-btn.warn{background:#8d1e1e;border-color:#8d1e1e}
#${CARD_ID} .amcc-chip{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;margin:2px 6px 2px 0;background:#e9f0ff;color:#1f3e7a}
#${CARD_ID} .amcc-chip.blocked{background:#ffe8e8;color:#8d1e1e}
#${CARD_ID} .amcc-chip.active{background:#e7f7ed;color:#11663e}
#${CARD_ID} .amcc-chip.critical{background:#8f1a1a;color:#fff}
#${CARD_ID} .amcc-chip.high{background:#d94e20;color:#fff}
#${CARD_ID} .amcc-chip.medium{background:#fff1d6;color:#7a4f00}
#${CARD_ID} .amcc-chip.low{background:#deecff;color:#1d4b84}
#${CARD_ID} .amcc-kpis{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin-top:10px}
#${CARD_ID} .amcc-kpi{border:1px solid #d6e1f5;border-radius:8px;background:#f8fbff;padding:8px}
#${CARD_ID} .amcc-kpi small{display:block;color:#58718f}
#${CARD_ID} table{width:100%;border-collapse:collapse}
#${CARD_ID} th,#${CARD_ID} td{border:1px solid #d6e1f5;padding:8px;text-align:left;vertical-align:top}
#${CARD_ID} th{background:#f4f8ff;color:#11466e}
#${CARD_ID} .amcc-audit{max-height:220px;overflow:auto}
#${CARD_ID} .amcc-audit-item{border-bottom:1px solid #e1e9f8;padding:7px 0;color:#325176;font-size:13px}
@media (max-width:768px){#${CARD_ID} .amcc-row{display:grid;grid-template-columns:1fr}}
`;
    document.head.appendChild(style);
  }

  const shell = document.createElement('section');
  shell.id = CARD_ID;
  shell.className = 'container';
  shell.innerHTML = `
<div class="amcc-card">
  <h2 style="margin:0 0 8px;">Admin Moderation Command Center</h2>
  <p style="margin:0;color:#1d4068;">Professional control desk for user block/unblock, report queue triage, and moderation audit trail.</p>
</div>
<div class="amcc-card" style="margin-top:10px;">
  <div class="amcc-grid cols">
    <div><label for="amccQuery">Search</label><input id="amccQuery" placeholder="User, email, phone, report, property"></div>
    <div><label for="amccRoleFilter">Role</label><select id="amccRoleFilter"><option value="all">All</option><option value="admin">Admin</option><option value="seller">Seller</option><option value="buyer">Buyer</option><option value="customer">Customer</option></select></div>
    <div><label for="amccBlockFilter">Block State</label><select id="amccBlockFilter"><option value="all">All</option><option value="blocked">Blocked</option><option value="active">Active</option></select></div>
    <div><label for="amccRiskFilter">Risk Band</label><select id="amccRiskFilter"><option value="all">All</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></div>
    <div><label for="amccReportFilter">Report State</label><select id="amccReportFilter"><option value="all">All</option><option value="open">Open</option><option value="resolved">Resolved</option></select></div>
    <div><label for="amccAutoSec">Auto Refresh (sec)</label><input id="amccAutoSec" type="number" min="0" max="300" step="5"></div>
  </div>
  <div class="amcc-row" style="margin-top:10px;">
    <button id="amccSaveFilters" class="amcc-btn alt" type="button">Save Filters</button>
    <button id="amccRefresh" class="amcc-btn" type="button">Refresh</button>
    <button id="amccExport" class="amcc-btn alt" type="button">Export CSV</button>
    <button id="amccBulkBlock" class="amcc-btn warn" type="button">Bulk Block</button>
    <button id="amccBulkUnblock" class="amcc-btn alt" type="button">Bulk Unblock</button>
    <span id="amccStatus" class="amcc-chip">Ready</span>
  </div>
</div>
<div id="amccKpis" class="amcc-kpis"></div>
<div class="amcc-card" style="margin-top:10px;">
  <h3 style="margin:0 0 8px;">User Moderation Board</h3>
  <div id="amccUserWrap" style="overflow:auto;"></div>
</div>
<div class="amcc-card" style="margin-top:10px;">
  <h3 style="margin:0 0 8px;">Report Management Queue</h3>
  <div id="amccReportWrap" style="overflow:auto;"></div>
</div>
<div class="amcc-card" style="margin-top:10px;">
  <h3 style="margin:0 0 8px;">Moderation Detail</h3>
  <div id="amccDetail" style="overflow:auto;color:#325176;">Select a user row for detail.</div>
</div>
<div class="amcc-card" style="margin-top:10px;">
  <h3 style="margin:0 0 8px;">Moderation Audit Feed</h3>
  <div id="amccAudit" class="amcc-audit"></div>
</div>
`;

  const anchor = document.getElementById('adminReportCommissionAutomationCard')
    || document.getElementById('adminFeaturedCommissionProCard')
    || document.getElementById('adminAnalyticsCommandCenterCard')
    || document.querySelector('.container');
  if (anchor?.parentElement) anchor.insertAdjacentElement('afterend', shell);
  else document.body.appendChild(shell);

  const ui = {
    query: document.getElementById('amccQuery'),
    roleFilter: document.getElementById('amccRoleFilter'),
    blockFilter: document.getElementById('amccBlockFilter'),
    riskFilter: document.getElementById('amccRiskFilter'),
    reportFilter: document.getElementById('amccReportFilter'),
    autoSec: document.getElementById('amccAutoSec'),
    saveFilters: document.getElementById('amccSaveFilters'),
    refresh: document.getElementById('amccRefresh'),
    export: document.getElementById('amccExport'),
    bulkBlock: document.getElementById('amccBulkBlock'),
    bulkUnblock: document.getElementById('amccBulkUnblock'),
    status: document.getElementById('amccStatus'),
    kpis: document.getElementById('amccKpis'),
    userWrap: document.getElementById('amccUserWrap'),
    reportWrap: document.getElementById('amccReportWrap'),
    detail: document.getElementById('amccDetail'),
    audit: document.getElementById('amccAudit'),
  };

  const state = {
    users: [],
    reports: [],
    filteredUsers: [],
    filteredReports: [],
    selectedUserId: '',
    timer: null,
  };

  const setStatus = (message, ok = true) => {
    ui.status.textContent = text(message, 'Ready');
    ui.status.style.color = ok ? '#1f3e7a' : '#8f1a1a';
  };

  const syncControls = () => {
    const prefs = getPrefs();
    ui.query.value = prefs.query;
    ui.roleFilter.value = prefs.role;
    ui.blockFilter.value = prefs.blockState;
    ui.riskFilter.value = prefs.riskState;
    ui.reportFilter.value = prefs.reportState;
    ui.autoSec.value = String(prefs.autoSec);
  };

  const readControls = () => ({
    query: text(ui.query.value),
    role: text(ui.roleFilter.value, 'all').toLowerCase(),
    blockState: text(ui.blockFilter.value, 'all').toLowerCase(),
    riskState: text(ui.riskFilter.value, 'all').toLowerCase(),
    reportState: text(ui.reportFilter.value, 'all').toLowerCase(),
    autoSec: clamp(Math.round(numberFrom(ui.autoSec.value, 45)), 0, 300),
  });

  const applyFilters = () => {
    const filter = readControls();
    const query = filter.query.toLowerCase();

    state.filteredUsers = state.users.filter((user) => {
      if (filter.role !== 'all' && text(user.role) !== filter.role) return false;
      if (filter.blockState === 'blocked' && !user.blocked) return false;
      if (filter.blockState === 'active' && user.blocked) return false;
      if (filter.riskState !== 'all' && text(user.riskBand) !== filter.riskState) return false;
      if (!query) return true;
      return [
        user.id,
        user.name,
        user.email,
        user.phone,
        user.role,
      ].some((value) => text(value).toLowerCase().includes(query));
    });

    state.filteredReports = state.reports.filter((report) => {
      if (filter.reportState !== 'all' && text(report.status) !== filter.reportState) return false;
      if (!query) return true;
      return [
        report.id,
        report.propertyId,
        report.propertyTitle,
        report.reportedByName,
        report.ownerName,
        report.reason,
      ].some((value) => text(value).toLowerCase().includes(query));
    });
  };

  const renderKpis = () => {
    const totalUsers = state.filteredUsers.length;
    const blocked = state.filteredUsers.filter((row) => row.blocked).length;
    const critical = state.filteredUsers.filter((row) => row.riskBand === 'critical').length;
    const high = state.filteredUsers.filter((row) => row.riskBand === 'high').length;
    const openReports = state.filteredReports.filter((row) => row.status !== 'resolved').length;
    const resolvedReports = state.filteredReports.filter((row) => row.status === 'resolved').length;
    ui.kpis.innerHTML = `
<div class="amcc-kpi"><small>Users</small><strong>${totalUsers}</strong></div>
<div class="amcc-kpi"><small>Blocked</small><strong>${blocked}</strong></div>
<div class="amcc-kpi"><small>Critical Risk</small><strong>${critical}</strong></div>
<div class="amcc-kpi"><small>High Risk</small><strong>${high}</strong></div>
<div class="amcc-kpi"><small>Open Reports</small><strong>${openReports}</strong></div>
<div class="amcc-kpi"><small>Resolved Reports</small><strong>${resolvedReports}</strong></div>`;
  };

  const renderUserTable = () => {
    const rows = state.filteredUsers;
    if (!rows.length) {
      ui.userWrap.innerHTML = '<p style="margin:0;color:#607da8;">No users match current filter.</p>';
      return;
    }
    ui.userWrap.innerHTML = `
<table>
  <thead>
    <tr>
      <th><input id="amccSelectAll" type="checkbox"></th>
      <th>User</th>
      <th>Role</th>
      <th>State</th>
      <th>Risk</th>
      <th>Signals</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    ${rows.map((row) => `
      <tr>
        <td><input type="checkbox" data-user-check="${escapeHtml(row.id)}"></td>
        <td><b>${escapeHtml(row.name)}</b><br><small>${escapeHtml(row.id)}</small><br><small>${escapeHtml(row.email || row.phone || '-')}</small></td>
        <td>${escapeHtml(row.role)}</td>
        <td><span class="amcc-chip ${row.blocked ? 'blocked' : 'active'}">${row.blocked ? 'BLOCKED' : 'ACTIVE'}</span></td>
        <td><span class="amcc-chip ${escapeHtml(row.riskBand)}">${escapeHtml(row.riskBand.toUpperCase())}</span><br><small>Score ${row.riskScore}</small></td>
        <td>Listings ${row.listingCount}<br>Open Owner Reports ${row.openReportsByOwner}<br>Open Reporter Reports ${row.openReportsByReporter}</td>
        <td>
          <div class="amcc-row" style="gap:6px;">
            <button class="amcc-btn alt" data-user-action="detail" data-user-id="${escapeHtml(row.id)}" type="button">Detail</button>
            <button class="amcc-btn alt" data-user-action="${row.blocked ? 'unblock' : 'block'}" data-user-id="${escapeHtml(row.id)}" type="button">${row.blocked ? 'Unblock' : 'Block'}</button>
            <button class="amcc-btn alt" data-user-action="notify" data-user-id="${escapeHtml(row.id)}" type="button">Notify</button>
          </div>
        </td>
      </tr>`).join('')}
  </tbody>
</table>`;
  };

  const renderReportTable = () => {
    const rows = state.filteredReports;
    if (!rows.length) {
      ui.reportWrap.innerHTML = '<p style="margin:0;color:#607da8;">No reports match current filter.</p>';
      return;
    }
    ui.reportWrap.innerHTML = `
<table>
  <thead>
    <tr>
      <th>Report</th>
      <th>Property</th>
      <th>Reporter</th>
      <th>Owner</th>
      <th>Reason</th>
      <th>Status</th>
      <th>Action</th>
    </tr>
  </thead>
  <tbody>
    ${rows.map((row) => `
      <tr>
        <td><b>${escapeHtml(row.id)}</b><br><small>${escapeHtml(shortTime(row.createdAt))}</small><br><small>Age ${row.ageHours}h</small></td>
        <td>${escapeHtml(text(row.propertyTitle, row.propertyId))}<br><small>${escapeHtml(row.propertyId)}</small></td>
        <td>${escapeHtml(text(row.reportedByName, row.reportedBy))}</td>
        <td>${escapeHtml(text(row.ownerName, row.ownerId || '-'))}${row.ownerBlocked ? ' <span class="amcc-chip blocked">Blocked</span>' : ''}</td>
        <td>${escapeHtml(row.reason)}</td>
        <td><span class="amcc-chip ${row.status === 'resolved' ? 'active' : 'medium'}">${escapeHtml(row.status.toUpperCase())}</span></td>
        <td>
          ${row.status !== 'resolved'
            ? `<button class="amcc-btn alt" data-report-action="resolve" data-report-id="${escapeHtml(row.id)}" type="button">Resolve</button>`
            : '<span style="color:#1f6d3d;">Done</span>'
          }
        </td>
      </tr>`).join('')}
  </tbody>
</table>`;
  };

  const renderDetail = (userId) => {
    const id = text(userId);
    const user = state.users.find((row) => row.id === id);
    if (!user) {
      ui.detail.innerHTML = '<p style="margin:0;color:#607da8;">Select a user row for detail.</p>';
      return;
    }
    const reports = state.reports.filter((row) => row.reportedBy === id || row.ownerId === id).slice(0, 10);
    ui.detail.innerHTML = `
<div style="margin-bottom:8px;">
  <b>${escapeHtml(user.name)}</b> (${escapeHtml(user.id)})<br>
  Role: <b>${escapeHtml(user.role)}</b> | State: <b>${user.blocked ? 'Blocked' : 'Active'}</b><br>
  Risk: <b>${escapeHtml(user.riskBand.toUpperCase())}</b> (${user.riskScore}) | Listings: <b>${user.listingCount}</b><br>
  Open reports as owner: <b>${user.openReportsByOwner}</b> | Open reports as reporter: <b>${user.openReportsByReporter}</b><br>
  Last login: <b>${escapeHtml(shortTime(user.lastLoginAt))}</b>
</div>
<div>
  <b>Recent moderation signals</b>
  ${reports.length
    ? reports.map((row) => `<div style="border-bottom:1px solid #e1e9f8;padding:6px 0;">${escapeHtml(row.id)} | ${escapeHtml(row.status)} | ${escapeHtml(text(row.propertyTitle, row.propertyId))}<br><small>${escapeHtml(row.reason)} | ${escapeHtml(shortTime(row.createdAt))}</small></div>`).join('')
    : '<p style="margin:6px 0 0;color:#607da8;">No report records for this user.</p>'
  }
</div>`;
  };

  const renderAudit = () => {
    const rows = getAudit();
    if (!rows.length) {
      ui.audit.innerHTML = '<p style="margin:0;color:#607da8;">No moderation audit entries yet.</p>';
      return;
    }
    ui.audit.innerHTML = rows.slice(0, 40).map((row) => `
<div class="amcc-audit-item">
  <b>${escapeHtml(text(row.action).toUpperCase())}</b> - ${escapeHtml(text(row.target, '-'))}<br>
  ${escapeHtml(text(row.detail))}<br>
  <small style="color:#6d86a5;">${escapeHtml(shortTime(row.at))} | ${escapeHtml(text(row.by, 'Admin'))}</small>
</div>`).join('');
  };

  const renderAll = () => {
    applyFilters();
    renderKpis();
    renderUserTable();
    renderReportTable();
    renderAudit();
    if (state.selectedUserId) renderDetail(state.selectedUserId);
  };

  const refresh = async (options = {}) => {
    const data = await fetchData();
    const model = buildModel(data.users, data.reports);
    state.users = model.userRows;
    state.reports = model.reportRows;
    renderAll();
    if (!options.silent) setStatus(`Moderation board refreshed (${state.filteredUsers.length} users, ${state.filteredReports.length} reports).`, true);
  };

  const setAutoRefresh = (seconds, options = {}) => {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
    const sec = clamp(Math.round(numberFrom(seconds, 0)), 0, 300);
    if (sec > 0) state.timer = setInterval(() => refresh({ silent: true }), sec * 1000);
    if (!options.silent) setStatus(sec > 0 ? `Auto refresh every ${sec}s.` : 'Auto refresh disabled.', true);
  };

  const selectedUserIds = () => Array.from(document.querySelectorAll('#amccUserWrap [data-user-check]:checked'))
    .map((node) => text(node.getAttribute('data-user-check')))
    .filter(Boolean);

  ui.userWrap?.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.id !== 'amccSelectAll') return;
    const checked = Boolean(target.checked);
    document.querySelectorAll('#amccUserWrap [data-user-check]').forEach((node) => {
      node.checked = checked;
    });
  });

  ui.userWrap?.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = text(target.getAttribute('data-user-action')).toLowerCase();
    const userId = text(target.getAttribute('data-user-id'));
    if (!action || !userId) return;

    if (action === 'detail') {
      state.selectedUserId = userId;
      renderDetail(userId);
      return;
    }
    if (action === 'notify') {
      const user = state.users.find((row) => row.id === userId);
      pushNotification('Moderation Alert', `${text(user?.name, userId)} moderation review required.`, ['admin'], 'warn');
      pushAudit({ action: 'notify', target: userId, detail: 'Manual moderation notification sent.' });
      renderAudit();
      setStatus('Notification sent.', true);
      return;
    }
    const result = await actionUserBlock(userId, action);
    if (!result.ok) {
      setStatus(result.message, false);
      pushAudit({ action, target: userId, detail: result.message, status: 'error' });
      renderAudit();
      return;
    }
    pushAudit({ action, target: userId, detail: result.message });
    await refresh({ silent: true });
    state.selectedUserId = userId;
    renderDetail(userId);
    setStatus(result.message, true);
  });

  ui.reportWrap?.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = text(target.getAttribute('data-report-action')).toLowerCase();
    const reportId = text(target.getAttribute('data-report-id'));
    if (action !== 'resolve' || !reportId) return;
    const result = await actionResolveReport(reportId);
    if (!result.ok) {
      setStatus(result.message, false);
      pushAudit({ action: 'report-resolve', target: reportId, detail: result.message, status: 'error' });
      renderAudit();
      return;
    }
    pushAudit({ action: 'report-resolve', target: reportId, detail: result.message });
    await refresh({ silent: true });
    setStatus(`Report ${reportId} resolved.`, true);
  });

  ui.saveFilters?.addEventListener('click', () => {
    const filter = readControls();
    setPrefs(filter);
    setAutoRefresh(filter.autoSec, { silent: true });
    renderAll();
    setStatus('Moderation filters saved.', true);
  });

  ui.refresh?.addEventListener('click', () => {
    refresh();
  });

  ui.export?.addEventListener('click', () => {
    exportCsv(state.filteredUsers, state.filteredReports);
    setStatus(`CSV exported (${state.filteredUsers.length} users, ${state.filteredReports.length} reports).`, true);
  });

  ui.bulkBlock?.addEventListener('click', async () => {
    const ids = selectedUserIds();
    if (!ids.length) {
      setStatus('Select at least one user for bulk block.', false);
      return;
    }
    let success = 0;
    for (const id of ids) {
      const result = await actionUserBlock(id, 'block');
      if (result.ok) success += 1;
    }
    pushAudit({ action: 'bulk-block', target: `${ids.length} users`, detail: `Blocked ${success}/${ids.length} users.` });
    await refresh({ silent: true });
    setStatus(`Bulk block done: ${success}/${ids.length}.`, success > 0);
  });

  ui.bulkUnblock?.addEventListener('click', async () => {
    const ids = selectedUserIds();
    if (!ids.length) {
      setStatus('Select at least one user for bulk unblock.', false);
      return;
    }
    let success = 0;
    for (const id of ids) {
      const result = await actionUserBlock(id, 'unblock');
      if (result.ok) success += 1;
    }
    pushAudit({ action: 'bulk-unblock', target: `${ids.length} users`, detail: `Unblocked ${success}/${ids.length} users.` });
    await refresh({ silent: true });
    setStatus(`Bulk unblock done: ${success}/${ids.length}.`, success > 0);
  });

  [ui.query, ui.roleFilter, ui.blockFilter, ui.riskFilter, ui.reportFilter].forEach((element) => {
    element?.addEventListener('input', () => renderAll());
    element?.addEventListener('change', () => renderAll());
  });
  ui.autoSec?.addEventListener('change', () => {
    const sec = clamp(Math.round(numberFrom(ui.autoSec.value, 45)), 0, 300);
    setPrefs({ autoSec: sec });
    setAutoRefresh(sec);
  });

  syncControls();
  setAutoRefresh(numberFrom(getPrefs().autoSec, 45), { silent: true });
  refresh({ silent: true }).then(() => {
    pushAudit({ action: 'init', target: 'moderation', detail: 'Admin moderation command center initialized.' });
    renderAudit();
  }).catch((error) => {
    setStatus(text(error?.message, 'Unable to initialize moderation center.'), false);
  });

  window.addEventListener('beforeunload', () => {
    if (state.timer) clearInterval(state.timer);
  });
})();
