const canvas = document.getElementById('heroCanvas');

if (canvas) {
  const ctx = canvas.getContext('2d');
  const stars = [];

  const setCanvasSize = () => {
    canvas.width = window.innerWidth;
    canvas.height = canvas.parentElement ? canvas.parentElement.offsetHeight : window.innerHeight;
  };

  const buildStars = () => {
    stars.length = 0;
    for (let index = 0; index < 140; index += 1) {
      stars.push({
        x: (Math.random() - 0.5) * canvas.width,
        y: (Math.random() - 0.5) * canvas.height,
        z: Math.random() * canvas.width,
      });
    }
  };

  const animate = () => {
    ctx.fillStyle = '#0b2f6b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    stars.forEach((star) => {
      star.z -= 2;
      if (star.z <= 1) star.z = canvas.width;

      const scale = 128 / star.z;
      const px = star.x * scale + canvas.width / 2;
      const py = star.y * scale + canvas.height / 2;

      if (px >= 0 && px <= canvas.width && py >= 0 && py <= canvas.height) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(px, py, 2, 2);
      }
    });

    requestAnimationFrame(animate);
  };

  setCanvasSize();
  buildStars();
  animate();

  window.addEventListener('resize', () => {
    setCanvasSize();
    buildStars();
  });
}

const locations = window.PROPERTYSETU_LOCATIONS || [];
const input = document.getElementById('locationSearch');
const citySelect = document.getElementById('citySelect');
const slugPreview = document.getElementById('slugPreview');
const suggestionList = document.getElementById('suggestionList');
const searchButton = document.getElementById('searchButton');
const tabButtons = document.querySelectorAll('.tab-btn');
const authBtn = document.getElementById('authBtn');
const locationSuggestions = document.getElementById('locationSuggestions');

if (locationSuggestions) {
  locationSuggestions.innerHTML = locations.map((location) => `<option value="${location}"></option>`).join('');
}

if (citySelect && slugPreview) {
  citySelect.addEventListener('change', () => {
    slugPreview.textContent = `SEO path preview: propertysetu.in/${citySelect.value}`;
  });
}

if (input) {
  input.addEventListener('input', () => {
    if (!suggestionList) return;

    const value = input.value.toLowerCase().trim();
    if (value.length < 2) {
      suggestionList.innerHTML = '';
      return;
    }

    const filtered = locations.filter((location) => location.toLowerCase().includes(value)).slice(0, 8);
    suggestionList.innerHTML = filtered.map((location) => `<li>${location}</li>`).join('');

    suggestionList.querySelectorAll('li').forEach((item) => {
      item.addEventListener('click', () => {
        input.value = item.textContent || '';
        suggestionList.innerHTML = '';
      });
    });
  });
}

tabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    tabButtons.forEach((tab) => tab.classList.remove('active'));
    button.classList.add('active');
  });
});

if (searchButton) {
  searchButton.addEventListener('click', () => {
    const selectedMode = document.querySelector('.tab-btn.active')?.dataset.mode || 'buy';
    const city = citySelect?.value || 'udaipur';
    const location = input?.value.trim() || 'all-areas';
    const normalizedLocation = location.toLowerCase().replace(/\s+/g, '-');

    window.location.hash = `search/${city}/${selectedMode}/${normalizedLocation}`;
  });
}

if (authBtn) {
  const setState = () => {
    const token = localStorage.getItem('propertySetu:session');
    authBtn.textContent = token ? 'Logout' : 'Login';
  };

  authBtn.addEventListener('click', () => {
    const token = localStorage.getItem('propertySetu:session');
    if (token) {
      localStorage.removeItem('propertySetu:session');
      localStorage.removeItem('propertySetu:userRole');
      setState();
      return;
    }

    const role = prompt('Login role (customer/seller/admin):', 'customer');
    if (!role) return;
    localStorage.setItem('propertySetu:session', `${Date.now()}`);
    localStorage.setItem('propertySetu:userRole', role.toLowerCase());
    setState();
  });

  setState();
}
