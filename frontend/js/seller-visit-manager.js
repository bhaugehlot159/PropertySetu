(() => {
  if (document.getElementById('sellerVisitManagerCard')) return;

  const live = window.PropertySetuLive || {};
  const isSellerPage = Boolean(document.getElementById('addPropertyForm') && document.getElementById('propertyList'));
  if (!isSellerPage) return;

  const STYLE_ID = 'seller-visit-manager-style';
  const CARD_ID = 'sellerVisitManagerCard';
  const CACHE_KEY = 'propertySetu:sellerVisitQueueCache';
  const OVERRIDE_KEY = 'propertySetu:sellerVisitStatusOverrides';

  const STATUS_LABELS = {
    requested: 'Requested',
    confirmed: 'Confirmed',
    completed: 'Completed',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
  };

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

  const formatDate = (value) => {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const normalizeStatus = (value) => {
    const raw = text(value, 'requested').toLowerCase();
    if (raw === 'scheduled') return 'requested';
    if (raw === 'confirmed') return 'confirmed';
    if (raw === 'completed') return 'completed';
    if (raw === 'rejected') return 'rejected';
    if (raw === 'cancelled') return 'cancelled';
    return 'requested';
  };

  const toItems = (payload) => (Array.isArray(payload?.items) ? payload.items : []);

  const getToken = () => {
    if (typeof live.getAnyToken === 'function') return text(live.getAnyToken());
    if (typeof live.getToken === 'function') return text(live.getToken('seller') || live.getToken('admin') || live.getToken('customer'));
    return '';
  };

  const normalizeVisit = (item = {}) => {
    const property = item.property && typeof item.property === 'object' ? item.property : {};
    const id = text(item.id || item._id);
    if (!id) return null;
    return {
      id,
      propertyId: text(item.propertyId || property.id),
      propertyTitle: text(item.propertyTitle || property.title, 'Property'),
      customerId: text(item.customerId),
      customerName: text(item.customerName, 'Customer'),
      preferredAt: text(item.preferredAt || item.visitAt),
      note: text(item.note),
      createdAt: text(item.createdAt),
      updatedAt: text(item.updatedAt),
      status: normalizeStatus(item.status || item.coreStatus),
    };
  };

  const getOverrides = () => {
    const raw = readJson(OVERRIDE_KEY, {});
    return raw && typeof raw === 'object' ? raw : {};
  };

  const setOverride = (visitId, status) => {
    const overrides = getOverrides();
    overrides[visitId] = {
      status: normalizeStatus(status),
      queued: true,
      updatedAt: new Date().toISOString(),
    };
    writeJson(OVERRIDE_KEY, overrides);
  };

  const clearOverride = (visitId) => {
    const overrides = getOverrides();
    if (!overrides[visitId]) return;
    delete overrides[visitId];
    writeJson(OVERRIDE_KEY, overrides);
  };

  const applyOverrides = (visits = []) => {
    const overrides = getOverrides();
    return visits.map((item) => {
      const override = overrides[item.id];
      if (!override) return item;
      return {
        ...item,
        status: normalizeStatus(override.status || item.status),
        _queuedStatus: Boolean(override.queued),
      };
    });
  };

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${CARD_ID} .svm-status { margin: 0 0 10px; color: #1f6d3d; font-size: 14px; }
#${CARD_ID} .svm-toolbar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
#${CARD_ID} .svm-btn {
  border: 1px solid #0b3d91;
  border-radius: 8px;
  background: #0b3d91;
  color: #fff;
  padding: 8px 12px;
  font-weight: 700;
  cursor: pointer;
}
#${CARD_ID} .svm-summary { display: grid; gap: 8px; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); }
#${CARD_ID} .svm-kpi { border: 1px solid #d7e5f7; border-radius: 8px; padding: 8px; background: #f8fbff; }
#${CARD_ID} .svm-kpi small { display: block; color: #58718f; }
#${CARD_ID} .svm-kpi b { color: #11466e; font-size: 17px; }
#${CARD_ID} .svm-list { list-style: none; padding: 0; margin: 12px 0 0; display: grid; gap: 8px; }
#${CARD_ID} .svm-item { border: 1px solid #dce5f1; border-radius: 8px; padding: 8px; background: #fff; }
#${CARD_ID} .svm-head { display: flex; gap: 8px; justify-content: space-between; align-items: center; }
#${CARD_ID} .svm-title { font-weight: 700; color: #12395f; }
#${CARD_ID} .svm-meta { margin-top: 4px; font-size: 13px; color: #4a617b; line-height: 1.4; }
#${CARD_ID} .svm-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 7px; }
#${CARD_ID} .svm-actions button {
  border-radius: 999px;
  border: 1px solid #cbdcf2;
  background: #fff;
  color: #12395f;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
}
#${CARD_ID} .svm-badge { border-radius: 999px; padding: 2px 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
#${CARD_ID} .svm-badge.requested { background: #fff5df; color: #8d5e00; }
#${CARD_ID} .svm-badge.confirmed { background: #e8f2ff; color: #0f4f8a; }
#${CARD_ID} .svm-badge.completed { background: #e7f8ef; color: #19643a; }
#${CARD_ID} .svm-badge.rejected,
#${CARD_ID} .svm-badge.cancelled { background: #ffeaea; color: #8f1f1f; }
#${CARD_ID} .svm-queued { color: #8d5e00; font-size: 12px; font-weight: 700; margin-top: 4px; }
    `;
    document.head.appendChild(style);
  }

  const card = document.createElement('div');
  card.className = 'container';
  card.id = CARD_ID;
  card.innerHTML = `
    <h2>Visit Booking Manager</h2>
    <p id="svmStatus" class="svm-status">Loading visit requests...</p>
    <div class="svm-toolbar">
      <button id="svmRefreshBtn" class="svm-btn" type="button">Refresh Visit Queue</button>
    </div>
    <div id="svmSummary" class="svm-summary"></div>
    <ul id="svmList" class="svm-list"><li class="svm-item">Loading...</li></ul>
  `;

  const containers = Array.from(document.querySelectorAll('.container'));
  const mountAfter = containers[1] || containers[containers.length - 1];
  if (mountAfter) {
    mountAfter.insertAdjacentElement('afterend', card);
  } else {
    document.body.appendChild(card);
  }

  const statusEl = document.getElementById('svmStatus');
  const summaryEl = document.getElementById('svmSummary');
  const listEl = document.getElementById('svmList');
  const refreshBtn = document.getElementById('svmRefreshBtn');

  let lastVisits = [];

  const setStatus = (message, ok = true) => {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.style.color = ok ? '#1f6d3d' : '#8d1e1e';
  };

  const renderSummary = (visits = []) => {
    if (!summaryEl) return;
    const counts = visits.reduce((acc, item) => {
      const key = normalizeStatus(item.status);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const cards = [
      { label: 'Total', value: visits.length },
      { label: 'Requested', value: counts.requested || 0 },
      { label: 'Confirmed', value: counts.confirmed || 0 },
      { label: 'Completed', value: counts.completed || 0 },
      { label: 'Rejected', value: counts.rejected || 0 },
      { label: 'Cancelled', value: counts.cancelled || 0 },
    ];
    summaryEl.innerHTML = cards.map((item) => `
      <div class="svm-kpi">
        <small>${item.label}</small>
        <b>${Number(item.value || 0).toLocaleString('en-IN')}</b>
      </div>
    `).join('');
  };

  const renderList = (visits = [], emptyText = 'No visit requests found yet.') => {
    if (!listEl) return;
    if (!Array.isArray(visits) || !visits.length) {
      listEl.innerHTML = `<li class="svm-item">${escapeHtml(emptyText)}</li>`;
      return;
    }
    listEl.innerHTML = visits.slice(0, 30).map((item) => {
      const badge = STATUS_LABELS[normalizeStatus(item.status)] || STATUS_LABELS.requested;
      const canRespond = ['requested', 'confirmed'].includes(normalizeStatus(item.status));
      return `
        <li class="svm-item">
          <div class="svm-head">
            <span class="svm-title">${escapeHtml(item.propertyTitle)}</span>
            <span class="svm-badge ${escapeHtml(normalizeStatus(item.status))}">${escapeHtml(badge)}</span>
          </div>
          <div class="svm-meta">Customer: ${escapeHtml(item.customerName || 'Customer')}</div>
          <div class="svm-meta">Preferred: ${escapeHtml(formatDate(item.preferredAt || item.createdAt))}</div>
          ${item.note ? `<div class="svm-meta">Note: ${escapeHtml(item.note)}</div>` : ''}
          ${item._queuedStatus ? '<div class="svm-queued">Status change queued (sync pending).</div>' : ''}
          ${canRespond ? `
            <div class="svm-actions">
              ${normalizeStatus(item.status) === 'requested' ? '<button data-next-status="confirmed" data-visit-id="' + escapeHtml(item.id) + '" type="button">Confirm</button>' : ''}
              <button data-next-status="completed" data-visit-id="${escapeHtml(item.id)}" type="button">Complete</button>
              <button data-next-status="rejected" data-visit-id="${escapeHtml(item.id)}" type="button">Reject</button>
              <button data-next-status="cancelled" data-visit-id="${escapeHtml(item.id)}" type="button">Cancel</button>
            </div>
          ` : ''}
        </li>
      `;
    }).join('');
  };

  const loadFromCache = () => {
    const items = readJson(CACHE_KEY, []);
    const normalized = (Array.isArray(items) ? items : [])
      .map(normalizeVisit)
      .filter(Boolean)
      .sort((a, b) => new Date(b.preferredAt || b.createdAt || 0).getTime() - new Date(a.preferredAt || a.createdAt || 0).getTime());
    const withOverrides = applyOverrides(normalized);
    lastVisits = withOverrides;
    renderSummary(withOverrides);
    renderList(withOverrides, 'No cached visit records found.');
  };

  const fetchLiveVisits = async (token) => {
    if (!token || typeof live.request !== 'function') return [];
    try {
      const response = await live.request('/visits/owner', { token });
      return toItems(response);
    } catch (error) {
      if (live.shouldFallbackToLocal && !live.shouldFallbackToLocal(error)) throw error;
      const fallback = await live.request('/visits', { token });
      return toItems(fallback);
    }
  };

  const loadVisits = async () => {
    const token = getToken();
    if (!token) {
      loadFromCache();
      setStatus('Login required for live visit queue. Showing local cache.', false);
      return;
    }

    setStatus('Refreshing live visit queue...');
    try {
      const liveItems = await fetchLiveVisits(token);
      const normalized = liveItems
        .map(normalizeVisit)
        .filter(Boolean)
        .sort((a, b) => new Date(b.preferredAt || b.createdAt || 0).getTime() - new Date(a.preferredAt || a.createdAt || 0).getTime());
      writeJson(CACHE_KEY, normalized);
      const withOverrides = applyOverrides(normalized);
      lastVisits = withOverrides;
      renderSummary(withOverrides);
      renderList(withOverrides);
      setStatus('Visit queue refreshed.');
    } catch (error) {
      loadFromCache();
      setStatus(`Live queue unavailable: ${text(error?.message, 'unknown error')}. Showing local cache.`, false);
    }
  };

  const setOptimisticStatus = (visitId, status) => {
    const next = lastVisits.map((item) => (
      item.id === visitId
        ? { ...item, status: normalizeStatus(status), _queuedStatus: true, updatedAt: new Date().toISOString() }
        : item
    ));
    lastVisits = next;
    renderSummary(next);
    renderList(next);
  };

  const updateVisitStatus = async (visitId, nextStatus) => {
    const token = getToken();
    if (!visitId || !nextStatus) return;
    setOverride(visitId, nextStatus);
    setOptimisticStatus(visitId, nextStatus);

    if (!token || typeof live.request !== 'function') {
      setStatus('Status queued locally. Login/live required for server sync.', false);
      return;
    }

    try {
      await live.request(`/visits/${encodeURIComponent(visitId)}/status`, {
        method: 'POST',
        token,
        data: { status: normalizeStatus(nextStatus) },
      });
      clearOverride(visitId);
      setStatus(`Visit ${visitId} updated to ${STATUS_LABELS[normalizeStatus(nextStatus)]}.`);
      await loadVisits();
    } catch (error) {
      if (live.shouldFallbackToLocal && live.shouldFallbackToLocal(error)) {
        setStatus(`Live update failed. Status queued locally (${STATUS_LABELS[normalizeStatus(nextStatus)]}).`, false);
        return;
      }
      clearOverride(visitId);
      setStatus(`Status update failed: ${text(error?.message, 'unknown error')}`, false);
      await loadVisits();
    }
  };

  listEl?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const visitId = text(target.getAttribute('data-visit-id'));
    const nextStatus = normalizeStatus(target.getAttribute('data-next-status'));
    if (!visitId || !nextStatus) return;
    updateVisitStatus(visitId, nextStatus).catch((error) => {
      setStatus(`Status update failed: ${text(error?.message, 'unknown error')}`, false);
    });
  });

  refreshBtn?.addEventListener('click', () => {
    loadVisits().catch((error) => {
      setStatus(`Queue refresh failed: ${text(error?.message, 'unknown error')}`, false);
    });
  });

  loadVisits().catch((error) => {
    setStatus(`Queue load failed: ${text(error?.message, 'unknown error')}`, false);
    loadFromCache();
  });
})();
