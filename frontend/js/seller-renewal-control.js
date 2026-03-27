(() => {
  if (document.getElementById('sellerRenewalControlCard')) return;

  const live = window.PropertySetuLive || {};
  const isSellerPage = Boolean(document.getElementById('addPropertyForm') && document.getElementById('propertyList'));
  if (!isSellerPage) return;

  const STYLE_ID = 'seller-renewal-control-style';
  const CARD_ID = 'sellerRenewalControlCard';
  const LISTINGS_KEY = 'propertySetu:listings';
  const RENEWAL_HISTORY_KEY = 'propertySetu:sellerRenewalHistory';
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

  const getToken = () => {
    if (typeof live.getAnyToken === 'function') return text(live.getAnyToken());
    if (typeof live.getToken === 'function') return text(live.getToken('seller') || live.getToken('admin') || live.getToken('customer'));
    return '';
  };

  const getSessionId = () => {
    if (typeof live.getAnySession === 'function') return text(live.getAnySession()?.id);
    return '';
  };

  const toDateLabel = (value) => {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const expiryTsFor = (item = {}) => {
    const direct = Date.parse(text(item.listingExpiresAt || item.featuredUntil));
    if (Number.isFinite(direct)) return direct;
    const listedAt = Date.parse(text(item.createdAt || item.listedAt));
    if (Number.isFinite(listedAt)) return listedAt + (30 * DAY_MS);
    return NaN;
  };

  const getMyListings = () => {
    const rows = readJson(LISTINGS_KEY, []);
    const sessionId = getSessionId();
    return (Array.isArray(rows) ? rows : [])
      .filter((item) => item && typeof item === 'object')
      .filter((item) => !sessionId || text(item.ownerId) === sessionId)
      .filter((item) => text(item.city, 'Udaipur').toLowerCase().includes('udaipur'));
  };

  const mergeByIdLocal = (incoming = []) => {
    const existing = readJson(LISTINGS_KEY, []);
    const map = new Map();
    (Array.isArray(existing) ? existing : []).forEach((item) => {
      const id = text(item?.id);
      if (id) map.set(id, item);
    });
    (Array.isArray(incoming) ? incoming : []).forEach((item) => {
      const id = text(item?.id);
      if (!id) return;
      const prev = map.get(id) || {};
      map.set(id, { ...prev, ...item });
    });
    writeJson(LISTINGS_KEY, [...map.values()]);
  };

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${CARD_ID} .src-status { margin: 0 0 10px; color: #1f6d3d; font-size: 14px; }
#${CARD_ID} .src-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 12px; }
#${CARD_ID} .src-btn {
  border: 1px solid #0b3d91;
  border-radius: 8px;
  background: #0b3d91;
  color: #fff;
  padding: 7px 11px;
  font-weight: 700;
  cursor: pointer;
}
#${CARD_ID} .src-btn.alt { background: #fff; color: #0b3d91; }
#${CARD_ID} .src-select { border: 1px solid #ccd9ee; border-radius: 8px; padding: 6px 9px; }
#${CARD_ID} .src-kpi-grid { display: grid; gap: 8px; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); margin-bottom: 10px; }
#${CARD_ID} .src-kpi { border: 1px solid #d7e6f8; border-radius: 8px; background: #f7fbff; padding: 8px; }
#${CARD_ID} .src-kpi small { display: block; color: #58718f; }
#${CARD_ID} .src-kpi b { color: #11466e; font-size: 16px; }
#${CARD_ID} .src-wrap { border: 1px solid #dbe6f5; border-radius: 10px; padding: 10px; background: #fff; }
#${CARD_ID} table { width: 100%; border-collapse: collapse; }
#${CARD_ID} th, #${CARD_ID} td { border: 1px solid #d5e2f4; padding: 7px; text-align: left; font-size: 13px; }
#${CARD_ID} th { background: #f3f8ff; }
#${CARD_ID} .src-chip { display: inline-block; border-radius: 999px; padding: 2px 8px; font-size: 11px; font-weight: 700; }
#${CARD_ID} .src-chip.expired { background: #ffe5e5; color: #9b1c1c; }
#${CARD_ID} .src-chip.urgent { background: #fff0d9; color: #9f5d00; }
#${CARD_ID} .src-chip.soon { background: #eef6ff; color: #1d4f87; }
#${CARD_ID} .src-chip.active { background: #e8f8ef; color: #17693a; }
#${CARD_ID} .src-chip.unset { background: #f2f4f7; color: #5f6f86; }
@media (max-width: 920px) {
  #${CARD_ID} .src-toolbar { flex-direction: column; align-items: flex-start; }
}
    `;
    document.head.appendChild(style);
  }

  const card = document.createElement('div');
  card.className = 'container';
  card.id = CARD_ID;
  card.innerHTML = `
    <h2>Listing Renewal Control Center</h2>
    <p id="srcStatus" class="src-status">Loading renewal insights...</p>
    <div class="src-toolbar">
      <button id="srcRefreshBtn" class="src-btn" type="button">Refresh</button>
      <button id="srcBulkBtn" class="src-btn alt" type="button">Renew Expiring (<=7d)</button>
      <button id="srcCsvBtn" class="src-btn alt" type="button">Export CSV</button>
      <label style="font-size:13px;color:#3d5674;">
        Renew For:
        <select id="srcDaysSelect" class="src-select">
          <option value="7">7 days</option>
          <option value="15">15 days</option>
          <option value="30" selected>30 days</option>
          <option value="60">60 days</option>
        </select>
      </label>
    </div>
    <div id="srcKpiGrid" class="src-kpi-grid"></div>
    <div id="srcWrap" class="src-wrap"><p style="margin:0;color:#607da8;">No listings loaded yet.</p></div>
  `;

  const chatCard = document.getElementById('sellerChatInboxCard');
  const containers = Array.from(document.querySelectorAll('.container'));
  const defaultAnchor = containers[1] || containers[containers.length - 1];
  const anchor = chatCard || defaultAnchor;
  if (anchor) anchor.insertAdjacentElement('afterend', card);
  else document.body.appendChild(card);

  const statusEl = document.getElementById('srcStatus');
  const kpiGridEl = document.getElementById('srcKpiGrid');
  const wrapEl = document.getElementById('srcWrap');
  const refreshBtn = document.getElementById('srcRefreshBtn');
  const bulkBtn = document.getElementById('srcBulkBtn');
  const csvBtn = document.getElementById('srcCsvBtn');
  const daysSelect = document.getElementById('srcDaysSelect');

  let rowsCache = [];
  let refreshTimer = null;

  const setStatus = (message, ok = true) => {
    statusEl.textContent = message;
    statusEl.style.color = ok ? '#1f6d3d' : '#8d1e1e';
  };

  const statusMetaFromDiff = (diffDays, hasExpiry) => {
    if (!hasExpiry) return { key: 'unset', label: 'No expiry date' };
    if (diffDays < 0) return { key: 'expired', label: `Expired ${Math.abs(diffDays)}d ago` };
    if (diffDays <= 3) return { key: 'urgent', label: `Expires in ${diffDays}d` };
    if (diffDays <= 7) return { key: 'soon', label: `Expiring in ${diffDays}d` };
    return { key: 'active', label: `Active ${diffDays}d left` };
  };

  const buildRows = (items = []) => {
    return (Array.isArray(items) ? items : []).map((item) => {
      const id = text(item?.id);
      const title = text(item?.title, id || 'Untitled');
      const expiryTs = expiryTsFor(item);
      const hasExpiry = Number.isFinite(expiryTs);
      const diffDays = hasExpiry ? Math.ceil((expiryTs - Date.now()) / DAY_MS) : NaN;
      const statusMeta = statusMetaFromDiff(diffDays, hasExpiry);
      return {
        id,
        title,
        price: numberFrom(item?.price, 0),
        featured: Boolean(item?.featured),
        expiryIso: hasExpiry ? new Date(expiryTs).toISOString() : '',
        expiryLabel: hasExpiry ? toDateLabel(expiryTs) : '-',
        diffDays,
        hasExpiry,
        statusKey: statusMeta.key,
        statusLabel: statusMeta.label,
      };
    }).sort((a, b) => {
      const order = { expired: 0, urgent: 1, soon: 2, active: 3, unset: 4 };
      const ao = numberFrom(order[a.statusKey], 99);
      const bo = numberFrom(order[b.statusKey], 99);
      if (ao !== bo) return ao - bo;
      if (Number.isFinite(a.diffDays) && Number.isFinite(b.diffDays)) return a.diffDays - b.diffDays;
      return a.title.localeCompare(b.title);
    });
  };

  const renderKpis = (rows = []) => {
    const expired = rows.filter((row) => row.statusKey === 'expired').length;
    const urgent = rows.filter((row) => row.statusKey === 'urgent').length;
    const soon = rows.filter((row) => row.statusKey === 'soon').length;
    const active = rows.filter((row) => row.statusKey === 'active').length;
    const history = readJson(RENEWAL_HISTORY_KEY, []);
    const today = new Date().toISOString().slice(0, 10);
    const renewedToday = (Array.isArray(history) ? history : []).filter((item) => text(item?.at).slice(0, 10) === today).length;
    kpiGridEl.innerHTML = `
      <div class="src-kpi"><small>Total Listings</small><b>${rows.length}</b></div>
      <div class="src-kpi"><small>Expired</small><b>${expired}</b></div>
      <div class="src-kpi"><small>Urgent (<=3d)</small><b>${urgent}</b></div>
      <div class="src-kpi"><small>Soon (<=7d)</small><b>${soon}</b></div>
      <div class="src-kpi"><small>Active</small><b>${active}</b></div>
      <div class="src-kpi"><small>Renewed Today</small><b>${renewedToday}</b></div>
    `;
  };

  const renderTable = (rows = []) => {
    if (!rows.length) {
      wrapEl.innerHTML = '<p style="margin:0;color:#607da8;">No seller listings found for renewal control.</p>';
      return;
    }
    wrapEl.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Property</th>
            <th>Status</th>
            <th>Expiry</th>
            <th>Price</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td><b>${escapeHtml(row.title)}</b><br><small style="color:#5b6e86;">ID: ${escapeHtml(row.id || '-')}</small></td>
              <td><span class="src-chip ${row.statusKey}">${escapeHtml(row.statusLabel)}</span></td>
              <td>${escapeHtml(row.expiryLabel)}</td>
              <td>₹${row.price.toLocaleString('en-IN')}</td>
              <td>
                <button class="src-btn" type="button" data-renew-id="${escapeHtml(row.id)}" ${row.id ? '' : 'disabled'}>
                  Renew Now
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  const syncMineFromLive = async () => {
    if (!live.request) return;
    const token = getToken();
    if (!token) return;
    try {
      const response = await live.request('/properties?city=Udaipur&mine=1', { token });
      const fromApi = (response?.items || []).map((entry) => {
        if (typeof live.normalizeApiListing === 'function') return live.normalizeApiListing(entry);
        return entry;
      }).filter(Boolean);
      mergeByIdLocal(fromApi);
    } catch {
      // keep local cache
    }
  };

  const pushRenewalHistory = (ids = [], days = 30) => {
    const history = readJson(RENEWAL_HISTORY_KEY, []);
    const next = Array.isArray(history) ? history.slice(0, 199) : [];
    const at = new Date().toISOString();
    ids.forEach((id) => next.unshift({ id, at, days }));
    writeJson(RENEWAL_HISTORY_KEY, next.slice(0, 200));
  };

  const applyLocalRenewal = (ids = [], expiryIso) => {
    const idSet = new Set((Array.isArray(ids) ? ids : []).map((id) => text(id)).filter(Boolean));
    if (!idSet.size) return [];
    const rows = readJson(LISTINGS_KEY, []);
    const updatedIds = [];
    const next = (Array.isArray(rows) ? rows : []).map((item) => {
      const id = text(item?.id);
      if (!idSet.has(id)) return item;
      updatedIds.push(id);
      return {
        ...item,
        listingExpiresAt: expiryIso,
        featuredUntil: expiryIso,
        updatedAt: new Date().toISOString(),
      };
    });
    writeJson(LISTINGS_KEY, next);
    return updatedIds;
  };

  const patchRenewalLive = async (id, expiryIso, token) => {
    if (!live.request || !token || !id) return;
    try {
      await live.request(`/properties/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        token,
        data: { featuredUntil: expiryIso, listingExpiresAt: expiryIso },
      });
    } catch (error) {
      if (typeof live.shouldFallbackToLocal === 'function' && live.shouldFallbackToLocal(error)) return;
      throw error;
    }
  };

  const renewIds = async (ids = [], days = 30) => {
    const cleanIds = [...new Set((Array.isArray(ids) ? ids : []).map((id) => text(id)).filter(Boolean))];
    if (!cleanIds.length) {
      setStatus('No listings selected for renewal.', false);
      return;
    }
    const safeDays = Math.max(1, numberFrom(days, 30));
    const expiryIso = new Date(Date.now() + (safeDays * DAY_MS)).toISOString();
    const updatedIds = applyLocalRenewal(cleanIds, expiryIso);
    pushRenewalHistory(updatedIds, safeDays);

    const token = getToken();
    if (token) {
      for (const id of updatedIds) {
        try {
          await patchRenewalLive(id, expiryIso, token);
        } catch (error) {
          setStatus(`Local renew done, but live sync failed for ${id}: ${text(error?.message, 'Unknown error')}`, false);
        }
      }
    }

    setStatus(`Renewed ${updatedIds.length} listing(s) for ${safeDays} day(s).`);
    await refresh();
  };

  const exportCsv = () => {
    const headers = ['Property ID', 'Title', 'Status', 'Expiry', 'Price'];
    const lines = rowsCache.map((row) => [
      row.id,
      row.title,
      row.statusLabel,
      row.expiryLabel,
      String(row.price),
    ]);
    const encodeCell = (value) => {
      const raw = String(value || '');
      if (!/[",\n]/.test(raw)) return raw;
      return `"${raw.replace(/"/g, '""')}"`;
    };
    const csv = [headers, ...lines].map((line) => line.map(encodeCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `seller-renewal-report-${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus('Renewal CSV exported.');
  };

  const refresh = async () => {
    await syncMineFromLive();
    const rows = buildRows(getMyListings());
    rowsCache = rows;
    renderKpis(rows);
    renderTable(rows);
    setStatus(`Renewal board ready. ${rows.length} listing(s) tracked.`);
  };

  refreshBtn?.addEventListener('click', () => {
    refresh().catch((error) => setStatus(text(error?.message, 'Refresh failed.'), false));
  });

  bulkBtn?.addEventListener('click', async () => {
    const days = numberFrom(daysSelect?.value, 30);
    const ids = rowsCache
      .filter((row) => row.statusKey === 'expired' || row.statusKey === 'urgent' || row.statusKey === 'soon')
      .map((row) => row.id);
    await renewIds(ids, days);
  });

  csvBtn?.addEventListener('click', exportCsv);

  wrapEl?.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const id = target.getAttribute('data-renew-id');
    if (!id) return;
    const days = numberFrom(daysSelect?.value, 30);
    await renewIds([id], days);
  });

  if (refreshTimer) window.clearInterval(refreshTimer);
  refreshTimer = window.setInterval(() => {
    refresh().catch(() => null);
  }, 45000);

  refresh().catch((error) => setStatus(text(error?.message, 'Unable to load renewal board.'), false));
})();
