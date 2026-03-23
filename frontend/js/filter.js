// =======================================
// PROPERTY FILTER SYSTEM (FINAL VERSION)
// =======================================

// Get filter elements
const typeFilter = document.getElementById("typeFilter");
const locationFilter = document.getElementById("locationFilter");
const minPriceInput = document.getElementById("minPrice");
const maxPriceInput = document.getElementById("maxPrice");

// Add event listeners
typeFilter.addEventListener("change", applyFilter);
locationFilter.addEventListener("change", applyFilter);
minPriceInput.addEventListener("input", applyFilter);
maxPriceInput.addEventListener("input", applyFilter);

function applyFilter() {

    const selectedType = typeFilter.value.toLowerCase();
    const selectedLocation = locationFilter.value.toLowerCase();
    const minPrice = parseInt(minPriceInput.value) || 0;
    const maxPrice = parseInt(maxPriceInput.value) || Infinity;

    const propertyCards = document.querySelectorAll(".property-card");

    propertyCards.forEach(function(card) {

        // Safe data fetch
        const cardType = card.getAttribute("data-type") 
            ? card.getAttribute("data-type").toLowerCase() 
            : "";

        const cardLocation = card.getAttribute("data-location") 
            ? card.getAttribute("data-location").toLowerCase() 
            : "";

        const cardPrice = card.getAttribute("data-price") 
            ? parseInt(card.getAttribute("data-price")) 
            : 0;

        // Conditions
        const typeMatch = (selectedType === "all" || selectedType === cardType);
        const locationMatch = (selectedLocation === "all" || selectedLocation === cardLocation);
        const priceMatch = (cardPrice >= minPrice && cardPrice <= maxPrice);

        // Final display logic
        if (typeMatch && locationMatch && priceMatch) {
            card.style.display = "block";
        } else {
            card.style.display = "none";
        }

    });

}