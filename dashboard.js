const userPropertiesDiv = document.getElementById('userProperties');
const LISTINGS_KEY = 'propertySetu:listings';
const BASE_BACKUP_KEYS = [
  'propertySetu:listings',
  'propertySetu:addPropertyDraft',
  'propertySetu:notifications',
  'propertySetu:notified',
  'propertysetu-marketplace-state',
  'propertysetu-customer-session',
  'propertysetu-admin-session',
  'properties',
  'favorites',
];
const backupStatus = document.getElementById('backupStatus');

const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const isUdaipurListing = (item) => {
  const city = String(item?.city || 'Udaipur').trim().toLowerCase();
  return city.includes('udaipur');
};

const safeParse = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const getBackupKeys = () => {
  const keys = new Set(BASE_BACKUP_KEYS);

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key) continue;
    const normalized = key.toLowerCase();
    if (normalized.includes('propertysetu') || key === 'properties' || key === 'favorites') {
      keys.add(key);
    }
  }

  return [...keys];
};

const downloadLocalData = () => {
  const storageData = {};
  const keys = getBackupKeys();

  keys.forEach((key) => {
    const value = localStorage.getItem(key);
    if (value !== null) {
      storageData[key] = safeParse(value);
    }
  });

  if (!Object.keys(storageData).length) {
    if (backupStatus) backupStatus.textContent = 'Backup skipped: local data nahi mila.';
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `propertysetu-local-data-${timestamp}.json`;
  const payload = {
    app: 'PropertySetu',
    exportedAt: new Date().toISOString(),
    storage: storageData,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);

  if (backupStatus) backupStatus.textContent = `Backup saved: ${fileName}`;
};

const renderProperties = () => {
  if (!userPropertiesDiv) return;
  const allListings = readJson(LISTINGS_KEY, []);
  const listings = allListings.filter(isUdaipurListing);

  userPropertiesDiv.innerHTML = '';
  if (!listings.length) {
    userPropertiesDiv.innerHTML = '<p>Udaipur listing abhi nahi hai. Add Property page se new listing create karein.</p>';
    return;
  }

  listings.forEach((prop) => {
    const card = document.createElement('div');
    card.className = 'property-card';
    card.innerHTML = `
      <h3>${prop.title || 'Untitled'} ${prop.status === 'Approved' ? '<span class="badge">Verified</span>' : ''}</h3>
      <p><b>Category:</b> ${prop.category || '-'}</p>
      <p><b>City:</b> Udaipur</p>
      <p><b>Location:</b> ${prop.location || '-'}</p>
      <p><b>Price:</b> ₹${Number(prop.price || 0).toLocaleString('en-IN')}</p>
      <p><b>Status:</b> ${prop.status || 'Pending Approval'}</p>
      <button data-id="${prop.id}" class="edit-btn">Edit ✏️</button>
      <button data-id="${prop.id}" class="delete-btn">Delete 🗑️</button>
    `;
    userPropertiesDiv.appendChild(card);
  });
};

userPropertiesDiv?.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (target.classList.contains('edit-btn')) {
    alert('Edit flow can be connected to Add Property form in next step.');
    return;
  }

  if (target.classList.contains('delete-btn')) {
    const id = target.dataset.id;
    if (!id) return;
    const allListings = readJson(LISTINGS_KEY, []);
    const listings = allListings.filter((item) => item.id !== id);
    writeJson(LISTINGS_KEY, listings);
    renderProperties();
  }
});

document.getElementById('downloadLocalDataBtn')?.addEventListener('click', downloadLocalData);
window.downloadLocalData = downloadLocalData;
renderProperties();
