// Dummy demo data
let userPropertiesData = [
    {id:1, title:"Luxury Villa Hiran Magri", status:"Pending", category:"Buy"},
    {id:2, title:"Farmhouse Ambamata", status:"Approved", category:"Farm House"},
];

// Render properties
const userPropertiesDiv = document.getElementById('userProperties');

userPropertiesData.forEach(prop => {
    const card = document.createElement('div');
    card.className = 'property-card';
    card.innerHTML = `
        <h3>${prop.title}</h3>
        <p><b>Category:</b> ${prop.category}</p>
        <p><b>Status:</b> ${prop.status}</p>
        <button onclick="editProperty(${prop.id})">Edit ✏️</button>
        <button onclick="deleteProperty(${prop.id}, this)">Delete 🗑️</button>
    `;
    userPropertiesDiv.appendChild(card);
});

function editProperty(id){
    alert("Edit property ID "+id+" (Demo)");
}

function deleteProperty(id, btn){
    if(confirm("Are you sure to delete this property?")){
        alert("Property ID "+id+" Deleted");
        btn.parentElement.remove();
    }
}