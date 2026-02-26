// ============================
// PropertySetu - main.js
// ============================

// DOM Elements
const propertyContainer = document.getElementById("propertyContainer");
const searchInput = document.getElementById("searchInput");
const locationFilter = document.getElementById("locationFilter");
const minPrice = document.getElementById("minPrice");
const maxPrice = document.getElementById("maxPrice");
const noResult = document.getElementById("noResult");

// Load Properties from localStorage (Demo Data)
let properties = JSON.parse(localStorage.getItem("properties")) || [
    {
        title: "Luxury Villa – Hiran Magri",
        location: "Hiran Magri Sector 1",
        price: 12000000,
        type: "buy",
        image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c",
        featured: true
    },
    {
        title: "2BHK Modern Flat – Ambamata",
        location: "Ambamata",
        price: 18000,
        type: "rent",
        image: "https://images.unsplash.com/photo-1560185127-6ed189bf02f4",
        featured: false
    },
    {
        title: "Residential Plot – Pratap Nagar",
        location: "Pratap Nagar",
        price: 3500000,
        type: "buy",
        image: "https://images.unsplash.com/photo-1501183638710-841dd1904471",
        featured: false
    }
];

// Render Property Cards
function renderProperties() {
    propertyContainer.innerHTML = "";
    let visibleCount = 0;

    properties.forEach(property => {
        const titleLower = property.title.toLowerCase();
        const locationLower = property.location.toLowerCase();
        const searchVal = searchInput.value.toLowerCase();
        const locVal = locationFilter.value.toLowerCase();
        const min = parseInt(minPrice.value) || 0;
        const max = parseInt(maxPrice.value) || Infinity;

        const matchSearch = titleLower.includes(searchVal);
        const matchLocation = locVal === "all" || locationLower === locVal;
        const matchPrice = property.price >= min && property.price <= max;

        if (matchSearch && matchLocation && matchPrice) {
            visibleCount++;
            const card = document.createElement("div");
            card.className = "property-card";
            card.innerHTML = `
                <div style="position:relative">
                    ${property.featured ? '<span class="tag">FEATURED</span>' : ''}
                    <img src="${property.image}" alt="${property.title}">
                </div>
                <h3>${property.title}</h3>
                <p>Location: ${property.location}</p>
                <p>Price: ₹${property.price.toLocaleString()}</p>
                <button onclick="toggleFavorite(this)">❤️ Save</button>
            `;
            propertyContainer.appendChild(card);
        }
    });

    noResult.style.display = visibleCount === 0 ? "block" : "none";
}

// Favorite System
function toggleFavorite(button) {
    const cardTitle = button.closest(".property-card").querySelector("h3").innerText;
    let favorites = JSON.parse(localStorage.getItem("favorites")) || [];

    if (favorites.includes(cardTitle)) {
        favorites = favorites.filter(fav => fav !== cardTitle);
        button.innerText = "❤️ Save";
    } else {
        favorites.push(cardTitle);
        button.innerText = "✅ Saved";
    }
    localStorage.setItem("favorites", JSON.stringify(favorites));
}

// Event Listeners
searchInput.addEventListener("input", renderProperties);
locationFilter.addEventListener("change", renderProperties);
minPrice.addEventListener("input", renderProperties);
maxPrice.addEventListener("input", renderProperties);

// Initial Render
document.addEventListener("DOMContentLoaded", renderProperties);