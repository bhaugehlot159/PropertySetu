// Demo auction data
let auctions = [
    {id:1, title:"Luxury Villa Hiran Magri", bids:[], endTime: Date.now()+60000}, // 60 sec demo
    {id:2, title:"Farmhouse Ambamata", bids:[], endTime: Date.now()+120000} // 2 min demo
];

const auctionDiv = document.getElementById('auctionList');

function renderAuctions(){
    auctionDiv.innerHTML = "";
    auctions.forEach(a => {
        const card = document.createElement('div');
        card.className = 'auction-card';
        card.id = 'auction-'+a.id;

        // Timer calculation
        let remaining = Math.max(0, a.endTime - Date.now());
        let sec = Math.floor(remaining/1000);

        card.innerHTML = `
            <h3>${a.title}</h3>
            <p><b>Timer:</b> <span class="timer" id="timer-${a.id}">${sec}s</span></p>
            <input type="number" placeholder="Enter bid amount" id="bidInput-${a.id}" />
            <button onclick="placeBid(${a.id})">Place Bid 🔒</button>
            <div id="bids-${a.id}"></div>
        `;
        auctionDiv.appendChild(card);
    });
}

function placeBid(id){
    const input = document.getElementById('bidInput-'+id);
    let value = parseInt(input.value);
    if(isNaN(value) || value <= 0){
        alert("Enter valid bid");
        return;
    }
    let auction = auctions.find(a=>a.id===id);
    auction.bids.push({bidder:"DemoUser", amount:value, time:Date.now()});
    input.value="";
    alert("Bid placed! 🔒 (Hidden from others)");
    updateBidsUI(id);
}

function updateBidsUI(id){
    const bidsDiv = document.getElementById('bids-'+id);
    bidsDiv.innerHTML = "<p>Bids: "+auctions.find(a=>a.id===id).bids.length+" bids placed (Hidden Amounts)</p>";
}

// Timer check & auto winner
setInterval(()=>{
    let now = Date.now();
    auctions.forEach(a=>{
        if(a.endTime <= now && !a.winner){
            if(a.bids.length>0){
                // auto highest bid winner
                let highest = a.bids.reduce((prev,curr)=>curr.amount>prev.amount?curr:prev,{amount:0});
                a.winner = highest;
                const card = document.getElementById('auction-'+a.id);
                card.innerHTML += `<p>🏆 Winner: ${highest.bidder} - ₹${highest.amount}</p>`;
                alert(`Auction Ended: ${a.title} - Winner: ${highest.bidder} - ₹${highest.amount}`);
            } else {
                a.winner = null;
            }
        } else {
            // update timer
            let remaining = Math.max(0, a.endTime - now);
            let sec = Math.floor(remaining/1000);
            const timerEl = document.getElementById('timer-'+a.id);
            if(timerEl) timerEl.innerText = sec+"s";
        }
    });
},1000);

renderAuctions();