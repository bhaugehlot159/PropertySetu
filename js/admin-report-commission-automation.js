(() => {
  if (document.getElementById('adminReportCommissionAutomationCard')) return;

  const live = window.PropertySetuLive || {};
  const adminReportList = document.getElementById('adminReportList');
  const adminOverview = document.getElementById('adminOverview');
  if (!adminReportList || !adminOverview) return;

  const STYLE_ID = 'admin-report-commission-automation-style';
  const CARD_ID = 'adminReportCommissionAutomationCard';
  const LOG_KEY = 'propertySetu:adminAutomationLog';
  const SNOOZE_KEY = 'propertySetu:adminReportSnooze';
  const DAY_MS = 86400000;
  const HOUR_MS = 3600000;

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

  const getAdminToken = () => {
    if (typeof live.getToken === 'function') {
      const token = text(live.getToken('admin'));
      if (token) return token;
    }
    if (typeof live.getAnyToken === 'function') {
      return text(live.getAnyToken());
    }
    return '';
  };

  const toTs = (value) => {
    const date = new Date(value || '');
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  };

  const toLabel = (value) => {
    const ts = toTs(value);
    if (!ts) return '-';
    return new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const inr = (value) => `₹${numberFrom(value, 0).toLocaleString('en-IN')}`;

  const notify = (title, message, type = 'info') => {
    if (!title || !message) return;
    if (window.PropertySetuNotify && typeof window.PropertySetuNotify.emit === 'function') {
      window.PropertySetuNotify.emit({ title, message, audience: ['admin'], type });
    }
  };

  const getLogs = () => {
    const rows = readJson(LOG_KEY, []);
    return Array.isArray(rows) ? rows : [];
  };

  const pushLog = (entry) => {
    const rows = getLogs();
    rows.unshift({
      id: `arca-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: new Date().toISOString(),
      ...entry,
    });
    writeJson(LOG_KEY, rows.slice(0, 400));
  };

  const getSnoozeMap = () => {
    const map = readJson(SNOOZE_KEY, {});
    return map && typeof map === 'object' ? map : {};
  };

  const setSnooze = (reportId, hours = 24) => {
    const next = getSnoozeMap();
    next[text(reportId)] = new Date(Date.now() + (Math.max(1, numberFrom(hours, 24)) * HOUR_MS)).toISOString();
    writeJson(SNOOZE_KEY, next);
  };

  const isSnoozed = (reportId) => {
    const map = getSnoozeMap();
    const until = toTs(map[text(reportId)]);
    return until > Date.now();
  };

  const severityFromReason = (reason) => {
    const raw = text(reason).toLowerCase();
    if (raw.includes('fraud') || raw.includes('fake') || raw.includes('scam') || raw.includes('illegal') || raw.includes('duplicate')) {
      return 'high';
    }
    if (raw.includes('spam') || raw.includes('misleading') || raw.includes('wrong') || raw.includes('price')) {
      return 'medium';
    }
    return 'low';
  };

  const normalizeReport = (item = {}) => {
    const createdAt = text(item.createdAt || item.at || new Date().toISOString());
    const ageHours = Math.max(0, Math.floor((Date.now() - toTs(createdAt)) / HOUR_MS));
    const status = text(item.status, 'pending').toLowerCase();
    const reason = text(item.reason, 'no-reason');
    return {
      id: text(item.id || item._id),
      propertyId: text(item.propertyId),
      propertyTitle: text(item.propertyTitle || item.propertyId || 'Property'),
      reason,
      status,
      createdAt,
      ageHours,
      severity: severityFromReason(reason),
      snoozed: isSnoozed(item.id || item._id),
    };
  };

  const normalizeLoanLead = (item = {}) => {
    const status = text(item.status, 'lead-created').toLowerCase();
    const amountBase = numberFrom(
      item.loanAmount
      || item.requestedAmount
      || item.requestedLoanAmount
      || item.amount
      || item.propertyPrice,
      0,
    );
    const finalCommissionAmount = numberFrom(item.finalCommissionAmount || item.commissionAmount, 0);
    const eligible = (status === 'sanctioned' || status === 'approved') && finalCommissionAmount <= 0 && amountBase > 0;
    const recommended = eligible ? Math.max(2500, Math.min(250000, Math.round(amountBase * 0.006))) : 0;
    return {
      id: text(item.id || item._id),
      userName: text(item.userName, 'User'),
      locality: text(item.locality, 'Udaipur'),
      status,
      amountBase,
      finalCommissionAmount,
      eligible,
      recommended,
      createdAt: text(item.createdAt),
    };
  };

  const normalizeQueueCount = (payload) => {
    const items = Array.isArray(payload?.items) ? payload.items : [];
    return {
      total: numberFrom(payload?.total, items.length),
      items,
    };
  };

  const api = async (path, options = {}) => {
    if (!live.request) throw new Error('Live API client unavailable.');
    return live.request(path, options);
  };

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${CARD_ID} .arca-status { margin: 0 0 10px; color: #1f6d3d; font-size: 14px; }
#${CARD_ID} .arca-toolbar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; align-items: center; }
#${CARD_ID} .arca-btn {
  border: 1px solid #0b3d91;
  border-radius: 8px;
  background: #0b3d91;
  color: #fff;
  padding: 7px 11px;
  font-weight: 700;
  cursor: pointer;
}
#${CARD_ID} .arca-btn.alt { background: #fff; color: #0b3d91; }
#${CARD_ID} .arca-btn.warn { background: #8f4f00; border-color: #8f4f00; }
#${CARD_ID} .arca-kpi-grid { display: grid; gap: 8px; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); margin-bottom: 10px; }
#${CARD_ID} .arca-kpi { border: 1px solid #dbe7ff; border-radius: 8px; padding: 8px; background: #f8fbff; }
#${CARD_ID} .arca-kpi small { display: block; color: #5c6f88; }
#${CARD_ID} .arca-kpi b { color: #11466e; font-size: 16px; }
#${CARD_ID} .arca-grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
#${CARD_ID} .arca-panel { border: 1px solid #dce5f1; border-radius: 10px; padding: 10px; background: #fff; }
#${CARD_ID} .arca-panel h3 { margin: 0 0 8px; color: #11466e; font-size: 16px; }
#${CARD_ID} .arca-table-wrap { overflow: auto; }
#${CARD_ID} table { width: 100%; border-collapse: collapse; min-width: 620px; }
#${CARD_ID} th, #${CARD_ID} td { border: 1px solid #d6e1f5; padding: 7px; text-align: left; font-size: 13px; }
#${CARD_ID} th { background: #f4f8ff; color: #12466e; }
#${CARD_ID} .arca-chip { display: inline-block; border-radius: 999px; padding: 2px 8px; font-size: 11px; font-weight: 700; }
#${CARD_ID} .arca-chip.high { background: #ffe5e5; color: #9c1f1f; }
#${CARD_ID} .arca-chip.medium { background: #fff0da; color: #9f5d00; }
#${CARD_ID} .arca-chip.low { background: #eaf3ff; color: #1a4f86; }
#${CARD_ID} .arca-mini-actions { display: flex; gap: 6px; flex-wrap: wrap; }
#${CARD_ID} .arca-mini-actions button {
  border: 1px solid #c4d7f2;
  border-radius: 999px;
  background: #fff;
  color: #12395f;
  font-size: 12px;
  padding: 3px 8px;
  cursor: pointer;
}
    `;
    document.head.appendChild(style);
  }

  const card = document.createElement('div');
  card.className = 'container';
  card.id = CARD_ID;
  card.innerHTML = `
    <h2>Report & Commission Automation Center</h2>
    <p id="arcaStatus" class="arca-status">Loading automation controls...</p>
    <div class="arca-toolbar">
      <button id="arcaRefreshBtn" class="arca-btn" type="button">Refresh</button>
      <button id="arcaRunReportBtn" class="arca-btn warn" type="button">Auto-Triage Reports</button>
      <button id="arcaRunCommissionBtn" class="arca-btn warn" type="button">Auto-Fill Loan Commission</button>
      <button id="arcaExportBtn" class="arca-btn alt" type="button">Export Automation Log</button>
    </div>
    <div id="arcaKpiGrid" class="arca-kpi-grid"></div>
    <div class="arca-grid">
      <section class="arca-panel">
        <h3>Report SLA Queue</h3>
        <div id="arcaReportWrap" class="arca-table-wrap"></div>
      </section>
      <section class="arca-panel">
        <h3>Commission Gap Queue</h3>
        <div id="arcaCommissionWrap" class="arca-table-wrap"></div>
      </section>
    </div>
    <section class="arca-panel" style="margin-top:10px;">
      <h3>Automation Audit Log</h3>
      <div id="arcaLogWrap" class="arca-table-wrap"></div>
    </section>
  `;

  const adminContainer = adminOverview.closest('.container');
  if (adminContainer) {
    adminContainer.insertAdjacentElement('afterend', card);
  } else {
    document.body.appendChild(card);
  }

  const statusEl = document.getElementById('arcaStatus');
  const refreshBtn = document.getElementById('arcaRefreshBtn');
  const runReportBtn = document.getElementById('arcaRunReportBtn');
  const runCommissionBtn = document.getElementById('arcaRunCommissionBtn');
  const exportBtn = document.getElementById('arcaExportBtn');
  const kpiGridEl = document.getElementById('arcaKpiGrid');
  const reportWrapEl = document.getElementById('arcaReportWrap');
  const commissionWrapEl = document.getElementById('arcaCommissionWrap');
  const logWrapEl = document.getElementById('arcaLogWrap');

  let state = {
    reports: [],
    loanLeads: [],
    commissionAnalytics: {},
    queueTotals: {},
  };

  const setStatus = (message, ok = true) => {
    statusEl.textContent = message;
    statusEl.style.color = ok ? '#1f6d3d' : '#8d1e1e';
  };

  const computeSummary = () => {
    const reports = state.reports || [];
    const openReports = reports.filter((r) => r.status !== 'resolved').length;
    const staleReports = reports.filter((r) => r.status !== 'resolved' && r.ageHours >= 72 && !r.snoozed).length;
    const highRisk = reports.filter((r) => r.status !== 'resolved' && r.severity === 'high' && !r.snoozed).length;
    const autoResolvable = reports.filter((r) => r.status !== 'resolved' && !r.snoozed && (r.ageHours >= 72 || r.severity === 'high')).length;

    const loanLeads = state.loanLeads || [];
    const commissionGaps = loanLeads.filter((l) => l.eligible).length;
    const recommendedTotal = loanLeads.reduce((sum, lead) => sum + numberFrom(lead.recommended, 0), 0);
    const monetized = numberFrom(state.commissionAnalytics?.totalMonetized, 0);
    const estimated = numberFrom(state.commissionAnalytics?.estimatedCommission, 0);
    return {
      openReports,
      staleReports,
      highRisk,
      autoResolvable,
      commissionGaps,
      recommendedTotal,
      monetized,
      estimated,
    };
  };

  const renderKpis = () => {
    const s = computeSummary();
    kpiGridEl.innerHTML = `
      <div class="arca-kpi"><small>Open Reports</small><b>${s.openReports}</b></div>
      <div class="arca-kpi"><small>Stale Reports 72h+</small><b>${s.staleReports}</b></div>
      <div class="arca-kpi"><small>High-Risk Reports</small><b>${s.highRisk}</b></div>
      <div class="arca-kpi"><small>Auto-Resolvable</small><b>${s.autoResolvable}</b></div>
      <div class="arca-kpi"><small>Commission Gaps</small><b>${s.commissionGaps}</b></div>
      <div class="arca-kpi"><small>Recommended Fill</small><b>${inr(s.recommendedTotal)}</b></div>
      <div class="arca-kpi"><small>Total Monetized</small><b>${inr(s.monetized)}</b></div>
      <div class="arca-kpi"><small>Estimated Commission</small><b>${inr(s.estimated)}</b></div>
    `;
  };

  const renderReports = () => {
    const rows = (state.reports || []).slice(0, 20);
    if (!rows.length) {
      reportWrapEl.innerHTML = '<p style="margin:0;color:#607da8;">No reports loaded.</p>';
      return;
    }
    reportWrapEl.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Property</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Severity</th>
            <th>Age</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${escapeHtml(row.propertyTitle)}</td>
              <td>${escapeHtml(row.reason)}</td>
              <td>${escapeHtml(row.status)}${row.snoozed ? ' (snoozed)' : ''}</td>
              <td><span class="arca-chip ${escapeHtml(row.severity)}">${escapeHtml(row.severity.toUpperCase())}</span></td>
              <td>${numberFrom(row.ageHours, 0)}h</td>
              <td>
                <div class="arca-mini-actions">
                  ${row.status !== 'resolved' ? `<button type="button" data-report-resolve="${escapeHtml(row.id)}">Resolve</button>` : ''}
                  ${row.status !== 'resolved' ? `<button type="button" data-report-snooze="${escapeHtml(row.id)}">Snooze 24h</button>` : ''}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  const renderCommission = () => {
    const rows = (state.loanLeads || []).filter((lead) => lead.eligible).slice(0, 20);
    if (!rows.length) {
      commissionWrapEl.innerHTML = '<p style="margin:0;color:#607da8;">No commission gaps found.</p>';
      return;
    }
    commissionWrapEl.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Lead</th>
            <th>Status</th>
            <th>Base Amount</th>
            <th>Current Commission</th>
            <th>Recommended</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${escapeHtml(row.userName)}<br><small>${escapeHtml(row.id)}</small></td>
              <td>${escapeHtml(row.status)}</td>
              <td>${inr(row.amountBase)}</td>
              <td>${row.finalCommissionAmount > 0 ? inr(row.finalCommissionAmount) : '-'}</td>
              <td><b>${inr(row.recommended)}</b></td>
              <td><button type="button" data-loan-apply="${escapeHtml(row.id)}" data-loan-amount="${escapeHtml(String(row.recommended))}">Apply</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  const renderLogs = () => {
    const rows = getLogs().slice(0, 30);
    if (!rows.length) {
      logWrapEl.innerHTML = '<p style="margin:0;color:#607da8;">No automation logs yet.</p>';
      return;
    }
    logWrapEl.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Action</th>
            <th>Target</th>
            <th>Result</th>
            <th>Meta</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${escapeHtml(toLabel(row.at))}</td>
              <td>${escapeHtml(text(row.action))}</td>
              <td>${escapeHtml(text(row.target))}</td>
              <td>${escapeHtml(text(row.result))}</td>
              <td>${escapeHtml(text(row.meta))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  const loadData = async () => {
    const token = getAdminToken();
    if (!token || !live.request) {
      setStatus('Admin login required for automation center.', false);
      state = { reports: [], loanLeads: [], commissionAnalytics: {}, queueTotals: {} };
      renderKpis();
      renderReports();
      renderCommission();
      renderLogs();
      return;
    }

    setStatus('Loading live report and commission queues...');
    try {
      const [
        reportsPayload,
        commissionPayload,
        loanPayload,
        documentationPayload,
        bookingPayload,
        franchisePayload,
      ] = await Promise.all([
        api('/admin/reports', { token }),
        api('/admin/commission-analytics', { token }),
        api('/loan/assistance', { token }),
        api('/documentation/requests', { token }),
        api('/ecosystem/bookings', { token }),
        api('/franchise/requests', { token }),
      ]);

      const reports = normalizeQueueCount(reportsPayload).items.map(normalizeReport).filter((r) => r.id);
      const loanLeads = normalizeQueueCount(loanPayload).items.map(normalizeLoanLead).filter((r) => r.id);

      state = {
        reports,
        loanLeads,
        commissionAnalytics: commissionPayload?.analytics || {},
        queueTotals: {
          documentation: normalizeQueueCount(documentationPayload).total,
          booking: normalizeQueueCount(bookingPayload).total,
          franchise: normalizeQueueCount(franchisePayload).total,
        },
      };
      renderKpis();
      renderReports();
      renderCommission();
      renderLogs();
      setStatus('Automation center refreshed.');
    } catch (error) {
      setStatus(`Automation center load failed: ${text(error?.message, 'Unknown error')}`, false);
    }
  };

  const resolveReport = async (reportId, source = 'manual') => {
    const token = getAdminToken();
    if (!token || !live.request) {
      setStatus('Admin login required for resolving report.', false);
      return false;
    }
    const reasonBase = source === 'auto-triage'
      ? 'Auto-triage resolved high-risk or stale report after admin policy checks.'
      : 'Manual admin review completed and report resolved with verified action.';
    const reason = text(reasonBase);
    try {
      await api(`/admin/reports/${encodeURIComponent(reportId)}/resolve`, {
        method: 'POST',
        token,
        data: { moderationReason: reason, reason },
      });
      pushLog({
        action: 'report-resolve',
        target: reportId,
        result: 'success',
        meta: source,
      });
      notify('Report Resolved', `Report ${reportId} resolved (${source}).`, 'success');
      return true;
    } catch (error) {
      pushLog({
        action: 'report-resolve',
        target: reportId,
        result: 'failed',
        meta: text(error?.message, source),
      });
      setStatus(`Report resolve failed (${reportId}): ${text(error?.message, 'Unknown error')}`, false);
      return false;
    }
  };

  const applyLoanCommission = async (leadId, amount, source = 'manual') => {
    const token = getAdminToken();
    if (!token || !live.request) {
      setStatus('Admin login required for commission apply.', false);
      return false;
    }
    const reasonBase = source === 'auto-fill'
      ? 'Auto-fill commission applied after policy validation and lead sanity checks.'
      : 'Manual commission update after admin validation and compliance review.';
    const reason = text(reasonBase);
    try {
      await api(`/admin/loan/assistance/${encodeURIComponent(leadId)}/status`, {
        method: 'POST',
        token,
        data: {
          status: 'sanctioned',
          finalCommissionAmount: numberFrom(amount, 0),
          moderationReason: reason,
          reason,
          adminNote: reason,
        },
      });
      pushLog({
        action: 'loan-commission-apply',
        target: leadId,
        result: 'success',
        meta: `${source} amount=${numberFrom(amount, 0)}`,
      });
      notify('Commission Updated', `Loan lead ${leadId} commission set: ${inr(amount)}.`, 'success');
      return true;
    } catch (error) {
      pushLog({
        action: 'loan-commission-apply',
        target: leadId,
        result: 'failed',
        meta: text(error?.message, source),
      });
      setStatus(`Commission apply failed (${leadId}): ${text(error?.message, 'Unknown error')}`, false);
      return false;
    }
  };

  const runReportAutomation = async () => {
    const candidates = (state.reports || [])
      .filter((row) => row.status !== 'resolved')
      .filter((row) => !row.snoozed)
      .filter((row) => row.severity === 'high' || row.ageHours >= 72)
      .slice(0, 6);

    if (!candidates.length) {
      setStatus('No auto-triage report candidates found.');
      return;
    }

    let resolved = 0;
    for (const row of candidates) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await resolveReport(row.id, 'auto-triage');
      if (ok) resolved += 1;
    }
    setStatus(`Report automation completed. Resolved ${resolved}/${candidates.length}.`);
    await loadData();
  };

  const runCommissionAutomation = async () => {
    const candidates = (state.loanLeads || [])
      .filter((lead) => lead.eligible)
      .slice(0, 6);
    if (!candidates.length) {
      setStatus('No commission automation candidates found.');
      return;
    }
    let applied = 0;
    for (const lead of candidates) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await applyLoanCommission(lead.id, lead.recommended, 'auto-fill');
      if (ok) applied += 1;
    }
    setStatus(`Commission automation completed. Applied ${applied}/${candidates.length}.`);
    await loadData();
  };

  const exportLogs = () => {
    const rows = getLogs();
    if (!rows.length) {
      setStatus('No automation logs to export.');
      return;
    }
    const headers = ['Timestamp', 'Action', 'Target', 'Result', 'Meta'];
    const body = rows.map((row) => [
      row.at,
      row.action,
      row.target,
      row.result,
      row.meta,
    ]);
    const encodeCell = (value) => {
      const raw = String(value || '');
      if (!/[",\n]/.test(raw)) return raw;
      return `"${raw.replace(/"/g, '""')}"`;
    };
    const csv = [headers, ...body].map((line) => line.map(encodeCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `admin-automation-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus('Automation log exported.');
  };

  reportWrapEl?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const resolveId = text(target.getAttribute('data-report-resolve'));
    const snoozeId = text(target.getAttribute('data-report-snooze'));
    if (resolveId) {
      resolveReport(resolveId, 'manual').then((ok) => {
        if (ok) loadData();
      });
      return;
    }
    if (snoozeId) {
      setSnooze(snoozeId, 24);
      pushLog({
        action: 'report-snooze',
        target: snoozeId,
        result: 'success',
        meta: '24h',
      });
      setStatus(`Report ${snoozeId} snoozed for 24h.`);
      loadData();
    }
  });

  commissionWrapEl?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const leadId = text(target.getAttribute('data-loan-apply'));
    if (!leadId) return;
    const amount = numberFrom(target.getAttribute('data-loan-amount'), 0);
    applyLoanCommission(leadId, amount, 'manual').then((ok) => {
      if (ok) loadData();
    });
  });

  refreshBtn?.addEventListener('click', () => {
    loadData();
  });
  runReportBtn?.addEventListener('click', () => {
    runReportAutomation();
  });
  runCommissionBtn?.addEventListener('click', () => {
    runCommissionAutomation();
  });
  exportBtn?.addEventListener('click', exportLogs);

  loadData();
})();
