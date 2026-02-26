// Demo subscription/featured plans
let plans = [
    {id:1, name:"7 Days Featured", price:299, duration:"7 days"},
    {id:2, name:"30 Days Featured", price:999, duration:"30 days"},
    {id:3, name:"Property Care Monthly", price:499, duration:"1 month"}
];

const featuredDiv = document.getElementById('featuredPlans');

plans.forEach(plan => {
    const card = document.createElement('div');
    card.className = 'plan-card';
    card.innerHTML = `
        <h3>${plan.name} <span class="badge">Demo</span></h3>
        <p><b>Price:</b> ₹${plan.price}</p>
        <p><b>Duration:</b> ${plan.duration}</p>
        <button onclick="subscribePlan(${plan.id})">Subscribe / Activate</button>
    `;
    featuredDiv.appendChild(card);
});

function subscribePlan(id){
    const plan = plans.find(p => p.id === id);
    alert(`Plan "${plan.name}" activated! ✅ (Demo Only)`);
}