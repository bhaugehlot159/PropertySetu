document.addEventListener("DOMContentLoaded", function () {

    const searchInput = document.getElementById("searchInput");

    searchInput.addEventListener("input", function () {

        const query = this.value.toLowerCase();
        const propertyCards = document.querySelectorAll(".property-card");

        propertyCards.forEach(function(card) {

            const text = card.innerText.toLowerCase();

            if (text.includes(query)) {
                card.style.display = "block";
            } else {
                card.style.display = "none";
            }

        });

    });

});
function filterProperty(type) {

    const cards = document.querySelectorAll(".property-card");

    cards.forEach(function(card) {

        if (type === "all") {
            card.style.display = "block";
        } 
        else if (card.dataset.type === type) {
            card.style.display = "block";
        } 
        else {
            card.style.display = "none";
        }

    });

}
document.getElementById("locationFilter").addEventListener("change", function () {

    const selectedLocation = this.value.toLowerCase();
    const cards = document.querySelectorAll(".property-card");

    cards.forEach(function(card) {

        const cardLocation = card.dataset.location.toLowerCase();

        if (selectedLocation === "all" || cardLocation === selectedLocation) {
            card.style.display = "block";
        } else {
            card.style.display = "none";
        }

    });

});
function filterByPrice() {

    const min = parseInt(document.getElementById("minPrice").value) || 0;
    const max = parseInt(document.getElementById("maxPrice").value) || Infinity;

    const cards = document.querySelectorAll(".property-card");

    cards.forEach(function(card) {

        const price = parseInt(card.dataset.price);

        if (price >= min && price <= max) {
            card.style.display = "block";
        } else {
            card.style.display = "none";
        }

    });

}
function applyFilters() {

    const searchValue = document.getElementById("searchInput").value.toLowerCase();
    const locationValue = document.getElementById("locationFilter").value.toLowerCase();
    const min = parseInt(document.getElementById("minPrice").value) || 0;
    const max = parseInt(document.getElementById("maxPrice").value) || Infinity;

    const cards = document.querySelectorAll(".property-card");
    const noResult = document.getElementById("noResult");

    let visibleCount = 0;

    cards.forEach(function(card) {

        const title = card.querySelector("h3").innerText.toLowerCase();
        const location = card.dataset.location.toLowerCase();
        const price = parseInt(card.dataset.price);
        const type = card.dataset.type;

        const matchSearch = title.includes(searchValue) || location.includes(searchValue);
        const matchLocation = (locationValue === "all") || (location === locationValue);
        const matchPrice = price >= min && price <= max;

        if (matchSearch && matchLocation && matchPrice) {
            card.style.display = "block";
            visibleCount++;
        } else {
            card.style.display = "none";
        }

    });

    if (visibleCount === 0) {
        noResult.style.display = "block";
    } else {
        noResult.style.display = "none";
    }

}