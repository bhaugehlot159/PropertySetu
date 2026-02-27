const key = 'propertySetu:customerPortal';
const defaultState = { wishlist: 0, visits: 0, compare: 0, verifiedSearches: 0, logs: [] };

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
  document.getElementById('verifiedCount').textContent = state.verifiedSearches;
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

document.getElementById('clearPortal').addEventListener('click', () => {
  state = { ...defaultState };
  save(state);
  render(state);
});
