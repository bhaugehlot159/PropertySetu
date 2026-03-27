(() => {
  if (document.getElementById('customerInvestmentAnalyzerCard')) return;

  const live = window.PropertySetuLive || {};
  const isUserPage = Boolean(
    document.getElementById('wishlist')
    && document.getElementById('visitForm')
    && document.getElementById('chatBox')
  );
  if (!isUserPage) return;

  const CARD_ID = 'customerInvestmentAnalyzerCard';
  const STYLE_ID = 'customer-investment-analyzer-style';
  const LISTINGS_KEY = 'propertySetu:listings';
  const MARKET_STATE_KEY = 'propertysetu-marketplace-state';
  const VISIT_KEY = 'propertySetu:userVisits';
  const SETTINGS_KEY = 'propertySetu:investmentAnalyzerSettings';
  const RENT_OVERRIDE_KEY = 'propertySetu:investmentRentOverrides';

  const text = (value, fallback = '') => {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  };
  const numberFrom = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
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

  const getSettings = () => {
    const current = readJson(SETTINGS_KEY, {});
    return {
      appreciationPct: clamp(numberFrom(current?.appreciationPct, 6), 1, 18),
      vacancyPct: clamp(numberFrom(current?.vacancyPct, 8), 0, 35),
      maintenancePct: clamp(numberFrom(current?.maintenancePct, 1.2), 0.2, 8),
      loanRatePct: clamp(numberFrom(current?.loanRatePct, 8.7), 5, 18),
      downPaymentPct: clamp(numberFrom(current?.downPaymentPct, 25), 5, 80),
      tenureYears: clamp(numberFrom(current?.tenureYears, 20), 5, 35),
      horizonYears: clamp(numberFrom(current?.horizonYears, 5), 2, 15),
    };
  };

  const setSettings = (next) => {
    const current = getSettings();
    writeJson(SETTINGS_KEY, { ...current, ...(next || {}) });
  };

  const getRentOverrides = () => {
    const map = readJson(RENT_OVERRIDE_KEY, {});
    return map && typeof map === 'object' ? map : {};
  };
  const setRentOverride = (id, amount) => {
    const key = text(id);
    if (!key) return;
    const map = getRentOverrides();
    if (numberFrom(amount, 0) <= 0) delete map[key];
    else map[key] = Math.max(0, Math.round(numberFrom(amount, 0)));
    writeJson(RENT_OVERRIDE_KEY, map);
  };

  const normalizeListing = (item = {}) => {
    const id = text(item.id || item._id);
    if (!id) return null;
    return {
      id,
      title: text(item.title, id),
      location: text(item.location || item.locality, 'Udaipur'),
      city: text(item.city, 'Udaipur'),
      category: text(item.category || item.propertyTypeCore, 'Unknown'),
      purpose: text(item.purpose || item.type || item.saleRentMode, 'Unknown'),
      price: Math.max(0, numberFrom(item.price, 0)),
      verified: Boolean(item.verified || text(item.status).toLowerCase() === 'approved'),
      featured: Boolean(item.featured),
      listedAt: text(item.createdAt || item.listedAt || item.updatedAt),
    };
  };

  const loadListingMap = () => {
    const rows = readJson(LISTINGS_KEY, []);
    const map = new Map();
    (Array.isArray(rows) ? rows : [])
      .map((item) => normalizeListing(item))
      .filter(Boolean)
      .forEach((item) => map.set(item.id, item));
    return map;
  };

  const shortlistIds = (listingMap) => {
    const state = readJson(MARKET_STATE_KEY, { wishlist: [], compare: [] });
    const ids = [];
    const add = (value) => {
      const id = text(value);
      if (!id || ids.includes(id)) return;
      ids.push(id);
    };
    (Array.isArray(state?.wishlist) ? state.wishlist : []).forEach(add);
    (Array.isArray(state?.compare) ? state.compare : []).forEach(add);
    const visits = readJson(VISIT_KEY, []);
    (Array.isArray(visits) ? visits : []).forEach((visit) => add(visit?.propertyId));
    if (!ids.length) {
      [...listingMap.values()]
        .sort((a, b) => new Date(b.listedAt || 0).getTime() - new Date(a.listedAt || 0).getTime())
        .slice(0, 8)
        .forEach((item) => add(item.id));
    }
    return ids;
  };

  const medianByCategory = (listingMap) => {
    const bucket = new Map();
    [...listingMap.values()].forEach((item) => {
      const key = text(item.category).toLowerCase() || 'unknown';
      if (!bucket.has(key)) bucket.set(key, []);
      if (item.price > 0) bucket.get(key).push(item.price);
    });
    const out = {};
    bucket.forEach((prices, key) => {
      const sorted = prices.sort((a, b) => a - b);
      if (!sorted.length) {
        out[key] = 0;
        return;
      }
      const mid = Math.floor(sorted.length / 2);
      out[key] = sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    });
    return out;
  };

  const estimatedMonthlyRent = (listing, priceMedian, overrides) => {
    const id = text(listing.id);
    const override = numberFrom(overrides[id], 0);
    if (override > 0) return override;
    const price = numberFrom(listing.price, 0);
    const category = text(listing.category).toLowerCase();
    const purpose = text(listing.purpose).toLowerCase();

    if (purpose.includes('rent') && price > 0 && price < 300000) return price;

    let yieldPct = 0.35;
    if (category.includes('commercial') || category.includes('shop') || category.includes('office') || category.includes('warehouse')) {
      yieldPct = 0.55;
    } else if (category.includes('plot') || category.includes('land') || category.includes('farm') || category.includes('vadi')) {
      yieldPct = 0.12;
    } else if (category.includes('pg') || category.includes('hostel')) {
      yieldPct = 0.65;
    }
    const base = price > 0 ? price : numberFrom(priceMedian, 0);
    return Math.max(0, Math.round((base * yieldPct) / 100));
  };

  const monthlyEmi = ({ loanAmount, ratePct, tenureYears }) => {
    const principal = Math.max(0, numberFrom(loanAmount, 0));
    const months = Math.max(1, Math.round(numberFrom(tenureYears, 1) * 12));
    const monthlyRate = numberFrom(ratePct, 0) / 1200;
    if (principal <= 0) return 0;
    if (monthlyRate <= 0) return Math.round(principal / months);
    const factor = (1 + monthlyRate) ** months;
    const emi = (principal * monthlyRate * factor) / (factor - 1);
    return Math.round(emi);
  };

  const buildModel = ({ listingMap, ids, settings, rentOverrides }) => {
    const medians = medianByCategory(listingMap);
    const rows = ids
      .map((id) => listingMap.get(id))
      .filter(Boolean)
      .map((listing) => {
        const categoryKey = text(listing.category).toLowerCase() || 'unknown';
        const categoryMedian = numberFrom(medians[categoryKey], 0);
        const price = numberFrom(listing.price, 0);
        const monthlyRent = estimatedMonthlyRent(listing, categoryMedian, rentOverrides);
        const annualRentGross = monthlyRent * 12;
        const annualMaintenance = Math.round((price * settings.maintenancePct) / 100);
        const annualVacancyLoss = Math.round((annualRentGross * settings.vacancyPct) / 100);
        const annualRentNet = Math.max(0, annualRentGross - annualMaintenance - annualVacancyLoss);
        const grossYield = price > 0 ? Number(((annualRentGross / price) * 100).toFixed(2)) : 0;
        const netYield = price > 0 ? Number(((annualRentNet / price) * 100).toFixed(2)) : 0;

        const downPayment = Math.round((price * settings.downPaymentPct) / 100);
        const loanAmount = Math.max(0, price - downPayment);
        const emi = monthlyEmi({
          loanAmount,
          ratePct: settings.loanRatePct,
          tenureYears: settings.tenureYears,
        });
        const annualEmi = emi * 12;
        const annualCashflow = annualRentNet - annualEmi;
        const projectedPrice = Math.round(price * ((1 + (settings.appreciationPct / 100)) ** settings.horizonYears));
        const capitalGain = Math.max(0, projectedPrice - price);
        const cashflowHorizon = annualCashflow * settings.horizonYears;
        const totalReturn = capitalGain + cashflowHorizon;
        const investedCapital = Math.max(1, downPayment + (cashflowHorizon < 0 ? Math.abs(cashflowHorizon) : 0));
        const roiPct = Number(((totalReturn / investedCapital) * 100).toFixed(1));

        const paybackYears = annualRentNet > 0 ? Number((price / annualRentNet).toFixed(1)) : 99;
        const priceVsMedianPct = categoryMedian > 0 ? Number((((price - categoryMedian) / categoryMedian) * 100).toFixed(1)) : 0;

        const yieldScore = clamp(Math.round((netYield / 8) * 40), 0, 40);
        const roiScore = clamp(Math.round((roiPct / 120) * 35), 0, 35);
        const cashflowScore = annualCashflow > 0 ? clamp(Math.round((annualCashflow / Math.max(1, annualRentGross)) * 15), 0, 15) : 0;
        const trustScore = listing.verified ? 10 : 5;
        const investmentScore = clamp(yieldScore + roiScore + cashflowScore + trustScore, 0, 100);

        let strategy = 'Balanced investment candidate.';
        if (roiPct >= 100 && annualCashflow > 0) strategy = 'Strong long-term + cashflow candidate.';
        else if (annualCashflow < 0 && roiPct > 60) strategy = 'Growth-heavy asset, cashflow negative initially.';
        else if (netYield < 2) strategy = 'Low yield, prefer negotiation or self-use.';
        else if (paybackYears > 25) strategy = 'Slow payback. Re-evaluate rent assumptions.';

        return {
          ...listing,
          categoryMedian,
          priceVsMedianPct,
          monthlyRent,
          annualRentGross,
          annualRentNet,
          annualMaintenance,
          annualVacancyLoss,
          grossYield,
          netYield,
          downPayment,
          loanAmount,
          emi,
          annualEmi,
          annualCashflow,
          projectedPrice,
          capitalGain,
          totalReturn,
          roiPct,
          paybackYears,
          investmentScore,
          strategy,
        };
      })
      .sort((a, b) => {
        if (b.investmentScore !== a.investmentScore) return b.investmentScore - a.investmentScore;
        return b.roiPct - a.roiPct;
      });

    const summary = {
      shortlist: rows.length,
      avgNetYield: rows.length ? Number((rows.reduce((sum, row) => sum + numberFrom(row.netYield, 0), 0) / rows.length).toFixed(2)) : 0,
      positiveCashflow: rows.filter((row) => numberFrom(row.annualCashflow, 0) > 0).length,
      highRoi: rows.filter((row) => numberFrom(row.roiPct, 0) >= 80).length,
      topPick: rows[0] ? `${rows[0].title} (${rows[0].investmentScore})` : '-',
    };

    return { rows, summary };
  };

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${CARD_ID} .cia-status{margin:0 0 10px;color:#1f6d3d;font-size:14px;}
#${CARD_ID} .cia-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px;}
#${CARD_ID} .cia-btn{border:1px solid #0b3d91;border-radius:8px;background:#0b3d91;color:#fff;padding:7px 11px;font-weight:700;cursor:pointer;}
#${CARD_ID} .cia-btn.alt{background:#fff;color:#0b3d91;}
#${CARD_ID} .cia-field{display:flex;align-items:center;gap:6px;font-size:12px;color:#395878;}
#${CARD_ID} .cia-field input{width:90px;padding:6px 8px;border:1px solid #cbdaf0;border-radius:8px;}
#${CARD_ID} .cia-kpi{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin-bottom:10px;}
#${CARD_ID} .cia-kpi-item{border:1px solid #d7e6f8;border-radius:8px;background:#f7fbff;padding:8px;}
#${CARD_ID} .cia-kpi-item small{display:block;color:#58718f;}
#${CARD_ID} .cia-kpi-item b{color:#11466e;font-size:16px;}
#${CARD_ID} .cia-table-wrap{overflow:auto;}
#${CARD_ID} table{width:100%;border-collapse:collapse;min-width:1160px;}
#${CARD_ID} th,#${CARD_ID} td{border:1px solid #d5e2f4;padding:7px;text-align:left;font-size:13px;vertical-align:top;}
#${CARD_ID} th{background:#f3f8ff;}
#${CARD_ID} .cia-chip{display:inline-block;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:700;}
#${CARD_ID} .cia-chip.high{background:#e7f8ef;color:#19643a;}
#${CARD_ID} .cia-chip.mid{background:#fff0d9;color:#9f5d00;}
#${CARD_ID} .cia-chip.low{background:#ffe5e5;color:#992222;}
#${CARD_ID} .cia-actions{display:flex;flex-wrap:wrap;gap:6px;}
#${CARD_ID} .cia-actions button{border:1px solid #cbdcf2;background:#fff;color:#12395f;border-radius:999px;padding:4px 9px;font-size:12px;cursor:pointer;}
    `;
    document.head.appendChild(style);
  }

  const card = document.createElement('div');
  card.className = 'container';
  card.id = CARD_ID;
  card.innerHTML = `
    <h2>Investment Analyzer Pro</h2>
    <p id="ciaStatus" class="cia-status">Loading investment model...</p>
    <div class="cia-toolbar">
      <button id="ciaRefreshBtn" class="cia-btn" type="button">Refresh Model</button>
      <button id="ciaCsvBtn" class="cia-btn alt" type="button">Export CSV</button>
      <label class="cia-field">App %<input id="ciaAppInput" type="number" min="1" max="18" step="0.1"></label>
      <label class="cia-field">Vacancy %<input id="ciaVacancyInput" type="number" min="0" max="35" step="0.5"></label>
      <label class="cia-field">Maint %<input id="ciaMaintInput" type="number" min="0.2" max="8" step="0.1"></label>
      <label class="cia-field">Rate %<input id="ciaRateInput" type="number" min="5" max="18" step="0.1"></label>
      <label class="cia-field">Down %<input id="ciaDownInput" type="number" min="5" max="80" step="1"></label>
      <label class="cia-field">Tenure Y<input id="ciaTenureInput" type="number" min="5" max="35" step="1"></label>
      <label class="cia-field">Horizon Y<input id="ciaHorizonInput" type="number" min="2" max="15" step="1"></label>
    </div>
    <div id="ciaKpi" class="cia-kpi"></div>
    <div id="ciaTable" class="cia-table-wrap"></div>
  `;

  const decisionCard = document.getElementById('customerDecisionRoomCard');
  const visitCard = document.getElementById('userVisitOptimizerCard');
  const engagementCard = document.getElementById('customerEngagementSuiteCard');
  const anchor = decisionCard || visitCard || engagementCard || document.querySelector('.container');
  if (anchor) anchor.insertAdjacentElement('afterend', card);
  else document.body.appendChild(card);

  const statusEl = document.getElementById('ciaStatus');
  const kpiEl = document.getElementById('ciaKpi');
  const tableEl = document.getElementById('ciaTable');
  const refreshBtn = document.getElementById('ciaRefreshBtn');
  const csvBtn = document.getElementById('ciaCsvBtn');
  const appInput = document.getElementById('ciaAppInput');
  const vacancyInput = document.getElementById('ciaVacancyInput');
  const maintInput = document.getElementById('ciaMaintInput');
  const rateInput = document.getElementById('ciaRateInput');
  const downInput = document.getElementById('ciaDownInput');
  const tenureInput = document.getElementById('ciaTenureInput');
  const horizonInput = document.getElementById('ciaHorizonInput');

  let model = { rows: [], summary: {} };

  const setStatus = (message, ok = true) => {
    statusEl.textContent = message;
    statusEl.style.color = ok ? '#1f6d3d' : '#8d1e1e';
  };

  const scoreClass = (score) => {
    const value = numberFrom(score, 0);
    if (value >= 70) return 'high';
    if (value >= 50) return 'mid';
    return 'low';
  };

  const writeSettingsToInputs = (settings) => {
    appInput.value = String(numberFrom(settings.appreciationPct, 6));
    vacancyInput.value = String(numberFrom(settings.vacancyPct, 8));
    maintInput.value = String(numberFrom(settings.maintenancePct, 1.2));
    rateInput.value = String(numberFrom(settings.loanRatePct, 8.7));
    downInput.value = String(numberFrom(settings.downPaymentPct, 25));
    tenureInput.value = String(numberFrom(settings.tenureYears, 20));
    horizonInput.value = String(numberFrom(settings.horizonYears, 5));
  };

  const readInputsToSettings = () => ({
    appreciationPct: clamp(numberFrom(appInput.value, 6), 1, 18),
    vacancyPct: clamp(numberFrom(vacancyInput.value, 8), 0, 35),
    maintenancePct: clamp(numberFrom(maintInput.value, 1.2), 0.2, 8),
    loanRatePct: clamp(numberFrom(rateInput.value, 8.7), 5, 18),
    downPaymentPct: clamp(numberFrom(downInput.value, 25), 5, 80),
    tenureYears: clamp(numberFrom(tenureInput.value, 20), 5, 35),
    horizonYears: clamp(numberFrom(horizonInput.value, 5), 2, 15),
  });

  const render = () => {
    const summary = model.summary || {};
    kpiEl.innerHTML = `
      <div class="cia-kpi-item"><small>Shortlist</small><b>${numberFrom(summary.shortlist, 0)}</b></div>
      <div class="cia-kpi-item"><small>Avg Net Yield</small><b>${numberFrom(summary.avgNetYield, 0)}%</b></div>
      <div class="cia-kpi-item"><small>Positive Cashflow</small><b>${numberFrom(summary.positiveCashflow, 0)}</b></div>
      <div class="cia-kpi-item"><small>High ROI (80%+)</small><b>${numberFrom(summary.highRoi, 0)}</b></div>
      <div class="cia-kpi-item"><small>Top Pick</small><b>${escapeHtml(text(summary.topPick, '-'))}</b></div>
    `;

    if (!model.rows.length) {
      tableEl.innerHTML = '<p style="margin:0;color:#607da8;">Wishlist/compare listings add karo to investment analysis visible hoga.</p>';
      return;
    }

    tableEl.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Listing</th>
            <th>Investment Score</th>
            <th>Yield</th>
            <th>Cashflow</th>
            <th>ROI Projection</th>
            <th>Financing</th>
            <th>Strategy</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${model.rows.map((row) => `
            <tr>
              <td>
                <b>${escapeHtml(row.title)}</b><br>
                <small style="color:#5b6e86;">${escapeHtml(row.location)} | ${escapeHtml(row.category)}</small><br>
                <small style="color:#5b6e86;">Price ${escapeHtml(inr(row.price))} (${row.priceVsMedianPct >= 0 ? '+' : ''}${numberFrom(row.priceVsMedianPct, 0)}% vs median)</small>
              </td>
              <td><span class="cia-chip ${scoreClass(row.investmentScore)}">${numberFrom(row.investmentScore, 0)}</span></td>
              <td>
                Rent ${escapeHtml(inr(row.monthlyRent))}/mo<br>
                Gross ${numberFrom(row.grossYield, 0)}%<br>
                Net ${numberFrom(row.netYield, 0)}%
              </td>
              <td>
                Net Rent ${escapeHtml(inr(row.annualRentNet))}/yr<br>
                EMI ${escapeHtml(inr(row.annualEmi))}/yr<br>
                Cashflow ${escapeHtml(inr(row.annualCashflow))}/yr
              </td>
              <td>
                Projected Price ${escapeHtml(inr(row.projectedPrice))}<br>
                Capital Gain ${escapeHtml(inr(row.capitalGain))}<br>
                Total Return ${escapeHtml(inr(row.totalReturn))}<br>
                ROI ${numberFrom(row.roiPct, 0)}%
              </td>
              <td>
                Down ${escapeHtml(inr(row.downPayment))}<br>
                Loan ${escapeHtml(inr(row.loanAmount))}<br>
                Payback ${numberFrom(row.paybackYears, 0)}y
              </td>
              <td>${escapeHtml(row.strategy)}</td>
              <td>
                <div class="cia-actions">
                  <button type="button" data-action="rent" data-id="${escapeHtml(row.id)}">Set Rent</button>
                  <button type="button" data-action="compare" data-id="${escapeHtml(row.id)}">Add Compare</button>
                  <button type="button" data-action="open" data-id="${escapeHtml(row.id)}">Open</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  const addToCompare = (id) => {
    const key = text(id);
    if (!key) return;
    const state = readJson(MARKET_STATE_KEY, { wishlist: [], compare: [], visits: [] });
    const compare = Array.isArray(state.compare) ? state.compare : [];
    if (compare.includes(key)) return;
    if (compare.length >= 3) compare.shift();
    compare.push(key);
    writeJson(MARKET_STATE_KEY, { ...state, compare });
  };

  const exportCsv = () => {
    const headers = [
      'Listing ID',
      'Title',
      'Location',
      'Category',
      'Price',
      'Monthly Rent',
      'Gross Yield',
      'Net Yield',
      'Annual Cashflow',
      'ROI %',
      'Investment Score',
      'Strategy',
    ];
    const rows = (model.rows || []).map((row) => ([
      row.id,
      row.title,
      row.location,
      row.category,
      String(numberFrom(row.price, 0)),
      String(numberFrom(row.monthlyRent, 0)),
      String(numberFrom(row.grossYield, 0)),
      String(numberFrom(row.netYield, 0)),
      String(numberFrom(row.annualCashflow, 0)),
      String(numberFrom(row.roiPct, 0)),
      String(numberFrom(row.investmentScore, 0)),
      row.strategy,
    ]));
    const quote = (value) => {
      const raw = String(value || '');
      if (!/[",\n]/.test(raw)) return raw;
      return `"${raw.replace(/"/g, '""')}"`;
    };
    const csv = [headers, ...rows].map((line) => line.map(quote).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `customer-investment-analyzer-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus('Investment CSV exported.');
  };

  const refresh = async () => {
    setStatus('Refreshing investment analysis...');
    const settings = getSettings();
    writeSettingsToInputs(settings);
    const listingMap = loadListingMap();
    const ids = shortlistIds(listingMap);
    const rentOverrides = getRentOverrides();
    model = buildModel({
      listingMap,
      ids,
      settings,
      rentOverrides,
    });
    render();
    setStatus(`Investment analyzer ready. ${numberFrom(model.summary.shortlist, 0)} shortlist listing(s) evaluated.`);
  };

  refreshBtn?.addEventListener('click', () => {
    setSettings(readInputsToSettings());
    refresh().catch((error) => setStatus(text(error?.message, 'Refresh failed.'), false));
  });
  csvBtn?.addEventListener('click', exportCsv);
  [appInput, vacancyInput, maintInput, rateInput, downInput, tenureInput, horizonInput].forEach((input) => {
    input?.addEventListener('change', () => {
      setSettings(readInputsToSettings());
      refresh().catch((error) => setStatus(text(error?.message, 'Settings apply failed.'), false));
    });
  });

  tableEl?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = text(target.getAttribute('data-action')).toLowerCase();
    const id = text(target.getAttribute('data-id'));
    if (!action || !id) return;
    const row = (model.rows || []).find((item) => item.id === id);
    if (!row) return;

    if (action === 'rent') {
      const value = window.prompt(`Set monthly rent for ${row.title} (₹)`, String(numberFrom(row.monthlyRent, 0)));
      if (value === null) return;
      setRentOverride(row.id, numberFrom(value, 0));
      setStatus('Rent override saved.');
      refresh().catch(() => null);
      return;
    }
    if (action === 'compare') {
      addToCompare(row.id);
      setStatus(`${row.title} added to compare set.`);
      return;
    }
    if (action === 'open') {
      window.open(`property-details.html?id=${encodeURIComponent(row.id)}`, '_blank', 'noopener,noreferrer');
    }
  });

  refresh().catch((error) => {
    setStatus(text(error?.message, 'Unable to load investment analyzer.'), false);
  });
})();
