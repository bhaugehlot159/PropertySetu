(() => {
  if (document.getElementById('adminFraudRiskCenterCard')) return;

  const live = window.PropertySetuLive || {};
  const isAdminPage = Boolean(document.getElementById('pendingProperties') && document.getElementById('adminOverview'));
  if (!isAdminPage) return;

  const CARD_ID = 'adminFraudRiskCenterCard';
  const STYLE_ID = 'admin-fraud-risk-center-style';
  const LISTINGS_KEY = 'propertySetu:listings';
  const LOCAL_REPORT_KEY = 'propertySetu:localReports';
  const TRACK_KEY = 'propertySetu:adminFraudRiskTrack';

  const text = (value, fallback = '') => {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  };
  const numberFrom = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const toTs = (value) => {
    const date = new Date(value || '');
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  };
  const inr = (value) => `₹${numberFrom(value, 0).toLocaleString('en-IN')}`;
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

  const getAdminToken = () => {
    if (typeof live.getToken === 'function') {
      const token = text(live.getToken('admin'));
      if (token) return token;
    }
    if (typeof live.getAnyToken === 'function') return text(live.getAnyToken());
    return '';
  };

  const normalizeListing = (item = {}) => {
    const id = text(item.id || item._id);
    if (!id) return null;
    const media = item.media && typeof item.media === 'object' ? item.media : {};
    const uploads = Array.isArray(media.uploads) ? media.uploads : [];
    const images = Array.isArray(item.images) ? item.images : [];
    const imagesCount = Math.max(images.length, numberFrom(media.photosCount, 0), uploads.filter((row) => text(row?.category).toLowerCase() === 'photo').length);
    const aiReview = item.aiReview && typeof item.aiReview === 'object' ? item.aiReview : {};
    const privateDocs = item.privateDocs && typeof item.privateDocs === 'object' ? item.privateDocs : {};
    const docs = Array.isArray(privateDocs.propertyDocuments) ? privateDocs.propertyDocuments : [];

    return {
      id,
      title: text(item.title, id),
      locality: text(item.locality || item.location, 'Udaipur'),
      category: text(item.category, 'Unknown'),
      price: Math.max(0, numberFrom(item.price, 0)),
      ownerId: text(item.ownerId || item.owner?.id || item.userId),
      verified: Boolean(item.verified || text(item.status).toLowerCase() === 'approved'),
      imagesCount,
      docsComplete: Boolean(privateDocs.ownerIdProof && privateDocs.addressProof && docs.length > 0),
      aiReview: {
        fraudRiskScore: clamp(numberFrom(aiReview.fraudRiskScore, item.verified ? 15 : 38), 0, 100),
        fakeListingSignal: Boolean(aiReview.fakeListingSignal || aiReview.duplicatePhotoDetected || aiReview.suspiciousPricingAlert),
        duplicatePhotoDetected: Boolean(aiReview.duplicatePhotoDetected),
        suspiciousPricingAlert: Boolean(aiReview.suspiciousPricingAlert),
      },
    };
  };

  const reasonSeverity = (reason) => {
    const raw = text(reason).toLowerCase();
    if (raw.includes('fake') || raw.includes('fraud') || raw.includes('duplicate') || raw.includes('scam')) return 'high';
    if (raw.includes('spam') || raw.includes('misleading') || raw.includes('price')) return 'medium';
    return 'low';
  };

  const normalizeReport = (item = {}, source = 'live') => {
    const propertyId = text(item.propertyId || item.listingId || item.property?.id);
    if (!propertyId) return null;
    const status = text(item.status || (source === 'local' ? 'pending' : 'pending')).toLowerCase();
    const reason = text(item.reason || item.comment || item.message || 'No reason');
    return {
      id: text(item.id || item._id || `${source}-${propertyId}-${Date.now()}`),
      propertyId,
      reason,
      severity: reasonSeverity(reason),
      pending: status !== 'resolved' && status !== 'closed',
      source,
    };
  };

  const getTrackMap = () => {
    const track = readJson(TRACK_KEY, {});
    return track && typeof track === 'object' ? track : {};
  };
  const mergeTrack = (id, patch) => {
    const key = text(id);
    if (!key) return;
    const next = getTrackMap();
    const current = next[key] && typeof next[key] === 'object' ? next[key] : {};
    next[key] = { ...current, ...(patch || {}), updatedAt: new Date().toISOString() };
    writeJson(TRACK_KEY, next);
  };
  const clearSnooze = () => {
    const next = getTrackMap();
    Object.keys(next).forEach((id) => {
      if (!next[id] || typeof next[id] !== 'object') return;
      next[id].snoozedUntil = '';
    });
    writeJson(TRACK_KEY, next);
  };

  const median = (values = []) => {
    const sorted = values.filter((value) => numberFrom(value, 0) > 0).map((value) => numberFrom(value, 0)).sort((a, b) => a - b);
    if (!sorted.length) return 0;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  };

  const buildModel = (listings = [], reports = []) => {
    const track = getTrackMap();
    const priceByCategory = new Map();
    listings.forEach((listing) => {
      const key = text(listing.category).toLowerCase() || 'unknown';
      if (!priceByCategory.has(key)) priceByCategory.set(key, []);
      if (listing.price > 0) priceByCategory.get(key).push(listing.price);
    });

    const reportMap = new Map();
    reports.forEach((report) => {
      const key = text(report.propertyId);
      if (!key) return;
      const current = reportMap.get(key) || { total: 0, pending: 0, high: 0, liveIds: [] };
      current.total += 1;
      if (report.pending) current.pending += 1;
      if (report.pending && report.severity === 'high') current.high += 1;
      if (report.source === 'live') current.liveIds.push(report.id);
      reportMap.set(key, current);
    });

    const now = Date.now();
    const rows = listings.map((listing) => {
      const reportsForListing = reportMap.get(listing.id) || { total: 0, pending: 0, high: 0, liveIds: [] };
      const medianPrice = median(priceByCategory.get(text(listing.category).toLowerCase()) || []);
      const ratio = (listing.price > 0 && medianPrice > 0) ? (listing.price / medianPrice) : 1;
      const t = track[listing.id] && typeof track[listing.id] === 'object' ? track[listing.id] : {};

      let score = numberFrom(listing.aiReview?.fraudRiskScore, 35);
      if (listing.aiReview?.fakeListingSignal) score += 20;
      if (listing.aiReview?.duplicatePhotoDetected) score += 14;
      if (listing.aiReview?.suspiciousPricingAlert) score += 12;
      score += Math.min(30, numberFrom(reportsForListing.pending, 0) * 10);
      score += Math.min(24, numberFrom(reportsForListing.high, 0) * 12);
      if (listing.imagesCount < 5) score += 12;
      if (!listing.docsComplete) score += 8;
      if (ratio < 0.45) score += 12;
      if (ratio > 3.2) score += 8;
      if (listing.verified) score -= 10;
      score = clamp(Math.round(score), 0, 100);

      const severity = score >= 70 ? 'high' : score >= 45 ? 'medium' : 'low';
      const snoozed = toTs(t.snoozedUntil) > now;
      return {
        ...listing,
        score,
        severity,
        reportTotal: reportsForListing.total,
        reportPending: reportsForListing.pending,
        reportHigh: reportsForListing.high,
        liveReportIds: reportsForListing.liveIds,
        medianPrice,
        ratio,
        decision: text(t.decision),
        reviewedAt: text(t.reviewedAt),
        snoozedUntil: text(t.snoozedUntil),
        snoozed,
      };
    }).sort((a, b) => b.score - a.score);

    return {
      rows,
      summary: {
        total: rows.length,
        high: rows.filter((row) => row.severity === 'high').length,
        medium: rows.filter((row) => row.severity === 'medium').length,
        needsAction: rows.filter((row) => row.score >= 45 && !row.snoozed && row.decision !== 'safe').length,
        unresolvedReports: rows.reduce((sum, row) => sum + numberFrom(row.reportPending, 0), 0),
      },
    };
  };

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${CARD_ID} .status{margin:0 0 10px;color:#1f6d3d;font-size:14px;}
#${CARD_ID} .toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;}
#${CARD_ID} .btn{border:1px solid #0b3d91;border-radius:8px;background:#0b3d91;color:#fff;padding:7px 11px;font-weight:700;cursor:pointer;}
#${CARD_ID} .btn.alt{background:#fff;color:#0b3d91;}
#${CARD_ID} .btn.warn{background:#8f4f00;border-color:#8f4f00;}
#${CARD_ID} .kpi{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin-bottom:10px;}
#${CARD_ID} .kpi-item{border:1px solid #d7e6f8;border-radius:8px;background:#f7fbff;padding:8px;}
#${CARD_ID} .kpi-item small{display:block;color:#58718f;}
#${CARD_ID} .kpi-item b{color:#11466e;font-size:16px;}
#${CARD_ID} .table-wrap{overflow:auto;}
#${CARD_ID} table{width:100%;border-collapse:collapse;min-width:980px;}
#${CARD_ID} th,#${CARD_ID} td{border:1px solid #d5e2f4;padding:7px;text-align:left;font-size:13px;vertical-align:top;}
#${CARD_ID} th{background:#f3f8ff;}
#${CARD_ID} .chip{display:inline-block;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:700;}
#${CARD_ID} .chip.high{background:#ffe5e5;color:#992222;}
#${CARD_ID} .chip.medium{background:#fff0d9;color:#9f5d00;}
#${CARD_ID} .chip.low{background:#e7f8ef;color:#19643a;}
#${CARD_ID} .chip.snooze{background:#e8f2ff;color:#165188;}
#${CARD_ID} .actions{display:flex;flex-wrap:wrap;gap:6px;}
#${CARD_ID} .actions button{border:1px solid #cbdcf2;background:#fff;color:#12395f;border-radius:999px;padding:4px 9px;font-size:12px;cursor:pointer;}
    `;
    document.head.appendChild(style);
  }

  const card = document.createElement('div');
  card.className = 'container';
  card.id = CARD_ID;
  card.innerHTML = `
    <h2>AI Fraud Risk Center</h2>
    <p id="afrcStatus" class="status">Loading fraud queue...</p>
    <div class="toolbar">
      <button id="afrcRefresh" class="btn" type="button">Refresh</button>
      <button id="afrcAuto" class="btn warn" type="button">Auto Triage</button>
      <button id="afrcExport" class="btn alt" type="button">Export CSV</button>
      <button id="afrcUnsnooze" class="btn alt" type="button">Clear Snooze</button>
    </div>
    <div id="afrcKpi" class="kpi"></div>
    <div id="afrcTable" class="table-wrap"></div>
  `;

  const anchor = document.getElementById('adminFeaturedCommissionProCard')
    || document.getElementById('adminReportCommissionAutomationCard')
    || document.querySelector('.container');
  if (anchor) anchor.insertAdjacentElement('afterend', card);
  else document.body.appendChild(card);

  const statusEl = document.getElementById('afrcStatus');
  const kpiEl = document.getElementById('afrcKpi');
  const tableEl = document.getElementById('afrcTable');
  const refreshBtn = document.getElementById('afrcRefresh');
  const autoBtn = document.getElementById('afrcAuto');
  const exportBtn = document.getElementById('afrcExport');
  const unsnoozeBtn = document.getElementById('afrcUnsnooze');

  let model = { rows: [], summary: {} };

  const setStatus = (message, ok = true) => {
    statusEl.textContent = message;
    statusEl.style.color = ok ? '#1f6d3d' : '#8d1e1e';
  };

  const render = () => {
    const summary = model.summary || {};
    kpiEl.innerHTML = `
      <div class="kpi-item"><small>Total Listings</small><b>${numberFrom(summary.total, 0)}</b></div>
      <div class="kpi-item"><small>High Risk</small><b>${numberFrom(summary.high, 0)}</b></div>
      <div class="kpi-item"><small>Medium Risk</small><b>${numberFrom(summary.medium, 0)}</b></div>
      <div class="kpi-item"><small>Needs Action</small><b>${numberFrom(summary.needsAction, 0)}</b></div>
      <div class="kpi-item"><small>Unresolved Reports</small><b>${numberFrom(summary.unresolvedReports, 0)}</b></div>
    `;
    if (!model.rows.length) {
      tableEl.innerHTML = '<p style="margin:0;color:#607da8;">No listing data available.</p>';
      return;
    }
    tableEl.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Listing</th>
            <th>Risk</th>
            <th>Reports</th>
            <th>AI Signals</th>
            <th>Price Signal</th>
            <th>Review State</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${model.rows.slice(0, 80).map((row) => `
            <tr>
              <td><b>${escapeHtml(row.title)}</b><br><small style="color:#5b6e86;">${escapeHtml(row.id)} | ${escapeHtml(row.locality)} | ${escapeHtml(row.category)}</small></td>
              <td><span class="chip ${escapeHtml(row.severity)}">${numberFrom(row.score, 0)} (${escapeHtml(row.severity)})</span><br>${row.snoozed ? `<span class="chip snooze">Snoozed</span>` : ''}</td>
              <td>Total ${numberFrom(row.reportTotal, 0)} | Pending ${numberFrom(row.reportPending, 0)} | High ${numberFrom(row.reportHigh, 0)}</td>
              <td>AI ${numberFrom(row.aiReview?.fraudRiskScore, 0)} | Fake ${row.aiReview?.fakeListingSignal ? 'Y' : 'N'} | Dup ${row.aiReview?.duplicatePhotoDetected ? 'Y' : 'N'} | Price ${row.aiReview?.suspiciousPricingAlert ? 'Y' : 'N'}</td>
              <td>Listed ${escapeHtml(inr(row.price))}<br>Median ${escapeHtml(inr(row.medianPrice))}<br>Ratio ${(numberFrom(row.ratio, 1)).toFixed(2)}x</td>
              <td>Decision: ${escapeHtml(row.decision || 'pending')}<br>Reviewed: ${escapeHtml(row.reviewedAt || '-')}</td>
              <td>
                <div class="actions">
                  <button type="button" data-action="manual" data-id="${escapeHtml(row.id)}">Manual Review</button>
                  <button type="button" data-action="safe" data-id="${escapeHtml(row.id)}">Mark Safe</button>
                  <button type="button" data-action="resolve" data-id="${escapeHtml(row.id)}">Resolve Reports</button>
                  <button type="button" data-action="snooze" data-id="${escapeHtml(row.id)}">Snooze 24h</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  const refresh = async () => {
    setStatus('Refreshing fraud queue...');
    const token = getAdminToken();
    const [liveListings, liveReports] = await Promise.all([
      (async () => {
        if (!token || typeof live.request !== 'function') return [];
        try {
          const response = await live.request('/admin/properties', { token });
          const items = Array.isArray(response?.items) ? response.items : [];
          return items.map((row) => normalizeListing(typeof live.normalizeApiListing === 'function' ? (live.normalizeApiListing(row) || row) : row)).filter(Boolean);
        } catch {
          return [];
        }
      })(),
      (async () => {
        if (!token || typeof live.request !== 'function') return [];
        try {
          const response = await live.request('/admin/reports', { token });
          const items = Array.isArray(response?.items) ? response.items : [];
          return items.map((row) => normalizeReport(row, 'live')).filter(Boolean);
        } catch {
          return [];
        }
      })(),
    ]);
    const localListings = (Array.isArray(readJson(LISTINGS_KEY, [])) ? readJson(LISTINGS_KEY, []) : []).map((row) => normalizeListing(row)).filter(Boolean);
    const localReports = (Array.isArray(readJson(LOCAL_REPORT_KEY, [])) ? readJson(LOCAL_REPORT_KEY, []) : []).map((row) => normalizeReport(row, 'local')).filter(Boolean);

    const listings = uniqueBy([...liveListings, ...localListings], (row) => row.id);
    const reports = uniqueBy([...liveReports, ...localReports], (row) => `${row.id}:${row.propertyId}`);
    model = buildModel(listings, reports);
    render();
    setStatus(`Fraud queue ready. ${numberFrom(model.summary.needsAction, 0)} listing(s) need action.`);
  };

  const getRow = (id) => (model.rows || []).find((row) => row.id === id) || null;

  const runAutoTriage = async () => {
    const candidates = (model.rows || []).filter((row) => row.score >= 70 && !row.snoozed && row.decision !== 'safe');
    if (!candidates.length) {
      setStatus('No high-risk rows for auto triage.');
      return;
    }
    candidates.slice(0, 15).forEach((row) => {
      mergeTrack(row.id, { decision: 'manual-review', reviewedAt: new Date().toISOString() });
    });
    setStatus(`Auto triage flagged ${Math.min(15, candidates.length)} listing(s).`);
    refresh().catch(() => null);
  };

  const exportCsv = () => {
    const headers = ['Listing ID', 'Title', 'Category', 'Locality', 'Price', 'Risk Score', 'Severity', 'Pending Reports', 'Decision'];
    const rows = (model.rows || []).map((row) => [row.id, row.title, row.category, row.locality, String(numberFrom(row.price, 0)), String(numberFrom(row.score, 0)), row.severity, String(numberFrom(row.reportPending, 0)), row.decision || '']);
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
    link.download = `admin-fraud-risk-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus('Fraud CSV exported.');
  };

  tableEl?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = text(target.getAttribute('data-action')).toLowerCase();
    const id = text(target.getAttribute('data-id'));
    if (!action || !id) return;
    const row = getRow(id);
    if (!row) return;

    if (action === 'manual') {
      mergeTrack(id, { decision: 'manual-review', reviewedAt: new Date().toISOString(), snoozedUntil: '' });
      const token = getAdminToken();
      if (token && typeof live.request === 'function') {
        live.request(`/properties/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          token,
          data: {
            verified: false,
            aiReview: {
              ...(row.aiReview || {}),
              fakeListingSignal: true,
              recommendation: 'Manual admin verification required',
            },
          },
        }).catch(() => null);
      }
      setStatus('Marked for manual review.');
      refresh().catch(() => null);
      return;
    }
    if (action === 'safe') {
      mergeTrack(id, { decision: 'safe', reviewedAt: new Date().toISOString(), snoozedUntil: '' });
      setStatus('Marked safe.');
      refresh().catch(() => null);
      return;
    }
    if (action === 'snooze') {
      mergeTrack(id, { snoozedUntil: new Date(Date.now() + 86400000).toISOString(), decision: row.decision || 'snoozed' });
      setStatus('Snoozed for 24h.');
      refresh().catch(() => null);
      return;
    }
    if (action === 'resolve') {
      const ids = Array.isArray(row.liveReportIds) ? row.liveReportIds : [];
      if (!ids.length) {
        setStatus('No live reports attached to this listing.');
        return;
      }
      const token = getAdminToken();
      if (!token || typeof live.request !== 'function') {
        setStatus('Admin login required for report resolve.', false);
        return;
      }
      const reason = 'Fraud-risk center action resolved reports after listing-level risk review.';
      Promise.all(ids.map((reportId) => live.request(`/admin/reports/${encodeURIComponent(reportId)}/resolve`, {
        method: 'POST',
        token,
        data: { moderationReason: reason, reason },
      }).catch(() => null)))
        .then(() => {
          setStatus('Resolve reports action completed.');
          refresh().catch(() => null);
        })
        .catch(() => setStatus('Resolve reports failed.', false));
    }
  });

  refreshBtn?.addEventListener('click', () => {
    refresh().catch((error) => setStatus(text(error?.message, 'Refresh failed.'), false));
  });
  autoBtn?.addEventListener('click', () => {
    runAutoTriage().catch((error) => setStatus(text(error?.message, 'Auto triage failed.'), false));
  });
  exportBtn?.addEventListener('click', exportCsv);
  unsnoozeBtn?.addEventListener('click', () => {
    clearSnooze();
    setStatus('All snooze cleared.');
    refresh().catch(() => null);
  });

  refresh().catch((error) => {
    setStatus(text(error?.message, 'Unable to load fraud center.'), false);
  });
})();
