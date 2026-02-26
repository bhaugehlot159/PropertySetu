// areaInsights.js
const areaData = {
    "Hiran Magri": {
        schools: ["Hiran Magri Public School", "DAV School"],
        hospitals: ["NIMS Hospital", "Shri Vardhman Hospital"],
        markets: ["Hiran Magri Market", "Sector 1 Market"],
        avgPrice: "₹4,500 per sq ft"
    },
    "Pratap Nagar": {
        schools: ["St. Paul School", "City Public School"],
        hospitals: ["Pratap Nagar Hospital", "City Hospital"],
        markets: ["Pratap Nagar Market", "Sector 5 Market"],
        avgPrice: "₹5,000 per sq ft"
    },
    "Ambamata": {
        schools: ["Ambamata School", "Shree School"],
        hospitals: ["Ambamata Hospital", "Community Health Center"],
        markets: ["Ambamata Market", "Local Bazaar"],
        avgPrice: "₹3,800 per sq ft"
    },
    "Bhuwana": {
        schools: ["Bhuwana School", "Central School"],
        hospitals: ["Bhuwana Hospital", "Health Care Center"],
        markets: ["Bhuwana Market", "Local Shops"],
        avgPrice: "₹4,200 per sq ft"
    },
    "Sukher": {
        schools: ["Sukher Public School"],
        hospitals: ["Sukher Hospital"],
        markets: ["Sukher Market", "Industrial Market"],
        avgPrice: "₹4,000 per sq ft"
    },
    "Bedla": {
        schools: ["Bedla School"],
        hospitals: ["Bedla Hospital"],
        markets: ["Bedla Market"],
        avgPrice: "₹3,900 per sq ft"
    },
    "Fatehpura": {
        schools: ["Fatehpura School"],
        hospitals: ["Fatehpura Hospital"],
        markets: ["Fatehpura Market"],
        avgPrice: "₹4,100 per sq ft"
    }
};

const areaSelect = document.getElementById("areaSelect");
const areaDetails = document.getElementById("areaDetails");

areaSelect.addEventListener("change", () => {
    const val = areaSelect.value;
    if(!val){
        areaDetails.innerHTML = "<p>Please select an area to see insights.</p>";
        return;
    }

    const data = areaData[val];
    if(data){
        areaDetails.innerHTML = `
            <div class="area-card">
                <p><b>Schools:</b> ${data.schools.join(", ")}</p>
                <p><b>Hospitals:</b> ${data.hospitals.join(", ")}</p>
                <p><b>Markets:</b> ${data.markets.join(", ")}</p>
                <p><b>Average Property Price:</b> ${data.avgPrice}</p>
            </div>
        `;
    } else {
        areaDetails.innerHTML = "<p>No data available for this area.</p>";
    }
});