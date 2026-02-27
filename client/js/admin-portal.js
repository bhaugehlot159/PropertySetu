const bidKey = 'propertySetu:sealedBids';

const verification = [
  { id: 'P-109', label: 'Villa - Hiran Magri' },
  { id: 'P-145', label: 'Farm House - Badi' },
];

const reports = [
  { id: 'R-28', label: 'Suspicious price on listing P-145' },
  { id: 'R-31', label: 'Duplicate photo complaint P-109' },
];

const row = (left, right = '<button type="button">Resolve</button>') => `<li><span>${left}</span>${right}</li>`;
const row = (left, right = '<button>Resolve</button>') => `<li><span>${left}</span>${right}</li>`;

document.getElementById('verificationQueue').innerHTML = verification
  .map((item) => row(`${item.id} · ${item.label}`, '<button type="button">Approve</button>'))
  .join('');

document.getElementById('reportQueue').innerHTML = reports
  .map((item) => row(`${item.id} · ${item.label}`))
  .join('');

const renderBids = () => {
  const bids = JSON.parse(localStorage.getItem(bidKey) || '[]');
  document.getElementById('bidQueue').innerHTML = bids.length
    ? bids
      .map((item, idx) => `
        <li>
          <span>${item.propertyId} · ₹${item.amount} (${item.bidder})</span>
          <span>
            <input id="m-${idx}" type="number" placeholder="Modify" />
            <button type="button" onclick="modifyBid(${idx})">Modify</button>
            <button type="button" onclick="revealBid(${idx})">Reveal</button>
          </span>
        </li>`)
if (JSON.parse(localStorage.getItem(bidKey) || '[]').length === 0) {
  localStorage.setItem(
    bidKey,
    JSON.stringify([{ propertyId: 'P-145', amount: 4500000, bidder: 'buyer-22', publicVisible: false, modifiedByAdmin: null }]),
  );
}
const ensureSeedBids = () => {
  const current = JSON.parse(localStorage.getItem(bidKey) || '[]');
  if (current.length) return;

  localStorage.setItem(
    bidKey,
    JSON.stringify([
      {
        propertyId: 'P-145',
        amount: 4500000,
        bidder: 'buyer-22',
        publicVisible: false,
        modifiedByAdmin: null,
        createdAt: new Date().toISOString(),
      },
    ]),
  );
};

const renderBids = () => {
  const current = JSON.parse(localStorage.getItem(bidKey) || '[]');
  document.getElementById('bidQueue').innerHTML = current.length
    ? current
      .map(
        (item, idx) => `
      <li>
        <span>${item.propertyId} · ₹${item.amount} (${item.bidder})</span>
        <span>
          <input id="m-${idx}" type="number" placeholder="Modify" />
          <button onclick="modifyBid(${idx})">Modify</button>
          <button onclick="revealBid(${idx})">Reveal</button>
        </span>
      </li>`,
      )
      .join('')
    : '<li><span>No bids yet from customers.</span></li>';
};

window.modifyBid = (idx) => {
  const bids = JSON.parse(localStorage.getItem(bidKey) || '[]');
  const nextValue = Number(document.getElementById(`m-${idx}`).value);
  if (!nextValue) return;
  bids[idx].modifiedByAdmin = nextValue;
  bids[idx].amount = nextValue;
  localStorage.setItem(bidKey, JSON.stringify(bids));
  const all = JSON.parse(localStorage.getItem(bidKey) || '[]');
  const nextVal = Number(document.getElementById(`m-${idx}`).value);
  if (!nextVal) return;

  all[idx].modifiedByAdmin = nextVal;
  all[idx].amount = nextVal;
  localStorage.setItem(bidKey, JSON.stringify(all));
  renderBids();
};

window.revealBid = (idx) => {
  const bids = JSON.parse(localStorage.getItem(bidKey) || '[]');
  bids[idx].publicVisible = true;
  localStorage.setItem(bidKey, JSON.stringify(bids));
  alert(`Bid for ${bids[idx].propertyId} revealed as ₹${bids[idx].amount}`);
  renderBids();
};

if (JSON.parse(localStorage.getItem(bidKey) || '[]').length === 0) {
  localStorage.setItem(
    bidKey,
    JSON.stringify([
      { propertyId: 'P-145', amount: 4500000, bidder: 'buyer-22', publicVisible: false, modifiedByAdmin: null },
    ]),
  );
}

ensureSeedBids();
renderBids();
