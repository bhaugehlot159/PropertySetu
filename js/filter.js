function filterProperties() {

    let selectedType = document.getElementById("filterSelect").value;
    let selectedLocation = document.getElementById("locationSearch").value.toLowerCase();

    let cards = document.querySelectorAll(".property-card");

    cards.forEach(function(card) {

        let cardType = card.getAttribute("data-type");
        let cardLocation = card.getAttribute("data-location").toLowerCase();

        let typeMatch = (selectedType === "all" || selectedType === cardType);
        let locationMatch = (selectedLocation === "" || cardLocation.includes(selectedLocation));

        if(typeMatch && locationMatch) {
            card.style.display = "block";
        } else {
            card.style.display = "none";
        }

    });

}

document.getElementById("filterSelect").addEventListener("change", filterProperties);
document.getElementById("locationSearch").addEventListener("keyup", filterProperties);