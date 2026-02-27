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
}
animate();

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
