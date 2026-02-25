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