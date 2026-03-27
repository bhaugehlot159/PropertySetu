(() => {
  if (document.getElementById('auctionPayoutReconciliationCenterCard')) return;

  const live = window.PropertySetuLive || {};
  const path = String(window.location.pathname || '').toLowerCase();
  const isAdminPage = path.includes('admin-dashboard') || Boolean(document.getElementById('adminOverview'));
  if (!isAdminPage) return;

  const CARD_ID = 'auctionPayoutReconciliationCenterCard';
  const STYLE_ID = 'auction-payout-reconciliation-center-style';
  const LISTINGS_KEY = 'propertySetu:listings';
  const AUCTION_STATE_KEY = 'propertySetu:auctionState';
  const AUCTION_BIDS_KEY = 'propertySetu:auctionBids';
  const SETTLEMENT_LEDGER_KEY = 'propertySetu:auctionSettlementLedger';
  const SLA_ALERTS_KEY = 'propertySetu:auctionSlaAlerts';
  const PREF_KEY = 'propertySetu:auctionPayoutPrefs';
  const LEDGER_KEY = 'propertySetu:auctionPayoutLedger';
  const AUDIT_KEY = 'propertySetu:auctionPayoutAudit';

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
      id: `auction-payout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      message,
      audience,
      type,
      createdAt: nowIso(),
      readBy: {},
    });
    writeJson('propertySetu:notifications', list.slice(0, 900));
  };

  const getPrefs = () => {
    const value = readJson(PREF_KEY, {});
    return {
      query: text(value?.query),
      state: text(value?.state, 'all').toLowerCase(),
      priority: text(value?.priority, 'all').toLowerCase(),
      owner: text(value?.owner, 'all').toLowerCase(),
      riskOnly: Boolean(value?.riskOnly),
      defaultCommissionPct: clamp(numberFrom(value?.defaultCommissionPct, 2), 0, 10),
      payoutSlaHours: clamp(numberFrom(value?.payoutSlaHours, 36), 6, 240),
      autoSec: clamp(Math.round(numberFrom(value?.autoSec, 35)), 0, 300),
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
      id: `auction-payout-audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: nowIso(),
      by: text(entry.by, getAdminName()),
      action: text(entry.action, 'refresh'),
      propertyId: text(entry.propertyId),
      propertyTitle: text(entry.propertyTitle),
      state: text(entry.state),
      note: text(entry.note),
    });
    writeJson(AUDIT_KEY, rows.slice(0, 800));
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
    const value = readJson(AUCTION_STATE_KEY, {});
    return value && typeof value === 'object' ? value : {};
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

  const settlementLedger = () => {
    const value = readJson(SETTLEMENT_LEDGER_KEY, {});
    return value && typeof value === 'object' ? value : {};
  };

  const openSlaByProperty = () => {
    const value = readJson(SLA_ALERTS_KEY, {});
    const map = new Map();
    Object.values(value && typeof value === 'object' ? value : {}).forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const state = text(item.state, 'open').toLowerCase();
      if (state === 'resolved') return;
      const propertyId = text(item.propertyId);
      if (!propertyId) return;
      if (!map.has(propertyId)) map.set(propertyId, []);
      map.get(propertyId).push({
        id: text(item.id),
        rule: text(item.rule),
        severity: text(item.severity, 'low').toLowerCase(),
        note: text(item.note),
        state,
      });
    });
    return map;
  };

  const calcPayout = (row = {}) => {
    const payoutAmount = Math.max(0, Math.round(numberFrom(row.payoutAmount, 0)));
    const commissionPct = clamp(numberFrom(row.commissionPct, 0), 0, 15);
    const commissionAmount = Math.max(0, Math.round(numberFrom(row.commissionAmount, Math.round(payoutAmount * (commissionPct / 100)))));
    const adjustmentAmount = Math.round(numberFrom(row.adjustmentAmount, 0));
    const payableAmount = Math.max(0, payoutAmount - commissionAmount + adjustmentAmount);
    return {
      payoutAmount,
      commissionPct,
      commissionAmount,
      adjustmentAmount,
      payableAmount,
    };
  };

  const ensureLedgerRow = (ledger, row, prefs) => {
    const propertyId = text(row.propertyId);
    if (!propertyId) return null;
    const current = ledger[propertyId] || {};
    const payoutAmount = Math.max(0, Math.round(numberFrom(current.payoutAmount, row.winnerBidAmount)));
    const commissionPct = clamp(numberFrom(current.commissionPct, prefs.defaultCommissionPct), 0, 15);
    const derived = calcPayout({
      payoutAmount,
      commissionPct,
      commissionAmount: current.commissionAmount,
      adjustmentAmount: current.adjustmentAmount,
    });
    const fallbackDueBase = epoch(row.closedAt || row.winnerAcceptedAt || row.settlementTargetAt || nowIso());
    const dueAt = text(current.dueAt)
      || new Date(fallbackDueBase + prefs.payoutSlaHours * 3600000).toISOString();
    const tokenExpected = Math.max(
      1000,
      Math.round(numberFrom(current.tokenExpected, Math.round(payoutAmount * 0.1)))
    );
    const tokenReceived = Math.max(0, Math.round(numberFrom(current.tokenReceived, 0)));
    const state = text(current.state, 'pending').toLowerCase();
    const normalizedState = ['pending', 'partial', 'released', 'hold', 'refunded'].includes(state) ? state : 'pending';

    const next = {
      propertyId,
      caseId: text(current.caseId, `PAY-${propertyId.slice(0, 6).toUpperCase()}-${String(Date.now()).slice(-6)}`),
      owner: text(current.owner, text(row.settlementOwner)),
      priority: text(current.priority, text(row.settlementPriority, 'medium')).toLowerCase(),
      state: normalizedState,
      payoutAmount: derived.payoutAmount,
      commissionPct: derived.commissionPct,
      commissionAmount: derived.commissionAmount,
      adjustmentAmount: derived.adjustmentAmount,
      payableAmount: derived.payableAmount,
      tokenExpected,
      tokenReceived,
      dueAt,
      followUpAt: text(current.followUpAt),
      holdReason: text(current.holdReason),
      releasedAt: text(current.releasedAt),
      refundedAt: text(current.refundedAt),
      refundedAmount: Math.max(0, Math.round(numberFrom(current.refundedAmount, 0))),
      notes: Array.isArray(current.notes) ? current.notes.slice(0, 80) : [],
      notifyCount: Math.max(0, Math.round(numberFrom(current.notifyCount, 0))),
      lastNotifiedAt: text(current.lastNotifiedAt),
      createdAt: text(current.createdAt, nowIso()),
      updatedAt: nowIso(),
    };

    if (next.state === 'released' && !next.releasedAt) next.releasedAt = nowIso();
    if (next.state === 'refunded' && !next.refundedAt) next.refundedAt = nowIso();
    ledger[propertyId] = next;
    return next;
  };

  const buildRows = () => {
    const prefs = getPrefs();
    const listings = listingMap();
    const auctions = auctionMap();
    const bids = allBids();
    const settlement = settlementLedger();
    const sla = openSlaByProperty();
    const ledger = getLedgerMap();
    const rows = [];

    const ids = new Set();
    Object.keys(auctions).forEach((id) => ids.add(text(id)));
    bids.forEach((item) => ids.add(text(item.propertyId)));
    Object.keys(settlement).forEach((id) => ids.add(text(id)));
    Object.keys(ledger).forEach((id) => ids.add(text(id)));

    ids.forEach((propertyId) => {
      if (!propertyId) return;
      const auction = auctions[propertyId] || {};
      const rawStatus = text(auction.status, '').toLowerCase();
      const bidRows = bids.filter((item) => item.propertyId === propertyId);
      const highestBid = bidRows[0] || null;
      const winnerBid = bidRows.find((item) => item.id === text(auction.winnerBidId)) || highestBid;
      const hasWinner = Boolean(winnerBid);
      const settlementRow = settlement[propertyId] && typeof settlement[propertyId] === 'object' ? settlement[propertyId] : {};
      const settlementState = text(settlementRow.state).toLowerCase();

      const isCandidate = (
        rawStatus === 'settled'
        || Boolean(auction.winnerBidId)
        || settlementState === 'completed'
        || settlementState === 'open'
        || settlementState === 'blocked'
      ) && hasWinner;
      if (!isCandidate) return;

      const listing = listings.get(propertyId) || {
        id: propertyId,
        title: propertyId,
        city: 'Udaipur',
        location: 'Udaipur',
        ownerId: '',
      };

      const ledgerRow = ensureLedgerRow(ledger, {
        propertyId,
        winnerBidAmount: winnerBid ? winnerBid.amount : 0,
        closedAt: text(auction.closedAt || auction.closesAt),
        winnerAcceptedAt: text(auction.winnerAcceptedAt),
        settlementTargetAt: text(settlementRow.targetAt),
        settlementOwner: text(settlementRow.owner),
        settlementPriority: text(settlementRow.priority),
      }, prefs);
      if (!ledgerRow) return;

      const alerts = sla.get(propertyId) || [];
      const dueEpoch = epoch(ledgerRow.dueAt);
      const followUpEpoch = epoch(ledgerRow.followUpAt);
      const hoursToDue = dueEpoch ? (dueEpoch - Date.now()) / 3600000 : 0;
      const overdue = !['released', 'refunded'].includes(ledgerRow.state) && dueEpoch && hoursToDue < 0;
      const dueSoon = !['released', 'refunded'].includes(ledgerRow.state) && dueEpoch && hoursToDue >= 0 && hoursToDue <= 8;
      const followUpDue = !['released', 'refunded'].includes(ledgerRow.state) && followUpEpoch && followUpEpoch <= Date.now();
      const tokenGap = Math.max(0, ledgerRow.tokenExpected - ledgerRow.tokenReceived);
      const outstanding = ['released', 'refunded'].includes(ledgerRow.state) ? 0 : ledgerRow.payableAmount;

      const severityScore = alerts.reduce((score, item) => {
        if (item.severity === 'critical') return score + 3;
        if (item.severity === 'high') return score + 2;
        if (item.severity === 'medium') return score + 1;
        return score;
      }, 0);
      const riskScore = (
        (ledgerRow.state === 'hold' ? 2 : 0)
        + (overdue ? 3 : 0)
        + (dueSoon ? 1 : 0)
        + (followUpDue ? 1 : 0)
        + (tokenGap > 0 ? 1 : 0)
        + severityScore
      );

      rows.push({
        propertyId,
        propertyTitle: listing.title,
        city: listing.city,
        location: listing.location,
        sellerId: listing.ownerId,
        auctionStatus: rawStatus || 'settled',
        winnerBidAmount: winnerBid ? winnerBid.amount : 0,
        winnerBidId: winnerBid ? winnerBid.id : '',
        winnerBidderId: winnerBid ? winnerBid.bidderId : '',
        winnerBidderName: winnerBid ? winnerBid.bidderName : '',
        ledger: ledgerRow,
        alerts,
        dueEpoch,
        hoursToDue,
        overdue,
        dueSoon,
        followUpDue,
        tokenGap,
        outstanding,
        riskScore,
      });
    });

    setLedgerMap(ledger);
    return rows.sort((a, b) => {
      const stateRank = { hold: 0, pending: 1, partial: 2, released: 3, refunded: 4 };
      const stateDiff = (stateRank[text(a.ledger.state, 'pending')] ?? 9) - (stateRank[text(b.ledger.state, 'pending')] ?? 9);
      if (stateDiff !== 0) return stateDiff;
      const riskDiff = b.riskScore - a.riskScore;
      if (riskDiff !== 0) return riskDiff;
      return epoch(a.ledger.dueAt) - epoch(b.ledger.dueAt);
    });
  };

  const priorityRank = (value) => {
    const key = text(value, 'medium').toLowerCase();
    if (key === 'critical') return 4;
    if (key === 'high') return 3;
    if (key === 'medium') return 2;
    return 1;
  };

  const syncSettlementMilestone = (propertyId, milestoneId) => {
    const settlement = settlementLedger();
    const row = settlement[propertyId];
    if (!row || typeof row !== 'object') return;
    const completed = Array.isArray(row.completedStages)
      ? row.completedStages.map((item) => text(item)).filter(Boolean)
      : [];
    const set = new Set(completed);
    if (milestoneId === 'payout_release') set.add('payout_release');
    if (milestoneId === 'handover_complete') {
      set.add('payout_release');
      set.add('handover_complete');
    }
    row.completedStages = Array.from(set);
    row.milestoneAt = {
      ...(row.milestoneAt && typeof row.milestoneAt === 'object' ? row.milestoneAt : {}),
      [milestoneId]: nowIso(),
    };
    const ordered = ['winner_confirmation', 'token_collection', 'kyc_verification', 'legal_docs', 'payout_release', 'handover_complete'];
    const nextStage = ordered.find((stage) => !set.has(stage)) || 'handover_complete';
    row.stage = nextStage;
    if (set.has('handover_complete')) row.state = 'completed';
    row.updatedAt = nowIso();
    settlement[propertyId] = row;
    writeJson(SETTLEMENT_LEDGER_KEY, settlement);
  };

  const applyPayoutAction = (row, action) => {
    if (!row) return { ok: false, message: 'Payout case not found.' };
    const ledger = getLedgerMap();
    const current = ledger[row.propertyId];
    if (!current) return { ok: false, message: 'Payout ledger missing.' };

    const lowerAction = text(action).toLowerCase();
    const admin = getAdminName();
    const now = nowIso();
    let message = '';

    if (lowerAction === 'collect-token') {
      const raw = window.prompt('Token amount received (INR):', String(Math.max(1000, row.tokenGap || current.tokenExpected || 0)));
      if (raw === null) return { ok: false, message: 'Token update cancelled.' };
      const amount = Math.max(0, Math.round(numberFrom(raw, 0)));
      if (!amount) return { ok: false, message: 'Token amount must be greater than zero.' };
      current.tokenReceived = Math.max(0, Math.round(numberFrom(current.tokenReceived, 0))) + amount;
      if (current.state !== 'hold' && current.state !== 'released' && current.state !== 'refunded') {
        current.state = current.tokenReceived >= current.tokenExpected ? 'pending' : 'partial';
      }
      message = `Token updated: +${inr(amount)}.`;
    } else if (lowerAction === 'adjust') {
      const raw = window.prompt('Adjustment amount (+/- INR):', String(Math.round(numberFrom(current.adjustmentAmount, 0))));
      if (raw === null) return { ok: false, message: 'Adjustment cancelled.' };
      current.adjustmentAmount = Math.round(numberFrom(raw, 0));
      message = `Adjustment set to ${inr(current.adjustmentAmount)}.`;
    } else if (lowerAction === 'commission') {
      const raw = window.prompt('Commission %:', String(numberFrom(current.commissionPct, getPrefs().defaultCommissionPct)));
      if (raw === null) return { ok: false, message: 'Commission update cancelled.' };
      current.commissionPct = clamp(numberFrom(raw, getPrefs().defaultCommissionPct), 0, 15);
      message = `Commission set to ${current.commissionPct.toFixed(2)}%.`;
    } else if (lowerAction === 'release') {
      if (text(current.state) === 'hold') return { ok: false, message: 'Case is on hold. Clear hold before releasing payout.' };
      const tokenGap = Math.max(0, Math.round(numberFrom(current.tokenExpected, 0)) - Math.round(numberFrom(current.tokenReceived, 0)));
      if (tokenGap > 0) return { ok: false, message: `Token short by ${inr(tokenGap)}.` };
      current.state = 'released';
      current.releasedAt = now;
      current.holdReason = '';
      message = `Payout released successfully (${inr(current.payableAmount)}).`;
      syncSettlementMilestone(row.propertyId, 'payout_release');
    } else if (lowerAction === 'hold') {
      const reason = window.prompt('Hold reason:', text(current.holdReason, 'Compliance review pending'));
      if (reason === null) return { ok: false, message: 'Hold action cancelled.' };
      current.state = 'hold';
      current.holdReason = text(reason, 'On hold');
      message = `Case put on hold: ${current.holdReason}`;
    } else if (lowerAction === 'clear-hold') {
      current.state = current.tokenReceived >= current.tokenExpected ? 'pending' : 'partial';
      current.holdReason = '';
      message = 'Hold removed.';
    } else if (lowerAction === 'refund') {
      const raw = window.prompt('Refund amount (INR):', String(Math.max(0, Math.round(numberFrom(current.refundedAmount, current.payableAmount)))));
      if (raw === null) return { ok: false, message: 'Refund action cancelled.' };
      const amount = Math.max(0, Math.round(numberFrom(raw, 0)));
      if (!amount) return { ok: false, message: 'Refund amount must be greater than zero.' };
      current.state = 'refunded';
      current.refundedAmount = amount;
      current.refundedAt = now;
      message = `Refund marked: ${inr(amount)}.`;
    } else if (lowerAction === 'assign') {
      const owner = window.prompt('Assign owner:', text(current.owner, getAdminName()));
      if (owner === null) return { ok: false, message: 'Assign action cancelled.' };
      current.owner = text(owner);
      message = current.owner ? `Owner assigned to ${current.owner}.` : 'Owner cleared.';
    } else if (lowerAction === 'priority') {
      const value = window.prompt('Priority (low/medium/high/critical):', text(current.priority, 'medium'));
      if (value === null) return { ok: false, message: 'Priority update cancelled.' };
      const key = text(value, 'medium').toLowerCase();
      current.priority = ['low', 'medium', 'high', 'critical'].includes(key) ? key : 'medium';
      message = `Priority set to ${current.priority}.`;
    } else if (lowerAction === 'followup') {
      const raw = window.prompt('Follow-up after hours:', '12');
      if (raw === null) return { ok: false, message: 'Follow-up update cancelled.' };
      const hours = clamp(numberFrom(raw, 12), 1, 240);
      current.followUpAt = new Date(Date.now() + hours * 3600000).toISOString();
      message = `Follow-up scheduled in ${hours}h.`;
    } else if (lowerAction === 'note') {
      const note = window.prompt('Add payout note:', '');
      if (note === null) return { ok: false, message: 'Note cancelled.' };
      const payload = text(note);
      if (!payload) return { ok: false, message: 'Empty note ignored.' };
      const notes = Array.isArray(current.notes) ? current.notes : [];
      notes.unshift({ at: now, by: admin, text: payload });
      current.notes = notes.slice(0, 100);
      message = 'Note added.';
    } else if (lowerAction === 'notify') {
      pushNotification(
        `Auction payout update - ${row.propertyTitle}`,
        `Case ${current.caseId} | State ${current.state.toUpperCase()} | Payable ${inr(current.payableAmount)}`,
        ['admin', 'seller', 'customer'],
        priorityRank(current.priority) >= 3 ? 'warn' : 'info'
      );
      current.lastNotifiedAt = now;
      current.notifyCount = Math.max(0, Math.round(numberFrom(current.notifyCount, 0))) + 1;
      message = 'Stakeholders notified.';
    } else if (lowerAction === 'recalc') {
      current.payoutAmount = Math.max(0, Math.round(numberFrom(current.payoutAmount, row.winnerBidAmount)));
      message = 'Payout values recalculated.';
    } else {
      return { ok: false, message: 'Unknown payout action.' };
    }

    const recalculated = calcPayout(current);
    current.payoutAmount = recalculated.payoutAmount;
    current.commissionPct = recalculated.commissionPct;
    current.commissionAmount = recalculated.commissionAmount;
    current.adjustmentAmount = recalculated.adjustmentAmount;
    current.payableAmount = recalculated.payableAmount;

    if (!current.dueAt) {
      const prefs = getPrefs();
      current.dueAt = new Date(Date.now() + prefs.payoutSlaHours * 3600000).toISOString();
    }
    current.updatedAt = now;
    ledger[row.propertyId] = current;
    setLedgerMap(ledger);

    pushAudit({
      by: admin,
      action: lowerAction,
      propertyId: row.propertyId,
      propertyTitle: row.propertyTitle,
      state: current.state,
      note: message,
    });
    if (lowerAction !== 'notify') {
      pushNotification(`Payout action - ${row.propertyTitle}`, message, ['admin'], 'info');
    }
    return { ok: true, message };
  };

  const exportCsv = (rows) => {
    const header = [
      'propertyId',
      'propertyTitle',
      'caseId',
      'state',
      'priority',
      'owner',
      'winnerBidAmount',
      'payoutAmount',
      'commissionPct',
      'commissionAmount',
      'adjustmentAmount',
      'payableAmount',
      'tokenExpected',
      'tokenReceived',
      'dueAt',
      'followUpAt',
      'riskScore',
    ];
    const lines = rows.map((row) => [
      row.propertyId,
      row.propertyTitle,
      row.ledger.caseId,
      row.ledger.state,
      row.ledger.priority,
      row.ledger.owner,
      row.winnerBidAmount,
      row.ledger.payoutAmount,
      row.ledger.commissionPct,
      row.ledger.commissionAmount,
      row.ledger.adjustmentAmount,
      row.ledger.payableAmount,
      row.ledger.tokenExpected,
      row.ledger.tokenReceived,
      row.ledger.dueAt,
      row.ledger.followUpAt,
      row.riskScore,
    ].map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = `${header.join(',')}\n${lines.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `auction-payout-reconciliation-${Date.now()}.csv`;
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
#${CARD_ID} .aprc-card{border:1px solid #d6e1f5;border-radius:10px;background:#fff;padding:10px}
#${CARD_ID} .aprc-grid{display:grid;gap:10px}
#${CARD_ID} .aprc-grid.cols{grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}
#${CARD_ID} label{display:block;font-size:12px;color:#35597d;margin-bottom:4px}
#${CARD_ID} input,#${CARD_ID} select{width:100%;border:1px solid #cad9ef;border-radius:8px;padding:8px 10px;box-sizing:border-box}
#${CARD_ID} .aprc-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
#${CARD_ID} .aprc-btn{border:1px solid #0b3d91;background:#0b3d91;color:#fff;border-radius:8px;padding:8px 12px;cursor:pointer;font-weight:700}
#${CARD_ID} .aprc-btn.alt{background:#fff;color:#0b3d91}
#${CARD_ID} .aprc-chip{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;margin:2px 6px 2px 0;background:#e9f0ff;color:#1f3e7a}
#${CARD_ID} .aprc-chip.state-pending{background:#e8f2ff;color:#1d4c84}
#${CARD_ID} .aprc-chip.state-partial{background:#fff1d6;color:#7a4f00}
#${CARD_ID} .aprc-chip.state-hold{background:#ffe8e8;color:#8d1e1e}
#${CARD_ID} .aprc-chip.state-released{background:#e7f7ed;color:#11663e}
#${CARD_ID} .aprc-chip.state-refunded{background:#f0ebff;color:#4d3d8f}
#${CARD_ID} .aprc-chip.priority-low{background:#deecff;color:#1d4b84}
#${CARD_ID} .aprc-chip.priority-medium{background:#fff1d6;color:#7a4f00}
#${CARD_ID} .aprc-chip.priority-high{background:#ffd8c9;color:#8a2b08}
#${CARD_ID} .aprc-chip.priority-critical{background:#8f1a1a;color:#fff}
#${CARD_ID} .aprc-kpis{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin-top:10px}
#${CARD_ID} .aprc-kpi{border:1px solid #d6e1f5;border-radius:8px;background:#f8fbff;padding:8px}
#${CARD_ID} .aprc-kpi small{display:block;color:#58718f}
#${CARD_ID} table{width:100%;border-collapse:collapse}
#${CARD_ID} th,#${CARD_ID} td{border:1px solid #d6e1f5;padding:8px;text-align:left;vertical-align:top}
#${CARD_ID} th{background:#f4f8ff;color:#11466e}
#${CARD_ID} .aprc-audit{max-height:220px;overflow:auto}
#${CARD_ID} .aprc-audit-item{border-bottom:1px solid #e1e9f8;padding:7px 0;color:#325176;font-size:13px}
@media (max-width:768px){#${CARD_ID} .aprc-row{display:grid;grid-template-columns:1fr}}
`;
    document.head.appendChild(style);
  }

  const shell = document.createElement('section');
  shell.id = CARD_ID;
  shell.className = 'container';
  shell.innerHTML = `
<div class="aprc-card">
  <h2 style="margin:0 0 8px;">Auction Payout Reconciliation Center</h2>
  <p style="margin:0;color:#1d4068;">Finance control board for payout readiness, token tracking, release/hold/refund actions, and settlement milestone sync.</p>
</div>
<div class="aprc-card" style="margin-top:10px;">
  <div class="aprc-grid cols">
    <div><label for="aprcQuery">Search</label><input id="aprcQuery" placeholder="Property, case, winner"></div>
    <div><label for="aprcStateFilter">State</label><select id="aprcStateFilter"><option value="all">All</option><option value="pending">Pending</option><option value="partial">Partial</option><option value="hold">Hold</option><option value="released">Released</option><option value="refunded">Refunded</option></select></div>
    <div><label for="aprcPriorityFilter">Priority</label><select id="aprcPriorityFilter"><option value="all">All</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></div>
    <div><label for="aprcOwnerFilter">Owner</label><select id="aprcOwnerFilter"><option value="all">All</option><option value="unassigned">Unassigned</option><option value="mine">Assigned To Me</option></select></div>
    <div><label for="aprcRiskOnly">Risk Focus</label><select id="aprcRiskOnly"><option value="0">No</option><option value="1">Yes</option></select></div>
    <div><label for="aprcCommissionDefault">Default Commission %</label><input id="aprcCommissionDefault" type="number" min="0" max="10" step="0.25"></div>
    <div><label for="aprcSlaHours">Payout SLA (hours)</label><input id="aprcSlaHours" type="number" min="6" max="240" step="1"></div>
    <div><label for="aprcAutoSec">Auto Refresh (sec)</label><input id="aprcAutoSec" type="number" min="0" max="300" step="5"></div>
  </div>
  <div class="aprc-row" style="margin-top:10px;">
    <button id="aprcSaveFilters" class="aprc-btn alt" type="button">Save Filters</button>
    <button id="aprcRefresh" class="aprc-btn" type="button">Refresh Board</button>
    <button id="aprcExport" class="aprc-btn alt" type="button">Export CSV</button>
    <span id="aprcStatus" class="aprc-chip">Ready</span>
  </div>
</div>
<div class="aprc-card" style="margin-top:10px;">
  <h3 style="margin:0 0 8px;">Payout Action Desk</h3>
  <div class="aprc-row">
    <input id="aprcPropertyId" placeholder="Property ID" style="flex:1 1 180px;">
    <select id="aprcAction" style="min-width:200px;">
      <option value="collect-token">Collect Token</option>
      <option value="adjust">Set Adjustment</option>
      <option value="commission">Set Commission %</option>
      <option value="release">Release Payout</option>
      <option value="hold">Put On Hold</option>
      <option value="clear-hold">Clear Hold</option>
      <option value="refund">Mark Refund</option>
      <option value="assign">Assign Owner</option>
      <option value="priority">Update Priority</option>
      <option value="followup">Set Follow-up</option>
      <option value="note">Add Note</option>
      <option value="notify">Notify</option>
      <option value="recalc">Recalculate</option>
    </select>
    <button id="aprcApply" class="aprc-btn" type="button">Apply</button>
  </div>
</div>
<div id="aprcKpis" class="aprc-kpis"></div>
<div class="aprc-card" style="margin-top:10px;">
  <h3 style="margin:0 0 8px;">Payout Board</h3>
  <div id="aprcBoard" style="overflow:auto;"></div>
</div>
<div class="aprc-card" style="margin-top:10px;">
  <h3 style="margin:0 0 8px;">Payout Detail</h3>
  <div id="aprcDetail" style="overflow:auto;color:#325176;">Select a payout case from board.</div>
</div>
<div class="aprc-card" style="margin-top:10px;">
  <h3 style="margin:0 0 8px;">Payout Audit Feed</h3>
  <div id="aprcAudit" class="aprc-audit"></div>
</div>
`;

  const anchor = document.getElementById('auctionSettlementWarRoomCard')
    || document.getElementById('auctionSlaEscalationCenterCard')
    || document.getElementById('auctionUnifiedAnalyticsTimelineCard')
    || document.getElementById('adminAuctionControlCenter')
    || document.querySelector('.container');
  if (anchor?.parentElement) anchor.insertAdjacentElement('afterend', shell);
  else document.body.appendChild(shell);

  const ui = {
    query: document.getElementById('aprcQuery'),
    stateFilter: document.getElementById('aprcStateFilter'),
    priorityFilter: document.getElementById('aprcPriorityFilter'),
    ownerFilter: document.getElementById('aprcOwnerFilter'),
    riskOnly: document.getElementById('aprcRiskOnly'),
    commissionDefault: document.getElementById('aprcCommissionDefault'),
    slaHours: document.getElementById('aprcSlaHours'),
    autoSec: document.getElementById('aprcAutoSec'),
    saveFilters: document.getElementById('aprcSaveFilters'),
    refresh: document.getElementById('aprcRefresh'),
    export: document.getElementById('aprcExport'),
    status: document.getElementById('aprcStatus'),
    propertyId: document.getElementById('aprcPropertyId'),
    action: document.getElementById('aprcAction'),
    apply: document.getElementById('aprcApply'),
    kpis: document.getElementById('aprcKpis'),
    board: document.getElementById('aprcBoard'),
    detail: document.getElementById('aprcDetail'),
    audit: document.getElementById('aprcAudit'),
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
    ui.commissionDefault.value = String(prefs.defaultCommissionPct);
    ui.slaHours.value = String(prefs.payoutSlaHours);
    ui.autoSec.value = String(prefs.autoSec);
  };

  const getControls = () => ({
    query: text(ui.query.value),
    state: text(ui.stateFilter.value, 'all').toLowerCase(),
    priority: text(ui.priorityFilter.value, 'all').toLowerCase(),
    owner: text(ui.ownerFilter.value, 'all').toLowerCase(),
    riskOnly: text(ui.riskOnly.value) === '1',
    defaultCommissionPct: clamp(numberFrom(ui.commissionDefault.value, 2), 0, 10),
    payoutSlaHours: clamp(numberFrom(ui.slaHours.value, 36), 6, 240),
    autoSec: clamp(Math.round(numberFrom(ui.autoSec.value, 35)), 0, 300),
  });

  const updateDueTargets = (hours) => {
    const map = getLedgerMap();
    let touched = 0;
    Object.values(map).forEach((row) => {
      if (!row || typeof row !== 'object') return;
      if (['released', 'refunded'].includes(text(row.state, 'pending').toLowerCase())) return;
      const base = epoch(row.createdAt) || Date.now();
      row.dueAt = new Date(base + hours * 3600000).toISOString();
      row.updatedAt = nowIso();
      touched += 1;
    });
    if (touched > 0) setLedgerMap(map);
  };

  const applyFilters = (rows) => {
    const filter = getControls();
    const query = filter.query.toLowerCase();
    const me = getAdminName().toLowerCase();
    return rows.filter((row) => {
      const stateKey = text(row.ledger.state, 'pending').toLowerCase();
      const priorityKey = text(row.ledger.priority, 'medium').toLowerCase();
      if (filter.state !== 'all' && stateKey !== filter.state) return false;
      if (filter.priority !== 'all' && priorityKey !== filter.priority) return false;
      if (filter.owner === 'unassigned' && text(row.ledger.owner)) return false;
      if (filter.owner === 'mine' && text(row.ledger.owner).toLowerCase() !== me) return false;
      if (filter.riskOnly && row.riskScore <= 0) return false;
      if (!query) return true;
      return [
        row.propertyId,
        row.propertyTitle,
        row.ledger.caseId,
        row.winnerBidderName,
      ].some((value) => text(value).toLowerCase().includes(query));
    });
  };

  const renderKpis = (rows) => {
    const total = rows.length;
    const pending = rows.filter((row) => ['pending', 'partial'].includes(text(row.ledger.state, 'pending'))).length;
    const hold = rows.filter((row) => text(row.ledger.state, 'pending') === 'hold').length;
    const released = rows.filter((row) => text(row.ledger.state, 'pending') === 'released').length;
    const refunded = rows.filter((row) => text(row.ledger.state, 'pending') === 'refunded').length;
    const overdue = rows.filter((row) => row.overdue).length;
    const outstanding = rows.reduce((sum, row) => sum + numberFrom(row.outstanding, 0), 0);
    const tokenGap = rows.reduce((sum, row) => sum + numberFrom(row.tokenGap, 0), 0);
    ui.kpis.innerHTML = `
<div class="aprc-kpi"><small>Total Cases</small><strong>${total}</strong></div>
<div class="aprc-kpi"><small>Pending/Partial</small><strong>${pending}</strong></div>
<div class="aprc-kpi"><small>Hold</small><strong>${hold}</strong></div>
<div class="aprc-kpi"><small>Released</small><strong>${released}</strong></div>
<div class="aprc-kpi"><small>Refunded</small><strong>${refunded}</strong></div>
<div class="aprc-kpi"><small>Overdue</small><strong>${overdue}</strong></div>
<div class="aprc-kpi"><small>Outstanding</small><strong>${inr(outstanding)}</strong></div>
<div class="aprc-kpi"><small>Token Gap</small><strong>${inr(tokenGap)}</strong></div>`;
  };

  const renderDetail = (propertyId) => {
    const row = state.filtered.find((item) => item.propertyId === propertyId)
      || state.rows.find((item) => item.propertyId === propertyId);
    if (!row) {
      ui.detail.innerHTML = '<p style="margin:0;color:#607da8;">Select a payout case from board.</p>';
      return;
    }
    const notes = Array.isArray(row.ledger.notes) ? row.ledger.notes.slice(0, 12) : [];
    ui.detail.innerHTML = `
<div style="margin-bottom:8px;">
  <b>${escapeHtml(row.propertyTitle)}</b> (${escapeHtml(row.propertyId)})<br>
  Case: <b>${escapeHtml(row.ledger.caseId)}</b> | Owner: <b>${escapeHtml(text(row.ledger.owner, 'Unassigned'))}</b><br>
  Winner: <b>${escapeHtml(text(row.winnerBidderName, 'N/A'))}</b> | Winning Bid: <b>${inr(row.winnerBidAmount)}</b><br>
  Due: <b>${escapeHtml(shortTime(row.ledger.dueAt))}</b> | Follow-up: <b>${escapeHtml(shortTime(row.ledger.followUpAt))}</b>
</div>
<div style="margin-bottom:8px;">
  <span class="aprc-chip state-${escapeHtml(text(row.ledger.state, 'pending'))}">${escapeHtml(text(row.ledger.state, 'pending').toUpperCase())}</span>
  <span class="aprc-chip priority-${escapeHtml(text(row.ledger.priority, 'medium'))}">${escapeHtml(text(row.ledger.priority, 'medium').toUpperCase())}</span>
  ${row.alerts.length ? row.alerts.map((alert) => `<span class="aprc-chip">${escapeHtml(alert.rule)} (${escapeHtml(alert.severity)})</span>`).join('') : '<span style="color:#1f6d3d;">No active SLA risk</span>'}
</div>
<div style="margin-bottom:8px;">
  Payout: <b>${inr(row.ledger.payoutAmount)}</b> | Commission: <b>${row.ledger.commissionPct.toFixed(2)}% (${inr(row.ledger.commissionAmount)})</b> |
  Adjustment: <b>${inr(row.ledger.adjustmentAmount)}</b> | Payable: <b>${inr(row.ledger.payableAmount)}</b><br>
  Token: <b>${inr(row.ledger.tokenReceived)}</b> / ${inr(row.ledger.tokenExpected)} (Gap ${inr(row.tokenGap)})
</div>
<div>
  <b>Latest Notes</b>
  ${notes.length
    ? notes.map((item) => `<div style="border-bottom:1px solid #e1e9f8;padding:6px 0;">${escapeHtml(text(item.text))}<br><small style="color:#6d86a5;">${escapeHtml(shortTime(item.at))} | ${escapeHtml(text(item.by))}</small></div>`).join('')
    : '<p style="margin:6px 0 0;color:#607da8;">No payout notes logged.</p>'
  }
</div>
`;
  };

  const renderBoard = (rows) => {
    if (!rows.length) {
      ui.board.innerHTML = '<p style="margin:0;color:#607da8;">No payout cases for current filters.</p>';
      return;
    }
    ui.board.innerHTML = `
<table>
  <thead>
    <tr>
      <th>Property</th>
      <th>Case</th>
      <th>Amounts</th>
      <th>Token</th>
      <th>SLA</th>
      <th>Signals</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    ${rows.map((row) => {
      const stateKey = text(row.ledger.state, 'pending').toLowerCase();
      const priorityKey = text(row.ledger.priority, 'medium').toLowerCase();
      const signals = [];
      if (row.overdue) signals.push('Overdue');
      if (row.dueSoon) signals.push('Due Soon');
      if (row.followUpDue) signals.push('Follow-up due');
      if (stateKey === 'hold') signals.push(`Hold: ${text(row.ledger.holdReason, 'Reason pending')}`);
      if (row.alerts.length) signals.push(...row.alerts.slice(0, 2).map((item) => `${item.rule} (${item.severity})`));
      return `
      <tr>
        <td><b>${escapeHtml(row.propertyTitle)}</b><br>${escapeHtml(row.propertyId)}<br><small>${escapeHtml(row.location)}, ${escapeHtml(row.city)}</small></td>
        <td>${escapeHtml(row.ledger.caseId)}<br><span class="aprc-chip state-${escapeHtml(stateKey)}">${escapeHtml(stateKey.toUpperCase())}</span><span class="aprc-chip priority-${escapeHtml(priorityKey)}">${escapeHtml(priorityKey.toUpperCase())}</span><br><small>Owner: ${escapeHtml(text(row.ledger.owner, 'Unassigned'))}</small></td>
        <td>Bid ${inr(row.winnerBidAmount)}<br>Payable ${inr(row.ledger.payableAmount)}<br><small>Comm ${row.ledger.commissionPct.toFixed(2)}%</small></td>
        <td>${inr(row.ledger.tokenReceived)} / ${inr(row.ledger.tokenExpected)}<br>Gap ${inr(row.tokenGap)}</td>
        <td>Due ${escapeHtml(shortTime(row.ledger.dueAt))}<br>${row.hoursToDue ? `${row.hoursToDue.toFixed(1)}h` : '-'}<br>Follow-up ${escapeHtml(shortTime(row.ledger.followUpAt))}</td>
        <td>${signals.length ? signals.map((item) => `<span class="aprc-chip">${escapeHtml(item)}</span>`).join('') : '<span style="color:#1f6d3d;">Healthy</span>'}</td>
        <td>
          <div class="aprc-row" style="gap:6px;">
            <button class="aprc-btn alt" data-action="detail" data-property-id="${escapeHtml(row.propertyId)}" type="button">Detail</button>
            <button class="aprc-btn alt" data-action="release" data-property-id="${escapeHtml(row.propertyId)}" type="button">Release</button>
            <button class="aprc-btn alt" data-action="hold" data-property-id="${escapeHtml(row.propertyId)}" type="button">Hold</button>
            <button class="aprc-btn alt" data-action="notify" data-property-id="${escapeHtml(row.propertyId)}" type="button">Notify</button>
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
      ui.audit.innerHTML = '<p style="margin:0;color:#607da8;">No payout audit entries yet.</p>';
      return;
    }
    ui.audit.innerHTML = rows.slice(0, 40).map((item) => `
<div class="aprc-audit-item">
  <b>${escapeHtml(text(item.action, 'refresh').toUpperCase())}</b> - ${escapeHtml(text(item.propertyTitle, item.propertyId || '-'))}<br>
  <small>${escapeHtml(text(item.state, '-'))}</small><br>
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
    if (!options.silent) {
      setStatus(`Payout board refreshed (${state.filtered.length} cases).`, true);
    }
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

  ui.saveFilters?.addEventListener('click', () => {
    const next = getControls();
    setPrefs(next);
    updateDueTargets(next.payoutSlaHours);
    setAutoRefresh(next.autoSec, { silent: true });
    refresh();
    setStatus('Payout filters saved.', true);
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
    setPrefs({ autoSec: value });
    setAutoRefresh(value);
  });

  ui.board?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = text(target.getAttribute('data-action')).toLowerCase();
    const propertyId = text(target.getAttribute('data-property-id'));
    if (!action || !propertyId) return;
    state.selectedPropertyId = propertyId;
    ui.propertyId.value = propertyId;
    if (action === 'detail') {
      renderDetail(propertyId);
      return;
    }
    const row = state.rows.find((item) => item.propertyId === propertyId);
    const result = applyPayoutAction(row, action);
    if (!result.ok) {
      setStatus(result.message, false);
      return;
    }
    refresh({ silent: true });
    renderDetail(propertyId);
    setStatus(result.message, true);
  });

  ui.apply?.addEventListener('click', () => {
    const propertyId = text(ui.propertyId.value);
    if (!propertyId) {
      setStatus('Property ID required for payout action.', false);
      return;
    }
    const row = state.rows.find((item) => item.propertyId === propertyId);
    const action = text(ui.action.value).toLowerCase();
    const result = applyPayoutAction(row, action);
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
  setAutoRefresh(numberFrom(getPrefs().autoSec, 35), { silent: true });
  refresh({ silent: true });
  pushAudit({
    action: 'init',
    by: 'System',
    note: 'Auction payout reconciliation center initialized.',
  });

  window.addEventListener('beforeunload', () => {
    if (state.timer) clearInterval(state.timer);
  });
})();
