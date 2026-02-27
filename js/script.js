 codex/make-entire-website-runnable-with-auto-suggestions
// Hero Canvas 3D Animation
const canvas = document.getElementById("heroCanvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

let stars = [];
for (let i = 0; i < 150; i++) {
  stars.push({
    x: Math.random() * canvas.width - canvas.width / 2,
    y: Math.random() * canvas.height - canvas.height / 2,
    z: Math.random() * canvas.width
  });
}

function animate() {
  ctx.fillStyle = "#0b3d91";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < stars.length; i++) {
    const star = stars[i];
    star.z -= 2;
    if (star.z <= 0) star.z = canvas.width;

    const k = 128.0 / star.z;
    const px = star.x * k + canvas.width / 2;
    const py = star.y * k + canvas.height / 2;

    if (px >= 0 && px <= canvas.width && py >= 0 && py <= canvas.height) {
      ctx.fillStyle = "white";
      ctx.fillRect(px, py, 2, 2);
    }
  }

  requestAnimationFrame(animate);
=======
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
}

const locations = window.PROPERTYSETU_LOCATIONS || [];
const input = document.getElementById('locationSearch');
const citySelect = document.getElementById('citySelect');
const slugPreview = document.getElementById('slugPreview');
const suggestionList = document.getElementById('suggestionList');
const locationSuggestions = document.getElementById('locationSuggestions');

if (locationSuggestions) {
  locationSuggestions.innerHTML = locations.map((loc) => `<option value="${loc}"></option>`).join('');
}

if (citySelect && slugPreview) {
  citySelect.addEventListener('change', () => {
    slugPreview.textContent = `SEO path preview: propertysetu.in/${citySelect.value}`;
  });
}
 codex/add-auto-suggestion-feature-for-udaipur-codes
animate();


if (input) {
  input.addEventListener('input', () => {
    const value = input.value.toLowerCase().trim();

    if (!suggestionList) return;
    if (value.length < 2) {
      suggestionList.innerHTML = '';
      return;
    }

    const filtered = locations.filter((loc) => loc.toLowerCase().includes(value)).slice(0, 8);
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
 codex/add-features-to-enhance-website-attractiveness
 main
}

 codex/make-entire-website-runnable-with-auto-suggestions
// Location Search Suggestions
const fallbackLocations = [
  "Hiran Magri Sector 1",
  "Hiran Magri Sector 2",
  "Hiran Magri Sector 3",
  "Pratap Nagar",
  "Ambamata",
  "Sukher",
  "Bhuwana",
  "Bedla",
  "Fatehpura",
  "Goverdhan Vilas",
  "Shobhagpura",
  "Celebration Mall Area"
];

const searchInput = document.getElementById("locationSearch");
const suggestionsBox = document.getElementById("locationSuggestions");

function renderSuggestions(items) {
  if (!items.length) {
    suggestionsBox.innerHTML = "";
    suggestionsBox.style.display = "none";
    return;
  }

  suggestionsBox.innerHTML = items
    .map(
      (item) =>
        `<button type="button" class="suggestion-item" data-location="${item}">${item}</button>`
    )
    .join("");
  suggestionsBox.style.display = "block";
}

async function fetchSuggestions(query) {
  try {
    const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error("Network response was not ok");
    return await response.json();
  } catch (error) {
    return fallbackLocations.filter((location) =>
      location.toLowerCase().includes(query.toLowerCase())
    );
  }
}

let debounceTimer;
searchInput.addEventListener("input", () => {
  const value = searchInput.value.trim();

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    if (!value) {
      renderSuggestions([]);
      return;
    }

    const suggestions = await fetchSuggestions(value);
    renderSuggestions(suggestions.slice(0, 8));
  }, 150);
});

suggestionsBox.addEventListener("click", (event) => {
  const button = event.target.closest(".suggestion-item");
  if (!button) return;

  searchInput.value = button.dataset.location;
  renderSuggestions([]);
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".location-search-wrapper")) {
    renderSuggestions([]);
  }
});

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
