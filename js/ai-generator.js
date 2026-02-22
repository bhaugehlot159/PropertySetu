function generateDescription() {
    const type = document.querySelector("select").value;
    const price = document.querySelector('input[placeholder="Price (₹)"]').value;
    const area = document.getElementById("totalArea").value;
    const location = document.querySelector('input[placeholder="Location (Udaipur Area Name)"]').value;
    if (!type || !price || !area || !location) { alert("Please fill Property Type, Price, Size and Location first."); return; }
    const description = `This beautiful ${type} is available in ${location}, Udaipur.
Spacious area of ${area}.
Offered at an attractive price of ₹${price}.
Perfect investment opportunity with great connectivity and peaceful surroundings.
Contact now for site visit and more details!`;
    document.getElementById("description").value = description;
}