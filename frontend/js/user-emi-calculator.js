(() => {
  if (document.getElementById('userEmiCalculatorCard')) return;

  const live = window.PropertySetuLive || {};
  const propertySelect = document.getElementById('propertySelect');
  if (!propertySelect) return;

  const STYLE_ID = 'user-emi-calculator-style';
  const CARD_ID = 'userEmiCalculatorCard';
  const EMI_STATE_KEY = 'propertySetu:userEmiState';
  const LISTINGS_KEY = 'propertySetu:listings';

  const text = (value, fallback = '') => {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  };

  const numberFrom = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

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

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${CARD_ID} .emi-status { margin: 0 0 10px; color: #1f6d3d; font-size: 14px; }
#${CARD_ID} .emi-grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
#${CARD_ID} .emi-grid label { font-size: 12px; color: #35597d; display: block; margin-bottom: 4px; }
#${CARD_ID} .emi-grid input {
  width: 100%;
  border: 1px solid #cad9ef;
  border-radius: 8px;
  padding: 8px 10px;
}
#${CARD_ID} .emi-toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
#${CARD_ID} .emi-btn {
  border: 1px solid #0b3d91;
  border-radius: 8px;
  background: #0b3d91;
  color: #fff;
  padding: 8px 12px;
  font-weight: 700;
  cursor: pointer;
}
#${CARD_ID} .emi-btn.alt { background: #fff; color: #0b3d91; }
#${CARD_ID} .emi-kpis { display: grid; gap: 8px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); margin-top: 12px; }
#${CARD_ID} .emi-kpi {
  border: 1px solid #d7e5f7;
  border-radius: 8px;
  padding: 8px;
  background: #f8fbff;
}
#${CARD_ID} .emi-kpi small { color: #58718f; display: block; }
#${CARD_ID} .emi-kpi b { color: #11466e; font-size: 16px; }
#${CARD_ID} .emi-table-wrap { margin-top: 12px; overflow: auto; }
#${CARD_ID} .emi-table { width: 100%; border-collapse: collapse; min-width: 520px; }
#${CARD_ID} .emi-table th, #${CARD_ID} .emi-table td {
  border: 1px solid #d6e1f5;
  padding: 7px 8px;
  text-align: left;
  font-size: 12px;
}
#${CARD_ID} .emi-table th { background: #f4f8ff; color: #11466e; }
    `;
    document.head.appendChild(style);
  }

  const card = document.createElement('div');
  card.className = 'container';
  card.id = CARD_ID;
  card.innerHTML = `
    <h2>EMI Calculator</h2>
    <p id="emiStatus" class="emi-status">Select property and calculate EMI.</p>
    <div class="emi-grid">
      <div>
        <label for="emiPropertyPrice">Property Price</label>
        <input id="emiPropertyPrice" type="number" min="0" step="1000" placeholder="Auto from selected property" />
      </div>
      <div>
        <label for="emiDownPaymentPercent">Down Payment (%)</label>
        <input id="emiDownPaymentPercent" type="number" min="0" max="95" step="0.1" value="20" />
      </div>
      <div>
        <label for="emiLoanAmount">Loan Amount</label>
        <input id="emiLoanAmount" type="number" min="1" step="1000" placeholder="Auto calculated" />
      </div>
      <div>
        <label for="emiAnnualRate">Interest Rate (% p.a.)</label>
        <input id="emiAnnualRate" type="number" min="0" step="0.1" value="8.6" />
      </div>
      <div>
        <label for="emiTenureYears">Tenure (Years)</label>
        <input id="emiTenureYears" type="number" min="1" max="40" step="1" value="20" />
      </div>
      <div>
        <label for="emiMonthlyIncome">Monthly Income (Optional)</label>
        <input id="emiMonthlyIncome" type="number" min="0" step="1000" placeholder="For affordability ratio" />
      </div>
    </div>
    <div class="emi-toolbar">
      <button id="emiAutoFillBtn" class="emi-btn alt" type="button">Auto-fill from Selected Property</button>
      <button id="emiCalcBtn" class="emi-btn" type="button">Calculate EMI</button>
    </div>
    <div id="emiKpis" class="emi-kpis"></div>
    <div id="emiBreakdownWrap" class="emi-table-wrap"></div>
  `;

  const containers = Array.from(document.querySelectorAll('.container'));
  const anchor = containers[2] || containers[containers.length - 1];
  if (anchor) {
    anchor.insertAdjacentElement('afterend', card);
  } else {
    document.body.appendChild(card);
  }

  const statusEl = document.getElementById('emiStatus');
  const propertyPriceEl = document.getElementById('emiPropertyPrice');
  const downPercentEl = document.getElementById('emiDownPaymentPercent');
  const loanAmountEl = document.getElementById('emiLoanAmount');
  const rateEl = document.getElementById('emiAnnualRate');
  const tenureEl = document.getElementById('emiTenureYears');
  const incomeEl = document.getElementById('emiMonthlyIncome');
  const autoFillBtn = document.getElementById('emiAutoFillBtn');
  const calcBtn = document.getElementById('emiCalcBtn');
  const kpisEl = document.getElementById('emiKpis');
  const tableWrapEl = document.getElementById('emiBreakdownWrap');

  const setStatus = (message, ok = true) => {
    statusEl.textContent = message;
    statusEl.style.color = ok ? '#1f6d3d' : '#8d1e1e';
  };

  const saveState = () => {
    writeJson(EMI_STATE_KEY, {
      propertyPrice: numberFrom(propertyPriceEl.value, 0),
      downPercent: numberFrom(downPercentEl.value, 20),
      loanAmount: numberFrom(loanAmountEl.value, 0),
      annualRate: numberFrom(rateEl.value, 8.6),
      tenureYears: numberFrom(tenureEl.value, 20),
      monthlyIncome: numberFrom(incomeEl.value, 0),
    });
  };

  const loadState = () => {
    const state = readJson(EMI_STATE_KEY, null);
    if (!state || typeof state !== 'object') return;
    if (numberFrom(state.propertyPrice, 0) > 0) propertyPriceEl.value = String(numberFrom(state.propertyPrice, 0));
    if (numberFrom(state.downPercent, 0) >= 0) downPercentEl.value = String(numberFrom(state.downPercent, 20));
    if (numberFrom(state.loanAmount, 0) > 0) loanAmountEl.value = String(numberFrom(state.loanAmount, 0));
    if (numberFrom(state.annualRate, 0) >= 0) rateEl.value = String(numberFrom(state.annualRate, 8.6));
    if (numberFrom(state.tenureYears, 0) > 0) tenureEl.value = String(numberFrom(state.tenureYears, 20));
    if (numberFrom(state.monthlyIncome, 0) > 0) incomeEl.value = String(numberFrom(state.monthlyIncome, 0));
  };

  const getListingsMap = () => {
    const rows = readJson(LISTINGS_KEY, []);
    const map = new Map();
    (Array.isArray(rows) ? rows : []).forEach((item) => {
      const id = text(item?.id);
      if (!id) return;
      map.set(id, {
        id,
        title: text(item?.title, 'Property'),
        price: numberFrom(item?.price, 0),
      });
    });
    return map;
  };

  const computeLoanFromPrice = () => {
    const price = numberFrom(propertyPriceEl.value, 0);
    const downPercent = Math.max(0, Math.min(95, numberFrom(downPercentEl.value, 20)));
    const loanAmount = Math.max(0, Math.round(price * (1 - (downPercent / 100))));
    loanAmountEl.value = loanAmount > 0 ? String(loanAmount) : '';
    return loanAmount;
  };

  const getSelectedPropertyPrice = () => {
    const selectedId = text(propertySelect.value);
    if (!selectedId) return { id: '', title: '', price: 0 };
    const map = getListingsMap();
    const row = map.get(selectedId);
    if (row) return row;
    return { id: selectedId, title: selectedId, price: 0 };
  };

  const buildSchedule = ({ loanAmount, annualRatePercent, tenureYears }) => {
    const monthlyRate = annualRatePercent / 12 / 100;
    const months = Math.max(1, Math.round(tenureYears * 12));
    const emi = monthlyRate === 0
      ? loanAmount / months
      : loanAmount * monthlyRate * ((1 + monthlyRate) ** months) / (((1 + monthlyRate) ** months) - 1);

    let balance = loanAmount;
    const schedule = [];
    for (let month = 1; month <= Math.min(12, months); month += 1) {
      const interest = monthlyRate === 0 ? 0 : balance * monthlyRate;
      const principal = Math.min(balance, emi - interest);
      balance = Math.max(0, balance - principal);
      schedule.push({
        month,
        emi,
        principal,
        interest,
        balance,
      });
    }

    const totalAmount = emi * months;
    const totalInterest = totalAmount - loanAmount;

    return {
      monthlyEmi: emi,
      totalAmount,
      totalInterest,
      months,
      schedule,
    };
  };

  const renderResult = ({ monthlyEmi, totalInterest, totalAmount, months, schedule }, mode = 'local') => {
    const monthlyIncome = numberFrom(incomeEl.value, 0);
    const emiIncomeRatio = monthlyIncome > 0 ? (monthlyEmi / monthlyIncome) * 100 : 0;
    const affordability = monthlyIncome > 0
      ? (emiIncomeRatio <= 40 ? 'Healthy' : emiIncomeRatio <= 55 ? 'Moderate' : 'High Burden')
      : 'N/A';

    kpisEl.innerHTML = `
      <div class="emi-kpi"><small>Monthly EMI</small><b>${inr(monthlyEmi)}</b></div>
      <div class="emi-kpi"><small>Total Interest</small><b>${inr(totalInterest)}</b></div>
      <div class="emi-kpi"><small>Total Payable</small><b>${inr(totalAmount)}</b></div>
      <div class="emi-kpi"><small>Total Months</small><b>${numberFrom(months, 0)}</b></div>
      <div class="emi-kpi"><small>EMI/Income Ratio</small><b>${monthlyIncome > 0 ? `${emiIncomeRatio.toFixed(1)}%` : 'N/A'}</b></div>
      <div class="emi-kpi"><small>Affordability</small><b>${affordability}</b></div>
    `;

    tableWrapEl.innerHTML = `
      <table class="emi-table">
        <thead>
          <tr>
            <th>Month</th>
            <th>EMI</th>
            <th>Principal</th>
            <th>Interest</th>
            <th>Balance</th>
          </tr>
        </thead>
        <tbody>
          ${schedule.map((row) => `
            <tr>
              <td>${row.month}</td>
              <td>${inr(row.emi)}</td>
              <td>${inr(row.principal)}</td>
              <td>${inr(row.interest)}</td>
              <td>${inr(row.balance)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    setStatus(`EMI calculated (${mode} mode).`);
  };

  const calculate = async () => {
    const loanAmount = numberFrom(loanAmountEl.value, 0);
    const annualRatePercent = numberFrom(rateEl.value, 0);
    const tenureYears = numberFrom(tenureEl.value, 0);
    if (loanAmount <= 0 || tenureYears <= 0 || annualRatePercent < 0) {
      setStatus('Valid loan amount, rate and tenure required.', false);
      return;
    }

    saveState();

    const fallback = () => {
      const result = buildSchedule({ loanAmount, annualRatePercent, tenureYears });
      renderResult(result, 'local');
    };

    if (!live.ai || typeof live.ai.emiCalculator !== 'function') {
      fallback();
      return;
    }

    try {
      const response = await live.ai.emiCalculator({
        loanAmount,
        annualRatePercent,
        tenureYears,
      });
      const emi = response?.emi || {};
      if (!emi || numberFrom(emi.monthlyEmi, 0) <= 0) {
        fallback();
        return;
      }
      const result = buildSchedule({
        loanAmount,
        annualRatePercent,
        tenureYears,
      });
      result.monthlyEmi = numberFrom(emi.monthlyEmi, result.monthlyEmi);
      result.totalInterest = numberFrom(emi.totalInterest, result.totalInterest);
      result.totalAmount = numberFrom(emi.totalAmount, result.totalAmount);
      renderResult(result, 'live');
    } catch (error) {
      fallback();
      setStatus(`Live EMI unavailable: ${text(error?.message, 'unknown error')}. Local result shown.`, false);
    }
  };

  const autoFillFromProperty = () => {
    const property = getSelectedPropertyPrice();
    if (property.price > 0) {
      propertyPriceEl.value = String(Math.round(property.price));
      computeLoanFromPrice();
      saveState();
      setStatus(`Auto-filled from ${property.title}.`);
      return;
    }
    setStatus('Selected property price unavailable. Fill manually.', false);
  };

  autoFillBtn?.addEventListener('click', autoFillFromProperty);
  calcBtn?.addEventListener('click', () => {
    calculate().catch((error) => {
      setStatus(`EMI calculation failed: ${text(error?.message, 'unknown error')}`, false);
    });
  });

  propertySelect?.addEventListener('change', () => {
    autoFillFromProperty();
  });

  propertyPriceEl?.addEventListener('input', () => {
    computeLoanFromPrice();
    saveState();
  });
  downPercentEl?.addEventListener('input', () => {
    computeLoanFromPrice();
    saveState();
  });
  loanAmountEl?.addEventListener('input', saveState);
  rateEl?.addEventListener('input', saveState);
  tenureEl?.addEventListener('input', saveState);
  incomeEl?.addEventListener('input', saveState);

  loadState();
  if (!numberFrom(loanAmountEl.value, 0)) {
    computeLoanFromPrice();
  }
  autoFillFromProperty();
})();
