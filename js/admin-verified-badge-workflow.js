(() => {
  if (document.getElementById('adminBadgeWorkflowCard')) return;

  const live = window.PropertySetuLive || {};
  const queueRoot = document.getElementById('ownerVerificationQueue');
  const isAdminPage = Boolean(queueRoot && document.getElementById('adminOverview'));
  if (!isAdminPage) return;

  const STYLE_ID = 'admin-badge-workflow-style';
  const CARD_ID = 'adminBadgeWorkflowCard';
  const LISTINGS_KEY = 'propertySetu:listings';
  const AUDIT_KEY = 'propertySetu:adminBadgeAuditTrail';
  const DECISION_STATE_KEY = 'propertySetu:adminBadgeDecisionState';
  const DAY_MS = 86400000;

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

  const asDecisionStatus = (value) => {
    const raw = text(value).toLowerCase();
    if (raw === 'verified' || raw === 'approved') return 'verified';
    if (raw === 'rejected') return 'rejected';
    if (raw === 'needs-info' || raw === 'needs info') return 'needs-info';
    return 'pending';
  };

  const labelForStatus = (value) => {
    const raw = asDecisionStatus(value);
    if (raw === 'verified') return 'Verified';
    if (raw === 'rejected') return 'Rejected';
    if (raw === 'needs-info') return 'Needs Info';
    return 'Pending Review';
  };

  const toDateLabel = (value) => {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const nowIso = () => new Date().toISOString();

  const getAdminSession = () => (
    typeof live.getSession === 'function' ? live.getSession('admin') : null
  );

  const getAdminToken = () => {
    if (typeof live.getToken === 'function') return text(live.getToken('admin'));
    if (typeof live.getAnyToken === 'function') return text(live.getAnyToken());
    return '';
  };

  const csvEscape = (value) => {
    const raw = String(value || '');
    if (!/[",\n]/.test(raw)) return raw;
    return `"${raw.replace(/"/g, '""')}"`;
  };

  const escapeSelectorValue = (value) => (
    String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  );

  const downloadText = (filename, content, mime) => {
    const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${CARD_ID} .abw-status { margin: 0 0 10px; color: #1f6d3d; font-size: 14px; }
#${CARD_ID} .abw-toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; align-items: center; }
#${CARD_ID} .abw-btn {
  border: 1px solid #0b3d91;
  border-radius: 8px;
  background: #0b3d91;
  color: #fff;
  padding: 7px 11px;
  font-weight: 700;
  cursor: pointer;
}
#${CARD_ID} .abw-btn.alt { background: #fff; color: #0b3d91; }
#${CARD_ID} .abw-btn.warn { background: #8f4f00; border-color: #8f4f00; }
#${CARD_ID} .abw-btn.danger { background: #8a1f1f; border-color: #8a1f1f; }
#${CARD_ID} .abw-kpi-grid { display: grid; gap: 8px; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); margin-bottom: 10px; }
#${CARD_ID} .abw-kpi { border: 1px solid #d7e5f7; border-radius: 8px; padding: 8px; background: #f8fbff; }
#${CARD_ID} .abw-kpi small { display: block; color: #58718f; }
#${CARD_ID} .abw-kpi b { color: #11466e; font-size: 16px; }
#${CARD_ID} .abw-list { display: grid; gap: 8px; }
#${CARD_ID} .abw-row { border: 1px solid #d9e4f5; border-radius: 10px; background: #fff; padding: 10px; }
#${CARD_ID} .abw-head { display: flex; justify-content: space-between; gap: 8px; align-items: flex-start; flex-wrap: wrap; }
#${CARD_ID} .abw-title { margin: 0; color: #12395f; }
#${CARD_ID} .abw-chip { display: inline-block; border-radius: 999px; padding: 2px 9px; font-size: 11px; font-weight: 700; }
#${CARD_ID} .abw-chip.pending { background: #eaf2ff; color: #1b4d87; }
#${CARD_ID} .abw-chip.verified { background: #e6f7ee; color: #1b6b3d; }
#${CARD_ID} .abw-chip.needs-info { background: #fff0da; color: #9f5d00; }
#${CARD_ID} .abw-chip.rejected { background: #ffe5e5; color: #992222; }
#${CARD_ID} .abw-meta { margin: 6px 0; color: #4a617b; font-size: 12px; line-height: 1.45; }
#${CARD_ID} .abw-reason {
  width: 100%;
  border: 1px solid #c8d7ed;
  border-radius: 8px;
  padding: 8px 9px;
  font-size: 13px;
  min-height: 64px;
  margin-top: 4px;
}
#${CARD_ID} .abw-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
#${CARD_ID} .abw-hint { color: #5a7390; font-size: 12px; margin-top: 4px; }
@media (max-width: 920px) {
  #${CARD_ID} .abw-actions { flex-direction: column; align-items: flex-start; }
}
    `;
    document.head.appendChild(style);
  }

  const card = document.createElement('div');
  card.className = 'property-card';
  card.id = CARD_ID;
  card.style.marginTop = '10px';
  card.innerHTML = `
    <h3>Verified Badge Decision Center (Strict Audit)</h3>
    <p id="abwStatus" class="abw-status">Loading verification queue...</p>
    <div class="abw-toolbar">
      <button id="abwRefreshBtn" class="abw-btn" type="button">Refresh Queue</button>
      <button id="abwExportCsvBtn" class="abw-btn alt" type="button">Export Audit CSV</button>
      <button id="abwExportJsonBtn" class="abw-btn alt" type="button">Export Audit JSON</button>
      <label style="font-size:13px;color:#3d5674;display:flex;gap:6px;align-items:center;">
        <input id="abwStrictToggle" type="checkbox" checked />
        Require reason (min 12 chars)
      </label>
    </div>
    <div id="abwKpiGrid" class="abw-kpi-grid"></div>
    <div id="abwList" class="abw-list"><p style="margin:0;color:#607da8;">No verification requests loaded.</p></div>
  `;

  const ownerCard = queueRoot.closest('.property-card');
  if (ownerCard) {
    ownerCard.insertAdjacentElement('afterend', card);
  } else {
    const container = queueRoot.closest('.container') || document.querySelector('.container');
    if (container) container.appendChild(card);
    else document.body.appendChild(card);
  }

  const statusEl = document.getElementById('abwStatus');
  const kpiEl = document.getElementById('abwKpiGrid');
  const listEl = document.getElementById('abwList');
  const refreshBtn = document.getElementById('abwRefreshBtn');
  const exportCsvBtn = document.getElementById('abwExportCsvBtn');
  const exportJsonBtn = document.getElementById('abwExportJsonBtn');
  const strictToggleEl = document.getElementById('abwStrictToggle');

  let queueItems = [];
  let busyById = {};

  const setStatus = (message, ok = true) => {
    statusEl.textContent = message;
    statusEl.style.color = ok ? '#1f6d3d' : '#8d1e1e';
  };

  const readDecisionState = () => {
    const map = readJson(DECISION_STATE_KEY, {});
    return map && typeof map === 'object' ? map : {};
  };

  const writeDecisionState = (next) => {
    writeJson(DECISION_STATE_KEY, next && typeof next === 'object' ? next : {});
  };

  const readAudit = () => {
    const rows = readJson(AUDIT_KEY, []);
    return Array.isArray(rows) ? rows : [];
  };

  const pushAudit = (row) => {
    const rows = readAudit();
    rows.unshift(row);
    writeJson(AUDIT_KEY, rows.slice(0, 500));
  };

  const overlayDecisionState = (items = []) => {
    const decisionMap = readDecisionState();
    return items.map((item) => {
      const existing = decisionMap[text(item.id)] || {};
      const mergedStatus = asDecisionStatus(existing.status || item.status);
      return {
        ...item,
        status: mergedStatus,
        decisionAt: text(existing.decisionAt || item.decisionAt),
        decisionReason: text(existing.reason || item.decisionReason),
      };
    });
  };

  const normalizeQueueItem = (item = {}, index = 0) => {
    const id = text(item.id || item._id, `request-${index + 1}`);
    const propertyId = text(item.propertyId || item.listingId || item.referenceId);
    const propertyTitle = text(item.propertyTitle || item.listingTitle || propertyId || 'N/A');
    const createdAt = text(item.createdAt, nowIso());
    const rawStatus = text(item.status || item.verificationStatus || 'pending review').toLowerCase();
    const status = rawStatus.includes('verified')
      ? 'verified'
      : rawStatus.includes('reject')
        ? 'rejected'
        : rawStatus.includes('needs')
          ? 'needs-info'
          : 'pending';

    return {
      id,
      propertyId,
      propertyTitle,
      userName: text(item.userName || item.ownerName || 'User'),
      userId: text(item.userId || item.ownerId),
      role: text(item.role, 'seller'),
      ownerKyc: text(item.ownerAadhaarPanStatus || item.kycStatus, 'Submitted'),
      addressKyc: text(item.addressVerificationStatus || item.addressStatus, 'Submitted'),
      createdAt,
      status,
      decisionAt: text(item.decisionAt),
      decisionReason: text(item.decisionReason || item.reason),
    };
  };

  const localFallbackQueue = () => {
    const listings = readJson(LISTINGS_KEY, []);
    return (Array.isArray(listings) ? listings : [])
      .filter((item) => item && typeof item === 'object')
      .map((item, index) => {
        const verification = item.verification && typeof item.verification === 'object' ? item.verification : {};
        const pending = !item.verified && !verification.adminApproved;
        const status = pending ? 'pending' : 'verified';
        return {
          id: text(item.id, `local-${index + 1}`),
          propertyId: text(item.id),
          propertyTitle: text(item.title, 'Property'),
          userName: text(item.ownerName || item.ownerId, 'Owner'),
          userId: text(item.ownerId),
          role: 'seller',
          ownerKyc: text(verification.ownerAadhaarPanStatus, pending ? 'Pending' : 'Verified'),
          addressKyc: text(verification.addressVerificationStatus, pending ? 'Pending' : 'Verified'),
          createdAt: text(item.createdAt || item.listedAt, nowIso()),
          status,
          decisionAt: '',
          decisionReason: '',
        };
      });
  };

  const loadQueue = async () => {
    const token = getAdminToken();
    if (token && live.request) {
      try {
        const response = await live.request('/admin/owner-verification', { token });
        const items = Array.isArray(response?.items) ? response.items : [];
        const normalized = items.map(normalizeQueueItem);
        queueItems = overlayDecisionState(normalized);
        setStatus(`Live queue loaded. ${queueItems.length} request(s).`);
        return;
      } catch (error) {
        if (!(typeof live.shouldFallbackToLocal === 'function' && live.shouldFallbackToLocal(error))) {
          setStatus(`Live queue load failed: ${text(error?.message, 'Unknown error')}`, false);
          queueItems = overlayDecisionState(localFallbackQueue());
          return;
        }
      }
    }
    queueItems = overlayDecisionState(localFallbackQueue());
    setStatus('Live unavailable. Local verification queue loaded.', false);
  };

  const renderKpis = () => {
    const pending = queueItems.filter((item) => item.status === 'pending').length;
    const verified = queueItems.filter((item) => item.status === 'verified').length;
    const needsInfo = queueItems.filter((item) => item.status === 'needs-info').length;
    const rejected = queueItems.filter((item) => item.status === 'rejected').length;
    const pendingAges = queueItems
      .filter((item) => item.status === 'pending')
      .map((item) => Math.max(0, (Date.now() - new Date(item.createdAt || nowIso()).getTime()) / 3600000));
    const avgPendingHours = pendingAges.length
      ? Math.round(pendingAges.reduce((sum, v) => sum + v, 0) / pendingAges.length)
      : 0;
    const today = new Date().toISOString().slice(0, 10);
    const auditToday = readAudit().filter((row) => text(row?.at).slice(0, 10) === today).length;

    kpiEl.innerHTML = `
      <div class="abw-kpi"><small>Pending</small><b>${pending}</b></div>
      <div class="abw-kpi"><small>Verified</small><b>${verified}</b></div>
      <div class="abw-kpi"><small>Needs Info</small><b>${needsInfo}</b></div>
      <div class="abw-kpi"><small>Rejected</small><b>${rejected}</b></div>
      <div class="abw-kpi"><small>Avg Pending Age</small><b>${avgPendingHours}h</b></div>
      <div class="abw-kpi"><small>Audit Today</small><b>${auditToday}</b></div>
    `;
  };

  const sortedQueue = () => {
    const order = { pending: 0, 'needs-info': 1, rejected: 2, verified: 3 };
    return [...queueItems].sort((a, b) => {
      const ao = numberFrom(order[a.status], 99);
      const bo = numberFrom(order[b.status], 99);
      if (ao !== bo) return ao - bo;
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    });
  };

  const renderQueue = () => {
    const rows = sortedQueue();
    if (!rows.length) {
      listEl.innerHTML = '<p style="margin:0;color:#607da8;">No verification requests in queue.</p>';
      return;
    }
    listEl.innerHTML = rows.map((item) => {
      const isBusy = Boolean(busyById[item.id]);
      const status = asDecisionStatus(item.status);
      const rowAgeHours = Math.max(0, Math.floor((Date.now() - new Date(item.createdAt || nowIso()).getTime()) / 3600000));
      return `
        <article class="abw-row" data-row-id="${escapeHtml(item.id)}">
          <div class="abw-head">
            <h4 class="abw-title">${escapeHtml(item.userName)} (${escapeHtml(item.role)})</h4>
            <span class="abw-chip ${status}">${labelForStatus(status)}</span>
          </div>
          <p class="abw-meta">
            Request ID: <b>${escapeHtml(item.id)}</b><br>
            Property: <b>${escapeHtml(item.propertyTitle)}</b>${item.propertyId ? ` (${escapeHtml(item.propertyId)})` : ''}<br>
            KYC: Owner ${escapeHtml(item.ownerKyc)} | Address ${escapeHtml(item.addressKyc)}<br>
            Created: ${escapeHtml(toDateLabel(item.createdAt))} (${rowAgeHours}h old)
          </p>
          <textarea class="abw-reason" data-reason-id="${escapeHtml(item.id)}" placeholder="Decision reason (auditable)...">${escapeHtml(item.decisionReason || '')}</textarea>
          <div class="abw-hint">Reason is logged with timestamp and admin identity for compliance.</div>
          <div class="abw-actions">
            <button class="abw-btn" type="button" data-action="verify" data-id="${escapeHtml(item.id)}" ${isBusy ? 'disabled' : ''}>Verify + Badge</button>
            <button class="abw-btn warn" type="button" data-action="needs-info" data-id="${escapeHtml(item.id)}" ${isBusy ? 'disabled' : ''}>Needs Info</button>
            <button class="abw-btn danger" type="button" data-action="reject" data-id="${escapeHtml(item.id)}" ${isBusy ? 'disabled' : ''}>Reject</button>
            <button class="abw-btn alt" type="button" data-action="history" data-id="${escapeHtml(item.id)}" ${isBusy ? 'disabled' : ''}>View Audit</button>
          </div>
        </article>
      `;
    }).join('');
  };

  const persistLocalDecision = (item, nextStatus, reason) => {
    const map = readDecisionState();
    map[text(item.id)] = {
      status: nextStatus,
      reason,
      decisionAt: nowIso(),
    };
    writeDecisionState(map);
  };

  const applyLocalPropertyVerified = (propertyId, verified) => {
    const targetId = text(propertyId);
    if (!targetId) return false;
    const listings = readJson(LISTINGS_KEY, []);
    let touched = false;
    const next = (Array.isArray(listings) ? listings : []).map((item) => {
      if (text(item?.id) !== targetId) return item;
      touched = true;
      const verification = item.verification && typeof item.verification === 'object' ? item.verification : {};
      return {
        ...item,
        verified: Boolean(verified),
        verifiedByPropertySetu: Boolean(verified),
        verification: {
          ...verification,
          adminApproved: Boolean(verified),
          badgeEligible: Boolean(verified),
          approvedAt: verified ? nowIso() : verification.approvedAt,
        },
        updatedAt: nowIso(),
      };
    });
    if (touched) writeJson(LISTINGS_KEY, next);
    return touched;
  };

  const statusToApi = (action) => {
    if (action === 'verify') return 'verified';
    if (action === 'needs-info') return 'needs-info';
    if (action === 'reject') return 'rejected';
    return 'pending';
  };

  const setBusy = (id, busy) => {
    busyById = { ...busyById, [id]: busy };
    renderQueue();
  };

  const validateReason = (reason) => {
    if (!strictToggleEl?.checked) return true;
    return text(reason).length >= 12;
  };

  const runDecision = async (id, action) => {
    const row = queueItems.find((item) => text(item.id) === text(id));
    if (!row) return;

    const reasonEl = listEl.querySelector(`[data-reason-id="${escapeSelectorValue(text(id))}"]`);
    const reason = text(reasonEl?.value);
    if (!validateReason(reason)) {
      setStatus('Strict mode enabled: minimum 12-character reason required.', false);
      return;
    }

    const admin = getAdminSession();
    const adminId = text(admin?.id || admin?.userId || 'admin-local');
    const token = getAdminToken();
    const decisionStatus = statusToApi(action);

    const auditRow = {
      id: `ab-audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: nowIso(),
      adminId,
      requestId: text(row.id),
      propertyId: text(row.propertyId),
      userId: text(row.userId),
      action: decisionStatus,
      reason,
      liveDecision: false,
      livePropertySync: false,
      source: token ? 'live' : 'local',
      error: '',
    };

    setBusy(row.id, true);
    try {
      if (token && live.request) {
        try {
          await live.request(`/admin/owner-verification/${encodeURIComponent(row.id)}/decision`, {
            method: 'POST',
            token,
            data: { status: decisionStatus, reason, note: reason },
          });
          auditRow.liveDecision = true;
        } catch (error) {
          if (!(typeof live.shouldFallbackToLocal === 'function' && live.shouldFallbackToLocal(error))) {
            throw error;
          }
          auditRow.error = text(error?.message, 'Decision API fallback');
        }

        if (decisionStatus === 'verified' && row.propertyId) {
          try {
            await live.request(`/properties/${encodeURIComponent(row.propertyId)}/approve`, {
              method: 'POST',
              token,
              data: {},
            });
            auditRow.livePropertySync = true;
          } catch (error) {
            if (!(typeof live.shouldFallbackToLocal === 'function' && live.shouldFallbackToLocal(error))) {
              throw error;
            }
            auditRow.error = auditRow.error || text(error?.message, 'Property verify fallback');
          }
        }
      }

      persistLocalDecision(row, decisionStatus, reason);
      if (decisionStatus === 'verified' && row.propertyId) {
        applyLocalPropertyVerified(row.propertyId, true);
      }
      queueItems = queueItems.map((item) => (
        item.id === row.id
          ? {
            ...item,
            status: decisionStatus,
            decisionAt: nowIso(),
            decisionReason: reason,
          }
          : item
      ));
      pushAudit(auditRow);
      renderKpis();
      renderQueue();
      setStatus(`Decision saved: ${labelForStatus(decisionStatus)} for request ${row.id}.`);
    } catch (error) {
      auditRow.error = text(error?.message, 'Unknown error');
      pushAudit(auditRow);
      setStatus(`Decision failed for ${row.id}: ${auditRow.error}`, false);
    } finally {
      setBusy(row.id, false);
    }
  };

  const showRowHistory = (id) => {
    const rows = readAudit().filter((row) => text(row.requestId) === text(id)).slice(0, 8);
    if (!rows.length) {
      window.alert(`No audit records found for request ${id}.`);
      return;
    }
    const body = rows.map((row) => (
      `${toDateLabel(row.at)} | ${labelForStatus(row.action)} | ${text(row.reason, '-')}\n` +
      `admin=${text(row.adminId)} liveDecision=${row.liveDecision ? 'yes' : 'no'} livePropertySync=${row.livePropertySync ? 'yes' : 'no'}`
    )).join('\n\n');
    window.alert(body);
  };

  const exportAuditCsv = () => {
    const rows = readAudit();
    const headers = [
      'Audit ID',
      'Timestamp',
      'Admin ID',
      'Request ID',
      'Property ID',
      'User ID',
      'Action',
      'Reason',
      'Live Decision',
      'Live Property Sync',
      'Source',
      'Error',
    ];
    const lines = rows.map((row) => [
      row.id,
      row.at,
      row.adminId,
      row.requestId,
      row.propertyId,
      row.userId,
      row.action,
      row.reason,
      row.liveDecision ? 'yes' : 'no',
      row.livePropertySync ? 'yes' : 'no',
      row.source,
      row.error,
    ]);
    const csv = [headers, ...lines].map((line) => line.map(csvEscape).join(',')).join('\n');
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(`admin-badge-audit-${stamp}.csv`, csv, 'text/csv;charset=utf-8;');
    setStatus('Badge audit CSV exported.');
  };

  const exportAuditJson = () => {
    const rows = readAudit();
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(`admin-badge-audit-${stamp}.json`, JSON.stringify(rows, null, 2), 'application/json;charset=utf-8;');
    setStatus('Badge audit JSON exported.');
  };

  const render = async () => {
    await loadQueue();
    renderKpis();
    renderQueue();
  };

  refreshBtn?.addEventListener('click', () => {
    render().catch((error) => setStatus(text(error?.message, 'Queue refresh failed.'), false));
  });

  exportCsvBtn?.addEventListener('click', exportAuditCsv);
  exportJsonBtn?.addEventListener('click', exportAuditJson);

  listEl?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = text(target.getAttribute('data-action')).toLowerCase();
    const id = text(target.getAttribute('data-id'));
    if (!action || !id) return;
    if (action === 'history') {
      showRowHistory(id);
      return;
    }
    if (action === 'verify' || action === 'needs-info' || action === 'reject') {
      runDecision(id, action).catch((error) => setStatus(text(error?.message, 'Decision failed.'), false));
    }
  });

  render().catch((error) => setStatus(text(error?.message, 'Unable to load badge workflow.'), false));

  window.setInterval(() => {
    render().catch(() => null);
  }, 60000);
})();
