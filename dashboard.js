const userPropertiesDiv = document.getElementById('userProperties');
const LISTINGS_KEY = 'propertySetu:listings';

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

const renderProperties = () => {
  if (!userPropertiesDiv) return;
  const listings = readJson(LISTINGS_KEY, []);

  userPropertiesDiv.innerHTML = '';
  if (!listings.length) {
    userPropertiesDiv.innerHTML = '<p>No property yet. Add one from Add Property page.</p>';
    return;
  }

  listings.forEach((prop) => {
    const card = document.createElement('div');
    card.className = 'property-card';
    card.innerHTML = `
      <h3>${prop.title || 'Untitled'} ${prop.status === 'Approved' ? '<span class="badge">Verified</span>' : ''}</h3>
      <p><b>Category:</b> ${prop.category || '-'}</p>
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
    const listings = readJson(LISTINGS_KEY, []).filter((item) => item.id !== id);
    writeJson(LISTINGS_KEY, listings);
    renderProperties();
  }
});

renderProperties();
