(() => {
  if (document.getElementById('auctionSettlementWarRoomCard')) return;

  const live = window.PropertySetuLive || {};
  const path = String(window.location.pathname || '').toLowerCase();
  const isAdminPage = path.includes('admin-dashboard') || Boolean(document.getElementById('adminOverview'));
  if (!isAdminPage) return;

  const CARD_ID = 'auctionSettlementWarRoomCard';
  const STYLE_ID = 'auction-settlement-war-room-style';
  const LISTINGS_KEY = 'propertySetu:listings';
  const AUCTION_STATE_KEY = 'propertySetu:auctionState';
  const AUCTION_BIDS_KEY = 'propertySetu:auctionBids';
  const SLA_ALERTS_KEY = 'propertySetu:auctionSlaAlerts';
  const PREF_KEY = 'propertySetu:auctionSettlementPrefs';
  const LEDGER_KEY = 'propertySetu:auctionSettlementLedger';
  const AUDIT_KEY = 'propertySetu:auctionSettlementAudit';

  const STAGES = [
    { id: 'winner_confirmation', label: 'Winner Confirmation' },
    { id: 'token_collection', label: 'Token Collection' },
    { id: 'kyc_verification', label: 'KYC Verification' },
    { id: 'legal_docs', label: 'Legal Docs' },
    { id: 'payout_release', label: 'Payout Release' },
    { id: 'handover_complete', label: 'Handover Complete' },
  ];

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
  const inr = (value) => `Rs ${Math.round(numberFrom(value, 0)).toLocaleString('en-IN')}`;
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
      id: `auction-settlement-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      message,
      audience,
      type,
      createdAt: nowIso(),
      readBy: {},
    });
    writeJson('propertySetu:notifications', list.slice(0, 800));
  };

  const getPrefs = () => {
    const value = readJson(PREF_KEY, {});
    return {
      query: text(value?.query),
      state: text(value?.state, 'all').toLowerCase(),
      priority: text(value?.priority, 'all').toLowerCase(),
      owner: text(value?.owner, 'all').toLowerCase(),
      riskOnly: Boolean(value?.riskOnly),
      slaHours: clamp(numberFrom(value?.slaHours, 48), 12, 240),
      autoSec: clamp(Math.round(numberFrom(value?.autoSec, 40)), 0, 300),
    };
  };
  const setPrefs = (next) => {
    writeJson(PREF_KEY, { ...getPrefs(), ...(next || {}) });
  };

  const getLedgerMap = () => {
    const value = readJson(LEDGER_KEY, {});
    return value && typeof value === 'object' ? value : {};
  };
  const setLedgerMap = (next) => {
    writeJson(LEDGER_KEY, next && typeof next === 'object' ? next : {});
  };

  const getAudit = () => {
    const rows = readJson(AUDIT_KEY, []);
    return Array.isArray(rows) ? rows : [];
  };
  const pushAudit = (entry = {}) => {
    const rows = getAudit();
    rows.unshift({
      id: `auction-settlement-audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: nowIso(),
      by: text(entry.by, getAdminName()),
      action: text(entry.action, 'refresh'),
      propertyId: text(entry.propertyId),
      propertyTitle: text(entry.propertyTitle),
      stage: text(entry.stage),
      state: text(entry.state),
      note: text(entry.note),
    });
    writeJson(AUDIT_KEY, rows.slice(0, 700));
  };

  const listingMap = () => {
    const map = new Map();
    const rows = readJson(LISTINGS_KEY, []);
    (Array.isArray(rows) ? rows : []).forEach((item) => {
      const id = text(item?.id || item?._id);
      if (!id) return;
      map.set(id, {
        id,
        title: text(item?.title, id),
        city: text(item?.city, 'Udaipur'),
        location: text(item?.location || item?.locality, 'Udaipur'),
        ownerId: text(item?.ownerId || item?.userId || item?.owner?.id),
      });
    });
    return map;
  };

  const auctionMap = () => {
    const rows = readJson(AUCTION_STATE_KEY, {});
    return rows && typeof rows === 'object' ? rows : {};
  };

  const allBids = () => {
    const rows = readJson(AUCTION_BIDS_KEY, []);
    return (Array.isArray(rows) ? rows : [])
      .map((item) => {
        const id = text(item?.id);
        const propertyId = text(item?.propertyId);
        if (!id || !propertyId) return null;
        return {
          id,
          propertyId,
          bidderId: text(item?.bidderId, 'unknown'),
          bidderName: text(item?.bidderName, 'Bidder'),
          bidderRole: text(item?.bidderRole, 'buyer'),
          amount: Math.max(0, Math.round(numberFrom(item?.amount, 0))),
          createdAt: text(item?.createdAt),
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const diff = b.amount - a.amount;
        if (diff !== 0) return diff;
        return epoch(a.createdAt) - epoch(b.createdAt);
      });
  };

  const getOpenSlaByProperty = () => {
    const map = readJson(SLA_ALERTS_KEY, {});
    const index = new Map();
    Object.values(map && typeof map === 'object' ? map : {}).forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const state = text(item.state, 'open').toLowerCase();
      if (state === 'resolved') return;
      const propertyId = text(item.propertyId);
      if (!propertyId) return;
      if (!index.has(propertyId)) index.set(propertyId, []);
      index.get(propertyId).push({
        id: text(item.id),
        rule: text(item.rule),
        severity: text(item.severity, 'low').toLowerCase(),
        note: text(item.note),
        state,
      });
    });
    return index;
  };

  const stageLabel = (stageId) => {
    const row = STAGES.find((item) => item.id === stageId);
    return row ? row.label : 'Unknown';
  };
  const stageIndex = (stageId) => {
    const idx = STAGES.findIndex((item) => item.id === stageId);
    return idx >= 0 ? idx : 0;
  };

  const ensureLedgerRow = (ledger, row) => {
    const propertyId = text(row.propertyId);
    if (!propertyId) return null;
    const current = ledger[propertyId] || {};
    const completedStages = Array.isArray(current.completedStages)
      ? current.completedStages.map((item) => text(item)).filter(Boolean)
      : [];
    const uniqCompleted = Array.from(new Set(completedStages))
      .filter((stageId) => STAGES.some((stage) => stage.id === stageId));

    const targetAt = text(current.targetAt)
      || (row.closedAt ? new Date(epoch(row.closedAt) + getPrefs().slaHours * 3600000).toISOString() : '');
    const derivedState = text(current.state, 'open').toLowerCase();
    const state = derivedState === 'blocked' || derivedState === 'completed' ? derivedState : 'open';
    const stage = text(current.stage);
    const nextStage = stage && STAGES.some((item) => item.id === stage)
      ? stage
      : (uniqCompleted.length >= STAGES.length ? 'handover_complete' : STAGES[Math.min(uniqCompleted.length, STAGES.length - 1)].id);

    const next = {
      propertyId,
      caseId: text(current.caseId, `SET-${propertyId.slice(0, 6).toUpperCase()}-${String(Date.now()).slice(-6)}`),
      owner: text(current.owner),
      priority: text(current.priority, 'medium').toLowerCase(),
      state,
      stage: nextStage,
      completedStages: uniqCompleted,
      blockedReason: text(current.blockedReason),
      followUpAt: text(current.followUpAt),
      targetAt,
      createdAt: text(current.createdAt, nowIso()),
      updatedAt: nowIso(),
      notes: Array.isArray(current.notes) ? current.notes.slice(0, 50) : [],
      notifyCount: Math.max(0, Math.round(numberFrom(current.notifyCount, 0))),
      lastNotifiedAt: text(current.lastNotifiedAt),
      milestoneAt: current?.milestoneAt && typeof current.milestoneAt === 'object' ? current.milestoneAt : {},
    };
    ledger[propertyId] = next;
    return next;
  };

  const buildRows = () => {
    const listings = listingMap();
    const auctions = auctionMap();
    const bids = allBids();
    const slaByProperty = getOpenSlaByProperty();
    const prefs = getPrefs();
    const ids = new Set();

    Object.keys(auctions || {}).forEach((id) => ids.add(text(id)));
    bids.forEach((bid) => ids.add(text(bid.propertyId)));
    Array.from(slaByProperty.keys()).forEach((id) => ids.add(text(id)));

    const ledger = getLedgerMap();
    const rows = [];

    ids.forEach((propertyId) => {
      if (!propertyId) return;
      const auction = auctions[propertyId] || {};
      const listing = listings.get(propertyId) || {
        id: propertyId,
        title: propertyId,
        city: 'Udaipur',
        location: 'Udaipur',
        ownerId: '',
      };
      const bidRows = bids.filter((item) => item.propertyId === propertyId);
      const highestBid = bidRows[0] || null;
      const winnerBid = bidRows.find((item) => item.id === text(auction?.winnerBidId)) || highestBid;
      const rawStatus = text(auction?.status, 'live').toLowerCase();
      const closeAt = text(auction?.closesAt || auction?.closedAt);
      const hasSla = slaByProperty.has(propertyId);
      const isCandidate = (
        rawStatus === 'settled'
        || rawStatus === 'closed'
        || hasSla
        || Boolean(auction?.winnerBidId)
      ) && (bidRows.length > 0 || hasSla);
      if (!isCandidate) return;

      const ledgerRow = ensureLedgerRow(ledger, {
        propertyId,
        closedAt: closeAt,
      });
      if (!ledgerRow) return;

      const completedStages = Array.isArray(ledgerRow.completedStages) ? ledgerRow.completedStages : [];
      const currentStage = text(ledgerRow.stage, STAGES[0].id);
      const stageNo = stageIndex(currentStage) + 1;
      const targetEpoch = epoch(ledgerRow.targetAt);
      const hoursToSla = targetEpoch ? (targetEpoch - Date.now()) / 3600000 : 0;
      const isOverdue = ledgerRow.state !== 'completed' && targetEpoch && hoursToSla < 0;
      const dueSoon = ledgerRow.state !== 'completed' && targetEpoch && hoursToSla >= 0 && hoursToSla <= 12;

      const alerts = slaByProperty.get(propertyId) || [];
      const criticalAlert = alerts.some((item) => item.severity === 'critical');
      const highAlert = alerts.some((item) => item.severity === 'high');

      const riskScore = (
        (isOverdue ? 3 : 0)
        + (dueSoon ? 1 : 0)
        + (ledgerRow.state === 'blocked' ? 2 : 0)
        + (criticalAlert ? 3 : 0)
        + (highAlert ? 2 : 0)
      );

      const priority = text(ledgerRow.priority, 'medium').toLowerCase();
      const effectivePriority = priority === 'critical' || priority === 'high'
        ? priority
        : (criticalAlert ? 'critical' : highAlert ? 'high' : priority || 'medium');

      rows.push({
        propertyId,
        propertyTitle: listing.title,
        city: listing.city,
        location: listing.location,
        listingOwnerId: listing.ownerId,
        auctionStatus: rawStatus,
        closeAt,
        winnerBidId: text(auction?.winnerBidId),
        winnerBidAmount: winnerBid ? winnerBid.amount : 0,
        winnerBidderId: winnerBid ? winnerBid.bidderId : '',
        winnerBidderName: winnerBid ? winnerBid.bidderName : '',
        totalBids: bidRows.length,
        ledger: ledgerRow,
        stageNo,
        stageLabel: stageLabel(currentStage),
        completedCount: completedStages.length,
        isOverdue,
        dueSoon,
        hoursToSla,
        alerts,
        riskScore,
        priority: effectivePriority,
        followUpAt: text(ledgerRow.followUpAt),
      });
    });

    setLedgerMap(ledger);
    return rows.sort((a, b) => {
      const stateRank = { blocked: 0, open: 1, completed: 2 };
      const stateDiff = (stateRank[text(a.ledger.state, 'open')] ?? 9) - (stateRank[text(b.ledger.state, 'open')] ?? 9);
      if (stateDiff !== 0) return stateDiff;
      const riskDiff = b.riskScore - a.riskScore;
      if (riskDiff !== 0) return riskDiff;
      return epoch(a.ledger.targetAt) - epoch(b.ledger.targetAt);
    });
  };

  const shortTime = (value) => {
    const ts = epoch(value);
    if (!ts) return '-';
    return new Date(ts).toLocaleString('en-IN');
  };
  const priorityRank = (value) => {
    const key = text(value, 'medium').toLowerCase();
    if (key === 'critical') return 4;
    if (key === 'high') return 3;
    if (key === 'medium') return 2;
    return 1;
  };

  const applySettlementAction = (row, action) => {
    if (!row) return { ok: false, message: 'Settlement case not found.' };
    const lowerAction = text(action).toLowerCase();
    const map = getLedgerMap();
    const current = map[row.propertyId];
    if (!current) return { ok: false, message: 'Settlement ledger missing.' };
    const admin = getAdminName();
    const now = nowIso();

    const completed = Array.isArray(current.completedStages)
      ? current.completedStages.map((item) => text(item)).filter(Boolean)
      : [];
    const completedSet = new Set(completed);
    const currentStage = text(current.stage, STAGES[0].id);
    let message = '';

    if (lowerAction === 'advance') {
      completedSet.add(currentStage);
      const sorted = STAGES
        .map((item) => item.id)
        .filter((stageId) => completedSet.has(stageId));
      current.completedStages = sorted;
      current.milestoneAt = {
        ...(current.milestoneAt || {}),
        [currentStage]: now,
      };
      const nextIdx = Math.min(sorted.length, STAGES.length - 1);
      current.stage = STAGES[nextIdx].id;
      current.state = sorted.length >= STAGES.length ? 'completed' : 'open';
      message = sorted.length >= STAGES.length
        ? 'Case marked completed.'
        : `Advanced to ${stageLabel(current.stage)}.`;
    } else if (lowerAction === 'rollback') {
      const sorted = STAGES
        .map((item) => item.id)
        .filter((stageId) => completedSet.has(stageId));
      const last = sorted[sorted.length - 1];
      if (!last) return { ok: false, message: 'No completed stage to rollback.' };
      completedSet.delete(last);
      current.completedStages = STAGES
        .map((item) => item.id)
        .filter((stageId) => completedSet.has(stageId));
      if (current.milestoneAt && typeof current.milestoneAt === 'object') {
        delete current.milestoneAt[last];
      }
      current.stage = last;
      current.state = 'open';
      message = `Rolled back stage ${stageLabel(last)}.`;
    } else if (lowerAction === 'block') {
      const reason = window.prompt('Block reason:', text(current.blockedReason, 'Awaiting legal confirmation'));
      if (reason === null) return { ok: false, message: 'Block action cancelled.' };
      current.state = 'blocked';
      current.blockedReason = text(reason, 'Blocked');
      message = `Case blocked: ${current.blockedReason}`;
    } else if (lowerAction === 'unblock') {
      current.state = 'open';
      current.blockedReason = '';
      message = 'Case unblocked.';
    } else if (lowerAction === 'complete') {
      current.completedStages = STAGES.map((item) => item.id);
      current.stage = STAGES[STAGES.length - 1].id;
      current.state = 'completed';
      current.milestoneAt = {
        ...(current.milestoneAt || {}),
        [current.stage]: now,
      };
      message = 'Case force-completed.';
    } else if (lowerAction === 'followup') {
      const existing = epoch(current.followUpAt) ? shortTime(current.followUpAt) : '';
      const raw = window.prompt('Follow-up after hours (example 24):', existing ? '24' : '24');
      if (raw === null) return { ok: false, message: 'Follow-up update cancelled.' };
      const hours = clamp(numberFrom(raw, 24), 1, 240);
      current.followUpAt = new Date(Date.now() + hours * 3600000).toISOString();
      message = `Follow-up set for ${hours}h.`;
    } else if (lowerAction === 'assign') {
      const owner = window.prompt('Assign owner name:', text(current.owner, getAdminName()));
      if (owner === null) return { ok: false, message: 'Assign action cancelled.' };
      current.owner = text(owner);
      message = current.owner ? `Case assigned to ${current.owner}.` : 'Owner cleared.';
    } else if (lowerAction === 'priority') {
      const value = window.prompt('Priority (low/medium/high/critical):', text(current.priority, 'medium'));
      if (value === null) return { ok: false, message: 'Priority update cancelled.' };
      const key = text(value, 'medium').toLowerCase();
      current.priority = ['low', 'medium', 'high', 'critical'].includes(key) ? key : 'medium';
      message = `Priority set to ${current.priority}.`;
    } else if (lowerAction === 'notify') {
      pushNotification(
        `Settlement action - ${row.propertyTitle}`,
        `Case ${current.caseId} | Stage ${stageLabel(current.stage)} | Owner ${text(current.owner, 'Unassigned')}`,
        ['admin', 'seller', 'customer'],
        priorityRank(current.priority) >= 3 ? 'warn' : 'info'
      );
      current.lastNotifiedAt = now;
      current.notifyCount = Math.max(0, Math.round(numberFrom(current.notifyCount, 0))) + 1;
      message = 'Stakeholders notified.';
    } else if (lowerAction === 'note') {
      const note = window.prompt('Add settlement note:', '');
      if (note === null) return { ok: false, message: 'Note action cancelled.' };
      const next = text(note);
      if (!next) return { ok: false, message: 'Empty note ignored.' };
      const notes = Array.isArray(current.notes) ? current.notes : [];
      notes.unshift({
        at: now,
        by: admin,
        text: next,
      });
      current.notes = notes.slice(0, 80);
      message = 'Note added.';
    } else {
      return { ok: false, message: 'Unknown action.' };
    }

    current.updatedAt = now;
    map[row.propertyId] = current;
    setLedgerMap(map);
    pushAudit({
      by: admin,
      action: lowerAction,
      propertyId: row.propertyId,
      propertyTitle: row.propertyTitle,
      stage: current.stage,
      state: current.state,
      note: message,
    });

    if (lowerAction !== 'notify') {
      pushNotification(
        `Settlement update - ${row.propertyTitle}`,
        message,
        ['admin'],
        'info'
      );
    }
    return { ok: true, message };
  };

  const exportCsv = (rows) => {
    const header = [
      'propertyId',
      'propertyTitle',
      'auctionStatus',
      'caseId',
      'owner',
      'priority',
      'state',
      'stage',
      'completedStages',
      'winnerBidAmount',
      'totalBids',
      'targetAt',
      'followUpAt',
      'riskScore',
      'alerts',
    ];
    const lines = rows.map((row) => [
      row.propertyId,
      row.propertyTitle,
      row.auctionStatus,
      row.ledger.caseId,
      row.ledger.owner,
      row.priority,
      row.ledger.state,
      row.stageLabel,
      row.ledger.completedStages.join('|'),
      row.winnerBidAmount,
      row.totalBids,
      row.ledger.targetAt,
      row.followUpAt,
      row.riskScore,
      row.alerts.map((item) => `${item.rule}:${item.severity}`).join('|'),
    ].map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = `${header.join(',')}\n${lines.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `auction-settlement-war-room-${Date.now()}.csv`;
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
#${CARD_ID} .aswr-card{border:1px solid #d6e1f5;border-radius:10px;background:#fff;padding:10px}
#${CARD_ID} .aswr-grid{display:grid;gap:10px}
#${CARD_ID} .aswr-grid.cols{grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}
#${CARD_ID} label{display:block;font-size:12px;color:#35597d;margin-bottom:4px}
#${CARD_ID} input,#${CARD_ID} select{width:100%;border:1px solid #cad9ef;border-radius:8px;padding:8px 10px;box-sizing:border-box}
#${CARD_ID} .aswr-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
#${CARD_ID} .aswr-btn{border:1px solid #0b3d91;background:#0b3d91;color:#fff;border-radius:8px;padding:8px 12px;cursor:pointer;font-weight:700}
#${CARD_ID} .aswr-btn.alt{background:#fff;color:#0b3d91}
#${CARD_ID} .aswr-btn.warn{background:#8d1e1e;border-color:#8d1e1e}
#${CARD_ID} .aswr-chip{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;margin:2px 6px 2px 0;background:#e9f0ff;color:#1f3e7a}
#${CARD_ID} .aswr-chip.state-open{background:#e5f2ff;color:#1b4a82}
#${CARD_ID} .aswr-chip.state-blocked{background:#ffeaea;color:#8d1e1e}
#${CARD_ID} .aswr-chip.state-completed{background:#e8f7ef;color:#10623e}
#${CARD_ID} .aswr-chip.priority-low{background:#deecff;color:#1d4b84}
#${CARD_ID} .aswr-chip.priority-medium{background:#fff1d6;color:#7a4f00}
#${CARD_ID} .aswr-chip.priority-high{background:#ffd8c9;color:#8a2b08}
#${CARD_ID} .aswr-chip.priority-critical{background:#8f1a1a;color:#fff}
#${CARD_ID} .aswr-kpis{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin-top:10px}
#${CARD_ID} .aswr-kpi{border:1px solid #d6e1f5;border-radius:8px;background:#f8fbff;padding:8px}
#${CARD_ID} .aswr-kpi small{display:block;color:#58718f}
#${CARD_ID} table{width:100%;border-collapse:collapse}
#${CARD_ID} th,#${CARD_ID} td{border:1px solid #d6e1f5;padding:8px;text-align:left;vertical-align:top}
#${CARD_ID} th{background:#f4f8ff;color:#11466e}
#${CARD_ID} .aswr-audit{max-height:220px;overflow:auto}
#${CARD_ID} .aswr-audit-item{border-bottom:1px solid #e1e9f8;padding:7px 0;color:#325176;font-size:13px}
@media (max-width:768px){#${CARD_ID} .aswr-row{display:grid;grid-template-columns:1fr}}
`;
    document.head.appendChild(style);
  }

  const shell = document.createElement('section');
  shell.id = CARD_ID;
  shell.className = 'container';
  shell.innerHTML = `
<div class="aswr-card">
  <h2 style="margin:0 0 8px;">Auction Settlement War Room</h2>
  <p style="margin:0;color:#1d4068;">Post-auction execution board for winner closure, KYC, legal docs, payout release and handover completion.</p>
</div>
<div class="aswr-card" style="margin-top:10px;">
  <div class="aswr-grid cols">
    <div><label for="aswrQuery">Search</label><input id="aswrQuery" placeholder="Property, case id, winner"></div>
    <div><label for="aswrStateFilter">State</label><select id="aswrStateFilter"><option value="all">All</option><option value="open">Open</option><option value="blocked">Blocked</option><option value="completed">Completed</option></select></div>
    <div><label for="aswrPriorityFilter">Priority</label><select id="aswrPriorityFilter"><option value="all">All</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></div>
    <div><label for="aswrOwnerFilter">Owner</label><select id="aswrOwnerFilter"><option value="all">All</option><option value="unassigned">Unassigned</option><option value="mine">Assigned To Me</option></select></div>
    <div><label for="aswrRiskOnly">Risk Focus</label><select id="aswrRiskOnly"><option value="0">No</option><option value="1">Yes</option></select></div>
    <div><label for="aswrSlaHours">SLA Target (hours)</label><input id="aswrSlaHours" type="number" min="12" max="240" step="1"></div>
    <div><label for="aswrAutoSec">Auto Refresh (sec)</label><input id="aswrAutoSec" type="number" min="0" max="300" step="5"></div>
  </div>
  <div class="aswr-row" style="margin-top:10px;">
    <button id="aswrSavePrefs" class="aswr-btn alt" type="button">Save Filters</button>
    <button id="aswrRefresh" class="aswr-btn" type="button">Refresh Board</button>
    <button id="aswrExport" class="aswr-btn alt" type="button">Export CSV</button>
    <span id="aswrStatus" class="aswr-chip">Ready</span>
  </div>
</div>
<div class="aswr-card" style="margin-top:10px;">
  <h3 style="margin:0 0 8px;">Case Action Desk</h3>
  <div class="aswr-row">
    <input id="aswrCasePropertyId" placeholder="Property ID" style="flex:1 1 180px;">
    <select id="aswrCaseAction" style="min-width:190px;">
      <option value="advance">Advance Stage</option>
      <option value="rollback">Rollback Stage</option>
      <option value="block">Block Case</option>
      <option value="unblock">Unblock Case</option>
      <option value="assign">Assign Owner</option>
      <option value="priority">Update Priority</option>
      <option value="followup">Set Follow-up</option>
      <option value="note">Add Note</option>
      <option value="notify">Notify Stakeholders</option>
      <option value="complete">Mark Completed</option>
    </select>
    <button id="aswrApplyAction" class="aswr-btn" type="button">Apply</button>
  </div>
</div>
<div id="aswrKpis" class="aswr-kpis"></div>
<div class="aswr-card" style="margin-top:10px;">
  <h3 style="margin:0 0 8px;">Settlement Cases</h3>
  <div id="aswrBoard" style="overflow:auto;"></div>
</div>
<div class="aswr-card" style="margin-top:10px;">
  <h3 style="margin:0 0 8px;">Case Detail</h3>
  <div id="aswrDetail" style="overflow:auto;color:#325176;">Select a case from settlement board.</div>
</div>
<div class="aswr-card" style="margin-top:10px;">
  <h3 style="margin:0 0 8px;">Settlement Audit Feed</h3>
  <div id="aswrAudit" class="aswr-audit"></div>
</div>
`;

  const anchor = document.getElementById('auctionSlaEscalationCenterCard')
    || document.getElementById('auctionUnifiedAnalyticsTimelineCard')
    || document.getElementById('adminAuctionControlCenter')
    || document.querySelector('.container');
  if (anchor?.parentElement) anchor.insertAdjacentElement('afterend', shell);
  else document.body.appendChild(shell);

  const ui = {
    query: document.getElementById('aswrQuery'),
    stateFilter: document.getElementById('aswrStateFilter'),
    priorityFilter: document.getElementById('aswrPriorityFilter'),
    ownerFilter: document.getElementById('aswrOwnerFilter'),
    riskOnly: document.getElementById('aswrRiskOnly'),
    slaHours: document.getElementById('aswrSlaHours'),
    autoSec: document.getElementById('aswrAutoSec'),
    savePrefs: document.getElementById('aswrSavePrefs'),
    refresh: document.getElementById('aswrRefresh'),
    export: document.getElementById('aswrExport'),
    status: document.getElementById('aswrStatus'),
    casePropertyId: document.getElementById('aswrCasePropertyId'),
    caseAction: document.getElementById('aswrCaseAction'),
    applyAction: document.getElementById('aswrApplyAction'),
    kpis: document.getElementById('aswrKpis'),
    board: document.getElementById('aswrBoard'),
    detail: document.getElementById('aswrDetail'),
    audit: document.getElementById('aswrAudit'),
  };

  const state = {
    rows: [],
    filtered: [],
    selectedPropertyId: '',
    timer: null,
  };

  const setStatus = (message, ok = true) => {
    ui.status.textContent = text(message, 'Ready');
    ui.status.style.color = ok ? '#1f3e7a' : '#8f1a1a';
  };

  const syncControlsFromPrefs = () => {
    const prefs = getPrefs();
    ui.query.value = prefs.query;
    ui.stateFilter.value = prefs.state;
    ui.priorityFilter.value = prefs.priority;
    ui.ownerFilter.value = prefs.owner;
    ui.riskOnly.value = prefs.riskOnly ? '1' : '0';
    ui.slaHours.value = String(prefs.slaHours);
    ui.autoSec.value = String(prefs.autoSec);
  };

  const getControls = () => ({
    query: text(ui.query.value),
    state: text(ui.stateFilter.value, 'all').toLowerCase(),
    priority: text(ui.priorityFilter.value, 'all').toLowerCase(),
    owner: text(ui.ownerFilter.value, 'all').toLowerCase(),
    riskOnly: text(ui.riskOnly.value) === '1',
    slaHours: clamp(numberFrom(ui.slaHours.value, 48), 12, 240),
    autoSec: clamp(Math.round(numberFrom(ui.autoSec.value, 40)), 0, 300),
  });

  const updateTargetsForSla = (hours) => {
    const map = getLedgerMap();
    let touched = 0;
    Object.values(map).forEach((row) => {
      if (!row || typeof row !== 'object') return;
      if (text(row.state, 'open').toLowerCase() === 'completed') return;
      const fallback = epoch(row.createdAt) || Date.now();
      row.targetAt = new Date(fallback + hours * 3600000).toISOString();
      row.updatedAt = nowIso();
      touched += 1;
    });
    if (touched > 0) setLedgerMap(map);
  };

  const applyFilters = (rows) => {
    const filters = getControls();
    const me = getAdminName().toLowerCase();
    return rows.filter((row) => {
      const stateKey = text(row.ledger.state, 'open').toLowerCase();
      const query = filters.query.toLowerCase();
      if (filters.state !== 'all' && stateKey !== filters.state) return false;
      if (filters.priority !== 'all' && text(row.priority, 'medium').toLowerCase() !== filters.priority) return false;
      if (filters.owner === 'unassigned' && text(row.ledger.owner)) return false;
      if (filters.owner === 'mine' && text(row.ledger.owner).toLowerCase() !== me) return false;
      if (filters.riskOnly && row.riskScore <= 0) return false;
      if (!query) return true;
      return [
        row.propertyId,
        row.propertyTitle,
        row.ledger.caseId,
        row.winnerBidderName,
        row.stageLabel,
      ].some((value) => text(value).toLowerCase().includes(query));
    });
  };

  const renderKpis = (rows) => {
    const total = rows.length;
    const openCount = rows.filter((row) => text(row.ledger.state, 'open') === 'open').length;
    const blockedCount = rows.filter((row) => text(row.ledger.state, 'open') === 'blocked').length;
    const completedCount = rows.filter((row) => text(row.ledger.state, 'open') === 'completed').length;
    const overdue = rows.filter((row) => row.isOverdue).length;
    const dueSoon = rows.filter((row) => row.dueSoon).length;
    const highRisk = rows.filter((row) => row.riskScore >= 3).length;
    ui.kpis.innerHTML = `
<div class="aswr-kpi"><small>Total Cases</small><strong>${total}</strong></div>
<div class="aswr-kpi"><small>Open</small><strong>${openCount}</strong></div>
<div class="aswr-kpi"><small>Blocked</small><strong>${blockedCount}</strong></div>
<div class="aswr-kpi"><small>Completed</small><strong>${completedCount}</strong></div>
<div class="aswr-kpi"><small>Overdue</small><strong>${overdue}</strong></div>
<div class="aswr-kpi"><small>Due Soon</small><strong>${dueSoon}</strong></div>
<div class="aswr-kpi"><small>High Risk</small><strong>${highRisk}</strong></div>`;
  };

  const renderDetail = (propertyId) => {
    const row = state.filtered.find((item) => item.propertyId === propertyId)
      || state.rows.find((item) => item.propertyId === propertyId);
    if (!row) {
      ui.detail.innerHTML = '<p style="margin:0;color:#607da8;">Select a case from settlement board.</p>';
      return;
    }
    const notes = Array.isArray(row.ledger.notes) ? row.ledger.notes.slice(0, 10) : [];
    ui.detail.innerHTML = `
<div style="margin-bottom:8px;">
  <b>${escapeHtml(row.propertyTitle)}</b> (${escapeHtml(row.propertyId)})<br>
  Case: <b>${escapeHtml(row.ledger.caseId)}</b> | Stage <b>${escapeHtml(row.stageLabel)}</b><br>
  Winner: <b>${escapeHtml(text(row.winnerBidderName, 'Pending'))}</b> at <b>${inr(row.winnerBidAmount)}</b><br>
  Target: <b>${escapeHtml(shortTime(row.ledger.targetAt))}</b> | Follow-up: <b>${escapeHtml(shortTime(row.followUpAt))}</b>
</div>
<div style="margin-bottom:8px;">
  ${STAGES.map((stage) => {
    const done = Array.isArray(row.ledger.completedStages) && row.ledger.completedStages.includes(stage.id);
    const when = row.ledger.milestoneAt && row.ledger.milestoneAt[stage.id] ? shortTime(row.ledger.milestoneAt[stage.id]) : '';
    return `<span class="aswr-chip ${done ? 'state-completed' : 'state-open'}">${escapeHtml(stage.label)}${when ? ` (${escapeHtml(when)})` : ''}</span>`;
  }).join('')}
</div>
<div style="margin-bottom:8px;">
  ${row.alerts.length
    ? row.alerts.map((alert) => `<span class="aswr-chip priority-${escapeHtml(alert.severity)}">${escapeHtml(alert.rule)} - ${escapeHtml(alert.severity)}</span>`).join('')
    : '<span style="color:#1f6d3d;">No active SLA alerts</span>'
  }
</div>
<div>
  <b>Latest Notes</b>
  ${notes.length
    ? notes.map((item) => `<div style="border-bottom:1px solid #e1e9f8;padding:6px 0;">${escapeHtml(text(item.text))}<br><small style="color:#6d86a5;">${escapeHtml(shortTime(item.at))} | ${escapeHtml(text(item.by))}</small></div>`).join('')
    : '<p style="margin:6px 0 0;color:#607da8;">No notes logged.</p>'
  }
</div>
`;
  };

  const renderBoard = (rows) => {
    if (!rows.length) {
      ui.board.innerHTML = '<p style="margin:0;color:#607da8;">No settlement cases found for current filters.</p>';
      return;
    }
    ui.board.innerHTML = `
<table>
  <thead>
    <tr>
      <th>Property</th>
      <th>Case</th>
      <th>Winner</th>
      <th>Stage</th>
      <th>SLA</th>
      <th>Signals</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    ${rows.map((row) => {
      const stateKey = text(row.ledger.state, 'open').toLowerCase();
      const priorityKey = text(row.priority, 'medium').toLowerCase();
      const signals = [];
      if (row.isOverdue) signals.push('Overdue');
      if (row.dueSoon) signals.push('Due Soon');
      if (stateKey === 'blocked') signals.push(`Blocked: ${text(row.ledger.blockedReason, 'Reason pending')}`);
      if (row.alerts.length) signals.push(...row.alerts.slice(0, 2).map((alert) => `${alert.rule} (${alert.severity})`));
      return `
      <tr>
        <td><b>${escapeHtml(row.propertyTitle)}</b><br>${escapeHtml(row.propertyId)}<br><small>${escapeHtml(row.location)}, ${escapeHtml(row.city)}</small></td>
        <td>${escapeHtml(row.ledger.caseId)}<br><span class="aswr-chip state-${escapeHtml(stateKey)}">${escapeHtml(stateKey.toUpperCase())}</span><span class="aswr-chip priority-${escapeHtml(priorityKey)}">${escapeHtml(priorityKey.toUpperCase())}</span><br><small>Owner: ${escapeHtml(text(row.ledger.owner, 'Unassigned'))}</small></td>
        <td>${escapeHtml(text(row.winnerBidderName, 'Pending'))}<br>${row.winnerBidAmount ? inr(row.winnerBidAmount) : '-'}</td>
        <td>${row.stageNo}/${STAGES.length} - ${escapeHtml(row.stageLabel)}<br><small>Completed ${row.completedCount}/${STAGES.length}</small></td>
        <td>Target ${escapeHtml(shortTime(row.ledger.targetAt))}<br>${row.hoursToSla ? `${row.hoursToSla.toFixed(1)}h` : '-'}<br>Follow-up ${escapeHtml(shortTime(row.followUpAt))}</td>
        <td>${signals.length ? signals.map((item) => `<span class="aswr-chip">${escapeHtml(item)}</span>`).join('') : '<span style="color:#1f6d3d;">Healthy</span>'}</td>
        <td>
          <div class="aswr-row" style="gap:6px;">
            <button class="aswr-btn alt" data-action="detail" data-property-id="${escapeHtml(row.propertyId)}" type="button">Detail</button>
            <button class="aswr-btn alt" data-action="advance" data-property-id="${escapeHtml(row.propertyId)}" type="button">Advance</button>
            <button class="aswr-btn alt" data-action="block" data-property-id="${escapeHtml(row.propertyId)}" type="button">Block</button>
            <button class="aswr-btn alt" data-action="notify" data-property-id="${escapeHtml(row.propertyId)}" type="button">Notify</button>
          </div>
        </td>
      </tr>`;
    }).join('')}
  </tbody>
</table>`;
  };

  const renderAudit = () => {
    const rows = getAudit();
    if (!rows.length) {
      ui.audit.innerHTML = '<p style="margin:0;color:#607da8;">No settlement audit entries yet.</p>';
      return;
    }
    ui.audit.innerHTML = rows.slice(0, 40).map((item) => `
<div class="aswr-audit-item">
  <b>${escapeHtml(text(item.action, 'refresh').toUpperCase())}</b> - ${escapeHtml(text(item.propertyTitle, item.propertyId || '-'))}<br>
  <small>${escapeHtml(text(item.stage))} | ${escapeHtml(text(item.state))}</small><br>
  ${escapeHtml(text(item.note))}<br>
  <small style="color:#6d86a5;">${escapeHtml(shortTime(item.at))} | ${escapeHtml(text(item.by, 'Admin'))}</small>
</div>`).join('');
  };

  const refresh = (options = {}) => {
    state.rows = buildRows();
    state.filtered = applyFilters(state.rows);
    renderKpis(state.filtered);
    renderBoard(state.filtered);
    renderAudit();
    if (state.selectedPropertyId) renderDetail(state.selectedPropertyId);
    if (!options.silent) setStatus(`Settlement board refreshed (${state.filtered.length} cases).`, true);
  };

  const setAutoRefresh = (seconds, options = {}) => {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
    const value = clamp(Math.round(numberFrom(seconds, 0)), 0, 300);
    if (value > 0) {
      state.timer = setInterval(() => refresh({ silent: true }), value * 1000);
    }
    if (!options.silent) {
      setStatus(value > 0 ? `Auto refresh every ${value}s.` : 'Auto refresh disabled.', true);
    }
  };

  ui.savePrefs?.addEventListener('click', () => {
    const next = getControls();
    setPrefs(next);
    updateTargetsForSla(next.slaHours);
    setAutoRefresh(next.autoSec, { silent: true });
    refresh();
    setStatus('Settlement filters saved.', true);
  });

  ui.refresh?.addEventListener('click', () => refresh());

  ui.export?.addEventListener('click', () => {
    exportCsv(state.filtered);
    setStatus(`CSV exported (${state.filtered.length} rows).`, true);
  });

  [ui.query, ui.stateFilter, ui.priorityFilter, ui.ownerFilter, ui.riskOnly].forEach((element) => {
    element?.addEventListener('input', () => refresh({ silent: true }));
    element?.addEventListener('change', () => refresh({ silent: true }));
  });

  ui.autoSec?.addEventListener('change', () => {
    const value = clamp(Math.round(numberFrom(ui.autoSec.value, 0)), 0, 300);
    setAutoRefresh(value);
    setPrefs({ autoSec: value });
  });

  ui.board?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = text(target.getAttribute('data-action')).toLowerCase();
    const propertyId = text(target.getAttribute('data-property-id'));
    if (!action || !propertyId) return;
    state.selectedPropertyId = propertyId;
    ui.casePropertyId.value = propertyId;
    if (action === 'detail') {
      renderDetail(propertyId);
      return;
    }
    const row = state.rows.find((item) => item.propertyId === propertyId);
    const result = applySettlementAction(row, action);
    if (!result.ok) {
      setStatus(result.message, false);
      return;
    }
    refresh({ silent: true });
    renderDetail(propertyId);
    setStatus(result.message, true);
  });

  ui.applyAction?.addEventListener('click', () => {
    const propertyId = text(ui.casePropertyId.value);
    if (!propertyId) {
      setStatus('Property ID required for case action.', false);
      return;
    }
    const row = state.rows.find((item) => item.propertyId === propertyId);
    const action = text(ui.caseAction.value).toLowerCase();
    const result = applySettlementAction(row, action);
    if (!result.ok) {
      setStatus(result.message, false);
      return;
    }
    state.selectedPropertyId = propertyId;
    refresh({ silent: true });
    renderDetail(propertyId);
    setStatus(result.message, true);
  });

  syncControlsFromPrefs();
  setAutoRefresh(numberFrom(getPrefs().autoSec, 40), { silent: true });
  refresh({ silent: true });
  pushAudit({
    action: 'init',
    by: 'System',
    note: 'Auction settlement war room initialized.',
  });

  window.addEventListener('beforeunload', () => {
    if (state.timer) clearInterval(state.timer);
  });
})();
