(() => {
  if (document.getElementById('auctionSlaEscalationCenterCard')) return;

  const live = window.PropertySetuLive || {};
  const path = String(window.location.pathname || '').toLowerCase();
  const isAdminPage = path.includes('admin-dashboard') || Boolean(document.getElementById('adminOverview'));
  if (!isAdminPage) return;

  const CARD_ID = 'auctionSlaEscalationCenterCard';
  const STYLE_ID = 'auction-sla-escalation-center-style';
  const LISTINGS_KEY = 'propertySetu:listings';
  const AUCTION_STATE_KEY = 'propertySetu:auctionState';
  const AUCTION_BIDS_KEY = 'propertySetu:auctionBids';
  const CUSTOMER_AUDIT_KEY = 'propertySetu:auctionAudit';
  const SELLER_AUDIT_KEY = 'propertySetu:auctionSellerAudit';
  const ADMIN_AUDIT_KEY = 'propertySetu:auctionAdminAudit';
  const PREF_KEY = 'propertySetu:auctionSlaPrefs';
  const ALERTS_KEY = 'propertySetu:auctionSlaAlerts';
  const SLA_AUDIT_KEY = 'propertySetu:auctionSlaAudit';

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

  const pushNotification = (title, message, audience = ['admin'], type = 'warn') => {
    if (!title || !message) return;
    if (window.PropertySetuNotify && typeof window.PropertySetuNotify.emit === 'function') {
      window.PropertySetuNotify.emit({ title, message, audience, type });
      return;
    }
    const rows = readJson('propertySetu:notifications', []);
    const list = Array.isArray(rows) ? rows : [];
    list.unshift({
      id: `auction-sla-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      message,
      audience,
      type,
      createdAt: nowIso(),
      readBy: {},
    });
    writeJson('propertySetu:notifications', list.slice(0, 800));
  };

  const severityRank = (value) => {
    const key = text(value, 'low').toLowerCase();
    if (key === 'critical') return 4;
    if (key === 'high') return 3;
    if (key === 'medium') return 2;
    return 1;
  };
  const stateRank = (value) => {
    const key = text(value, 'open').toLowerCase();
    if (key === 'open') return 0;
    if (key === 'ack') return 1;
    return 2;
  };
  const prettyRule = (rule) => {
    const key = text(rule).toLowerCase();
    if (key === 'ready_to_settle') return 'Ready to settle';
    if (key === 'settlement_breach') return 'Settlement breach';
    if (key === 'idle_no_bid') return 'Idle with no bids';
    if (key === 'reserve_stale') return 'Reserve stale';
    return key ? key.replace(/_/g, ' ') : 'Unknown';
  };
  const shortTime = (value) => {
    const ts = epoch(value);
    if (!ts) return '-';
    return new Date(ts).toLocaleString('en-IN');
  };

  const getPrefs = () => {
    const value = readJson(PREF_KEY, {});
    return {
      query: text(value?.query),
      severity: text(value?.severity, 'all').toLowerCase(),
      state: text(value?.state, 'all').toLowerCase(),
      preCloseHours: clamp(numberFrom(value?.preCloseHours, 6), 1, 72),
      settlementBreachHours: clamp(numberFrom(value?.settlementBreachHours, 12), 1, 240),
      idleHours: clamp(numberFrom(value?.idleHours, 36), 4, 720),
      reserveStaleHours: clamp(numberFrom(value?.reserveStaleHours, 18), 1, 240),
      cooldownMinutes: clamp(numberFrom(value?.cooldownMinutes, 30), 1, 720),
      autoSec: clamp(Math.round(numberFrom(value?.autoSec, 45)), 0, 300),
    };
  };
  const setPrefs = (next) => {
    writeJson(PREF_KEY, { ...getPrefs(), ...(next || {}) });
  };

  const getAlertsMap = () => {
    const value = readJson(ALERTS_KEY, {});
    return value && typeof value === 'object' ? value : {};
  };
  const saveAlertsMap = (next) => {
    writeJson(ALERTS_KEY, next && typeof next === 'object' ? next : {});
  };

  const getAudit = () => {
    const rows = readJson(SLA_AUDIT_KEY, []);
    return Array.isArray(rows) ? rows : [];
  };
  const pushAudit = (entry = {}) => {
    const rows = getAudit();
    rows.unshift({
      id: `sla-audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: nowIso(),
      by: text(entry.by, getAdminName()),
      action: text(entry.action, 'scan'),
      rule: text(entry.rule),
      severity: text(entry.severity, 'medium'),
      propertyId: text(entry.propertyId),
      propertyTitle: text(entry.propertyTitle),
      state: text(entry.state),
      note: text(entry.note),
    });
    writeJson(SLA_AUDIT_KEY, rows.slice(0, 600));
  };

  const listingMap = () => {
    const rows = readJson(LISTINGS_KEY, []);
    const map = new Map();
    (Array.isArray(rows) ? rows : []).forEach((item) => {
      const id = text(item?.id || item?._id);
      if (!id) return;
      map.set(id, {
        id,
        title: text(item?.title, id),
        city: text(item?.city, 'Udaipur'),
        location: text(item?.location || item?.locality, 'Udaipur'),
        ownerId: text(item?.ownerId || item?.userId || item?.owner?.id),
        listedPrice: Math.max(0, Math.round(numberFrom(item?.price, 0))),
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

  const deriveStatus = (auction, topBid) => {
    const raw = text(auction?.status, 'live').toLowerCase();
    if (raw === 'settled') return 'settled';
    if (raw === 'cancelled') return 'cancelled';
    if (raw === 'closed') return topBid && auction?.winnerBidId ? 'settled' : 'closed';
    const closeEpoch = epoch(auction?.closesAt);
    if (closeEpoch > 0 && closeEpoch <= Date.now()) return topBid && auction?.winnerBidId ? 'settled' : 'closed';
    return 'live';
  };

  const getUnifiedAuditList = () => {
    const normalize = (row = {}, source = 'audit') => ({
      id: text(row.id, `${source}-${Math.random().toString(36).slice(2, 8)}`),
      source,
      at: text(row.at || row.createdAt),
      type: text(row.type || row.action, 'info'),
      propertyId: text(row.propertyId),
      by: text(row.by),
    });
    const customer = (Array.isArray(readJson(CUSTOMER_AUDIT_KEY, [])) ? readJson(CUSTOMER_AUDIT_KEY, []) : []).map((item) => normalize(item, 'customer'));
    const seller = (Array.isArray(readJson(SELLER_AUDIT_KEY, [])) ? readJson(SELLER_AUDIT_KEY, []) : []).map((item) => normalize(item, 'seller'));
    const admin = (Array.isArray(readJson(ADMIN_AUDIT_KEY, [])) ? readJson(ADMIN_AUDIT_KEY, []) : []).map((item) => normalize(item, 'admin'));
    return [...customer, ...seller, ...admin];
  };

  const buildAuctionRows = () => {
    const listings = listingMap();
    const auctions = auctionMap();
    const bids = allBids();
    const ids = new Set();
    Object.keys(auctions || {}).forEach((id) => ids.add(text(id)));
    bids.forEach((bid) => ids.add(text(bid.propertyId)));

    const rows = [];
    ids.forEach((propertyId) => {
      if (!propertyId) return;
      const listing = listings.get(propertyId) || {
        id: propertyId,
        title: propertyId,
        city: 'Udaipur',
        location: 'Udaipur',
        ownerId: '',
        listedPrice: 0,
      };
      const auction = auctions[propertyId] || {
        propertyId,
        reservePrice: Math.max(1000, Math.round(numberFrom(listing.listedPrice, 0) * 0.9 || 1000)),
        closesAt: '',
        status: 'live',
      };
      const bidRows = bids.filter((bid) => bid.propertyId === propertyId);
      const highestBid = bidRows[0] || null;
      const secondBid = bidRows[1] || null;
      const reservePrice = Math.max(1000, Math.round(numberFrom(auction.reservePrice, listing.listedPrice * 0.9 || 1000)));
      const closeEpoch = epoch(auction.closesAt);
      const status = deriveStatus(auction, highestBid);
      const closesInHours = closeEpoch ? (closeEpoch - Date.now()) / 3600000 : null;
      const fallbackStart = closeEpoch ? closeEpoch - 72 * 3600000 : Date.now() - 24 * 3600000;
      const startedAtEpoch = epoch(auction.startedAt || auction.createdAt || auction.openedAt || auction.updatedAt) || fallbackStart;
      const closedAtEpoch = epoch(auction.closedAt || auction.winnerAcceptedAt || auction.updatedAt) || closeEpoch;
      const lastBidAtEpoch = bidRows.length
        ? bidRows.reduce((maxTs, bid) => Math.max(maxTs, epoch(bid.createdAt)), 0)
        : 0;
      const reserveGap = highestBid ? reservePrice - highestBid.amount : reservePrice;

      rows.push({
        propertyId,
        propertyTitle: listing.title,
        city: listing.city,
        location: listing.location,
        ownerId: listing.ownerId,
        listedPrice: listing.listedPrice,
        reservePrice,
        status,
        closesAt: text(auction.closesAt),
        closesInHours,
        startedAtEpoch,
        closedAtEpoch,
        lastBidAtEpoch,
        totalBids: bidRows.length,
        highestBid,
        secondBid,
        highestAmount: highestBid ? highestBid.amount : 0,
        reserveGap,
        winnerBidId: text(auction.winnerBidId),
      });
    });
    return rows;
  };

  const createCandidate = (row, rule, severity, note, metric = {}) => ({
    id: `${rule}:${row.propertyId}`,
    rule,
    severity,
    propertyId: row.propertyId,
    propertyTitle: row.propertyTitle,
    city: row.city,
    location: row.location,
    note,
    metric,
    snapshot: {
      status: row.status,
      totalBids: row.totalBids,
      reservePrice: row.reservePrice,
      highestAmount: row.highestAmount,
      closesAt: row.closesAt,
      closesInHours: row.closesInHours,
      listedPrice: row.listedPrice,
    },
  });

  const evaluateRules = (rows, prefs) => {
    const candidates = [];
    rows.forEach((row) => {
      if (row.status === 'live' && row.closesInHours !== null && row.closesInHours > 0 && row.closesInHours <= prefs.preCloseHours && row.highestAmount >= row.reservePrice) {
        candidates.push(createCandidate(
          row,
          'ready_to_settle',
          row.closesInHours <= 2 ? 'high' : 'medium',
          `Reserve met and auction closes in ${row.closesInHours.toFixed(1)}h.`,
          { closesInHours: Number(row.closesInHours.toFixed(2)), reserveGap: row.reserveGap }
        ));
      }
      if (row.status === 'closed' && row.totalBids > 0 && !row.winnerBidId) {
        const breachHours = row.closedAtEpoch ? (Date.now() - row.closedAtEpoch) / 3600000 : 0;
        if (breachHours >= prefs.settlementBreachHours) {
          candidates.push(createCandidate(
            row,
            'settlement_breach',
            breachHours >= prefs.settlementBreachHours * 2 ? 'critical' : 'high',
            `Closed for ${breachHours.toFixed(1)}h with bids but no winner settlement.`,
            { breachHours: Number(breachHours.toFixed(2)), totalBids: row.totalBids }
          ));
        }
      }
      if (row.status === 'live' && row.totalBids === 0) {
        const idleHours = row.startedAtEpoch ? (Date.now() - row.startedAtEpoch) / 3600000 : 0;
        if (idleHours >= prefs.idleHours) {
          candidates.push(createCandidate(
            row,
            'idle_no_bid',
            idleHours >= prefs.idleHours * 1.5 ? 'high' : 'medium',
            `Live for ${idleHours.toFixed(1)}h without any bid.`,
            { idleHours: Number(idleHours.toFixed(2)) }
          ));
        }
      }
      if (row.status === 'live' && row.totalBids > 0 && row.highestAmount < row.reservePrice && row.closesInHours !== null && row.closesInHours > 0 && row.closesInHours <= prefs.reserveStaleHours) {
        candidates.push(createCandidate(
          row,
          'reserve_stale',
          row.closesInHours <= 3 ? 'high' : 'medium',
          `Top bid ${inr(row.highestAmount)} is below reserve by ${inr(row.reserveGap)} with only ${row.closesInHours.toFixed(1)}h left.`,
          { closesInHours: Number(row.closesInHours.toFixed(2)), reserveGap: row.reserveGap }
        ));
      }
    });
    return candidates;
  };

  const syncCandidatesToAlerts = (candidates, options = {}) => {
    const now = nowIso();
    const nowTs = Date.now();
    const prefs = getPrefs();
    const map = getAlertsMap();
    const seen = new Set();
    let opened = 0;
    let reopened = 0;
    let resolved = 0;
    let notified = 0;

    candidates.forEach((candidate) => {
      const id = text(candidate.id);
      if (!id) return;
      seen.add(id);
      const prev = map[id];
      const previousSeverity = text(prev?.severity, 'low').toLowerCase();
      const next = {
        ...(prev || {}),
        id,
        rule: candidate.rule,
        severity: candidate.severity,
        propertyId: candidate.propertyId,
        propertyTitle: candidate.propertyTitle,
        city: candidate.city,
        location: candidate.location,
        note: candidate.note,
        metric: candidate.metric,
        snapshot: candidate.snapshot,
        updatedAt: now,
        lastTriggeredAt: now,
      };

      if (!prev) {
        next.createdAt = now;
        next.state = 'open';
        next.openedBy = 'system';
        opened += 1;
        pushAudit({
          action: 'opened',
          rule: next.rule,
          severity: next.severity,
          propertyId: next.propertyId,
          propertyTitle: next.propertyTitle,
          state: next.state,
          note: next.note,
          by: 'System',
        });
      } else if (text(prev.state, 'open').toLowerCase() === 'resolved') {
        next.state = 'open';
        next.reopenedAt = now;
        next.reopenedBy = 'system';
        reopened += 1;
        pushAudit({
          action: 'reopened',
          rule: next.rule,
          severity: next.severity,
          propertyId: next.propertyId,
          propertyTitle: next.propertyTitle,
          state: next.state,
          note: 'Condition re-triggered after resolution.',
          by: 'System',
        });
      } else {
        next.state = text(prev.state, 'open').toLowerCase();
      }

      const cooldownMs = Math.max(1, prefs.cooldownMinutes) * 60000;
      const lastNotifiedTs = epoch(next.lastNotifiedAt);
      const raisedSeverity = severityRank(next.severity) > severityRank(previousSeverity);
      const shouldNotify = Boolean(options.forceNotify)
        || !lastNotifiedTs
        || (nowTs - lastNotifiedTs) >= cooldownMs
        || raisedSeverity
        || !prev;
      if (shouldNotify && next.state !== 'resolved') {
        pushNotification(
          `[Auction SLA] ${prettyRule(next.rule)} - ${next.propertyTitle}`,
          `${next.note} (${next.propertyId})`,
          ['admin'],
          severityRank(next.severity) >= 3 ? 'warn' : 'info'
        );
        next.lastNotifiedAt = now;
        next.notifyCount = Math.max(0, Math.round(numberFrom(next.notifyCount, 0))) + 1;
        notified += 1;
      }
      map[id] = next;
    });

    Object.keys(map).forEach((id) => {
      const row = map[id];
      if (!row || seen.has(id)) return;
      const status = text(row.state, 'open').toLowerCase();
      if (status === 'resolved') return;
      map[id] = {
        ...row,
        state: 'resolved',
        resolvedAt: now,
        resolvedBy: 'system',
        updatedAt: now,
        note: text(row.note, 'Alert condition cleared in latest scan.'),
        autoResolved: true,
      };
      resolved += 1;
      pushAudit({
        action: 'resolved',
        rule: text(row.rule),
        severity: text(row.severity, 'medium'),
        propertyId: text(row.propertyId),
        propertyTitle: text(row.propertyTitle),
        state: 'resolved',
        note: 'Condition cleared in latest scan.',
        by: 'System',
      });
    });
    saveAlertsMap(map);
    return { opened, reopened, resolved, notified };
  };

  const setAlertState = (id, action) => {
    const map = getAlertsMap();
    const row = map[id];
    if (!row) return false;
    const now = nowIso();
    const admin = getAdminName();
    const current = text(row.state, 'open').toLowerCase();
    if (action === 'ack' && current !== 'resolved') {
      row.state = 'ack';
      row.ackAt = now;
      row.ackBy = admin;
      row.updatedAt = now;
      pushAudit({
        action: 'ack',
        by: admin,
        rule: row.rule,
        severity: row.severity,
        propertyId: row.propertyId,
        propertyTitle: row.propertyTitle,
        state: row.state,
        note: 'Alert acknowledged.',
      });
    } else if (action === 'resolve') {
      row.state = 'resolved';
      row.resolvedAt = now;
      row.resolvedBy = admin;
      row.updatedAt = now;
      row.autoResolved = false;
      pushAudit({
        action: 'resolve',
        by: admin,
        rule: row.rule,
        severity: row.severity,
        propertyId: row.propertyId,
        propertyTitle: row.propertyTitle,
        state: row.state,
        note: 'Alert resolved manually.',
      });
    } else if (action === 'reopen') {
      row.state = 'open';
      row.reopenedAt = now;
      row.reopenedBy = admin;
      row.updatedAt = now;
      row.autoResolved = false;
      pushAudit({
        action: 'reopen',
        by: admin,
        rule: row.rule,
        severity: row.severity,
        propertyId: row.propertyId,
        propertyTitle: row.propertyTitle,
        state: row.state,
        note: 'Alert reopened manually.',
      });
    } else if (action === 'notify') {
      pushNotification(
        `[Auction SLA] ${prettyRule(row.rule)} - ${row.propertyTitle}`,
        `${text(row.note)} (${row.propertyId})`,
        ['admin'],
        severityRank(row.severity) >= 3 ? 'warn' : 'info'
      );
      row.lastNotifiedAt = now;
      row.notifyCount = Math.max(0, Math.round(numberFrom(row.notifyCount, 0))) + 1;
      row.updatedAt = now;
      pushAudit({
        action: 'notify',
        by: admin,
        rule: row.rule,
        severity: row.severity,
        propertyId: row.propertyId,
        propertyTitle: row.propertyTitle,
        state: row.state,
        note: 'Manual notification sent.',
      });
    } else {
      return false;
    }
    map[id] = row;
    saveAlertsMap(map);
    return true;
  };

  const clearResolvedAlerts = () => {
    const map = getAlertsMap();
    const next = {};
    Object.keys(map).forEach((id) => {
      const row = map[id];
      if (!row) return;
      if (text(row.state, 'open').toLowerCase() === 'resolved') return;
      next[id] = row;
    });
    saveAlertsMap(next);
  };

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${CARD_ID}{margin-top:16px}
#${CARD_ID} .sla-card{border:1px solid #d6e1f5;border-radius:10px;background:#fff;padding:10px}
#${CARD_ID} .sla-grid{display:grid;gap:10px}
#${CARD_ID} .sla-grid.cols{grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}
#${CARD_ID} label{display:block;font-size:12px;color:#35597d;margin-bottom:4px}
#${CARD_ID} input,#${CARD_ID} select{width:100%;border:1px solid #cad9ef;border-radius:8px;padding:8px 10px;box-sizing:border-box}
#${CARD_ID} .sla-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
#${CARD_ID} .sla-btn{border:1px solid #0b3d91;background:#0b3d91;color:#fff;border-radius:8px;padding:8px 12px;cursor:pointer;font-weight:700}
#${CARD_ID} .sla-btn.alt{background:#fff;color:#0b3d91}
#${CARD_ID} .sla-status{display:inline-block;padding:3px 9px;border-radius:999px;background:#e9f0ff;color:#1f3e7a;font-size:12px}
#${CARD_ID} .sla-kpis{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin-top:10px}
#${CARD_ID} .sla-kpi{border:1px solid #d6e1f5;border-radius:8px;background:#f8fbff;padding:8px}
#${CARD_ID} .sla-kpi small{display:block;color:#58718f}
#${CARD_ID} table{width:100%;border-collapse:collapse}
#${CARD_ID} th,#${CARD_ID} td{border:1px solid #d6e1f5;padding:8px;text-align:left;vertical-align:top}
#${CARD_ID} th{background:#f4f8ff;color:#11466e}
#${CARD_ID} .chip{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px}
#${CARD_ID} .chip.state-open{background:#ffe8e8;color:#8f1a1a}
#${CARD_ID} .chip.state-ack{background:#fff4d9;color:#7a4f00}
#${CARD_ID} .chip.state-resolved{background:#e6f7ea;color:#1d6a3c}
#${CARD_ID} .chip.sev-critical{background:#8f1a1a;color:#fff}
#${CARD_ID} .chip.sev-high{background:#d94e20;color:#fff}
#${CARD_ID} .chip.sev-medium{background:#ffcd56;color:#5f4200}
#${CARD_ID} .chip.sev-low{background:#d9ebff;color:#1f3e7a}
`;
    document.head.appendChild(style);
  }

  const card = document.createElement('section');
  card.id = CARD_ID;
  card.className = 'container';
  card.innerHTML = `
<div class="sla-card">
  <h2 style="margin:0 0 8px;">Auction SLA Escalation Center</h2>
  <p style="margin:0;color:#1d4068;">Tracks settlement risk and SLA breaches across auctions with acknowledge, resolve, reopen and notify actions.</p>
</div>
<div class="sla-card" style="margin-top:10px;">
  <div class="sla-grid cols">
    <div><label for="asecPreCloseHours">Ready-to-settle window (hours)</label><input id="asecPreCloseHours" type="number" min="1" max="72" step="1"></div>
    <div><label for="asecSettlementBreachHours">Settlement breach after close (hours)</label><input id="asecSettlementBreachHours" type="number" min="1" max="240" step="1"></div>
    <div><label for="asecIdleHours">Idle no-bid threshold (hours)</label><input id="asecIdleHours" type="number" min="4" max="720" step="1"></div>
    <div><label for="asecReserveStaleHours">Reserve stale near-close window (hours)</label><input id="asecReserveStaleHours" type="number" min="1" max="240" step="1"></div>
    <div><label for="asecCooldownMinutes">Notification cooldown (minutes)</label><input id="asecCooldownMinutes" type="number" min="1" max="720" step="1"></div>
    <div><label for="asecAutoSec">Auto scan (sec, 0=off)</label><input id="asecAutoSec" type="number" min="0" max="300" step="5"></div>
  </div>
  <div class="sla-row" style="margin-top:10px;">
    <button id="asecSavePrefs" class="sla-btn alt" type="button">Save Settings</button>
    <button id="asecRunScan" class="sla-btn" type="button">Run SLA Scan</button>
    <button id="asecClearResolved" class="sla-btn alt" type="button">Clear Resolved</button>
    <span id="asecStatus" class="sla-status">Ready</span>
  </div>
</div>
<div class="sla-card" style="margin-top:10px;">
  <div class="sla-grid cols">
    <div><label for="asecQuery">Search</label><input id="asecQuery" placeholder="Property, rule, note, id"></div>
    <div><label for="asecSeverityFilter">Severity</label><select id="asecSeverityFilter"><option value="all">All</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></div>
    <div><label for="asecStateFilter">State</label><select id="asecStateFilter"><option value="all">All</option><option value="open">Open</option><option value="ack">Acknowledged</option><option value="resolved">Resolved</option></select></div>
  </div>
</div>
<div id="asecKpis" class="sla-kpis"></div>
<div class="sla-card" style="margin-top:10px;">
  <h3 style="margin:0 0 8px;">SLA Alerts</h3>
  <div id="asecAlertsWrap" style="overflow:auto;"></div>
</div>
<div class="sla-card" style="margin-top:10px;">
  <h3 style="margin:0 0 8px;">SLA Audit Feed</h3>
  <div id="asecAuditFeed" style="max-height:220px;overflow:auto;"></div>
</div>`;

  const anchor = document.getElementById('auctionUnifiedAnalyticsTimelineCard')
    || document.getElementById('adminAuctionControlCenter')
    || document.getElementById('adminAnalyticsCommandCenterCard')
    || document.querySelector('.container');
  if (anchor?.parentElement) anchor.insertAdjacentElement('afterend', card);
  else document.body.appendChild(card);

  const ui = {
    preCloseHours: document.getElementById('asecPreCloseHours'),
    settlementBreachHours: document.getElementById('asecSettlementBreachHours'),
    idleHours: document.getElementById('asecIdleHours'),
    reserveStaleHours: document.getElementById('asecReserveStaleHours'),
    cooldownMinutes: document.getElementById('asecCooldownMinutes'),
    autoSec: document.getElementById('asecAutoSec'),
    savePrefs: document.getElementById('asecSavePrefs'),
    runScan: document.getElementById('asecRunScan'),
    clearResolved: document.getElementById('asecClearResolved'),
    status: document.getElementById('asecStatus'),
    query: document.getElementById('asecQuery'),
    severityFilter: document.getElementById('asecSeverityFilter'),
    stateFilter: document.getElementById('asecStateFilter'),
    kpis: document.getElementById('asecKpis'),
    alertsWrap: document.getElementById('asecAlertsWrap'),
    auditFeed: document.getElementById('asecAuditFeed'),
  };

  const state = {
    auctionRows: [],
    unifiedAuditCount: 0,
    timer: null,
  };

  const setStatus = (message, ok = true) => {
    ui.status.textContent = text(message, 'Ready');
    ui.status.style.color = ok ? '#1f3e7a' : '#8f1a1a';
  };

  const renderKpis = (rows) => {
    const alerts = Array.isArray(rows) ? rows : [];
    const openCount = alerts.filter((row) => text(row.state, 'open').toLowerCase() === 'open').length;
    const ackCount = alerts.filter((row) => text(row.state, 'open').toLowerCase() === 'ack').length;
    const resolvedCount = alerts.filter((row) => text(row.state, 'open').toLowerCase() === 'resolved').length;
    const priorityCount = alerts.filter((row) => ['critical', 'high'].includes(text(row.severity).toLowerCase()) && text(row.state, 'open').toLowerCase() !== 'resolved').length;
    const breaches = alerts.filter((row) => text(row.rule).toLowerCase() === 'settlement_breach' && text(row.state, 'open').toLowerCase() !== 'resolved').length;
    ui.kpis.innerHTML = `
<div class="sla-kpi"><small>Total Alerts</small><strong>${alerts.length}</strong></div>
<div class="sla-kpi"><small>Open</small><strong>${openCount}</strong></div>
<div class="sla-kpi"><small>Acknowledged</small><strong>${ackCount}</strong></div>
<div class="sla-kpi"><small>Resolved</small><strong>${resolvedCount}</strong></div>
<div class="sla-kpi"><small>High Priority Active</small><strong>${priorityCount}</strong></div>
<div class="sla-kpi"><small>Settlement Breaches</small><strong>${breaches}</strong></div>
<div class="sla-kpi"><small>Unified Auction Audits</small><strong>${state.unifiedAuditCount}</strong></div>`;
  };

  const getFilteredAlerts = () => {
    const prefs = getPrefs();
    const query = text(prefs.query).toLowerCase();
    const map = getAlertsMap();
    return Object.values(map)
      .filter((item) => item && typeof item === 'object')
      .filter((item) => {
        const severity = text(item.severity, 'low').toLowerCase();
        const status = text(item.state, 'open').toLowerCase();
        if (prefs.severity !== 'all' && severity !== prefs.severity) return false;
        if (prefs.state !== 'all' && status !== prefs.state) return false;
        if (!query) return true;
        return [
          item.propertyId,
          item.propertyTitle,
          item.rule,
          item.note,
          item.id,
          item.city,
          item.location,
        ].some((value) => text(value).toLowerCase().includes(query));
      })
      .sort((a, b) => {
        const stateDiff = stateRank(a.state) - stateRank(b.state);
        if (stateDiff !== 0) return stateDiff;
        const severityDiff = severityRank(b.severity) - severityRank(a.severity);
        if (severityDiff !== 0) return severityDiff;
        return epoch(b.updatedAt) - epoch(a.updatedAt);
      });
  };

  const renderAlerts = (rows) => {
    const alerts = Array.isArray(rows) ? rows : [];
    if (!alerts.length) {
      ui.alertsWrap.innerHTML = '<p style="margin:0;color:#607da8;">No SLA alerts for current filter.</p>';
      return;
    }
    ui.alertsWrap.innerHTML = `
<table>
  <thead>
    <tr>
      <th>Property</th>
      <th>Rule</th>
      <th>Severity</th>
      <th>State</th>
      <th>Note</th>
      <th>Updated</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    ${alerts.map((row) => {
      const severity = text(row.severity, 'low').toLowerCase();
      const status = text(row.state, 'open').toLowerCase();
      const snapshot = row.snapshot || {};
      const details = [
        `Top: ${inr(numberFrom(snapshot.highestAmount, 0))}`,
        `Reserve: ${inr(numberFrom(snapshot.reservePrice, 0))}`,
        snapshot.closesAt ? `Close: ${shortTime(snapshot.closesAt)}` : '',
      ].filter(Boolean).join(' | ');
      return `
      <tr>
        <td><strong>${escapeHtml(text(row.propertyTitle, row.propertyId))}</strong><br><small>${escapeHtml(text(row.propertyId))}</small><br><small>${escapeHtml(text(row.city))}${row.location ? `, ${escapeHtml(text(row.location))}` : ''}</small></td>
        <td>${escapeHtml(prettyRule(row.rule))}</td>
        <td><span class="chip sev-${escapeHtml(severity)}">${escapeHtml(severity.toUpperCase())}</span></td>
        <td><span class="chip state-${escapeHtml(status)}">${escapeHtml(status.toUpperCase())}</span></td>
        <td>${escapeHtml(text(row.note))}<br><small>${escapeHtml(details)}</small></td>
        <td>${escapeHtml(shortTime(row.updatedAt || row.createdAt))}</td>
        <td>
          <div class="sla-row">
            ${status !== 'resolved' ? `<button class="sla-btn alt" data-action="ack" data-alert-id="${escapeHtml(row.id)}" type="button">Ack</button>` : ''}
            ${status !== 'resolved' ? `<button class="sla-btn alt" data-action="resolve" data-alert-id="${escapeHtml(row.id)}" type="button">Resolve</button>` : ''}
            ${status === 'resolved' ? `<button class="sla-btn alt" data-action="reopen" data-alert-id="${escapeHtml(row.id)}" type="button">Reopen</button>` : ''}
            <button class="sla-btn alt" data-action="notify" data-alert-id="${escapeHtml(row.id)}" type="button">Notify</button>
          </div>
        </td>
      </tr>`;
    }).join('')}
  </tbody>
</table>`;
  };

  const renderAuditFeed = () => {
    const rows = getAudit();
    if (!rows.length) {
      ui.auditFeed.innerHTML = '<p style="margin:0;color:#607da8;">No SLA audit logs yet.</p>';
      return;
    }
    ui.auditFeed.innerHTML = rows.slice(0, 40).map((row) => `
<div style="border-bottom:1px solid #e1e9f8;padding:7px 0;">
  <strong>${escapeHtml(text(row.action, 'scan').toUpperCase())}</strong> - ${escapeHtml(text(row.propertyTitle, row.propertyId || '-'))}
  <br><small>${escapeHtml(prettyRule(row.rule))} | ${escapeHtml(text(row.severity, '-'))} | ${escapeHtml(text(row.state, '-'))}</small>
  <br><small>${escapeHtml(text(row.note))}</small>
  <br><small style="color:#6d86a5;">${escapeHtml(shortTime(row.at))} | ${escapeHtml(text(row.by, 'System'))}</small>
</div>`).join('');
  };

  const renderFromStorage = () => {
    const filteredAlerts = getFilteredAlerts();
    renderKpis(filteredAlerts);
    renderAlerts(filteredAlerts);
    renderAuditFeed();
  };

  const runScan = (options = {}) => {
    const prefs = getPrefs();
    state.auctionRows = buildAuctionRows();
    state.unifiedAuditCount = getUnifiedAuditList().length;
    const candidates = evaluateRules(state.auctionRows, prefs);
    const syncStats = syncCandidatesToAlerts(candidates, options);
    renderFromStorage();
    const message = `Scan complete | candidates ${candidates.length} | opened ${syncStats.opened} | reopened ${syncStats.reopened} | resolved ${syncStats.resolved} | notified ${syncStats.notified}`;
    setStatus(message, true);
    pushAudit({
      action: 'scan',
      by: 'System',
      note: message,
      severity: 'info',
      state: 'done',
    });
  };

  const setAutoRefresh = (seconds, options = {}) => {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
    const value = clamp(Math.round(numberFrom(seconds, 0)), 0, 300);
    if (value > 0) {
      state.timer = setInterval(() => {
        runScan();
      }, value * 1000);
    }
    if (!options.silent) {
      setStatus(value > 0 ? `Auto scan every ${value}s` : 'Auto scan disabled', true);
    }
  };

  const syncControls = () => {
    const prefs = getPrefs();
    ui.preCloseHours.value = String(prefs.preCloseHours);
    ui.settlementBreachHours.value = String(prefs.settlementBreachHours);
    ui.idleHours.value = String(prefs.idleHours);
    ui.reserveStaleHours.value = String(prefs.reserveStaleHours);
    ui.cooldownMinutes.value = String(prefs.cooldownMinutes);
    ui.autoSec.value = String(prefs.autoSec);
    ui.query.value = prefs.query;
    ui.severityFilter.value = prefs.severity;
    ui.stateFilter.value = prefs.state;
  };

  ui.savePrefs?.addEventListener('click', () => {
    const next = {
      preCloseHours: clamp(numberFrom(ui.preCloseHours.value, 6), 1, 72),
      settlementBreachHours: clamp(numberFrom(ui.settlementBreachHours.value, 12), 1, 240),
      idleHours: clamp(numberFrom(ui.idleHours.value, 36), 4, 720),
      reserveStaleHours: clamp(numberFrom(ui.reserveStaleHours.value, 18), 1, 240),
      cooldownMinutes: clamp(numberFrom(ui.cooldownMinutes.value, 30), 1, 720),
      autoSec: clamp(Math.round(numberFrom(ui.autoSec.value, 45)), 0, 300),
      query: text(ui.query.value),
      severity: text(ui.severityFilter.value, 'all').toLowerCase(),
      state: text(ui.stateFilter.value, 'all').toLowerCase(),
    };
    setPrefs(next);
    setAutoRefresh(next.autoSec);
    runScan();
  });

  ui.runScan?.addEventListener('click', () => {
    runScan({ forceNotify: false });
  });

  ui.clearResolved?.addEventListener('click', () => {
    clearResolvedAlerts();
    renderFromStorage();
    setStatus('Resolved alerts cleared.', true);
  });

  ui.query?.addEventListener('input', () => {
    setPrefs({ query: text(ui.query.value) });
    renderFromStorage();
  });
  ui.severityFilter?.addEventListener('change', () => {
    setPrefs({ severity: text(ui.severityFilter.value, 'all').toLowerCase() });
    renderFromStorage();
  });
  ui.stateFilter?.addEventListener('change', () => {
    setPrefs({ state: text(ui.stateFilter.value, 'all').toLowerCase() });
    renderFromStorage();
  });

  ui.alertsWrap?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const id = text(target.getAttribute('data-alert-id'));
    const action = text(target.getAttribute('data-action')).toLowerCase();
    if (!id || !action) return;
    const updated = setAlertState(id, action);
    if (!updated) {
      setStatus('Unable to update alert state.', false);
      return;
    }
    renderFromStorage();
    setStatus(`Alert ${action} applied.`, true);
  });

  syncControls();
  setAutoRefresh(numberFrom(getPrefs().autoSec, 45), { silent: true });
  runScan();
  window.addEventListener('beforeunload', () => {
    if (state.timer) clearInterval(state.timer);
  });
})();
