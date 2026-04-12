(() => {
  if (document.getElementById('adminAnalyticsCommandCenterCard')) return;

  const live = window.PropertySetuLive || {};
  const isAdminPage = Boolean(document.getElementById('pendingProperties') && document.getElementById('adminOverview'));
  if (!isAdminPage) return;

  const CARD_ID = 'adminAnalyticsCommandCenterCard';
  const STYLE_ID = 'admin-analytics-command-center-style';
  const LISTINGS_KEY = 'propertySetu:listings';
  const BLOCKED_KEY = 'propertySetu:adminBlockedUsers';
  const GOVERNANCE_CACHE_KEY = 'propertySetu:adminGovernanceCache';
  const FRAUD_TRACK_KEY = 'propertySetu:adminFraudRiskTrack';
  const ADMIN_REVENUE_LOG_KEY = 'propertySetu:adminRevenueControlLog';
  const ADMIN_AUTOMATION_LOG_KEY = 'propertySetu:adminAutomationLog';
  const SELLER_BOOST_LOG_KEY = 'propertySetu:sellerBoostLog';
  const SELLER_EXPIRY_LOG_KEY = 'propertySetu:sellerExpiryAlertLog';
  const LOAN_LOCAL_KEY = 'propertySetu:loanAssistanceLocal';
  const DOC_LOCAL_KEY = 'propertySetu:documentationRequestsLocal';
  const BOOKING_LOCAL_KEY = 'propertySetu:ecosystemBookingsLocal';
  const FRANCHISE_LOCAL_KEY = 'propertySetu:franchiseRequestsLocal';
  const FILTER_KEY = 'propertySetu:adminAnalyticsCenterFilter';

  const DAY_MS = 86400000;

  const text = (value, fallback = '') => {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  };
  const numberFrom = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const inr = (value) => `₹${numberFrom(value, 0).toLocaleString('en-IN')}`;
  const norm = (value) => text(value).toLowerCase();
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
    if (typeof live.getToken === 'function') {
      const token = text(live.getToken('admin'));
      if (token) return token;
    }
    if (typeof live.getAnyToken === 'function') return text(live.getAnyToken());
    const adminSession = readJson('propertysetu-admin-session', {});
    return text(adminSession?.token);
  };

  const toDateLabel = (value) => {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  };
  const ts = (value) => {
    const date = new Date(value || '');
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  };
  const dateKey = (value) => {
    const millis = ts(value);
    if (!millis) return '';
    return new Date(millis).toISOString().slice(0, 10);
  };

  const normalizeListing = (item = {}) => ({
    id: text(item.id || item._id),
    title: text(item.title, 'Untitled'),
    city: text(item.city, 'Udaipur'),
    locality: text(item.location || item.locality, ''),
    category: text(item.category || item.propertyTypeCore || item.type, 'Unknown'),
    purpose: text(item.purpose || item.type || item.saleRentMode, 'Unknown'),
    price: Math.max(0, numberFrom(item.price, 0)),
    verified: Boolean(item.verified || item.verifiedByPropertySetu || norm(item.status) === 'approved'),
    featured: Boolean(item.featured),
    status: text(item.status, 'Pending'),
    createdAt: text(item.createdAt || item.listedAt || item.updatedAt),
    riskScore: clamp(numberFrom(item?.aiReview?.fraudRiskScore, item?.riskScore || 45), 0, 100),
    fakeSignal: Boolean(item?.aiReview?.fakeListingSignal || item?.aiReview?.duplicatePhotoDetected || item?.aiReview?.suspiciousPricingAlert),
  });

  const getLocalRows = (key) => {
    const rows = readJson(key, []);
    return Array.isArray(rows) ? rows : [];
  };

  const normalizeActivity = (entry = {}, source = '') => ({
    id: text(entry.id || `${source}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    at: text(entry.at || entry.createdAt || entry.updatedAt),
    source,
    type: text(entry.type || entry.action, source),
    title: text(entry.title || entry.message || entry.action || source),
    amount: Math.max(0, numberFrom(entry.amount, 0)),
    priority: clamp(numberFrom(entry.priority, 0), 0, 100),
    propertyId: text(entry.propertyId || entry.id),
    message: text(entry.message || entry.details || ''),
  });

  const getTimeFilter = () => {
    const filter = readJson(FILTER_KEY, {});
    return {
      days: clamp(numberFrom(filter?.days, 30), 7, 180),
      riskThreshold: clamp(numberFrom(filter?.riskThreshold, 70), 40, 95),
    };
  };
  const setTimeFilter = (next) => {
    const current = getTimeFilter();
    writeJson(FILTER_KEY, { ...current, ...(next || {}) });
  };

  const withinDays = (value, days) => {
    if (!value) return false;
    const delta = Date.now() - ts(value);
    return delta >= 0 && delta <= (Math.max(1, numberFrom(days, 30)) * DAY_MS);
  };

  const loadLiveQueues = async () => {
    const token = getToken();
    if (!token || typeof live.request !== 'function') {
      return {
        docs: getLocalRows(DOC_LOCAL_KEY),
        loans: getLocalRows(LOAN_LOCAL_KEY),
        bookings: getLocalRows(BOOKING_LOCAL_KEY),
        franchise: getLocalRows(FRANCHISE_LOCAL_KEY),
        commissionAnalytics: {},
        report: {},
      };
    }
    try {
      const [docsRes, loansRes, bookingsRes, franchiseRes, commissionRes, reportRes] = await Promise.allSettled([
        live.request('/documentation/requests', { token }),
        live.request('/loan/assistance', { token }),
        live.request('/ecosystem/bookings', { token }),
        live.request('/franchise/requests', { token }),
        live.request('/admin/commission-analytics', { token }),
        live.request('/admin/report?days=30', { token }),
      ]);

      const toItems = (result) => (result.status === 'fulfilled' ? (Array.isArray(result.value?.items) ? result.value.items : []) : []);
      return {
        docs: toItems(docsRes),
        loans: toItems(loansRes),
        bookings: toItems(bookingsRes),
        franchise: toItems(franchiseRes),
        commissionAnalytics: commissionRes.status === 'fulfilled' ? (commissionRes.value?.analytics || {}) : {},
        report: reportRes.status === 'fulfilled' ? (reportRes.value || {}) : {},
      };
    } catch {
      return {
        docs: getLocalRows(DOC_LOCAL_KEY),
        loans: getLocalRows(LOAN_LOCAL_KEY),
        bookings: getLocalRows(BOOKING_LOCAL_KEY),
        franchise: getLocalRows(FRANCHISE_LOCAL_KEY),
        commissionAnalytics: {},
        report: {},
      };
    }
  };

  const buildModel = async () => {
    const filter = getTimeFilter();
    const listings = getLocalRows(LISTINGS_KEY)
      .map((item) => normalizeListing(item))
      .filter((item) => item.id);

    const blockedUsers = getLocalRows(BLOCKED_KEY).filter((item) => item?.active !== false);
    const governanceCache = readJson(GOVERNANCE_CACHE_KEY, {});
    const fraudTrack = getLocalRows(FRAUD_TRACK_KEY);
    const revenueLog = getLocalRows(ADMIN_REVENUE_LOG_KEY).map((item) => normalizeActivity(item, 'revenue'));
    const automationLog = getLocalRows(ADMIN_AUTOMATION_LOG_KEY).map((item) => normalizeActivity(item, 'automation'));
    const boostLog = getLocalRows(SELLER_BOOST_LOG_KEY).map((item) => normalizeActivity(item, 'boost'));
    const expiryLog = getLocalRows(SELLER_EXPIRY_LOG_KEY).map((item) => normalizeActivity(item, 'expiry'));

    const liveQueues = await loadLiveQueues();
    const docs = Array.isArray(liveQueues.docs) ? liveQueues.docs : [];
    const loans = Array.isArray(liveQueues.loans) ? liveQueues.loans : [];
    const bookings = Array.isArray(liveQueues.bookings) ? liveQueues.bookings : [];
    const franchise = Array.isArray(liveQueues.franchise) ? liveQueues.franchise : [];
    const commissionAnalytics = liveQueues.commissionAnalytics || {};
    const report = liveQueues.report || {};

    const cityMap = {};
    const categoryMap = {};
    listings.forEach((item) => {
      cityMap[item.city] = numberFrom(cityMap[item.city], 0) + 1;
      categoryMap[item.category] = numberFrom(categoryMap[item.category], 0) + 1;
    });

    const topCities = Object.entries(cityMap)
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const topCategories = Object.entries(categoryMap)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const riskRows = listings
      .filter((item) => item.riskScore >= filter.riskThreshold || item.fakeSignal)
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 50);

    const activityRows = [...revenueLog, ...automationLog, ...boostLog, ...expiryLog]
      .filter((item) => withinDays(item.at, filter.days))
      .sort((a, b) => ts(b.at) - ts(a.at))
      .slice(0, 120);

    const revenueWindowRows = [...revenueLog, ...boostLog]
      .filter((item) => withinDays(item.at, filter.days));
    const revenueFromLogs = revenueWindowRows
      .filter((item) => text(item.type).toLowerCase().includes('boost') || text(item.type).toLowerCase().includes('priced') || numberFrom(item.amount, 0) > 0)
      .reduce((sum, item) => sum + numberFrom(item.amount, 0), 0);

    const summary = {
      listings: listings.length,
      verified: listings.filter((item) => item.verified).length,
      featured: listings.filter((item) => item.featured).length,
      pending: listings.filter((item) => norm(item.status).includes('pending')).length,
      blockedUsers: blockedUsers.length,
      governanceIssues: numberFrom(governanceCache?.summary?.issues || governanceCache?.summary?.totalIssues, 0),
      highRisk: riskRows.length,
      docsQueue: docs.length,
      loanQueue: loans.length,
      bookingQueue: bookings.length,
      franchiseQueue: franchise.length,
      revenueWindow: revenueFromLogs,
      estimatedCommission: numberFrom(commissionAnalytics?.estimatedCommission || report?.commission?.estimatedCommission, 0),
      monetizedCommission: numberFrom(commissionAnalytics?.totalMonetized || report?.commission?.totalMonetized, 0),
    };

    const dailyTrendMap = {};
    activityRows.forEach((item) => {
      const key = dateKey(item.at);
      if (!key) return;
      if (!dailyTrendMap[key]) {
        dailyTrendMap[key] = { day: key, events: 0, revenue: 0, boosts: 0, alerts: 0 };
      }
      dailyTrendMap[key].events += 1;
      dailyTrendMap[key].revenue += numberFrom(item.amount, 0);
      if (item.source === 'boost' || norm(item.type).includes('boost')) dailyTrendMap[key].boosts += 1;
      if (item.source === 'expiry' || norm(item.type).includes('alert')) dailyTrendMap[key].alerts += 1;
    });
    const dailyTrend = Object.values(dailyTrendMap)
      .sort((a, b) => a.day.localeCompare(b.day))
      .slice(-14);

    return {
      filter,
      listings,
      summary,
      topCities,
      topCategories,
      riskRows,
      activityRows,
      dailyTrend,
      queueHealth: {
        docs,
        loans,
        bookings,
        franchise,
      },
      fraudTrack: Array.isArray(fraudTrack) ? fraudTrack : [],
    };
  };

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${CARD_ID} .aacc-status{margin:0 0 10px;color:#1f6d3d;font-size:14px;}
#${CARD_ID} .aacc-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px;}
#${CARD_ID} .aacc-btn{border:1px solid #0b3d91;border-radius:8px;background:#0b3d91;color:#fff;padding:7px 11px;font-weight:700;cursor:pointer;}
#${CARD_ID} .aacc-btn.alt{background:#fff;color:#0b3d91;}
#${CARD_ID} .aacc-filters{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));margin-bottom:10px;}
#${CARD_ID} .aacc-filters label{display:grid;gap:4px;font-size:12px;color:#3d5674;}
#${CARD_ID} .aacc-filters input{border:1px solid #ccd9ee;border-radius:8px;padding:7px 9px;}
#${CARD_ID} .aacc-kpi{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin-bottom:10px;}
#${CARD_ID} .aacc-kpi-item{border:1px solid #d7e6f8;border-radius:8px;background:#f7fbff;padding:8px;}
#${CARD_ID} .aacc-kpi-item small{display:block;color:#58718f;}
#${CARD_ID} .aacc-kpi-item b{color:#11466e;font-size:16px;}
#${CARD_ID} .aacc-grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));margin-bottom:10px;}
#${CARD_ID} .aacc-card{border:1px solid #dbe6f5;border-radius:10px;padding:10px;background:#fff;}
#${CARD_ID} .aacc-card h3{margin:0 0 8px;color:#124a72;}
#${CARD_ID} .aacc-wrap{overflow:auto;}
#${CARD_ID} table{width:100%;border-collapse:collapse;min-width:760px;}
#${CARD_ID} th,#${CARD_ID} td{border:1px solid #d5e2f4;padding:7px;text-align:left;font-size:13px;vertical-align:top;}
#${CARD_ID} th{background:#f3f8ff;}
#${CARD_ID} .aacc-chip{display:inline-block;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:700;}
#${CARD_ID} .aacc-chip.high{background:#ffe5e5;color:#992222;}
#${CARD_ID} .aacc-chip.mid{background:#fff0d9;color:#9f5d00;}
#${CARD_ID} .aacc-chip.low{background:#e7f8ef;color:#19643a;}
    `;
    document.head.appendChild(style);
  }

  const card = document.createElement('div');
  card.className = 'container';
  card.id = CARD_ID;
  card.innerHTML = `
    <h2>Admin Analytics Command Center Pro</h2>
    <p id="aaccStatus" class="aacc-status">Loading command center analytics...</p>
    <div class="aacc-toolbar">
      <button id="aaccRefreshBtn" class="aacc-btn" type="button">Refresh</button>
      <button id="aaccLiveBtn" class="aacc-btn alt" type="button">Sync Live Queues</button>
      <button id="aaccCsvBtn" class="aacc-btn alt" type="button">Export CSV</button>
    </div>
    <div class="aacc-filters">
      <label>Window Days<input id="aaccWindowDaysInput" type="number" min="7" max="180" step="1"></label>
      <label>Risk Threshold<input id="aaccRiskThresholdInput" type="number" min="40" max="95" step="1"></label>
    </div>
    <div id="aaccKpi" class="aacc-kpi"></div>
    <div class="aacc-grid">
      <section class="aacc-card">
        <h3>Top Cities</h3>
        <div id="aaccCities" class="aacc-wrap"></div>
      </section>
      <section class="aacc-card">
        <h3>Top Categories</h3>
        <div id="aaccCategories" class="aacc-wrap"></div>
      </section>
      <section class="aacc-card">
        <h3>Queue Health</h3>
        <div id="aaccQueues" class="aacc-wrap"></div>
      </section>
    </div>
    <section class="aacc-card">
      <h3>Risk Watchlist</h3>
      <div id="aaccRisk" class="aacc-wrap"></div>
    </section>
    <section class="aacc-card" style="margin-top:10px;">
      <h3>Ops Timeline</h3>
      <div id="aaccOps" class="aacc-wrap"></div>
    </section>
  `;

  const fraudCard = document.getElementById('adminFraudRiskCenterCard');
  const governanceCard = document.getElementById('adminCategoryCityGuardCard');
  const anchor = governanceCard || fraudCard || document.querySelector('.container');
  if (anchor) anchor.insertAdjacentElement('afterend', card);
  else document.body.appendChild(card);

  const statusEl = document.getElementById('aaccStatus');
  const refreshBtn = document.getElementById('aaccRefreshBtn');
  const liveBtn = document.getElementById('aaccLiveBtn');
  const csvBtn = document.getElementById('aaccCsvBtn');
  const windowDaysInput = document.getElementById('aaccWindowDaysInput');
  const riskThresholdInput = document.getElementById('aaccRiskThresholdInput');
  const kpiEl = document.getElementById('aaccKpi');
  const citiesEl = document.getElementById('aaccCities');
  const categoriesEl = document.getElementById('aaccCategories');
  const queuesEl = document.getElementById('aaccQueues');
  const riskEl = document.getElementById('aaccRisk');
  const opsEl = document.getElementById('aaccOps');

  let model = null;

  const setStatus = (message, ok = true) => {
    statusEl.textContent = message;
    statusEl.style.color = ok ? '#1f6d3d' : '#8d1e1e';
  };

  const writeFilterToUi = () => {
    const filter = getTimeFilter();
    windowDaysInput.value = String(numberFrom(filter.days, 30));
    riskThresholdInput.value = String(numberFrom(filter.riskThreshold, 70));
  };
  const readFilterFromUi = () => ({
    days: clamp(numberFrom(windowDaysInput.value, 30), 7, 180),
    riskThreshold: clamp(numberFrom(riskThresholdInput.value, 70), 40, 95),
  });

  const renderKpi = () => {
    const s = model?.summary || {};
    kpiEl.innerHTML = `
      <div class="aacc-kpi-item"><small>Listings</small><b>${numberFrom(s.listings, 0)}</b></div>
      <div class="aacc-kpi-item"><small>Verified</small><b>${numberFrom(s.verified, 0)}</b></div>
      <div class="aacc-kpi-item"><small>Featured</small><b>${numberFrom(s.featured, 0)}</b></div>
      <div class="aacc-kpi-item"><small>Pending</small><b>${numberFrom(s.pending, 0)}</b></div>
      <div class="aacc-kpi-item"><small>Blocked Users</small><b>${numberFrom(s.blockedUsers, 0)}</b></div>
      <div class="aacc-kpi-item"><small>Governance Issues</small><b>${numberFrom(s.governanceIssues, 0)}</b></div>
      <div class="aacc-kpi-item"><small>High Risk</small><b>${numberFrom(s.highRisk, 0)}</b></div>
      <div class="aacc-kpi-item"><small>Docs Queue</small><b>${numberFrom(s.docsQueue, 0)}</b></div>
      <div class="aacc-kpi-item"><small>Loan Queue</small><b>${numberFrom(s.loanQueue, 0)}</b></div>
      <div class="aacc-kpi-item"><small>Booking Queue</small><b>${numberFrom(s.bookingQueue, 0)}</b></div>
      <div class="aacc-kpi-item"><small>Franchise Queue</small><b>${numberFrom(s.franchiseQueue, 0)}</b></div>
      <div class="aacc-kpi-item"><small>Revenue (${numberFrom(model?.filter?.days, 30)}d)</small><b>${inr(s.revenueWindow)}</b></div>
      <div class="aacc-kpi-item"><small>Est. Commission</small><b>${inr(s.estimatedCommission)}</b></div>
      <div class="aacc-kpi-item"><small>Monetized Commission</small><b>${inr(s.monetizedCommission)}</b></div>
    `;
  };

  const renderCities = () => {
    const rows = model?.topCities || [];
    if (!rows.length) {
      citiesEl.innerHTML = '<p style="margin:0;color:#607da8;">No city data.</p>';
      return;
    }
    citiesEl.innerHTML = `
      <table>
        <thead><tr><th>City</th><th>Listings</th><th>Share</th></tr></thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${escapeHtml(row.city)}</td>
              <td>${row.count}</td>
              <td>${model.summary.listings > 0 ? `${Math.round((row.count / model.summary.listings) * 100)}%` : '0%'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  const renderCategories = () => {
    const rows = model?.topCategories || [];
    if (!rows.length) {
      categoriesEl.innerHTML = '<p style="margin:0;color:#607da8;">No category data.</p>';
      return;
    }
    categoriesEl.innerHTML = `
      <table>
        <thead><tr><th>Category</th><th>Listings</th><th>Share</th></tr></thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${escapeHtml(row.category)}</td>
              <td>${row.count}</td>
              <td>${model.summary.listings > 0 ? `${Math.round((row.count / model.summary.listings) * 100)}%` : '0%'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  const renderQueues = () => {
    const rows = [
      { label: 'Documentation', count: numberFrom(model?.summary?.docsQueue, 0) },
      { label: 'Loan Assistance', count: numberFrom(model?.summary?.loanQueue, 0) },
      { label: 'Ecosystem Bookings', count: numberFrom(model?.summary?.bookingQueue, 0) },
      { label: 'Franchise Requests', count: numberFrom(model?.summary?.franchiseQueue, 0) },
    ];
    queuesEl.innerHTML = `
      <table>
        <thead><tr><th>Queue</th><th>Count</th><th>Load</th></tr></thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${escapeHtml(row.label)}</td>
              <td>${row.count}</td>
              <td><span class="aacc-chip ${row.count >= 20 ? 'high' : row.count >= 8 ? 'mid' : 'low'}">${row.count >= 20 ? 'High' : row.count >= 8 ? 'Medium' : 'Stable'}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  const renderRiskRows = () => {
    const rows = model?.riskRows || [];
    if (!rows.length) {
      riskEl.innerHTML = '<p style="margin:0;color:#607da8;">No high-risk listings in current threshold.</p>';
      return;
    }
    riskEl.innerHTML = `
      <table>
        <thead><tr><th>Listing</th><th>Location</th><th>Risk</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td><b>${escapeHtml(row.title)}</b><br><small>${escapeHtml(row.id)}</small></td>
              <td>${escapeHtml(row.locality || row.city)}<br><small>${escapeHtml(row.category)} | ${escapeHtml(row.purpose)}</small></td>
              <td><span class="aacc-chip ${row.riskScore >= 80 ? 'high' : row.riskScore >= 65 ? 'mid' : 'low'}">${row.riskScore}</span></td>
              <td>${escapeHtml(row.status)}${row.fakeSignal ? '<br><small style="color:#992222;">Fake signal</small>' : ''}</td>
              <td><button type="button" data-action="open-risk" data-id="${escapeHtml(row.id)}">Open</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  const renderOps = () => {
    const rows = model?.activityRows || [];
    if (!rows.length) {
      opsEl.innerHTML = '<p style="margin:0;color:#607da8;">No activity in selected window.</p>';
      return;
    }
    opsEl.innerHTML = `
      <table>
        <thead><tr><th>Time</th><th>Source</th><th>Action</th><th>Amount</th><th>Details</th></tr></thead>
        <tbody>
          ${rows.slice(0, 80).map((row) => `
            <tr>
              <td>${escapeHtml(toDateLabel(row.at))}</td>
              <td>${escapeHtml(row.source)}</td>
              <td>${escapeHtml(row.type)}</td>
              <td>${row.amount > 0 ? escapeHtml(inr(row.amount)) : '-'}</td>
              <td>${escapeHtml(row.title)}${row.message ? `<br><small>${escapeHtml(row.message)}</small>` : ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  const renderAll = () => {
    renderKpi();
    renderCities();
    renderCategories();
    renderQueues();
    renderRiskRows();
    renderOps();
  };

  const refresh = async () => {
    model = await buildModel();
    renderAll();
    setStatus(`Analytics synced. ${numberFrom(model?.summary?.listings, 0)} listings, ${numberFrom(model?.activityRows?.length, 0)} ops events in ${numberFrom(model?.filter?.days, 30)}d.`);
  };

  const exportCsv = () => {
    if (!model) return;
    const lines = [];
    lines.push('Section,Key,Value');
    Object.entries(model.summary || {}).forEach(([key, value]) => {
      lines.push(`Summary,${key},${String(value)}`);
    });
    (model.topCities || []).forEach((row) => lines.push(`TopCity,${row.city},${row.count}`));
    (model.topCategories || []).forEach((row) => lines.push(`TopCategory,${row.category},${row.count}`));
    (model.riskRows || []).forEach((row) => lines.push(`Risk,${row.id},${row.riskScore}`));
    (model.activityRows || []).slice(0, 100).forEach((row) => lines.push(`Activity,${row.type},${row.amount}`));
    const csv = lines.map((line) => line.split(',').map((cell) => {
      const raw = String(cell || '');
      if (!/[",\n]/.test(raw)) return raw;
      return `"${raw.replace(/"/g, '""')}"`;
    }).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `admin-analytics-command-center-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus('Analytics CSV exported.');
  };

  refreshBtn?.addEventListener('click', () => {
    setTimeFilter(readFilterFromUi());
    refresh().catch((error) => setStatus(text(error?.message, 'Refresh failed.'), false));
  });

  liveBtn?.addEventListener('click', () => {
    setTimeFilter(readFilterFromUi());
    refresh().catch((error) => setStatus(text(error?.message, 'Live sync failed.'), false));
  });

  csvBtn?.addEventListener('click', exportCsv);

  [windowDaysInput, riskThresholdInput].forEach((input) => {
    input?.addEventListener('change', () => {
      setTimeFilter(readFilterFromUi());
      refresh().catch(() => null);
    });
  });

  riskEl?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = text(target.getAttribute('data-action')).toLowerCase();
    const id = text(target.getAttribute('data-id'));
    if (action === 'open-risk' && id) {
      window.open(`property-details.html?id=${encodeURIComponent(id)}`, '_blank', 'noopener,noreferrer');
    }
  });

  writeFilterToUi();
  refresh().catch((error) => setStatus(text(error?.message, 'Unable to load analytics center.'), false));
})();
