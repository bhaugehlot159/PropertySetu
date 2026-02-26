// Pending Property Data
let pendingPropertiesData = [
    {id:1, title:"Luxury Villa Hiran Magri", owner:"Seller1", category:"Buy", featured:false},
    {id:2, title:"Farmhouse Ambamata", owner:"Seller2", category:"Farm House", featured:true},
];

// Bidding Data
let biddingData = [
    {propertyId:1, bidder:"Buyer1", amount:2500000},
    {propertyId:1, bidder:"Seller2", amount:2400000},
    {propertyId:2, bidder:"Buyer3", amount:1500000}
];

// Pending Property Approval
const pendingDiv = document.getElementById('pendingProperties');
pendingPropertiesData.forEach(prop => {
    const card = document.createElement('div');
    card.className = 'property-card';
    card.innerHTML = `
        <h3>${prop.title}</h3>
        <p><b>Owner:</b> ${prop.owner}</p>
        <p><b>Category:</b> ${prop.category}</p>
        <button onclick="approveProperty(${prop.id}, this)">Approve ✅</button>
        <button onclick="rejectProperty(${prop.id}, this)">Reject ❌</button>
    `;
    pendingDiv.appendChild(card);
});

function approveProperty(id, btn){
    alert("Property ID "+id+" Approved ✅");
    btn.parentElement.remove();
}
function rejectProperty(id, btn){
    alert("Property ID "+id+" Rejected ❌");
    btn.parentElement.remove();
}

// Featured Listing + Hidden Bidding
const featuredDiv = document.getElementById('featuredBids');
biddingData.forEach(bid => {
    const card = document.createElement('div');
    card.className = 'bid-card';
    card.innerHTML = `
        <p><b>Property ID:</b> ${bid.propertyId}</p>
        <p><b>Bidder:</b> ${bid.bidder}</p>
        <p><b>Bid Amount:</b> Hidden 🔒</p>
        <button onclick="revealBid(${bid.propertyId}, '${bid.bidder}', ${bid.amount})">Reveal Amount</button>
    `;
    featuredDiv.appendChild(card);
});

function revealBid(propId, bidder, amount){
    alert(`Property ${propId} - Bidder: ${bidder} - Amount: ₹${amount}`);
}