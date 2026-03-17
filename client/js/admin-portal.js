(() => {
  const bidKey = 'propertySetu:sealedBids';

  const verificationQueue = document.getElementById('verificationQueue');
  const reportQueue = document.getElementById('reportQueue');
  const bidQueue = document.getElementById('bidQueue');
  if (!verificationQueue || !reportQueue || !bidQueue) return;

  const parseJson = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const saveJson = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  const verification = [
    { id: 'P-109', label: 'Villa - Hiran Magri', risk: 'Low' },
    { id: 'P-145', label: 'Farm House - Badi', risk: 'Medium' },
    { id: 'P-163', label: 'Commercial - Sukher', risk: 'High' },
  ];

  const reports = [
    { id: 'R-28', label: 'Suspicious pricing complaint on listing P-145' },
    { id: 'R-31', label: 'Possible duplicate media on listing P-163' },
    { id: 'R-36', label: 'Ownership proof re-check request' },
  ];

  const ensureSeedBids = () => {
    const bids = parseJson(bidKey, []);
    if (bids.length) return;
    saveJson(bidKey, [
      {
        propertyId: 'P-145',
        amount: 4500000,
        bidder: 'buyer-22',
        publicVisible: false,
        modifiedByAdmin: null,
        createdAt: new Date().toISOString(),
      },
    ]);
  };

  const renderQueue = () => {
    verificationQueue.innerHTML = verification
      .map((item) => `<li><span>${item.id} • ${item.label} (${item.risk})</span><button type="button">Approve</button></li>`)
      .join('');

    reportQueue.innerHTML = reports
      .map((item) => `<li><span>${item.id} • ${item.label}</span><button type="button">Resolve</button></li>`)
      .join('');
  };

  const renderBids = () => {
    const bids = parseJson(bidKey, []);
    bidQueue.innerHTML = bids.length
      ? bids
        .map((item, idx) => `
          <li>
            <span>${item.propertyId} • ₹${Number(item.amount).toLocaleString('en-IN')} (${item.bidder})</span>
            <span style="display:flex;gap:6px;align-items:center;">
              <input data-bid-input="${idx}" type="number" min="0" placeholder="Modify" />
              <button type="button" data-bid-action="modify" data-bid-index="${idx}">Modify</button>
              <button type="button" data-bid-action="reveal" data-bid-index="${idx}">${item.publicVisible ? 'Revealed' : 'Reveal'}</button>
            </span>
          </li>`)
        .join('')
      : '<li><span>No bids yet from customers.</span></li>';
  };

  bidQueue.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const action = target.getAttribute('data-bid-action');
    const idx = Number(target.getAttribute('data-bid-index'));
    if (!action || Number.isNaN(idx)) return;

    const bids = parseJson(bidKey, []);
    if (!bids[idx]) return;

    if (action === 'modify') {
      const input = bidQueue.querySelector(`[data-bid-input="${idx}"]`);
      const nextValue = Number(input?.value || 0);
      if (!nextValue || nextValue <= 0) return;
      bids[idx].modifiedByAdmin = nextValue;
      bids[idx].amount = nextValue;
      saveJson(bidKey, bids);
      renderBids();
      return;
    }

    if (action === 'reveal') {
      bids[idx].publicVisible = true;
      saveJson(bidKey, bids);
      window.alert(`Bid for ${bids[idx].propertyId} revealed as ₹${Number(bids[idx].amount).toLocaleString('en-IN')}`);
      renderBids();
    }
  });

  ensureSeedBids();
  renderQueue();
  renderBids();
})();
