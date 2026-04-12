(() => {
  if (document.getElementById('adminCategoryCityGuardCard')) return;

  const live = window.PropertySetuLive || {};
  const isAdminPage = Boolean(document.getElementById('adminOverview') && document.getElementById('pendingProperties'));
  if (!isAdminPage) return;

  const CARD_ID = 'adminCategoryCityGuardCard';
  const STYLE_ID = 'admin-category-city-guard-style';
  const LISTINGS_KEY = 'propertySetu:listings';
  const REGISTRY_KEY = 'propertySetu:adminCatalogRegistry';
  const BLOCK_KEY = 'propertySetu:adminBlockedUsers';
  const CACHE_KEY = 'propertySetu:adminGovernanceCache';

  const DEFAULT_CATEGORIES = [
    'House',
    'Flat',
    'Villa',
    'Plot',
    'Farm House',
    'Vadi',
    'Agriculture Land',
    'Commercial',
    'Shop',
    'Office',
    'Warehouse',
    'PG/Hostel',
    'Property Care',
    'Home Maintenance',
    'Home Watch',
    'Buy',
    'Sell',
    'Rent',
    'Lease',
    'Mortgage (Girvi)',
  ];
  const DEFAULT_CITIES = ['Udaipur', 'Jaipur', 'Ahmedabad', 'Surat', 'Jodhpur'];

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
  const inr = (value) => `₹${numberFrom(value, 0).toLocaleString('en-IN')}`;
  const norm = (value) => text(value).replace(/\s+/g, ' ').trim();
  const slug = (value) => norm(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

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

  const getRegistry = () => {
    const raw = readJson(REGISTRY_KEY, {});
    const categories = Array.isArray(raw?.categories) ? raw.categories : [];
    const cities = Array.isArray(raw?.cities) ? raw.cities : [];
    const normalizeRows = (rows, type) => {
      const out = [];
      const seen = new Set();
      rows.forEach((item) => {
        const name = norm(item?.name || item);
        if (!name) return;
        const id = text(item?.id, `${type}-${slug(name)}`);
        const key = id.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        out.push({
          id,
          name,
          active: item?.active !== false,
          archived: Boolean(item?.archived),
          createdAt: text(item?.createdAt, new Date().toISOString()),
        });
      });
      return out;
    };
    const normalizedCategories = normalizeRows(categories, 'cat');
    const normalizedCities = normalizeRows(cities, 'city');
    const catSeen = new Set(normalizedCategories.map((row) => row.name.toLowerCase()));
    const citySeen = new Set(normalizedCities.map((row) => row.name.toLowerCase()));
    DEFAULT_CATEGORIES.forEach((name) => {
      if (!catSeen.has(name.toLowerCase())) {
        normalizedCategories.push({ id: `cat-${slug(name)}`, name, active: true, archived: false, createdAt: new Date().toISOString() });
      }
    });
    DEFAULT_CITIES.forEach((name) => {
      if (!citySeen.has(name.toLowerCase())) {
        normalizedCities.push({ id: `city-${slug(name)}`, name, active: true, archived: false, createdAt: new Date().toISOString() });
      }
    });
    return { categories: normalizedCategories, cities: normalizedCities };
  };
  const setRegistry = (registry) => writeJson(REGISTRY_KEY, registry || { categories: [], cities: [] });

  const getBlocked = () => {
    const rows = readJson(BLOCK_KEY, []);
    return (Array.isArray(rows) ? rows : [])
      .map((item) => ({
        id: text(item?.id, `blk-${slug(item?.key || '')}`),
        key: norm(item?.key || item?.userKey || ''),
        reason: text(item?.reason, 'Policy violation'),
        active: item?.active !== false,
        blockedAt: text(item?.blockedAt, new Date().toISOString()),
        unblockedAt: text(item?.unblockedAt),
      }))
      .filter((item) => item.key);
  };
  const setBlocked = (rows) => writeJson(BLOCK_KEY, Array.isArray(rows) ? rows : []);

  const ownerKeyOf = (item = {}) => {
    const ownerId = norm(item.ownerId || item.userId || item.owner?.id || '');
    if (ownerId) return ownerId;
    const ownerEmail = norm(item.ownerEmail || item.email || item.owner?.email || '');
    if (ownerEmail) return ownerEmail;
    const ownerPhone = text(item.ownerPhone || item.phone || item.owner?.phone || '').replace(/\D+/g, '');
    if (ownerPhone) return ownerPhone;
    return '';
  };

  const runAudit = ({ persist = false } = {}) => {
    const registry = getRegistry();
    const blocked = getBlocked();
    const listings = readJson(LISTINGS_KEY, []);
    const rows = Array.isArray(listings) ? listings : [];
    const activeCats = new Set(registry.categories.filter((item) => item.active && !item.archived).map((item) => item.name.toLowerCase()));
    const activeCities = new Set(registry.cities.filter((item) => item.active && !item.archived).map((item) => item.name.toLowerCase()));
    const blockedSet = new Set(blocked.filter((item) => item.active).map((item) => item.key.toLowerCase()));

    const issues = [];
    const impact = {};
    let catHits = 0;
    let cityHits = 0;
    let ownerHits = 0;

    const next = rows.map((item) => {
      const category = norm(item.category || item.propertyTypeCore || item.type || '');
      const city = norm(item.city || '');
      const owner = ownerKeyOf(item);
      const reasons = [];
      const categoryAllowed = !category || activeCats.has(category.toLowerCase());
      const cityAllowed = !city || activeCities.has(city.toLowerCase());
      const ownerBlocked = Boolean(owner && blockedSet.has(owner.toLowerCase()));
      if (!categoryAllowed) {
        reasons.push('Category not allowed');
        catHits += 1;
      }
      if (!cityAllowed) {
        reasons.push('City not allowed');
        cityHits += 1;
      }
      if (ownerBlocked) {
        reasons.push('Owner is blocked');
        ownerHits += 1;
        impact[owner.toLowerCase()] = numberFrom(impact[owner.toLowerCase()], 0) + 1;
      }
      if (reasons.length) {
        issues.push({
          id: text(item.id || item._id, '-'),
          title: text(item.title, 'Untitled'),
          category: category || '-',
          city: city || '-',
          owner: owner || '-',
          price: numberFrom(item.price, 0),
          reason: reasons.join(', '),
        });
      }
      return {
        ...item,
        adminGovernance: {
          categoryAllowed,
          cityAllowed,
          blockedOwner: ownerBlocked,
          checkedAt: new Date().toISOString(),
          reasons,
        },
        adminBlockedOwner: ownerBlocked,
      };
    });

    issues.sort((a, b) => numberFrom(b.price, 0) - numberFrom(a.price, 0));
    const summary = {
      listings: next.length,
      activeCategories: registry.categories.filter((item) => item.active && !item.archived).length,
      activeCities: registry.cities.filter((item) => item.active && !item.archived).length,
      blockedUsers: blocked.filter((item) => item.active).length,
      issues: issues.length,
      catHits,
      cityHits,
      ownerHits,
    };

    if (persist) {
      writeJson(LISTINGS_KEY, next);
      writeJson(CACHE_KEY, { checkedAt: new Date().toISOString(), summary, issues: issues.slice(0, 500), impact });
    }

    return { registry, blocked, summary, issues, impact };
  };

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${CARD_ID} .acg-status{margin:0 0 10px;color:#1f6d3d;font-size:14px;}
#${CARD_ID} .acg-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px;}
#${CARD_ID} .acg-btn{border:1px solid #0b3d91;border-radius:8px;background:#0b3d91;color:#fff;padding:7px 11px;font-weight:700;cursor:pointer;}
#${CARD_ID} .acg-btn.alt{background:#fff;color:#0b3d91;}
#${CARD_ID} .acg-btn.warn{background:#8f4f00;border-color:#8f4f00;}
#${CARD_ID} .acg-grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));margin-bottom:10px;}
#${CARD_ID} .acg-card{border:1px solid #dbe6f5;border-radius:10px;padding:10px;background:#fff;}
#${CARD_ID} .acg-card h3{margin:0 0 8px;color:#124a72;}
#${CARD_ID} .acg-kpi{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin-bottom:10px;}
#${CARD_ID} .acg-kpi-item{border:1px solid #d7e6f8;border-radius:8px;background:#f7fbff;padding:8px;}
#${CARD_ID} .acg-kpi-item small{display:block;color:#58718f;}
#${CARD_ID} .acg-kpi-item b{color:#11466e;font-size:16px;}
#${CARD_ID} .acg-form{display:grid;gap:8px;grid-template-columns:1fr auto;}
#${CARD_ID} .acg-form input{border:1px solid #ccd9ee;border-radius:8px;padding:7px 9px;}
#${CARD_ID} .acg-wrap{overflow:auto;}
#${CARD_ID} table{width:100%;border-collapse:collapse;min-width:560px;}
#${CARD_ID} th,#${CARD_ID} td{border:1px solid #d5e2f4;padding:7px;text-align:left;font-size:13px;vertical-align:top;}
#${CARD_ID} th{background:#f3f8ff;}
#${CARD_ID} .acg-chip{display:inline-block;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:700;}
#${CARD_ID} .acg-chip.ok{background:#e7f8ef;color:#19643a;}
#${CARD_ID} .acg-chip.off{background:#ffe5e5;color:#992222;}
#${CARD_ID} .acg-actions{display:flex;flex-wrap:wrap;gap:6px;}
#${CARD_ID} .acg-actions button{border:1px solid #cbdcf2;background:#fff;color:#12395f;border-radius:999px;padding:4px 9px;font-size:12px;cursor:pointer;}
    `;
    document.head.appendChild(style);
  }

  const card = document.createElement('div');
  card.className = 'container';
  card.id = CARD_ID;
  card.innerHTML = `
    <h2>Category + City Governance & User Block Control</h2>
    <p id="acgStatus" class="acg-status">Loading governance panel...</p>
    <div class="acg-toolbar">
      <button id="acgRefreshBtn" class="acg-btn" type="button">Refresh</button>
      <button id="acgAuditBtn" class="acg-btn warn" type="button">Run Audit</button>
      <button id="acgCsvBtn" class="acg-btn alt" type="button">Export CSV</button>
    </div>
    <div id="acgKpi" class="acg-kpi"></div>
    <div class="acg-grid">
      <section class="acg-card">
        <h3>Category Management</h3>
        <form id="acgCategoryForm" class="acg-form">
          <input id="acgCategoryInput" type="text" placeholder="Add category" />
          <button class="acg-btn" type="submit">Add</button>
        </form>
        <div id="acgCategoryTable" class="acg-wrap" style="margin-top:10px;"></div>
      </section>
      <section class="acg-card">
        <h3>City Management</h3>
        <form id="acgCityForm" class="acg-form">
          <input id="acgCityInput" type="text" placeholder="Add city" />
          <button class="acg-btn" type="submit">Add</button>
        </form>
        <div id="acgCityTable" class="acg-wrap" style="margin-top:10px;"></div>
      </section>
    </div>
    <section class="acg-card">
      <h3>User Block Management</h3>
      <form id="acgBlockForm" class="acg-form">
        <input id="acgBlockInput" type="text" placeholder="Owner ID / email / phone" />
        <button class="acg-btn warn" type="submit">Block</button>
      </form>
      <div id="acgBlockTable" class="acg-wrap" style="margin-top:10px;"></div>
    </section>
    <section class="acg-card" style="margin-top:10px;">
      <h3>Compliance Queue</h3>
      <div id="acgIssueTable" class="acg-wrap"></div>
    </section>
  `;
  const anchor = document.getElementById('adminFraudRiskCenterCard')
    || document.getElementById('adminFeaturedCommissionProCard')
    || document.getElementById('adminOverview')?.closest('.container')
    || document.querySelector('.container');
  if (anchor) anchor.insertAdjacentElement('afterend', card);
  else document.body.appendChild(card);

  const statusEl = document.getElementById('acgStatus');
  const kpiEl = document.getElementById('acgKpi');
  const categoryTableEl = document.getElementById('acgCategoryTable');
  const cityTableEl = document.getElementById('acgCityTable');
  const blockTableEl = document.getElementById('acgBlockTable');
  const issueTableEl = document.getElementById('acgIssueTable');
  const refreshBtn = document.getElementById('acgRefreshBtn');
  const auditBtn = document.getElementById('acgAuditBtn');
  const csvBtn = document.getElementById('acgCsvBtn');
  const categoryForm = document.getElementById('acgCategoryForm');
  const cityForm = document.getElementById('acgCityForm');
  const blockForm = document.getElementById('acgBlockForm');
  const categoryInput = document.getElementById('acgCategoryInput');
  const cityInput = document.getElementById('acgCityInput');
  const blockInput = document.getElementById('acgBlockInput');

  let model = runAudit({ persist: false });

  const setStatus = (message, ok = true) => {
    statusEl.textContent = message;
    statusEl.style.color = ok ? '#1f6d3d' : '#8d1e1e';
  };

  const render = () => {
    const s = model.summary || {};
    kpiEl.innerHTML = `
      <div class="acg-kpi-item"><small>Listings</small><b>${numberFrom(s.listings, 0)}</b></div>
      <div class="acg-kpi-item"><small>Active Categories</small><b>${numberFrom(s.activeCategories, 0)}</b></div>
      <div class="acg-kpi-item"><small>Active Cities</small><b>${numberFrom(s.activeCities, 0)}</b></div>
      <div class="acg-kpi-item"><small>Blocked Users</small><b>${numberFrom(s.blockedUsers, 0)}</b></div>
      <div class="acg-kpi-item"><small>Total Issues</small><b>${numberFrom(s.issues, 0)}</b></div>
      <div class="acg-kpi-item"><small>Owner Block Hits</small><b>${numberFrom(s.ownerHits, 0)}</b></div>
    `;

    categoryTableEl.innerHTML = `
      <table><thead><tr><th>Category</th><th>Status</th><th>Action</th></tr></thead><tbody>
      ${(model.registry.categories || []).sort((a, b) => a.name.localeCompare(b.name)).map((item) => `
        <tr>
          <td>${escapeHtml(item.name)}</td>
          <td><span class="acg-chip ${item.active ? 'ok' : 'off'}">${item.active ? 'Active' : (item.archived ? 'Archived' : 'Disabled')}</span></td>
          <td><div class="acg-actions">
            <button type="button" data-kind="cat" data-act="toggle" data-id="${escapeHtml(item.id)}">${item.active ? 'Disable' : 'Enable'}</button>
            <button type="button" data-kind="cat" data-act="${item.archived ? 'restore' : 'archive'}" data-id="${escapeHtml(item.id)}">${item.archived ? 'Restore' : 'Archive'}</button>
          </div></td>
        </tr>
      `).join('')}
      </tbody></table>
    `;

    cityTableEl.innerHTML = `
      <table><thead><tr><th>City</th><th>Status</th><th>Action</th></tr></thead><tbody>
      ${(model.registry.cities || []).sort((a, b) => a.name.localeCompare(b.name)).map((item) => `
        <tr>
          <td>${escapeHtml(item.name)}</td>
          <td><span class="acg-chip ${item.active ? 'ok' : 'off'}">${item.active ? 'Active' : (item.archived ? 'Archived' : 'Disabled')}</span></td>
          <td><div class="acg-actions">
            <button type="button" data-kind="city" data-act="toggle" data-id="${escapeHtml(item.id)}">${item.active ? 'Disable' : 'Enable'}</button>
            <button type="button" data-kind="city" data-act="${item.archived ? 'restore' : 'archive'}" data-id="${escapeHtml(item.id)}">${item.archived ? 'Restore' : 'Archive'}</button>
          </div></td>
        </tr>
      `).join('')}
      </tbody></table>
    `;

    if (!(model.blocked || []).length) {
      blockTableEl.innerHTML = '<p style="margin:0;color:#607da8;">No blocked users.</p>';
    } else {
      blockTableEl.innerHTML = `
        <table><thead><tr><th>User</th><th>Status</th><th>Reason</th><th>Impact</th><th>Action</th></tr></thead><tbody>
        ${(model.blocked || []).map((item) => `
          <tr>
            <td>${escapeHtml(item.key)}</td>
            <td><span class="acg-chip ${item.active ? 'off' : 'ok'}">${item.active ? 'Blocked' : 'Released'}</span></td>
            <td>${escapeHtml(item.reason)}</td>
            <td>${numberFrom(model.impact?.[item.key.toLowerCase()], 0)}</td>
            <td>${item.active ? `<button type="button" data-kind="block" data-act="unblock" data-id="${escapeHtml(item.id)}">Unblock</button>` : '-'}</td>
          </tr>
        `).join('')}
        </tbody></table>
      `;
    }

    if (!(model.issues || []).length) {
      issueTableEl.innerHTML = '<p style="margin:0;color:#607da8;">No compliance issues.</p>';
    } else {
      issueTableEl.innerHTML = `
        <table><thead><tr><th>Listing</th><th>Category</th><th>City</th><th>Owner</th><th>Price</th><th>Reason</th></tr></thead><tbody>
        ${(model.issues || []).slice(0, 80).map((row) => `
          <tr>
            <td><b>${escapeHtml(row.title)}</b><br><small>${escapeHtml(row.id)}</small></td>
            <td>${escapeHtml(row.category)}</td>
            <td>${escapeHtml(row.city)}</td>
            <td>${escapeHtml(row.owner)}</td>
            <td>${escapeHtml(inr(row.price))}</td>
            <td>${escapeHtml(row.reason)}</td>
          </tr>
        `).join('')}
        </tbody></table>
      `;
    }
  };

  const refresh = (persist = false) => {
    model = runAudit({ persist });
    render();
    setStatus(`Governance ready. ${numberFrom(model.summary?.issues, 0)} issue(s) across ${numberFrom(model.summary?.listings, 0)} listing(s).`);
  };

  const upsertRegistry = (type, value) => {
    const name = norm(value);
    if (!name) return false;
    const registry = getRegistry();
    const list = type === 'cat' ? registry.categories : registry.cities;
    const existing = list.find((row) => row.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      existing.active = true;
      existing.archived = false;
    } else {
      list.push({ id: `${type}-${slug(name)}`, name, active: true, archived: false, createdAt: new Date().toISOString() });
    }
    setRegistry(registry);
    return true;
  };

  const updateRegistryRow = (kind, id, action) => {
    const registry = getRegistry();
    const list = kind === 'cat' ? registry.categories : registry.cities;
    const row = list.find((item) => item.id === id);
    if (!row) return false;
    if (action === 'toggle') {
      row.active = !row.active;
      row.archived = false;
    }
    if (action === 'archive') {
      row.active = false;
      row.archived = true;
    }
    if (action === 'restore') {
      row.active = true;
      row.archived = false;
    }
    setRegistry(registry);
    return true;
  };

  const blockUser = async (key) => {
    const safe = norm(key).toLowerCase();
    if (!safe) return false;
    const rows = getBlocked();
    const existing = rows.find((item) => item.key.toLowerCase() === safe);
    if (existing && existing.active) return false;
    if (existing) {
      existing.active = true;
      existing.blockedAt = new Date().toISOString();
      existing.unblockedAt = '';
    } else {
      rows.unshift({
        id: `blk-${slug(safe)}-${Date.now()}`,
        key: safe,
        reason: 'Policy violation',
        active: true,
        blockedAt: new Date().toISOString(),
        unblockedAt: '',
      });
    }
    setBlocked(rows);
    return true;
  };

  const unblockUser = (id) => {
    const rows = getBlocked();
    const target = rows.find((item) => item.id === id);
    if (!target) return false;
    target.active = false;
    target.unblockedAt = new Date().toISOString();
    setBlocked(rows);
    return true;
  };

  const exportCsv = () => {
    const headers = ['Listing ID', 'Title', 'Category', 'City', 'Owner', 'Price', 'Reason'];
    const lines = [headers.join(',')];
    (model.issues || []).forEach((row) => {
      const cols = [row.id, row.title, row.category, row.city, row.owner, String(numberFrom(row.price, 0)), row.reason]
        .map((cell) => {
          const raw = String(cell || '');
          if (!/[",\n]/.test(raw)) return raw;
          return `"${raw.replace(/"/g, '""')}"`;
        });
      lines.push(cols.join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `admin-governance-issues-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  categoryForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!upsertRegistry('cat', categoryInput?.value)) {
      setStatus('Category name required.', false);
      return;
    }
    if (categoryInput) categoryInput.value = '';
    refresh(false);
  });
  cityForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!upsertRegistry('city', cityInput?.value)) {
      setStatus('City name required.', false);
      return;
    }
    if (cityInput) cityInput.value = '';
    refresh(false);
  });
  blockForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    blockUser(blockInput?.value).then((ok) => {
      if (!ok) {
        setStatus('User key required or already blocked.', false);
        return;
      }
      if (blockInput) blockInput.value = '';
      refresh(true);
    });
  });

  [categoryTableEl, cityTableEl].forEach((root) => {
    root?.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const btn = target.closest('button');
      if (!btn) return;
      const kind = text(btn.getAttribute('data-kind'));
      const action = text(btn.getAttribute('data-act'));
      const id = text(btn.getAttribute('data-id'));
      if (!kind || !action || !id) return;
      if (updateRegistryRow(kind, id, action)) refresh(false);
    });
  });
  blockTableEl?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const btn = target.closest('button');
    if (!btn) return;
    const action = text(btn.getAttribute('data-act'));
    const id = text(btn.getAttribute('data-id'));
    if (action !== 'unblock' || !id) return;
    if (unblockUser(id)) refresh(true);
  });

  refreshBtn?.addEventListener('click', () => refresh(false));
  auditBtn?.addEventListener('click', () => refresh(true));
  csvBtn?.addEventListener('click', exportCsv);

  refresh(false);
})();
