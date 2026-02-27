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
    for (let i = 0; i < 140; i += 1) {
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
codex/develop-complete-propertysetu-website-structure-nbroka
}

const locations = window.PROPERTYSETU_LOCATIONS || [];
const input = document.getElementById('locationSearch');
const citySelect = document.getElementById('citySelect');
const slugPreview = document.getElementById('slugPreview');
const suggestionList = document.getElementById('suggestionList');
const locationSuggestions = document.getElementById('locationSuggestions');

if (locationSuggestions) {
  locationSuggestions.innerHTML = locations
    .map((loc) => `<option value="${loc}"></option>`)
    .join('');
}

if (citySelect && slugPreview) {
  citySelect.addEventListener('change', () => {
    slugPreview.textContent = `SEO path preview: propertysetu.in/${citySelect.value}`;
  });
}

if (input) {
  input.addEventListener('input', () => {
    const value = input.value.toLowerCase().trim();

    if (!suggestionList) return;
    if (value.length < 2) {
      suggestionList.innerHTML = '';
      return;
    }

    const filtered = locations.filter((loc) => loc.toLowerCase().includes(value)).slice(0, 6);
    suggestionList.innerHTML = filtered.map((loc) => `<li>${loc}</li>`).join('');

    suggestionList.querySelectorAll('li').forEach((li) => {
      li.addEventListener('click', () => {
        input.value = li.textContent;
        suggestionList.innerHTML = '';
      });
    });
  });
}

const tabButtons = document.querySelectorAll('.tab-btn');
tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

const searchButton = document.getElementById('searchButton');
if (searchButton) {
  searchButton.addEventListener('click', () => {
    const selectedMode = document.querySelector('.tab-btn.active')?.dataset.mode || 'buy';
    const city = citySelect?.value || 'udaipur';
    const location = input?.value.trim() || 'all-areas';
    const normalized = location.toLowerCase().replace(/\s+/g, '-');
    window.location.hash = `search/${city}/${selectedMode}/${normalized}`;

    const portalHint = document.getElementById('portalHint');
    if (portalHint) {
      portalHint.textContent = `Search ready for ${city.toUpperCase()} / ${selectedMode.toUpperCase()} / ${location}`;
    }
  });
}
=======
}

const locations = [
  'Hiran Magri Sector 1',
  'Hiran Magri Sector 2',
  'Pratap Nagar',
  'Ambamata',
  'Sukher',
  'Bhuwana',
  'Bedla',
  'Fatehpura',
];

const input = document.getElementById('locationSearch');
const citySelect = document.getElementById('citySelect');
const slugPreview = document.getElementById('slugPreview');

if (citySelect && slugPreview) {
  citySelect.addEventListener('change', () => {
    slugPreview.textContent = `SEO path preview: propertysetu.in/${citySelect.value}`;
  });
}

if (input) {
  input.addEventListener('keyup', () => {
    const value = input.value.toLowerCase();
    const filtered = locations.filter((loc) => loc.toLowerCase().includes(value));
    if (value.length > 1) {
      input.title = filtered.length ? `Suggestions: ${filtered.join(', ')}` : 'No exact locality match';
    } else {
      input.title = '';
    }
  });
}

const tabButtons = document.querySelectorAll('.tab-btn');
tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

const searchButton = document.getElementById('searchButton');
if (searchButton) {
  searchButton.addEventListener('click', () => {
    const selectedMode = document.querySelector('.tab-btn.active')?.dataset.mode || 'buy';
    const city = citySelect?.value || 'udaipur';
    const location = input?.value.trim() || 'all-areas';
    const normalized = location.toLowerCase().replace(/\s+/g, '-');
    window.location.hash = `search/${city}/${selectedMode}/${normalized}`;
  });
}
main
