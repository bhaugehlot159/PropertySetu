// ===============================
// COMPLETE PROPERTY FILTER SYSTEM
// ===============================

// Get elements
const searchInput = document.getElementById("searchInput");
const typeFilter = document.getElementById("typeFilter");
const locationFilter = document.getElementById("locationFilter");
const minPriceInput = document.getElementById("minPrice");
const maxPriceInput = document.getElementById("maxPrice");

// Add event listeners
searchInput.addEventListener("input", filterProperties);
typeFilter.addEventListener("change", filterProperties);
locationFilter.addEventListener("change", filterProperties);
minPriceInput.addEventListener("input", filterProperties);
maxPriceInput.addEventListener("input", filterProperties);

function filterProperties() {

    const query = searchInput.value.trim().toLowerCase();
    const selectedType = typeFilter.value.toLowerCase();
    const selectedLocation = locationFilter.value.toLowerCase();
    const minPrice = parseInt(minPriceInput.value) || 0;
    const maxPrice = parseInt(maxPriceInput.value) || Infinity;

    const propertyCards = document.querySelectorAll(".property-card");

    propertyCards.forEach(function(card) {

        // Get card data safely
        const title = card.querySelector("h3") 
            ? card.querySelector("h3").innerText.toLowerCase() 
            : "";

        const location = card.getAttribute("data-location") 
            ? card.getAttribute("data-location").toLowerCase() 
            : "";

        const type = card.getAttribute("data-type") 
            ? card.getAttribute("data-type").toLowerCase() 
            : "";

        const price = card.getAttribute("data-price") 
            ? parseInt(card.getAttribute("data-price")) 
            : 0;

        const allParagraphs = card.querySelectorAll("p");
        let extraText = "";

        allParagraphs.forEach(function(p) {
            extraText += p.innerText.toLowerCase() + " ";
        });

        const fullText = title + " " + location + " " + type + " " + extraText;

        // Conditions
        const searchMatch = (query === "" || fullText.includes(query));
        const typeMatch = (selectedType === "all" || selectedType === type);
        const locationMatch = (selectedLocation === "all" || location === selectedLocation);
        const priceMatch = (price >= minPrice && price <= maxPrice);

        // Final display
        if (searchMatch && typeMatch && locationMatch && priceMatch) {
            card.style.display = "block";
        } else {
            card.style.display = "none";
        }

    });

}