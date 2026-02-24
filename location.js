const locations = [
"Hiran Magri Sector 1","Hiran Magri Sector 2","Hiran Magri Sector 3",
"Hiran Magri Sector 4","Hiran Magri Sector 5","Hiran Magri Sector 6",
"Hiran Magri Sector 7","Hiran Magri Sector 8","Hiran Magri Sector 9",
"Hiran Magri Sector 10","Hiran Magri Sector 11","Hiran Magri Sector 12",
"Hiran Magri Sector 13","Hiran Magri Sector 14",
"Pratap Nagar","Bhuwana","Sukher","Bedla","Shobhagpura",
"Saheli Nagar","Fatehpura","Ambamata","Rani Road",
"Goverdhan Vilas","Savina","Manva Kheda","Ayad","Titardi",
"Debari","Balicha","Eklingpura","Kaladwas",
"Madri RIICO","Transport Nagar","Pula",
"Chetak Circle","Surajpole","Delhi Gate","Hathipole",
"Bapu Bazaar","Gulab Bagh","Chitrakoot Nagar",
"Amberi","Badgaon","Iswal","Nai","Badi",
"Sisarma","Kodiyat","Lakhawali","Dabok"
];

const input = document.getElementById("locationSearch");
const list = document.getElementById("locationList");

input.addEventListener("keyup", function() {
    let value = this.value.toLowerCase();
    list.innerHTML = "";

    if(value === "") {
        list.style.display = "none";
        return;
    }

    let filtered = locations.filter(loc => 
        loc.toLowerCase().includes(value)
    );

    filtered.forEach(loc => {
        let div = document.createElement("div");
        div.textContent = loc;
        div.style.padding = "8px";
        div.style.cursor = "pointer";

        div.onclick = function() {
            input.value = loc;
            list.style.display = "none";
        };

        list.appendChild(div);
    });

    list.style.display = filtered.length ? "block" : "none";
});