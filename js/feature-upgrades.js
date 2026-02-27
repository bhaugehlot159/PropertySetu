const demoProperties = [
  {
    title: 'Lake View Villa',
    place: 'Rani Road, Udaipur',
    price: '₹2.8 Cr',
    type: 'Buy',
    aiTag: 'AI Match 96%',
  },
  {
    title: '2BHK Family Flat',
    place: 'Saheli Nagar, Udaipur',
    price: '₹22,000 / month',
    type: 'Rent',
    aiTag: 'AI Match 91%',
  },
  {
    title: 'Commercial Shop',
    place: 'Hathipole, Udaipur',
    price: '₹48 Lakh',
    type: 'Buy',
    aiTag: 'AI Demand High',
  },
  {
    title: 'Farmhouse Plot',
    place: 'Badi Lake Road, Udaipur',
    price: '₹72 Lakh',
    type: 'Plot',
    aiTag: 'AI Growth Zone',
  },
  {
    title: 'Student Studio',
    place: 'University Road, Udaipur',
    price: '₹12,500 / month',
    type: 'Rent',
    aiTag: 'AI Verified Photos',
  },
  {
    title: 'Premium Penthouse',
    place: 'Fatehpura, Udaipur',
    price: '₹1.65 Cr',
    type: 'Buy',
    aiTag: 'AI Negotiation Ready',
  },
];

const defaultNotifications = [
  'Welcome to PropertySetu live notifications.',
  'AI fraud shield is monitoring suspicious listing patterns.',
  'New verified property added in Hiran Magri Sector 4.',
];

function renderDemoProperties() {
  const grid = document.getElementById('demoPropertyGrid');
  if (!grid) return;

  grid.innerHTML = demoProperties
    .map(
      (property) => `
      <article class="card">
        <h3>${property.title}</h3>
        <p><strong>${property.type}</strong> • ${property.place}</p>
        <p>${property.price}</p>
        <p>${property.aiTag}</p>
      </article>
    `,
    )
    .join('');
}

function loadNotifications() {
  const feed = document.getElementById('liveNotifications');
  const status = document.getElementById('notificationStatus');
  if (!feed) return;

  const dynamic = JSON.parse(localStorage.getItem('propertySetu:notifications') || '[]');
  const merged = [
    ...dynamic.map((item) => item.message),
    ...defaultNotifications,
  ].slice(0, 8);

  feed.innerHTML = merged.map((msg) => `<li>${msg}</li>`).join('');
  if (status) status.textContent = `Notification service: active (${merged.length} updates)`;
}

function broadcastBrowserNotification() {
  if (!('Notification' in window)) return;

  const shouldShow = !localStorage.getItem('propertySetu:notified');
  if (!shouldShow) return;

  Notification.requestPermission().then((permission) => {
    if (permission === 'granted') {
      new Notification('PropertySetu', {
        body: 'Live listing, AI safety and visit notifications are now active.',
      });
      localStorage.setItem('propertySetu:notified', 'yes');
    }
  });
}

function setupGlobalAutocomplete() {
  const locations = window.PROPERTYSETU_LOCATIONS || [];
  const searchableInputs = [
    document.getElementById('locationSearch'),
    document.getElementById('searchInput'),
  ].filter(Boolean);

  searchableInputs.forEach((input) => {
    const listId = `${input.id || 'search'}-auto-list`;
    let dataList = document.getElementById(listId);

    if (!dataList) {
      dataList = document.createElement('datalist');
      dataList.id = listId;
      input.insertAdjacentElement('afterend', dataList);
    }

    input.setAttribute('list', listId);
    dataList.innerHTML = locations.map((loc) => `<option value="${loc}"></option>`).join('');
  });
}

window.addEventListener('storage', (event) => {
  if (event.key === 'propertySetu:notifications') {
    loadNotifications();
  }
});

renderDemoProperties();
loadNotifications();
setupGlobalAutocomplete();
broadcastBrowserNotification();
