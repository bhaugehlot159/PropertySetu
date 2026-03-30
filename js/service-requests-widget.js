(() => {
  if (document.getElementById('psServiceQueueCard')) return;

  const live = window.PropertySetuLive || {};
  const allowDemoFallback = Boolean(live.allowDemoFallback);
  const containers = Array.from(document.querySelectorAll('.container'));
  if (!containers.length) return;

  const QUEUE_LAST_SEEN_KEY = 'propertySetu:ecosystemQueueLastSeen';
  const FEED_KEY = 'propertySetu:ecosystemActionFeed';
  const CARD_ID = 'psServiceQueueCard';
  const STYLE_ID = 'psServiceQueueStyle';

  const modules = [
    { key: 'docs', label: 'Docs', path: '/documentation/requests' },
    { key: 'loan', label: 'Loan', path: '/loan/assistance' },
    { key: 'booking', label: 'Bookings', path: '/ecosystem/bookings' },
    { key: 'franchise', label: 'Franchise', path: '/franchise/requests' },
    { key: 'rent', label: 'Rent Drafts', path: '/rent-agreement/drafts' },
  ];

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

  const text = (value, fallback = '') => {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  };

  const escapeHtml = (value) => (
    String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  );

  const toItems = (payload) => (Array.isArray(payload?.items) ? payload.items : []);

  const formatDate = (value) => {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const toAmount = (value) => {
    const num = Number(value || 0);
    if (!Number.isFinite(num) || num <= 0) return '';
    return ` | ₹${num.toLocaleString('en-IN')}`;
  };

  const detectStatus = (item) => {
    const raw = text(item?.status || item?.stage || item?.state || 'requested').toLowerCase();
    if (
      raw.includes('completed')
      || raw.includes('approved')
      || raw.includes('accepted')
      || raw.includes('generated')
      || raw.includes('active')
      || raw.includes('done')
      || raw.includes('published')
    ) return 'completed';
    if (
      raw.includes('reject')
      || raw.includes('failed')
      || raw.includes('cancel')
    ) return 'rejected';
    if (
      raw.includes('progress')
      || raw.includes('review')
      || raw.includes('processing')
      || raw.includes('screening')
      || raw.includes('verifying')
    ) return 'in_progress';
    return 'pending';
  };

  const normalizeEntry = (moduleKey, item) => {
    if (!item || typeof item !== 'object') return null;

    const base = {
      statusType: detectStatus(item),
      statusLabel: text(item.status || item.stage || item.state, 'requested'),
      at: text(item.updatedAt || item.createdAt),
      module: moduleKey,
    };

    if (moduleKey === 'docs') {
      return {
        ...base,
        title: text(item.serviceName || item.serviceId, 'Documentation Request'),
        meta: text(item.city || item.propertyId),
      };
    }
    if (moduleKey === 'loan') {
      return {
        ...base,
        title: text(item.bankName || item.bankId, 'Loan Assistance'),
        meta: `${text(item.city || item.locality || '')}${toAmount(item.requestedAmount)}`.trim(),
      };
    }
    if (moduleKey === 'booking') {
      return {
        ...base,
        title: text(item.serviceName || item.serviceId, 'Partner Booking'),
        meta: text(item.locality || item.city || item.preferredDate),
      };
    }
    if (moduleKey === 'franchise') {
      return {
        ...base,
        title: text(item.city, 'Franchise Request'),
        meta: toAmount(item.investmentBudget).replace(' | ', ''),
      };
    }
    return {
      ...base,
      title: `${text(item.ownerName, 'Owner')} -> ${text(item.tenantName, 'Tenant')}`,
      meta: text(item.startDate || item.propertyAddress || ''),
    };
  };

  const ensureStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${CARD_ID} .psrq-status { margin: 0 0 10px; color: #1f6d3d; font-size: 14px; }
#${CARD_ID} .psrq-toolbar { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
#${CARD_ID} .psrq-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;
  border: 1px solid #0b3d91;
  border-radius: 8px;
  background: #0b3d91;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
}
#${CARD_ID} .psrq-btn.ghost { background: #fff; color: #0b3d91; }
#${CARD_ID} .psrq-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; }
#${CARD_ID} .psrq-kpi { border: 1px solid #d4dbe6; border-radius: 8px; padding: 8px; background: #f8fbff; }
#${CARD_ID} .psrq-kpi small { color: #567291; display: block; }
#${CARD_ID} .psrq-kpi b { color: #11466e; font-size: 17px; }
#${CARD_ID} .psrq-feed { list-style: none; padding: 0; margin: 12px 0 0; display: grid; gap: 8px; }
#${CARD_ID} .psrq-item { border: 1px solid #dce5f1; border-radius: 8px; padding: 8px; background: #fff; }
#${CARD_ID} .psrq-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
#${CARD_ID} .psrq-title { font-weight: 700; color: #15385d; }
#${CARD_ID} .psrq-meta { margin-top: 4px; color: #4a617b; font-size: 13px; }
#${CARD_ID} .psrq-time { font-size: 12px; color: #6a7f99; margin-top: 4px; }
#${CARD_ID} .psrq-badge { border-radius: 999px; font-size: 11px; font-weight: 700; padding: 2px 8px; text-transform: uppercase; }
#${CARD_ID} .psrq-badge.pending { background: #fff5df; color: #8d5e00; }
#${CARD_ID} .psrq-badge.in_progress { background: #e8f2ff; color: #0f4f8a; }
#${CARD_ID} .psrq-badge.completed { background: #e7f8ef; color: #19643a; }
#${CARD_ID} .psrq-badge.rejected { background: #ffeaea; color: #8f1f1f; }
    `;
    document.head.appendChild(style);
  };

  const card = document.createElement('div');
  card.className = 'container';
  card.id = CARD_ID;
  card.innerHTML = `
    <h2>My Service Requests</h2>
    <p id="psrqStatus" class="psrq-status">Loading live service queues...</p>
    <div class="psrq-toolbar">
      <button id="psrqRefreshBtn" class="psrq-btn" type="button">Refresh Live Queue</button>
      <a href="pages/ecosystem-services.html" class="psrq-btn ghost">Open Service Desk</a>
    </div>
    <div id="psrqSummary" class="psrq-summary"></div>
    <ul id="psrqFeed" class="psrq-feed"><li class="psrq-item">Loading latest requests...</li></ul>
  `;
  containers[containers.length - 1].insertAdjacentElement('afterend', card);
  ensureStyles();

  const statusEl = document.getElementById('psrqStatus');
  const summaryEl = document.getElementById('psrqSummary');
  const feedEl = document.getElementById('psrqFeed');
  const refreshBtn = document.getElementById('psrqRefreshBtn');

  const setStatus = (message, ok = true) => {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.style.color = ok ? '#1f6d3d' : '#8d1e1e';
  };

  const renderSummary = (metrics = {}) => {
    if (!summaryEl) return;
    const cards = [
      { label: 'Docs', value: metrics.docs || 0 },
      { label: 'Loan', value: metrics.loan || 0 },
      { label: 'Bookings', value: metrics.booking || 0 },
      { label: 'Franchise', value: metrics.franchise || 0 },
      { label: 'Rent Drafts', value: metrics.rent || 0 },
      { label: 'Open', value: metrics.open || 0 },
      { label: 'Completed', value: metrics.completed || 0 },
    ];
    summaryEl.innerHTML = cards.map((item) => `
      <div class="psrq-kpi">
        <small>${item.label}</small>
        <b>${Number(item.value || 0).toLocaleString('en-IN')}</b>
      </div>
    `).join('');
  };

  const renderFeed = (rows, emptyText = 'No service request records found yet.') => {
    if (!feedEl) return;
    if (!Array.isArray(rows) || !rows.length) {
      feedEl.innerHTML = `<li class="psrq-item">${escapeHtml(emptyText)}</li>`;
      return;
    }
    feedEl.innerHTML = rows.slice(0, 8).map((row) => `
      <li class="psrq-item">
        <div class="psrq-head">
          <span class="psrq-title">${escapeHtml(row.title || 'Request')}</span>
          <span class="psrq-badge ${escapeHtml(row.statusType || 'pending')}">${escapeHtml(row.statusLabel || 'requested')}</span>
        </div>
        ${row.meta ? `<div class="psrq-meta">${escapeHtml(row.meta)}</div>` : ''}
        <div class="psrq-time">${escapeHtml(formatDate(row.at))}</div>
      </li>
    `).join('');
  };

  const getToken = () => {
    if (typeof live.getAnyToken === 'function') return text(live.getAnyToken());
    if (typeof live.getToken === 'function') {
      return text(live.getToken('customer') || live.getToken('seller') || live.getToken('admin'));
    }
    return '';
  };

  const renderFromLocal = () => {
    if (!allowDemoFallback) {
      renderSummary({ docs: 0, loan: 0, booking: 0, franchise: 0, rent: 0, open: 0, completed: 0 });
      renderFeed([], 'Live service queue unavailable. Please login and retry.');
      setStatus('Live queue required. Local fallback disabled.', false);
      return;
    }
    const snapshot = readJson(QUEUE_LAST_SEEN_KEY, null);
    const feed = readJson(FEED_KEY, []);
    if (snapshot && typeof snapshot === 'object') {
      renderSummary({
        docs: snapshot.docs || 0,
        loan: snapshot.loan || 0,
        booking: snapshot.booking || 0,
        franchise: snapshot.franchise || 0,
        rent: snapshot.rent || 0,
        open: snapshot.open || 0,
        completed: snapshot.completed || 0,
      });
    } else {
      renderSummary({ docs: 0, loan: 0, booking: 0, franchise: 0, rent: 0, open: 0, completed: 0 });
    }

    const localRows = Array.isArray(feed)
      ? feed
        .slice(0, 8)
        .map((entry) => ({
          title: text(entry?.message, 'Local service event'),
          statusLabel: 'local',
          statusType: 'pending',
          at: text(entry?.at),
          meta: 'Local queue feed',
        }))
      : [];

    renderFeed(localRows, 'No backup queue history yet.');
    if (snapshot?.at) {
      setStatus(`Live unavailable. Showing local snapshot from ${formatDate(snapshot.at)}.`, false);
      return;
    }
    setStatus('Login required for live queue. Showing backup mode.', false);
  };

  const sumSnapshotTotal = (snapshot) => (
    Number(snapshot?.docs || 0)
    + Number(snapshot?.loan || 0)
    + Number(snapshot?.booking || 0)
    + Number(snapshot?.franchise || 0)
    + Number(snapshot?.rent || 0)
  );

  const loadLive = async () => {
    const token = getToken();
    if (!token || typeof live.request !== 'function') {
      renderFromLocal();
      return;
    }

    const previousSnapshot = readJson(QUEUE_LAST_SEEN_KEY, null);
    setStatus('Refreshing live service queues...');

    const settled = await Promise.allSettled(
      modules.map((entry) => live.request(entry.path, { token })),
    );

    const rows = [];
    const metrics = { docs: 0, loan: 0, booking: 0, franchise: 0, rent: 0, open: 0, completed: 0 };
    const warnings = [];

    settled.forEach((result, index) => {
      const module = modules[index];
      if (result.status !== 'fulfilled') {
        warnings.push(module.label);
        return;
      }
      const items = toItems(result.value);
      metrics[module.key] = items.length;
      items.forEach((item) => {
        const normalized = normalizeEntry(module.key, item);
        if (!normalized) return;
        if (normalized.statusType === 'completed') metrics.completed += 1;
        if (normalized.statusType === 'pending' || normalized.statusType === 'in_progress') metrics.open += 1;
        rows.push(normalized);
      });
    });

    rows.sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime());
    renderSummary(metrics);
    renderFeed(rows);

    const snapshot = {
      at: new Date().toISOString(),
      docs: metrics.docs,
      loan: metrics.loan,
      booking: metrics.booking,
      franchise: metrics.franchise,
      rent: metrics.rent,
      open: metrics.open,
      completed: metrics.completed,
    };
    writeJson(QUEUE_LAST_SEEN_KEY, snapshot);

    if (warnings.length) {
      if (!allowDemoFallback) {
        setStatus(`Live queue partial failure in: ${warnings.join(', ')}.`, false);
      } else {
        setStatus(`Queue refreshed with warnings in: ${warnings.join(', ')}.`, false);
      }
      return;
    }

    const previousTotal = sumSnapshotTotal(previousSnapshot);
    const currentTotal = sumSnapshotTotal(snapshot);
    if (currentTotal > previousTotal) {
      setStatus(`Queue refreshed. ${currentTotal - previousTotal} new request(s) detected.`);
      return;
    }
    setStatus('Queue refreshed successfully.');
  };

  refreshBtn?.addEventListener('click', () => {
    loadLive().catch((error) => setStatus(`Queue refresh failed: ${text(error?.message, 'unknown error')}`, false));
  });

  loadLive().catch((error) => setStatus(`Queue load failed: ${text(error?.message, 'unknown error')}`, false));
})();
