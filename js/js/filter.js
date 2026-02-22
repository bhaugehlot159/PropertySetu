const filterSelect = document.getElementById("filterSelect");
const propertyCards = document.querySelectorAll(".property-card");
filterSelect.addEventListener("change", function() {
    const value = this.value;
    propertyCards.forEach(card => {
        if(value === "all") card.style.display = "inline-block";
        else if(card.querySelector(".tag").classList.contains(value)) card.style.display = "inline-block";
        else card.style.display = "none";
    });
});