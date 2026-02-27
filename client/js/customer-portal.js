const key = 'propertySetu:customerPortal';
const bidKey = 'propertySetu:sealedBids';

const defaultState = {
  wishlist: 0,
  visits: 0,
  compare: 0,
  bids: 0,
  verifiedSearches: 0,
  logs: [],
};

const load = () => {
  try {
    return { ...defaultState, ...(JSON.parse(localStorage.getItem(key)) || {}) };
  } catch {
    return { ...defaultState };
  }
};

const save = (state) => localStorage.setItem(key, JSON.stringify(state));

const render = (state) => {
  document.getElementById('wishCount').textContent = state.wishlist;
  document.getElementById('visitCount').textContent = state.visits;
  document.getElementById('compareCount').textContent = state.compare;
  document.getElementById('bidCount').textContent = state.bids;
  document.getElementById('activityLog').innerHTML = state.logs.map((item) => `<li>${item}</li>`).join('') || '<li>No activity yet.</li>';
};

let state = load();
render(state);

document.getElementById('saveDemo').addEventListener('click', () => {
  state.wishlist += 1;
  state.logs.unshift('Added "Luxury Villa Hiran Magri" to wishlist.');
  save(state);
  render(state);
});

document.getElementById('bookVisit').addEventListener('click', () => {
  state.visits += 1;
  state.logs.unshift('Visit booked for Sunday 11:00 AM.');
  save(state);
  render(state);
});

document.getElementById('verifiedSearch').addEventListener('click', () => {
  state.verifiedSearches += 1;
  state.logs.unshift('Verified-only search executed in Udaipur.');
  save(state);
  render(state);
});

document.getElementById('placeBid').addEventListener('click', () => {
  const propertyId = document.getElementById('bidProperty').value.trim();
  const amount = Number(document.getElementById('bidAmount').value);

  if (!propertyId || !amount) {
    alert('Property ID and amount required');
    return;
  }

  const allBids = JSON.parse(localStorage.getItem(bidKey) || '[]');
  allBids.push({ propertyId, amount, bidder: 'customer-demo', publicVisible: false, modifiedByAdmin: null, createdAt: new Date().toISOString() });
  localStorage.setItem(bidKey, JSON.stringify(allBids));

  state.bids += 1;
  state.logs.unshift(`Sealed bid placed for ${propertyId}. (Amount hidden from public)`);
  save(state);
  render(state);
});

document.getElementById('clearPortal').addEventListener('click', () => {
  state = { ...defaultState };
  save(state);
  render(state);
});
