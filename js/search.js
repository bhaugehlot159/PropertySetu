const searchInput = document.getElementById("searchInput");
searchInput.addEventListener("input", function() {
    const query = this.value.toLowerCase();
    const propertyCards = document.querySelectorAll(".property-card");
    propertyCards.forEach(card => {
        const title = card.querySelector("h3").innerText.toLowerCase();
        const location = card.querySelector("p").innerText.toLowerCase();
        if(title.includes(query) || location.includes(query)) card.style.display = "inline-block";
        else card.style.display = "none";
    });
});