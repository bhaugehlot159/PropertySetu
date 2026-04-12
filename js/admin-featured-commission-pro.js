(() => {
  if (document.getElementById('adminFeaturedCommissionProCard')) return;

  const live = window.PropertySetuLive || {};
  const isAdminPage = Boolean(document.getElementById('pendingProperties') && document.getElementById('adminOverview'));
  if (!isAdminPage) return;

  const STYLE_ID = 'admin-featured-commission-pro-style';
  const CARD_ID = 'adminFeaturedCommissionProCard';
  const LISTINGS_KEY = 'propertySetu:listings';
  const POLICY_KEY = 'propertySetu:adminRevenuePolicy';
  const CACHE_KEY = 'propertySetu:adminRevenueControlCache';
  const LOG_KEY = 'propertySetu:adminRevenueControlLog';

  const DEFAULT_POLICY = {
    featuredMarkupPct: 12,
    loanCommissionPct: 0.6,
    minimumCommission: 2500,
    propertyCareCommissionPct: 10,
  };

  const DEFAULT_FEATURED_PLANS = {
    'featured-7': { id: 'featured-7', name: 'Featured Listing - 7 Days', amount: 299, cycleDays: 7, type: 'featured' },
    'featured-30': { id: 'featured-30', name: 'Featured Listing - 30 Days', amount: 999, cycleDays: 30, type: 'featured' },
  };

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
    if (typeof live.getAnyToken === 'function') return text(live.getAnyToken());
    return '';
  };

  const normalizePlan = (item = {}) => {
    const id = text(item.id);
    if (!id) return null;
    return {
      id,
      name: text(item.name, id),
      amount: Math.max(0, numberFrom(item.amount, 0)),
      cycleDays: Math.max(1, numberFrom(item.cycleDays, 30)),
      type: text(item.type || 'featured', 'featured'),
    };
  };

  const normalizeLead = (item = {}) => {
    const id = text(item.id || item._id);
    if (!id) return null;
    const amountBase = Math.max(0, numberFrom(
      item.loanAmount
      || item.requestedAmount
      || item.requestedLoanAmount
      || item.amount
      || item.propertyPrice,
      0
    ));
    const status = text(item.status, 'lead-created').toLowerCase();
    const finalCommissionAmount = Math.max(0, numberFrom(item.finalCommissionAmount || item.commissionAmount, 0));
    return {
      id,
      userName: text(item.userName, 'User'),
      locality: text(item.locality, 'Udaipur'),
      status,
      amountBase,
      finalCommissionAmount,
      createdAt: text(item.createdAt),
      updatedAt: text(item.updatedAt),
    };
  };

  const getPolicy = () => {
    const current = readJson(POLICY_KEY, {});
    return {
      featuredMarkupPct: Math.max(0, Math.min(40, numberFrom(current?.featuredMarkupPct, DEFAULT_POLICY.featuredMarkupPct))),
      loanCommissionPct: Math.max(0.1, Math.min(5, numberFrom(current?.loanCommissionPct, DEFAULT_POLICY.loanCommissionPct))),
      minimumCommission: Math.max(0, numberFrom(current?.minimumCommission, DEFAULT_POLICY.minimumCommission)),
      propertyCareCommissionPct: Math.max(0, Math.min(35, numberFrom(current?.propertyCareCommissionPct, DEFAULT_POLICY.propertyCareCommissionPct))),
    };
  };

  const setPolicy = (next) => {
    const current = getPolicy();
    writeJson(POLICY_KEY, { ...current, ...(next || {}) });
  };

  const getCache = () => {
    const cache = readJson(CACHE_KEY, {});
    return cache && typeof cache === 'object' ? cache : {};
  };

  const setCache = (next) => {
    writeJson(CACHE_KEY, next && typeof next === 'object' ? next : {});
  };

  const getLog = () => {
    const rows = readJson(LOG_KEY, []);
    return Array.isArray(rows) ? rows : [];
  };

  const pushLog = (action, details = '') => {
    const rows = getLog();
    rows.unshift({
      id: `arcp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: new Date().toISOString(),
      action: text(action),
      details: text(details),
    });
    writeJson(LOG_KEY, rows.slice(0, 300));
  };

  const notify = (title, message, type = 'info') => {
    if (!title || !message) return;
    if (window.PropertySetuNotify && typeof window.PropertySetuNotify.emit === 'function') {
      window.PropertySetuNotify.emit({ title, message, audience: ['admin', 'seller'], type });
      return;
    }
    const existing = readJson('propertySetu:notifications', []);
    const list = Array.isArray(existing) ? existing : [];
    list.unshift({
      id: `arcp-n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      message,
      type,
      audience: ['admin', 'seller'],
      createdAt: new Date().toISOString(),
      readBy: {},
    });
    while (list.length > 500) list.pop();
    writeJson('propertySetu:notifications', list);
    try {
      localStorage.setItem('propertySetu:notifications:ping', String(Date.now()));
    } catch {
      // no-op
    }
  };

  const getFeaturedListings = () => {
    const listings = readJson(LISTINGS_KEY, []);
    return (Array.isArray(listings) ? listings : []).filter((item) => Boolean(item?.featured));
  };

  const readLiveFeaturedPlans = async (token) => {
    if (!token || typeof live.request !== 'function') return [];
    try {
      const response = await live.request('/subscriptions/plans', { token });
      const items = Array.isArray(response?.items) ? response.items : [];
      return items
        .map((item) => normalizePlan(item))
        .filter(Boolean)
        .filter((plan) => plan.type === 'featured' || plan.id === 'featured-7' || plan.id === 'featured-30');
    } catch {
      return [];
    }
  };

  const readLiveLoanLeads = async (token) => {
    if (!token || typeof live.request !== 'function') return [];
    try {
      const response = await live.request('/loan/assistance', { token });
      const items = Array.isArray(response?.items) ? response.items : [];
      return items.map((item) => normalizeLead(item)).filter(Boolean);
    } catch {
      return [];
    }
  };

  const recommendedAmount = (lead, policy) => {
    const base = numberFrom(lead?.amountBase, 0);
    const rate = numberFrom(policy?.loanCommissionPct, DEFAULT_POLICY.loanCommissionPct);
    const minimum = numberFrom(policy?.minimumCommission, DEFAULT_POLICY.minimumCommission);
    if (base <= 0) return minimum;
    return Math.max(minimum, Math.round((base * rate) / 100));
  };

  const buildModel = ({
    plans,
    loanLeads,
    featuredListings,
    policy,
  }) => {
    const planMap = new Map();
    Object.values(DEFAULT_FEATURED_PLANS).forEach((plan) => {
      planMap.set(plan.id, { ...plan });
    });
    (Array.isArray(plans) ? plans : []).forEach((plan) => {
      planMap.set(plan.id, { ...planMap.get(plan.id), ...plan });
    });
    const featuredPlans = [...planMap.values()]
      .filter((plan) => plan.id === 'featured-7' || plan.id === 'featured-30')
      .sort((a, b) => a.cycleDays - b.cycleDays);

    const suggestedPlans = featuredPlans.map((plan) => {
      const markup = numberFrom(policy.featuredMarkupPct, DEFAULT_POLICY.featuredMarkupPct);
      const suggestedAmount = Math.max(0, Math.round((plan.amount * (100 + markup)) / 100));
      return {
        ...plan,
        suggestedAmount,
        delta: suggestedAmount - plan.amount,
      };
    });

    const safeLeads = Array.isArray(loanLeads) ? loanLeads : [];
    const gapLeads = safeLeads
      .filter((lead) => (lead.status === 'approved' || lead.status === 'sanctioned') && numberFrom(lead.finalCommissionAmount, 0) <= 0)
      .map((lead) => ({
        ...lead,
        recommendedCommission: recommendedAmount(lead, policy),
      }))
      .sort((a, b) => b.recommendedCommission - a.recommendedCommission);

    const totalLoanVolume = safeLeads.reduce((sum, lead) => sum + numberFrom(lead.amountBase, 0), 0);
    const projectedCommission = safeLeads.reduce((sum, lead) => {
      if (!(lead.status === 'approved' || lead.status === 'sanctioned')) return sum;
      return sum + recommendedAmount(lead, policy);
    }, 0);
    const bookedCommission = safeLeads.reduce((sum, lead) => sum + numberFrom(lead.finalCommissionAmount, 0), 0);

    const featuredCount = (Array.isArray(featuredListings) ? featuredListings : []).length;
    const monthlyFeaturedProjection = suggestedPlans.reduce((sum, plan) => {
      const cycle = Math.max(1, numberFrom(plan.cycleDays, 30));
      const monthlyFactor = Math.max(1, Math.round(30 / cycle));
      const share = plan.id === 'featured-7' ? 0.45 : 0.55;
      return sum + Math.round(featuredCount * share * plan.suggestedAmount * monthlyFactor);
    }, 0);

    const propertyCareProjection = Math.round((monthlyFeaturedProjection * numberFrom(policy.propertyCareCommissionPct, 0)) / 100);

    return {
      featuredPlans,
      suggestedPlans,
      gapLeads,
      summary: {
        featuredCount,
        monthlyFeaturedProjection,
        projectedCommission,
        bookedCommission,
        commissionGap: Math.max(0, projectedCommission - bookedCommission),
        loanLeadCount: safeLeads.length,
        totalLoanVolume,
        propertyCareProjection,
      },
    };
  };

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${CARD_ID} .arcp-status{margin:0 0 10px;color:#1f6d3d;font-size:14px;}
#${CARD_ID} .arcp-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px;}
#${CARD_ID} .arcp-btn{border:1px solid #0b3d91;border-radius:8px;background:#0b3d91;color:#fff;padding:7px 11px;font-weight:700;cursor:pointer;}
#${CARD_ID} .arcp-btn.alt{background:#fff;color:#0b3d91;}
#${CARD_ID} .arcp-btn.warn{background:#8f4f00;border-color:#8f4f00;}
#${CARD_ID} .arcp-grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));margin-bottom:10px;}
#${CARD_ID} .arcp-card{border:1px solid #dbe6f5;border-radius:10px;padding:10px;background:#fff;}
#${CARD_ID} .arcp-card h3{margin:0 0 8px;color:#124a72;}
#${CARD_ID} .arcp-form{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));}
#${CARD_ID} .arcp-form input{width:100%;border:1px solid #ccd9ee;border-radius:8px;padding:7px 9px;}
#${CARD_ID} .arcp-kpi{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin-bottom:10px;}
#${CARD_ID} .arcp-kpi-item{border:1px solid #d7e6f8;border-radius:8px;background:#f7fbff;padding:8px;}
#${CARD_ID} .arcp-kpi-item small{display:block;color:#58718f;}
#${CARD_ID} .arcp-kpi-item b{color:#11466e;font-size:16px;}
#${CARD_ID} table{width:100%;border-collapse:collapse;min-width:680px;}
#${CARD_ID} th,#${CARD_ID} td{border:1px solid #d5e2f4;padding:7px;text-align:left;font-size:13px;}
#${CARD_ID} th{background:#f3f8ff;}
#${CARD_ID} .arcp-wrap{overflow:auto;}
#${CARD_ID} .arcp-chip{display:inline-block;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:700;}
#${CARD_ID} .arcp-chip.gap{background:#ffe5e5;color:#992222;}
#${CARD_ID} .arcp-chip.ok{background:#e7f8ef;color:#19643a;}
#${CARD_ID} .arcp-log{max-height:180px;overflow:auto;border:1px solid #dce6f5;border-radius:8px;padding:8px;background:#fff;}
    `;
    document.head.appendChild(style);
  }

  const card = document.createElement('div');
  card.className = 'container';
  card.id = CARD_ID;
  card.innerHTML = `
    <h2>Featured Pricing & Commission Control Pro</h2>
    <p id="arcpStatus" class="arcp-status">Loading admin revenue controls...</p>
    <div class="arcp-toolbar">
      <button id="arcpRefreshBtn" class="arcp-btn" type="button">Refresh</button>
      <button id="arcpApplyPricingBtn" class="arcp-btn warn" type="button">Apply Suggested Featured Pricing</button>
      <button id="arcpBulkCommissionBtn" class="arcp-btn warn" type="button">Bulk Apply Commission Gaps</button>
      <button id="arcpCsvBtn" class="arcp-btn alt" type="button">Export Gap CSV</button>
    </div>
    <div id="arcpKpi" class="arcp-kpi"></div>
    <div class="arcp-grid">
      <section class="arcp-card">
        <h3>Policy Controls</h3>
        <div class="arcp-form">
          <label>Featured Markup (%)<input id="arcpMarkupInput" type="number" min="0" max="40" step="0.5" /></label>
          <label>Loan Commission (%)<input id="arcpLoanPctInput" type="number" min="0.1" max="5" step="0.1" /></label>
          <label>Minimum Commission (INR)<input id="arcpMinInput" type="number" min="0" step="100" /></label>
          <label>Property Care Comm (%)<input id="arcpCarePctInput" type="number" min="0" max="35" step="0.5" /></label>
        </div>
        <div class="arcp-toolbar" style="margin-top:10px;">
          <button id="arcpSavePolicyBtn" class="arcp-btn" type="button">Save Policy</button>
        </div>
      </section>
      <section class="arcp-card">
        <h3>Control Log</h3>
        <div id="arcpLog" class="arcp-log"></div>
      </section>
    </div>
    <section class="arcp-card">
      <h3>Featured Pricing Projection</h3>
      <div id="arcpPricingTable" class="arcp-wrap"></div>
    </section>
    <section class="arcp-card" style="margin-top:10px;">
      <h3>Loan Commission Gap Queue</h3>
      <div id="arcpCommissionTable" class="arcp-wrap"></div>
    </section>
  `;

  const overview = document.getElementById('adminOverview');
  const reportCard = document.getElementById('adminReportCommissionAutomationCard');
  const verifyCard = document.getElementById('adminBadgeWorkflowCard');
  const anchor = reportCard || verifyCard || overview?.closest('.container') || document.querySelector('.container');
  if (anchor) anchor.insertAdjacentElement('afterend', card);
  else document.body.appendChild(card);

  const statusEl = document.getElementById('arcpStatus');
  const refreshBtn = document.getElementById('arcpRefreshBtn');
  const applyPricingBtn = document.getElementById('arcpApplyPricingBtn');
  const bulkCommissionBtn = document.getElementById('arcpBulkCommissionBtn');
  const csvBtn = document.getElementById('arcpCsvBtn');
  const savePolicyBtn = document.getElementById('arcpSavePolicyBtn');
  const markupInput = document.getElementById('arcpMarkupInput');
  const loanPctInput = document.getElementById('arcpLoanPctInput');
  const minInput = document.getElementById('arcpMinInput');
  const carePctInput = document.getElementById('arcpCarePctInput');
  const kpiEl = document.getElementById('arcpKpi');
  const logEl = document.getElementById('arcpLog');
  const pricingTableEl = document.getElementById('arcpPricingTable');
  const commissionTableEl = document.getElementById('arcpCommissionTable');

  let state = {
    plans: [],
    loanLeads: [],
    model: {
      featuredPlans: [],
      suggestedPlans: [],
      gapLeads: [],
      summary: {},
    },
  };

  const setStatus = (message, ok = true) => {
    statusEl.textContent = message;
    statusEl.style.color = ok ? '#1f6d3d' : '#8d1e1e';
  };

  const syncPolicyInputs = () => {
    const policy = getPolicy();
    markupInput.value = String(numberFrom(policy.featuredMarkupPct, DEFAULT_POLICY.featuredMarkupPct));
    loanPctInput.value = String(numberFrom(policy.loanCommissionPct, DEFAULT_POLICY.loanCommissionPct));
    minInput.value = String(numberFrom(policy.minimumCommission, DEFAULT_POLICY.minimumCommission));
    carePctInput.value = String(numberFrom(policy.propertyCareCommissionPct, DEFAULT_POLICY.propertyCareCommissionPct));
  };

  const renderLog = () => {
    const rows = getLog();
    if (!rows.length) {
      logEl.innerHTML = '<p style="margin:0;color:#607da8;">No actions logged yet.</p>';
      return;
    }
    logEl.innerHTML = rows.slice(0, 12).map((row) => `
      <div style="border-bottom:1px solid #e4edf9;padding:6px 0;">
        <b>${escapeHtml(text(row.action, '-'))}</b>
        <small style="display:block;color:#5c6f88;">${escapeHtml(new Date(row.at || Date.now()).toLocaleString('en-IN'))}</small>
        <small style="display:block;color:#3f5876;">${escapeHtml(text(row.details, '-'))}</small>
      </div>
    `).join('');
  };

  const render = () => {
    const model = state.model || {};
    const summary = model.summary || {};
    kpiEl.innerHTML = `
      <div class="arcp-kpi-item"><small>Featured Listings</small><b>${numberFrom(summary.featuredCount, 0)}</b></div>
      <div class="arcp-kpi-item"><small>Monthly Featured Projection</small><b>${inr(summary.monthlyFeaturedProjection)}</b></div>
      <div class="arcp-kpi-item"><small>Projected Commission</small><b>${inr(summary.projectedCommission)}</b></div>
      <div class="arcp-kpi-item"><small>Booked Commission</small><b>${inr(summary.bookedCommission)}</b></div>
      <div class="arcp-kpi-item"><small>Commission Gap</small><b>${inr(summary.commissionGap)}</b></div>
      <div class="arcp-kpi-item"><small>Loan Lead Volume</small><b>${inr(summary.totalLoanVolume)}</b></div>
      <div class="arcp-kpi-item"><small>Property Care Projection</small><b>${inr(summary.propertyCareProjection)}</b></div>
      <div class="arcp-kpi-item"><small>Gap Leads</small><b>${numberFrom(model.gapLeads?.length, 0)}</b></div>
    `;

    if (!model.suggestedPlans?.length) {
      pricingTableEl.innerHTML = '<p style="margin:0;color:#607da8;">Featured pricing data unavailable.</p>';
    } else {
      pricingTableEl.innerHTML = `
        <table>
          <thead>
            <tr>
              <th>Plan</th>
              <th>Current Amount</th>
              <th>Cycle</th>
              <th>Suggested Amount</th>
              <th>Delta</th>
            </tr>
          </thead>
          <tbody>
            ${model.suggestedPlans.map((plan) => `
              <tr>
                <td><b>${escapeHtml(plan.name)}</b><br><small style="color:#5b6e86;">${escapeHtml(plan.id)}</small></td>
                <td>${inr(plan.amount)}</td>
                <td>${numberFrom(plan.cycleDays, 0)} days</td>
                <td>${inr(plan.suggestedAmount)}</td>
                <td><span class="arcp-chip ${numberFrom(plan.delta, 0) > 0 ? 'gap' : 'ok'}">${numberFrom(plan.delta, 0) >= 0 ? '+' : ''}${inr(plan.delta)}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    if (!model.gapLeads?.length) {
      commissionTableEl.innerHTML = '<p style="margin:0;color:#607da8;">No commission gap leads found.</p>';
      return;
    }
    commissionTableEl.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Lead</th>
            <th>Status</th>
            <th>Loan Amount</th>
            <th>Current Commission</th>
            <th>Recommended</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${model.gapLeads.slice(0, 20).map((lead) => `
            <tr>
              <td><b>${escapeHtml(lead.userName)}</b><br><small style="color:#5b6e86;">${escapeHtml(lead.id)} | ${escapeHtml(lead.locality)}</small></td>
              <td>${escapeHtml(lead.status)}</td>
              <td>${inr(lead.amountBase)}</td>
              <td>${inr(lead.finalCommissionAmount)}</td>
              <td><span class="arcp-chip gap">${inr(lead.recommendedCommission)}</span></td>
              <td><button type="button" class="arcp-btn alt" data-action="apply-one" data-id="${escapeHtml(lead.id)}">Apply</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  const applyPolicyFromInputs = () => {
    const next = {
      featuredMarkupPct: Math.max(0, Math.min(40, numberFrom(markupInput.value, DEFAULT_POLICY.featuredMarkupPct))),
      loanCommissionPct: Math.max(0.1, Math.min(5, numberFrom(loanPctInput.value, DEFAULT_POLICY.loanCommissionPct))),
      minimumCommission: Math.max(0, numberFrom(minInput.value, DEFAULT_POLICY.minimumCommission)),
      propertyCareCommissionPct: Math.max(0, Math.min(35, numberFrom(carePctInput.value, DEFAULT_POLICY.propertyCareCommissionPct))),
    };
    setPolicy(next);
    pushLog('Policy Saved', `Markup ${next.featuredMarkupPct}% | Loan ${next.loanCommissionPct}% | Min ${next.minimumCommission}`);
    notify('Revenue Policy Updated', 'Admin updated featured + commission policy.', 'info');
    syncPolicyInputs();
    return next;
  };

  const applySuggestedPricing = async () => {
    const token = getAdminToken();
    if (!token || typeof live.request !== 'function') {
      setStatus('Admin login required for pricing update.', false);
      return;
    }
    const plans = state.model?.suggestedPlans || [];
    if (!plans.length) {
      setStatus('No suggested plans available.', false);
      return;
    }
    let success = 0;
    for (const plan of plans) {
      try {
        await live.request('/admin/config/featured-pricing', {
          method: 'POST',
          token,
          data: {
            planId: plan.id,
            amount: numberFrom(plan.suggestedAmount, 0),
            cycleDays: numberFrom(plan.cycleDays, 30),
          },
        });
        success += 1;
      } catch {
        // continue with best effort
      }
    }
    pushLog('Suggested Pricing Applied', `Applied ${success}/${plans.length} plan updates`);
    notify('Featured Pricing Updated', `Applied suggested pricing for ${success} plan(s).`, success ? 'success' : 'warn');
    setStatus(success ? `Suggested pricing applied (${success}/${plans.length}).` : 'Pricing apply failed on live endpoint.', success > 0);
    await refresh();
  };

  const applyOneCommission = async (lead) => {
    const token = getAdminToken();
    if (!token || typeof live.request !== 'function') {
      setStatus('Admin login required for commission apply.', false);
      return false;
    }
    const policy = getPolicy();
    const recommended = recommendedAmount(lead, policy);
    try {
      await live.request(`/admin/loan/assistance/${encodeURIComponent(lead.id)}/status`, {
        method: 'POST',
        token,
        data: {
          status: lead.status,
          finalCommissionAmount: recommended,
        },
      });
      pushLog('Commission Applied', `${lead.id} -> ${recommended}`);
      notify('Loan Commission Updated', `Commission set for lead ${lead.id}: ${inr(recommended)}.`, 'success');
      setStatus(`Commission applied for ${lead.id}.`);
      return true;
    } catch (error) {
      setStatus(text(error?.message, 'Commission apply failed.'), false);
      return false;
    }
  };

  const bulkApplyCommission = async () => {
    const gaps = state.model?.gapLeads || [];
    if (!gaps.length) {
      setStatus('No commission gap leads to apply.');
      return;
    }
    let applied = 0;
    for (const lead of gaps.slice(0, 30)) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await applyOneCommission(lead);
      if (ok) applied += 1;
    }
    pushLog('Bulk Commission Apply', `Applied ${applied}/${Math.min(30, gaps.length)} leads`);
    setStatus(applied ? `Bulk commission applied: ${applied}` : 'Bulk commission apply failed.', applied > 0);
    await refresh();
  };

  const exportGapCsv = () => {
    const rows = state.model?.gapLeads || [];
    const headers = ['Lead ID', 'User', 'Status', 'Locality', 'Loan Amount', 'Current Commission', 'Recommended Commission', 'Created At'];
    const dataRows = rows.map((lead) => ([
      lead.id,
      lead.userName,
      lead.status,
      lead.locality,
      String(numberFrom(lead.amountBase, 0)),
      String(numberFrom(lead.finalCommissionAmount, 0)),
      String(numberFrom(lead.recommendedCommission, 0)),
      lead.createdAt,
    ]));
    const quote = (value) => {
      const raw = String(value || '');
      if (!/[",\n]/.test(raw)) return raw;
      return `"${raw.replace(/"/g, '""')}"`;
    };
    const csv = [headers, ...dataRows].map((line) => line.map(quote).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `admin-commission-gap-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus('Commission gap CSV exported.');
  };

  const refresh = async () => {
    setStatus('Refreshing revenue control data...');
    const policy = getPolicy();
    syncPolicyInputs();

    const token = getAdminToken();
    const [livePlans, liveLeads] = await Promise.all([
      readLiveFeaturedPlans(token),
      readLiveLoanLeads(token),
    ]);

    const cache = getCache();
    const plans = livePlans.length ? livePlans : (Array.isArray(cache.plans) ? cache.plans : Object.values(DEFAULT_FEATURED_PLANS));
    const loanLeads = liveLeads.length ? liveLeads : (Array.isArray(cache.loanLeads) ? cache.loanLeads : []);
    const featuredListings = getFeaturedListings();

    state.model = buildModel({
      plans,
      loanLeads,
      featuredListings,
      policy,
    });
    state.plans = plans;
    state.loanLeads = loanLeads;
    setCache({ plans, loanLeads, at: new Date().toISOString() });

    render();
    renderLog();
    setStatus(`Revenue control ready. ${numberFrom(state.model.gapLeads?.length, 0)} commission gap lead(s).`);
  };

  savePolicyBtn?.addEventListener('click', () => {
    applyPolicyFromInputs();
    refresh().catch((error) => setStatus(text(error?.message, 'Policy refresh failed.'), false));
  });

  refreshBtn?.addEventListener('click', () => {
    refresh().catch((error) => setStatus(text(error?.message, 'Refresh failed.'), false));
  });

  applyPricingBtn?.addEventListener('click', () => {
    applyPolicyFromInputs();
    applySuggestedPricing().catch((error) => setStatus(text(error?.message, 'Pricing apply failed.'), false));
  });

  bulkCommissionBtn?.addEventListener('click', () => {
    applyPolicyFromInputs();
    bulkApplyCommission().catch((error) => setStatus(text(error?.message, 'Bulk commission failed.'), false));
  });

  csvBtn?.addEventListener('click', exportGapCsv);

  commissionTableEl?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = text(target.getAttribute('data-action')).toLowerCase();
    const id = text(target.getAttribute('data-id'));
    if (action !== 'apply-one' || !id) return;
    const lead = (state.model?.gapLeads || []).find((item) => item.id === id);
    if (!lead) return;
    applyPolicyFromInputs();
    applyOneCommission(lead)
      .then((ok) => {
        if (!ok) return;
        return refresh();
      })
      .catch((error) => setStatus(text(error?.message, 'Commission action failed.'), false));
  });

  syncPolicyInputs();
  renderLog();
  refresh().catch((error) => {
    setStatus(text(error?.message, 'Unable to load revenue controls.'), false);
  });
})();
