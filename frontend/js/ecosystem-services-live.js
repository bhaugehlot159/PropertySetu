(function () {
  const live = window.PropertySetuLive || {};
  const grid = document.querySelector('.grid');
  if (!grid) return;
  if (document.getElementById('ecosystemLiveQueueCard')) return;

  const text = (value, fallback = '') => {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  };

  const formatDate = (value) => {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const toItems = (payload) => (
    payload && Array.isArray(payload.items) ? payload.items : []
  );

  const getToken = () => {
    if (typeof live.getAnyToken === 'function') return text(live.getAnyToken());
    if (typeof live.getToken === 'function') {
      return text(live.getToken('customer') || live.getToken('seller') || live.getToken('admin'));
    }
    return '';
  };

  const readJson = live.readJson || ((key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  });

  const card = document.createElement('article');
  card.className = 'cardx';
  card.id = 'ecosystemLiveQueueCard';
  card.innerHTML = `
    <h2>My Live Service Queues</h2>
    <p id="ecosystemQueueStatus" class="muted">Loading your live requests...</p>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;">
      <button id="refreshServiceQueuesBtn" class="outline-btn dark-outline" type="button">Refresh Queues</button>
    </div>
    <div id="ecosystemQueueSummary" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-top:10px;"></div>
    <div style="margin-top:10px;">
      <h3 style="margin:0 0 6px;color:#124b73;font-size:0.98rem;">Documentation Requests</h3>
      <ul id="queueDocList" class="feed"><li>Loading...</li></ul>
    </div>
    <div style="margin-top:10px;">
      <h3 style="margin:0 0 6px;color:#124b73;font-size:0.98rem;">Loan Assistance Leads</h3>
      <ul id="queueLoanList" class="feed"><li>Loading...</li></ul>
    </div>
    <div style="margin-top:10px;">
      <h3 style="margin:0 0 6px;color:#124b73;font-size:0.98rem;">Service Bookings</h3>
      <ul id="queueBookingList" class="feed"><li>Loading...</li></ul>
    </div>
    <div style="margin-top:10px;">
      <h3 style="margin:0 0 6px;color:#124b73;font-size:0.98rem;">Franchise Requests</h3>
      <ul id="queueFranchiseList" class="feed"><li>Loading...</li></ul>
    </div>
    <div style="margin-top:10px;">
      <h3 style="margin:0 0 6px;color:#124b73;font-size:0.98rem;">Rent Agreement Drafts</h3>
      <ul id="queueRentList" class="feed"><li>Loading...</li></ul>
    </div>
  `;
  grid.appendChild(card);

  const queueStatus = document.getElementById('ecosystemQueueStatus');
  const queueSummary = document.getElementById('ecosystemQueueSummary');
  const refreshBtn = document.getElementById('refreshServiceQueuesBtn');

  const listEls = {
    docs: document.getElementById('queueDocList'),
    loan: document.getElementById('queueLoanList'),
    booking: document.getElementById('queueBookingList'),
    franchise: document.getElementById('queueFranchiseList'),
    rent: document.getElementById('queueRentList'),
  };

  function setStatus(message, ok = true) {
    if (!queueStatus) return;
    queueStatus.textContent = message;
    queueStatus.style.color = ok ? '#1f6d3d' : '#8d1e1e';
  }

  function renderSummary(metrics = {}) {
    if (!queueSummary) return;
    const cards = [
      { label: 'Docs', value: metrics.docs || 0 },
      { label: 'Loan Leads', value: metrics.loan || 0 },
      { label: 'Bookings', value: metrics.booking || 0 },
      { label: 'Franchise', value: metrics.franchise || 0 },
      { label: 'Rent Drafts', value: metrics.rent || 0 },
    ];
    queueSummary.innerHTML = cards.map((item) => (
      `<div style="border:1px solid #d7e5f7;border-radius:10px;padding:8px;background:#f8fbff;">
        <small style="display:block;color:#58718f;">${item.label}</small>
        <b style="color:#11466e;font-size:1.08rem;">${Number(item.value).toLocaleString('en-IN')}</b>
      </div>`
    )).join('');
  }

  function renderList(target, rows, mapper) {
    if (!target) return;
    if (!Array.isArray(rows) || !rows.length) {
      target.innerHTML = '<li>No records found.</li>';
      return;
    }
    target.innerHTML = rows.slice(0, 5).map(mapper).join('');
  }

  function mapDoc(item) {
    return `<li><b>${text(item.serviceName || item.serviceId, 'Service')}</b> - ${text(item.status, 'Requested')} <small>(${formatDate(item.updatedAt || item.createdAt)})</small></li>`;
  }

  function mapLoan(item) {
    const amount = Number(item.requestedAmount || 0).toLocaleString('en-IN');
    return `<li><b>${text(item.bankName || item.bankId, 'Bank')}</b> - ₹${amount} - ${text(item.status, 'lead-created')} <small>(${formatDate(item.updatedAt || item.createdAt)})</small></li>`;
  }

  function mapBooking(item) {
    return `<li><b>${text(item.serviceName || item.serviceId, 'Booking')}</b> - ${text(item.status, 'Requested')} <small>(${formatDate(item.updatedAt || item.createdAt)})</small></li>`;
  }

  function mapFranchise(item) {
    const city = text(item.city, 'City');
    return `<li><b>${city}</b> - ${text(item.status, 'screening')} <small>(${formatDate(item.updatedAt || item.createdAt)})</small></li>`;
  }

  function mapRent(item) {
    return `<li><b>${text(item.ownerName, 'Owner')} -> ${text(item.tenantName, 'Tenant')}</b> - ${text(item.startDate, 'Start Date N/A')} <small>(${formatDate(item.createdAt)})</small></li>`;
  }

  async function loadQueues() {
    const token = getToken();
    if (!token || typeof live.request !== 'function') {
      setStatus('Login required to load your live queue status.', false);
      renderSummary({ docs: 0, loan: 0, booking: 0, franchise: 0, rent: 0 });
      Object.values(listEls).forEach((target) => {
        if (target) target.innerHTML = '<li>Please login to view your live requests.</li>';
      });
      return;
    }

    setStatus('Refreshing live queues...');

    const [docsRes, loanRes, bookingRes, franchiseRes, rentRes] = await Promise.allSettled([
      live.request('/documentation/requests', { token }),
      live.request('/loan/assistance', { token }),
      live.request('/ecosystem/bookings', { token }),
      live.request('/franchise/requests', { token }),
      live.request('/rent-agreement/drafts', { token }),
    ]);

    const docs = docsRes.status === 'fulfilled' ? toItems(docsRes.value) : [];
    const loan = loanRes.status === 'fulfilled' ? toItems(loanRes.value) : [];
    const booking = bookingRes.status === 'fulfilled' ? toItems(bookingRes.value) : [];
    const franchise = franchiseRes.status === 'fulfilled' ? toItems(franchiseRes.value) : [];
    const rent = rentRes.status === 'fulfilled' ? toItems(rentRes.value) : [];

    renderSummary({
      docs: docs.length,
      loan: loan.length,
      booking: booking.length,
      franchise: franchise.length,
      rent: rent.length,
    });

    renderList(listEls.docs, docs, mapDoc);
    renderList(listEls.loan, loan, mapLoan);
    renderList(listEls.booking, booking, mapBooking);
    renderList(listEls.franchise, franchise, mapFranchise);
    renderList(listEls.rent, rent, mapRent);

    const failedCount = [docsRes, loanRes, bookingRes, franchiseRes, rentRes]
      .filter((entry) => entry.status === 'rejected')
      .length;

    const lastSeen = readJson('propertySetu:ecosystemQueueLastSeen', null);
    const now = new Date().toISOString();
    localStorage.setItem('propertySetu:ecosystemQueueLastSeen', JSON.stringify({
      at: now,
      docs: docs.length,
      loan: loan.length,
      booking: booking.length,
      franchise: franchise.length,
      rent: rent.length,
    }));

    if (failedCount > 0) {
      setStatus(`Queue refreshed with ${failedCount} module warning(s).`, false);
      return;
    }

    if (lastSeen && typeof lastSeen === 'object') {
      const previous = Number(lastSeen.docs || 0) + Number(lastSeen.loan || 0) + Number(lastSeen.booking || 0) + Number(lastSeen.franchise || 0) + Number(lastSeen.rent || 0);
      const current = docs.length + loan.length + booking.length + franchise.length + rent.length;
      if (current > previous) {
        setStatus(`Queue refreshed. ${current - previous} new request(s) detected.`);
        return;
      }
    }

    setStatus('Queue refreshed successfully.');
  }

  refreshBtn?.addEventListener('click', () => {
    loadQueues().catch((error) => setStatus(`Queue refresh failed: ${error.message || 'Unknown error'}`, false));
  });

  loadQueues().catch((error) => setStatus(`Queue load failed: ${error.message || 'Unknown error'}`, false));
})();
