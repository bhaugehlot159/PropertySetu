(() => {
  const live = window.PropertySetuLive || {};
  const auctionDiv = document.getElementById('auctionList');
  if (!auctionDiv) return;

  const readJson = live.readJson || ((key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  });
  const writeJson = live.writeJson || ((key, value) => localStorage.setItem(key, JSON.stringify(value)));
  const formatPrice = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
  const getToken = () => (live.getAnyToken ? live.getAnyToken() : '');

  const LOCAL_BID_KEY = 'propertySetu:sealedBids';

  let listings = [];

  const buildLocalAuctions = () => {
    const fromLocal = readJson('propertySetu:listings', [])
      .filter((item) => String(item?.city || 'Udaipur').toLowerCase().includes('udaipur'))
      .slice(0, 6)
      .map((item, idx) => ({
        id: item.id || `local-auction-${idx + 1}`,
        title: item.title || 'Udaipur Property',
        location: item.location || item.locality || 'Udaipur',
        price: Number(item.price || 0),
      }));

    if (fromLocal.length) return fromLocal;
    return [
      { id: 'demo-1', title: 'Luxury Villa Hiran Magri', location: 'Hiran Magri', price: 32000000 },
      { id: 'demo-2', title: 'Farmhouse Ambamata', location: 'Ambamata', price: 14500000 },
    ];
  };

  const fetchLiveAuctions = async () => {
    if (!live.request) return buildLocalAuctions();
    try {
      const response = await live.request('/properties?city=Udaipur');
      const items = (response?.items || []).slice(0, 20).map((item) => ({
        id: item.id,
        title: item.title || 'Udaipur Property',
        location: item.location || 'Udaipur',
        price: Number(item.price || 0),
      }));
      return items.length ? items : buildLocalAuctions();
    } catch {
      return buildLocalAuctions();
    }
  };

  const getLocalBids = () => readJson(LOCAL_BID_KEY, []);

  const countBids = (propertyId) => getLocalBids().filter((item) => item.propertyId === propertyId).length;

  const placeBid = async (propertyId) => {
    const input = document.getElementById(`bidInput-${propertyId}`);
    const amount = Number(input?.value || 0);
    if (!amount || amount <= 0) {
      window.alert('Valid bid amount enter karein.');
      return;
    }

    const token = getToken();
    if (token && live.request) {
      try {
        await live.request('/sealed-bids', {
          method: 'POST',
          token,
          data: { propertyId, amount },
        });
      } catch (error) {
        if (!live.shouldFallbackToLocal || !live.shouldFallbackToLocal(error)) {
          window.alert(error.message || 'Bid submit failed.');
          return;
        }
      }
    }

    const localBids = getLocalBids();
    localBids.push({
      propertyId,
      amount,
      bidder: (live.getAnySession ? live.getAnySession()?.name : '') || 'LocalUser',
      publicVisible: false,
      createdAt: new Date().toISOString(),
    });
    writeJson(LOCAL_BID_KEY, localBids);
    if (input) input.value = '';
    renderAuctions();
    window.alert('Sealed bid placed successfully.');
  };

  const getSummaryRow = (propertyId) => {
    const localCount = countBids(propertyId);
    return `${localCount} sealed bid(s) placed`;
  };

  const renderAuctions = () => {
    auctionDiv.innerHTML = listings.map((item) => `
      <div class="auction-card">
        <h3>${item.title}</h3>
        <p><b>Location:</b> ${item.location}, Udaipur</p>
        <p><b>Price:</b> ${formatPrice(item.price)}</p>
        <p><b>Status:</b> Bids hidden (admin-only reveal)</p>
        <input type="number" placeholder="Enter sealed bid amount" id="bidInput-${item.id}" />
        <button type="button" data-bid-property="${item.id}">Place Bid 🔒</button>
        <div id="bids-${item.id}"><p>${getSummaryRow(item.id)}</p></div>
      </div>
    `).join('');
  };

  auctionDiv.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const propertyId = target.getAttribute('data-bid-property');
    if (!propertyId) return;
    placeBid(propertyId);
  });

  fetchLiveAuctions().then((items) => {
    listings = items;
    renderAuctions();
  });
})();
