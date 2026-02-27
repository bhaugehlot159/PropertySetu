const verification = [
  { id: 'P-109', label: 'Villa - Hiran Magri' },
  { id: 'P-145', label: 'Farm House - Badi' },
];

const reports = [
  { id: 'R-28', label: 'Suspicious price on listing P-145' },
  { id: 'R-31', label: 'Duplicate photo complaint P-109' },
];

const bids = [
  { property: 'P-145', amount: '₹45,00,000', bidder: 'Buyer-22' },
  { property: 'P-109', amount: '₹1,10,00,000', bidder: 'Buyer-11' },
];

const row = (left, right = '<button>Resolve</button>') => `<li><span>${left}</span>${right}</li>`;

document.getElementById('verificationQueue').innerHTML = verification
  .map((item) => row(`${item.id} · ${item.label}`, '<button>Approve</button>'))
  .join('');

document.getElementById('reportQueue').innerHTML = reports
  .map((item) => row(`${item.id} · ${item.label}`))
  .join('');

document.getElementById('bidQueue').innerHTML = bids
  .map((item) => row(`${item.property} · Hidden Bid 🔒`, `<button title="${item.bidder} ${item.amount}">Reveal</button>`))
  .join('');
