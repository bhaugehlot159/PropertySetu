document.getElementById("filterSelect").addEventListener("change", function() {

    let selected = this.value;
    let cards = document.querySelectorAll(".property-card");

    cards.forEach(function(card) {

        if (selected === "all") {
            card.style.display = "block";
        } 
        else if (card.getAttribute("data-type") === selected) {
            card.style.display = "block";
        } 
        else {
            card.style.display = "none";
        }

    });

});