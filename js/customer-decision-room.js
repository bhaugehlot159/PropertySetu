(() => {
  if (document.getElementById('customerDecisionRoomCard')) return;

  const live = window.PropertySetuLive || {};
  const isUserPage = Boolean(
    document.getElementById('wishlist')
    && document.getElementById('visitForm')
    && document.getElementById('chatBox')
  );
  if (!isUserPage) return;

  const CARD_ID = 'customerDecisionRoomCard';
  const STYLE_ID = 'customer-decision-room-style';
  const LISTINGS_KEY = 'propertySetu:listings';
  const MARKET_STATE_KEY = 'propertysetu-marketplace-state';
  const VISIT_KEY = 'propertySetu:userVisits';
  const VIDEO_VISIT_KEY = 'propertySetu:videoVisits';
  const CHAT_PREFIX = 'propertySetu:userChat:';
  const NOTES_KEY = 'propertySetu:customerDecisionNotes';
  const SETTINGS_KEY = 'propertySetu:customerDecisionSettings';
  const LOAN_QUEUE_KEY = 'propertySetu:loanAssistanceLocal';
  const HOUR_MS = 3600000;

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
    if (typeof live.getToken === 'function') return text(live.getToken('customer') || live.getToken('seller') || live.getToken('admin'));
    return '';
  };
  const getSessionId = () => {
    if (typeof live.getAnySession === 'function') return text(live.getAnySession()?.id);
    return '';
  };

  const getSettings = () => {
    const settings = readJson(SETTINGS_KEY, {});
    return {
      monthlyIncome: Math.max(25000, numberFrom(settings?.monthlyIncome, 120000)),
      downPaymentPct: clamp(numberFrom(settings?.downPaymentPct, 20), 5, 80),
      tenureYears: clamp(numberFrom(settings?.tenureYears, 20), 5, 35),
      interestRate: clamp(numberFrom(settings?.interestRate, 8.7), 5, 18),
    };
  };

  const setSettings = (next) => {
    const current = getSettings();
    writeJson(SETTINGS_KEY, { ...current, ...(next || {}) });
  };

  const getNotes = () => {
    const map = readJson(NOTES_KEY, {});
    return map && typeof map === 'object' ? map : {};
  };

  const setNote = (listingId, note) => {
    const id = text(listingId);
    if (!id) return;
    const map = getNotes();
    map[id] = text(note);
    writeJson(NOTES_KEY, map);
  };

  const inr = (value) => `₹${numberFrom(value, 0).toLocaleString('en-IN')}`;

  const normalizeListing = (item = {}) => {
    const id = text(item.id || item._id);
    if (!id) return null;
    const verification = item.verification && typeof item.verification === 'object' ? item.verification : {};
    return {
      id,
      title: text(item.title, id),
      price: Math.max(0, numberFrom(item.price, 0)),
      location: text(item.location || item.locality, 'Udaipur'),
      city: text(item.city, 'Udaipur'),
      category: text(item.category || item.propertyTypeCore, 'Unknown'),
      ownerId: text(item.ownerId || item.owner?.id || item.userId),
      verified: Boolean(item.verified || text(item.status).toLowerCase() === 'approved'),
      verifiedByPropertySetu: Boolean(item.verifiedByPropertySetu || verification.badgeEligible || verification.adminApproved),
      featured: Boolean(item.featured),
      listedAt: text(item.createdAt || item.listedAt || item.updatedAt),
    };
  };

  const collectListingMap = () => {
    const rows = readJson(LISTINGS_KEY, []);
    const map = new Map();
    (Array.isArray(rows) ? rows : [])
      .map((item) => normalizeListing(item))
      .filter(Boolean)
      .forEach((row) => map.set(row.id, row));
    return map;
  };

  const collectShortlistIds = (listingMap, liveWishlistIds = []) => {
    const market = readJson(MARKET_STATE_KEY, { wishlist: [], compare: [] });
    const ids = [];
    const add = (id) => {
      const normalized = text(id);
      if (!normalized || ids.includes(normalized)) return;
      ids.push(normalized);
    };
    (Array.isArray(liveWishlistIds) ? liveWishlistIds : []).forEach(add);
    (Array.isArray(market?.wishlist) ? market.wishlist : []).forEach(add);
    (Array.isArray(market?.compare) ? market.compare : []).forEach(add);
    const visits = readJson(VISIT_KEY, []);
    (Array.isArray(visits) ? visits : []).forEach((visit) => add(visit?.propertyId));
    if (!ids.length) {
      [...listingMap.values()]
        .sort((a, b) => (new Date(b.listedAt || 0)).getTime() - (new Date(a.listedAt || 0)).getTime())
        .slice(0, 8)
        .forEach((row) => add(row.id));
    }
    return ids;
  };

  const collectVisitMap = () => {
    const map = {};
    const visits = readJson(VISIT_KEY, []);
    const videoVisits = readJson(VIDEO_VISIT_KEY, []);
    const bump = (id) => {
      const key = text(id);
      if (!key) return;
      map[key] = numberFrom(map[key], 0) + 1;
    };
    (Array.isArray(visits) ? visits : []).forEach((item) => bump(item?.propertyId));
    (Array.isArray(videoVisits) ? videoVisits : []).forEach((item) => bump(item?.propertyId || item?.listingId));
    return map;
  };

  const collectLiveWishlistIds = async (token) => {
    if (!token || typeof live.request !== 'function') return [];
    try {
      const response = await live.request('/wishlist', { token });
      const items = Array.isArray(response?.items) ? response.items : [];
      return items
        .map((item) => text(item?.propertyId || item?.property?.id || item?.property?._id))
        .filter(Boolean);
    } catch {
      return [];
    }
  };

  const collectLiveVisitMap = async (token) => {
    if (!token || typeof live.request !== 'function') return {};
    try {
      const response = await live.request('/visits/mine?limit=500', { token });
      const items = Array.isArray(response?.items) ? response.items : [];
      const map = {};
      items.forEach((item) => {
        const id = text(item?.propertyId || item?.property?.id || item?.property?._id);
        if (!id) return;
        map[id] = numberFrom(map[id], 0) + 1;
      });
      return map;
    } catch {
      return {};
    }
  };

  const mergeCountMap = (left = {}, right = {}) => {
    const out = {};
    const merge = (src) => {
      Object.entries(src || {}).forEach(([key, value]) => {
        const id = text(key);
        if (!id) return;
        out[id] = numberFrom(out[id], 0) + numberFrom(value, 0);
      });
    };
    merge(left);
    merge(right);
    return out;
  };

  const collectLocalChatStats = () => {
    const map = {};
    try {
      const keyCount = numberFrom(localStorage.length, 0);
      for (let i = 0; i < keyCount; i += 1) {
        const key = text(localStorage.key(i));
        if (!key.startsWith(CHAT_PREFIX)) continue;
        const listingId = key.slice(CHAT_PREFIX.length);
        const rows = readJson(key, []);
        const stats = map[listingId] || { inbound: 0, outbound: 0 };
        (Array.isArray(rows) ? rows : []).forEach((entry) => {
          const sender = text(entry?.sender).toLowerCase();
          if (sender === 'you') stats.outbound += 1;
          else stats.inbound += 1;
        });
        map[listingId] = stats;
      }
    } catch {
      // no-op
    }
    return map;
  };

  const collectLiveChatStats = async (token, sessionId) => {
    if (!token || typeof live.request !== 'function') return {};
    try {
      const response = await live.request('/chat/mine', { token });
      const rows = Array.isArray(response?.items) ? response.items : [];
      const map = {};
      rows.forEach((item) => {
        const listingId = text(item?.propertyId);
        if (!listingId) return;
        const stats = map[listingId] || { inbound: 0, outbound: 0 };
        const senderId = text(item?.senderId);
        const receiverId = text(item?.receiverId);
        if (sessionId && senderId === sessionId) stats.outbound += 1;
        if (sessionId && receiverId === sessionId) stats.inbound += 1;
        map[listingId] = stats;
      });
      return map;
    } catch {
      return {};
    }
  };

  const mergeChatStats = (a = {}, b = {}) => {
    const out = {};
    const apply = (source) => {
      Object.entries(source || {}).forEach(([id, stats]) => {
        const key = text(id);
        if (!key) return;
        if (!out[key]) out[key] = { inbound: 0, outbound: 0 };
        out[key].inbound += numberFrom(stats?.inbound, 0);
        out[key].outbound += numberFrom(stats?.outbound, 0);
      });
    };
    apply(a);
    apply(b);
    return out;
  };

  const monthlyEmi = ({ loanAmount, annualRate, tenureYears }) => {
    const principal = Math.max(0, numberFrom(loanAmount, 0));
    const months = Math.max(1, Math.round(numberFrom(tenureYears, 1) * 12));
    const monthlyRate = numberFrom(annualRate, 0) / 1200;
    if (principal <= 0) return 0;
    if (monthlyRate <= 0) return Math.round(principal / months);
    const factor = (1 + monthlyRate) ** months;
    const emi = (principal * monthlyRate * factor) / (factor - 1);
    return Math.round(emi);
  };

  const buildModel = ({ listingMap, shortlistIds, visitMap, chatStats, settings, notes }) => {
    const pricesByCategory = new Map();
    [...listingMap.values()].forEach((listing) => {
      const key = text(listing.category).toLowerCase() || 'unknown';
      if (!pricesByCategory.has(key)) pricesByCategory.set(key, []);
      if (listing.price > 0) pricesByCategory.get(key).push(listing.price);
    });
    const medians = {};
    pricesByCategory.forEach((values, key) => {
      const sorted = values.sort((a, b) => a - b);
      if (!sorted.length) medians[key] = 0;
      else {
        const mid = Math.floor(sorted.length / 2);
        medians[key] = sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
      }
    });

    const rows = shortlistIds
      .map((id) => listingMap.get(id))
      .filter(Boolean)
      .map((listing) => {
        const downPayment = Math.round((listing.price * settings.downPaymentPct) / 100);
        const loanAmount = Math.max(0, listing.price - downPayment);
        const emi = monthlyEmi({
          loanAmount,
          annualRate: settings.interestRate,
          tenureYears: settings.tenureYears,
        });
        const affordabilityRatio = settings.monthlyIncome > 0
          ? Number(((emi / settings.monthlyIncome) * 100).toFixed(1))
          : 999;

        let affordabilityScore = 8;
        if (affordabilityRatio <= 25) affordabilityScore = 40;
        else if (affordabilityRatio <= 35) affordabilityScore = 30;
        else if (affordabilityRatio <= 45) affordabilityScore = 20;

        let trustScore = listing.verified ? 18 : 8;
        if (listing.verifiedByPropertySetu) trustScore += 12;
        if (listing.featured) trustScore += 4;
        trustScore = clamp(trustScore, 0, 30);

        const visits = numberFrom(visitMap[listing.id], 0);
        const inbound = numberFrom(chatStats[listing.id]?.inbound, 0);
        const outbound = numberFrom(chatStats[listing.id]?.outbound, 0);
        let engagementScore = visits * 8;
        engagementScore += Math.min(inbound, outbound) * 2;
        if (outbound > 0) engagementScore += 3;
        engagementScore = clamp(engagementScore, 0, 25);

        const decisionScore = clamp(affordabilityScore + trustScore + engagementScore, 0, 100);

        const medianCategoryPrice = numberFrom(medians[text(listing.category).toLowerCase() || 'unknown'], 0);
        const priceVsMedianPct = medianCategoryPrice > 0
          ? Number((((listing.price - medianCategoryPrice) / medianCategoryPrice) * 100).toFixed(1))
          : 0;

        let recommendation = 'Healthy shortlist candidate. Prepare final negotiation points.';
        if (affordabilityRatio > 50) {
          recommendation = 'EMI ratio high. Consider lower budget or higher down payment.';
        } else if (visits === 0) {
          recommendation = 'Visit pending. Schedule site visit in next 48h.';
        } else if (outbound === 0) {
          recommendation = 'Owner conversation pending. Send qualification message.';
        } else if (loanAmount > 0) {
          recommendation = 'Start loan assistance pre-check for faster closure.';
        }

        return {
          ...listing,
          downPayment,
          loanAmount,
          emi,
          affordabilityRatio,
          affordabilityScore,
          trustScore,
          engagementScore,
          decisionScore,
          visits,
          inbound,
          outbound,
          priceVsMedianPct,
          recommendation,
          note: text(notes[listing.id]),
        };
      })
      .sort((a, b) => {
        if (b.decisionScore !== a.decisionScore) return b.decisionScore - a.decisionScore;
        return a.affordabilityRatio - b.affordabilityRatio;
      });

    const summary = {
      shortlist: rows.length,
      avgScore: rows.length
        ? Math.round(rows.reduce((sum, row) => sum + numberFrom(row.decisionScore, 0), 0) / rows.length)
        : 0,
      affordable: rows.filter((row) => numberFrom(row.affordabilityRatio, 0) <= 35).length,
      visitPending: rows.filter((row) => numberFrom(row.visits, 0) === 0).length,
      highPriority: rows.filter((row) => numberFrom(row.decisionScore, 0) >= 70).length,
    };

    return { rows, summary };
  };

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${CARD_ID} .cdr-status{margin:0 0 10px;color:#1f6d3d;font-size:14px;}
#${CARD_ID} .cdr-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px;}
#${CARD_ID} .cdr-btn{border:1px solid #0b3d91;border-radius:8px;background:#0b3d91;color:#fff;padding:7px 11px;font-weight:700;cursor:pointer;}
#${CARD_ID} .cdr-btn.alt{background:#fff;color:#0b3d91;}
#${CARD_ID} .cdr-field{display:flex;align-items:center;gap:6px;font-size:12px;color:#395878;}
#${CARD_ID} .cdr-field input{width:120px;padding:6px 8px;border:1px solid #cbdaf0;border-radius:8px;}
#${CARD_ID} .cdr-kpi{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin-bottom:10px;}
#${CARD_ID} .cdr-kpi-item{border:1px solid #d7e6f8;border-radius:8px;background:#f7fbff;padding:8px;}
#${CARD_ID} .cdr-kpi-item small{display:block;color:#58718f;}
#${CARD_ID} .cdr-kpi-item b{color:#11466e;font-size:16px;}
#${CARD_ID} .cdr-table-wrap{overflow:auto;}
#${CARD_ID} table{width:100%;border-collapse:collapse;min-width:1080px;}
#${CARD_ID} th,#${CARD_ID} td{border:1px solid #d5e2f4;padding:7px;text-align:left;font-size:13px;vertical-align:top;}
#${CARD_ID} th{background:#f3f8ff;}
#${CARD_ID} .cdr-chip{display:inline-block;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:700;}
#${CARD_ID} .cdr-chip.high{background:#e7f8ef;color:#19643a;}
#${CARD_ID} .cdr-chip.mid{background:#fff0d9;color:#9f5d00;}
#${CARD_ID} .cdr-chip.low{background:#ffe5e5;color:#992222;}
#${CARD_ID} .cdr-actions{display:flex;flex-wrap:wrap;gap:6px;}
#${CARD_ID} .cdr-actions button{border:1px solid #cbdcf2;background:#fff;color:#12395f;border-radius:999px;padding:4px 9px;font-size:12px;cursor:pointer;}
    `;
    document.head.appendChild(style);
  }

  const card = document.createElement('div');
  card.className = 'container';
  card.id = CARD_ID;
  card.innerHTML = `
    <h2>Customer Decision Room Pro</h2>
    <p id="cdrStatus" class="cdr-status">Building shortlist intelligence...</p>
    <div class="cdr-toolbar">
      <button id="cdrRefreshBtn" class="cdr-btn" type="button">Refresh Model</button>
      <button id="cdrAutoVisitBtn" class="cdr-btn alt" type="button">Auto Plan Visits</button>
      <button id="cdrCsvBtn" class="cdr-btn alt" type="button">Export CSV</button>
      <label class="cdr-field">Income / month<input id="cdrIncomeInput" type="number" min="25000" step="1000"></label>
      <label class="cdr-field">Down Payment %<input id="cdrDownPctInput" type="number" min="5" max="80" step="1"></label>
      <label class="cdr-field">Tenure (years)<input id="cdrTenureInput" type="number" min="5" max="35" step="1"></label>
      <label class="cdr-field">Interest %<input id="cdrRateInput" type="number" min="5" max="18" step="0.1"></label>
    </div>
    <div id="cdrKpi" class="cdr-kpi"></div>
    <div id="cdrTable" class="cdr-table-wrap"></div>
  `;

  const visitOptimizerCard = document.getElementById('userVisitOptimizerCard');
  const engagementCard = document.getElementById('customerEngagementSuiteCard');
  const wishlistContainer = document.getElementById('wishlist')?.closest('.container');
  const anchor = visitOptimizerCard || engagementCard || wishlistContainer || document.querySelector('.container');
  if (anchor) anchor.insertAdjacentElement('afterend', card);
  else document.body.appendChild(card);

  const statusEl = document.getElementById('cdrStatus');
  const kpiEl = document.getElementById('cdrKpi');
  const tableEl = document.getElementById('cdrTable');
  const refreshBtn = document.getElementById('cdrRefreshBtn');
  const autoVisitBtn = document.getElementById('cdrAutoVisitBtn');
  const csvBtn = document.getElementById('cdrCsvBtn');
  const incomeInput = document.getElementById('cdrIncomeInput');
  const downPctInput = document.getElementById('cdrDownPctInput');
  const tenureInput = document.getElementById('cdrTenureInput');
  const rateInput = document.getElementById('cdrRateInput');

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

  const render = () => {
    const summary = model.summary || {};
    kpiEl.innerHTML = `
      <div class="cdr-kpi-item"><small>Shortlist</small><b>${numberFrom(summary.shortlist, 0)}</b></div>
      <div class="cdr-kpi-item"><small>Avg Score</small><b>${numberFrom(summary.avgScore, 0)}</b></div>
      <div class="cdr-kpi-item"><small>Affordable (<=35%)</small><b>${numberFrom(summary.affordable, 0)}</b></div>
      <div class="cdr-kpi-item"><small>Visit Pending</small><b>${numberFrom(summary.visitPending, 0)}</b></div>
      <div class="cdr-kpi-item"><small>High Priority</small><b>${numberFrom(summary.highPriority, 0)}</b></div>
    `;

    if (!model.rows.length) {
      tableEl.innerHTML = '<p style="margin:0;color:#607da8;">Wishlist/compare listings add karo, decision room auto fill ho jayega.</p>';
      return;
    }

    tableEl.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Listing</th>
            <th>Decision Score</th>
            <th>Affordability</th>
            <th>Engagement</th>
            <th>Recommendation</th>
            <th>Note</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${model.rows.map((row) => `
            <tr>
              <td>
                <b>${escapeHtml(row.title)}</b><br>
                <small style="color:#5b6e86;">${escapeHtml(row.location)} | ${escapeHtml(row.category)}</small><br>
                <small style="color:#5b6e86;">Price ${escapeHtml(inr(row.price))} (${row.priceVsMedianPct >= 0 ? '+' : ''}${numberFrom(row.priceVsMedianPct, 0)}% vs category median)</small>
              </td>
              <td>
                <span class="cdr-chip ${scoreClass(row.decisionScore)}">${numberFrom(row.decisionScore, 0)}</span><br>
                <small>Aff ${numberFrom(row.affordabilityScore, 0)} | Trust ${numberFrom(row.trustScore, 0)} | Eng ${numberFrom(row.engagementScore, 0)}</small>
              </td>
              <td>
                EMI ${escapeHtml(inr(row.emi))}<br>
                Ratio ${numberFrom(row.affordabilityRatio, 0)}% of income<br>
                Loan ${escapeHtml(inr(row.loanAmount))} | Down ${escapeHtml(inr(row.downPayment))}
              </td>
              <td>
                Visits ${numberFrom(row.visits, 0)}<br>
                Chat out ${numberFrom(row.outbound, 0)}<br>
                Chat in ${numberFrom(row.inbound, 0)}
              </td>
              <td>${escapeHtml(row.recommendation)}</td>
              <td>${escapeHtml(text(row.note, '-'))}</td>
              <td>
                <div class="cdr-actions">
                  <button type="button" data-action="visit" data-id="${escapeHtml(row.id)}">Visit +48h</button>
                  <button type="button" data-action="ping" data-id="${escapeHtml(row.id)}">Ping Owner</button>
                  <button type="button" data-action="loan" data-id="${escapeHtml(row.id)}">Loan Assist</button>
                  <button type="button" data-action="note" data-id="${escapeHtml(row.id)}">Add Note</button>
                  <button type="button" data-action="open" data-id="${escapeHtml(row.id)}">Open</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  const addLocalVisit = (row, dateIso) => {
    const visits = readJson(VISIT_KEY, []);
    visits.unshift({
      propertyId: row.id,
      title: row.title,
      date: dateIso,
      createdAt: new Date().toISOString(),
      source: 'decision-room',
    });
    writeJson(VISIT_KEY, visits.slice(0, 120));
  };

  const quickVisit = async (row, hourOffset = 48) => {
    const dateIso = new Date(Date.now() + (Math.max(1, numberFrom(hourOffset, 48)) * HOUR_MS)).toISOString();
    const token = getToken();
    if (token && typeof live.request === 'function') {
      try {
        await live.request(`/properties/${encodeURIComponent(row.id)}/visit`, {
          method: 'POST',
          token,
          data: {
            preferredAt: dateIso,
            note: 'Decision room quick scheduling',
          },
        });
      } catch (error) {
        if (!live.shouldFallbackToLocal || !live.shouldFallbackToLocal(error)) {
          setStatus(text(error?.message, 'Visit scheduling failed.'), false);
          return false;
        }
      }
    }
    addLocalVisit(row, dateIso);
    setStatus(`Visit scheduled for ${row.title} at ${new Date(dateIso).toLocaleString('en-IN')}.`);
    return true;
  };

  const quickPing = async (row) => {
    const message = `Hi, I am interested in ${row.title}. Please share latest availability, documentation summary and best offer.`;
    const token = getToken();
    let liveSent = false;
    if (token && typeof live.request === 'function' && row.ownerId) {
      try {
        await live.request('/chat/send', {
          method: 'POST',
          token,
          data: {
            propertyId: row.id,
            receiverId: row.ownerId,
            message,
          },
        });
        liveSent = true;
      } catch (error) {
        if (!live.shouldFallbackToLocal || !live.shouldFallbackToLocal(error)) {
          setStatus(text(error?.message, 'Ping failed.'), false);
          return false;
        }
      }
    }
    const key = `${CHAT_PREFIX}${row.id}`;
    const chats = readJson(key, []);
    chats.push({
      sender: 'You',
      message,
      at: new Date().toISOString(),
      source: liveSent ? 'live' : 'local',
    });
    writeJson(key, chats);
    setStatus(`Owner ping queued for ${row.title}.`);
    return true;
  };

  const quickLoanAssist = async (row, settings) => {
    const payload = {
      propertyId: row.id,
      propertyTitle: row.title,
      requestedAmount: row.loanAmount,
      loanAmount: row.loanAmount,
      monthlyIncome: settings.monthlyIncome,
      tenureYears: settings.tenureYears,
      interestRate: settings.interestRate,
      estimatedEmi: row.emi,
      locality: row.location,
      city: row.city,
      note: 'Request from customer decision room',
    };
    const token = getToken();
    let liveDone = false;
    if (token && typeof live.request === 'function') {
      try {
        await live.request('/loan/assistance', {
          method: 'POST',
          token,
          data: payload,
        });
        liveDone = true;
        setStatus(`Loan assistance request submitted for ${row.title}.`);
      } catch (error) {
        if (!live.shouldFallbackToLocal || !live.shouldFallbackToLocal(error)) {
          setStatus(text(error?.message, 'Loan assistance failed.'), false);
          return false;
        }
      }
    }
    if (liveDone) return true;
    const queue = readJson(LOAN_QUEUE_KEY, []);
    queue.unshift({
      id: `loan-local-${Date.now()}`,
      ...payload,
      status: 'requested',
      createdAt: new Date().toISOString(),
      source: token ? 'live-fallback' : 'local',
    });
    writeJson(LOAN_QUEUE_KEY, queue.slice(0, 120));
    setStatus(`Loan assistance queued for ${row.title}.`);
    return true;
  };

  const exportCsv = () => {
    const headers = [
      'Listing ID',
      'Title',
      'Location',
      'Category',
      'Price',
      'Decision Score',
      'EMI',
      'Affordability Ratio',
      'Visits',
      'Chat Out',
      'Chat In',
      'Recommendation',
      'Note',
    ];
    const rows = (model.rows || []).map((row) => ([
      row.id,
      row.title,
      row.location,
      row.category,
      String(numberFrom(row.price, 0)),
      String(numberFrom(row.decisionScore, 0)),
      String(numberFrom(row.emi, 0)),
      String(numberFrom(row.affordabilityRatio, 0)),
      String(numberFrom(row.visits, 0)),
      String(numberFrom(row.outbound, 0)),
      String(numberFrom(row.inbound, 0)),
      row.recommendation,
      row.note || '',
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
    link.download = `customer-decision-room-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus('Decision room CSV exported.');
  };

  const readControlsToSettings = () => ({
    monthlyIncome: Math.max(25000, numberFrom(incomeInput.value, 120000)),
    downPaymentPct: clamp(numberFrom(downPctInput.value, 20), 5, 80),
    tenureYears: clamp(numberFrom(tenureInput.value, 20), 5, 35),
    interestRate: clamp(numberFrom(rateInput.value, 8.7), 5, 18),
  });

  const writeSettingsToControls = (settings) => {
    incomeInput.value = String(numberFrom(settings.monthlyIncome, 120000));
    downPctInput.value = String(numberFrom(settings.downPaymentPct, 20));
    tenureInput.value = String(numberFrom(settings.tenureYears, 20));
    rateInput.value = String(numberFrom(settings.interestRate, 8.7));
  };

  const refresh = async () => {
    setStatus('Refreshing decision model...');
    const settings = getSettings();
    writeSettingsToControls(settings);
    const listingMap = collectListingMap();
    const token = getToken();
    const liveWishlistIds = await collectLiveWishlistIds(token);
    const shortlistIds = collectShortlistIds(listingMap, liveWishlistIds);
    const localVisitMap = collectVisitMap();
    const liveVisitMap = await collectLiveVisitMap(token);
    const visitMap = mergeCountMap(localVisitMap, liveVisitMap);
    const localChat = collectLocalChatStats();
    const liveChat = await collectLiveChatStats(token, getSessionId());
    const chatStats = mergeChatStats(localChat, liveChat);
    const notes = getNotes();
    model = buildModel({
      listingMap,
      shortlistIds,
      visitMap,
      chatStats,
      settings,
      notes,
    });
    render();
    setStatus(`Decision room ready. ${numberFrom(model.summary.shortlist, 0)} shortlist listing(s) analyzed.`);
  };

  refreshBtn?.addEventListener('click', () => {
    const settings = readControlsToSettings();
    setSettings(settings);
    refresh().catch((error) => setStatus(text(error?.message, 'Refresh failed.'), false));
  });

  autoVisitBtn?.addEventListener('click', () => {
    const rows = (model.rows || []).filter((row) => numberFrom(row.decisionScore, 0) >= 60 && numberFrom(row.visits, 0) === 0);
    if (!rows.length) {
      setStatus('No auto-visit candidates found right now.');
      return;
    }
    const selected = rows.slice(0, 2);
    Promise.all(selected.map((row, index) => quickVisit(row, 48 + (index * 24))))
      .then(() => refresh())
      .catch((error) => setStatus(text(error?.message, 'Auto visit planning failed.'), false));
  });

  csvBtn?.addEventListener('click', exportCsv);

  [incomeInput, downPctInput, tenureInput, rateInput].forEach((el) => {
    el?.addEventListener('change', () => {
      setSettings(readControlsToSettings());
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
    const settings = getSettings();

    if (action === 'visit') {
      quickVisit(row, 48).then(() => refresh()).catch((error) => setStatus(text(error?.message, 'Visit action failed.'), false));
      return;
    }
    if (action === 'ping') {
      quickPing(row).then(() => refresh()).catch((error) => setStatus(text(error?.message, 'Ping action failed.'), false));
      return;
    }
    if (action === 'loan') {
      quickLoanAssist(row, settings).then(() => refresh()).catch((error) => setStatus(text(error?.message, 'Loan action failed.'), false));
      return;
    }
    if (action === 'note') {
      const value = window.prompt(`Decision note for ${row.title}`, row.note || '');
      if (value === null) return;
      setNote(row.id, value);
      setStatus('Decision note saved.');
      refresh().catch(() => null);
      return;
    }
    if (action === 'open') {
      window.open(`property-details.html?id=${encodeURIComponent(row.id)}`, '_blank', 'noopener,noreferrer');
    }
  });

  refresh().catch((error) => {
    setStatus(text(error?.message, 'Unable to load decision room.'), false);
  });
  window.setInterval(() => {
    refresh().catch(() => null);
  }, 90000);
})();
