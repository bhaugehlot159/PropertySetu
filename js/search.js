const searchInput = document.getElementById("searchInput");

searchInput.addEventListener("input", function () {

    const query = this.value.trim().toLowerCase();
    const propertyCards = document.querySelectorAll(".property-card");

    propertyCards.forEach(function (card) {

        // Safe fetch data
        const title = card.querySelector("h3") 
            ? card.querySelector("h3").innerText.toLowerCase() 
            : "";

        const location = card.getAttribute("data-location") 
            ? card.getAttribute("data-location").toLowerCase() 
            : "";

        const type = card.getAttribute("data-type") 
            ? card.getAttribute("data-type").toLowerCase() 
            : "";

        const allParagraphs = card.querySelectorAll("p");
        let extraText = "";

        allParagraphs.forEach(function (p) {
            extraText += p.innerText.toLowerCase() + " ";
        });

        // Combine everything
        const fullData = title + " " + location + " " + type + " " + extraText;

        // If search empty → show all
        if (query === "") {
            card.style.display = "block";
        } 
        else if (fullData.includes(query)) {
            card.style.display = "block";
        } 
        else {
            card.style.display = "none";
        }

    });

});