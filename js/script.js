// Hero Canvas 3D Animation
const canvas = document.getElementById("heroCanvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let stars = [];
for(let i=0;i<150;i++){
    stars.push({x:Math.random()*canvas.width, y:Math.random()*canvas.height, z:Math.random()*canvas.width});
}
function animate(){
    ctx.fillStyle = "#0b3d91";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    for(let i=0;i<stars.length;i++){
        let star = stars[i];
        star.z -= 2;
        if(star.z <=0) star.z = canvas.width;
        let k = 128.0 / star.z;
        let px = star.x * k + canvas.width/2;
        let py = star.y * k + canvas.height/2;
        ctx.fillStyle = "white";
        ctx.fillRect(px, py, 2,2);
    }
    requestAnimationFrame(animate);
}
animate();

// Location Search
const locations = [
"Hiran Magri Sector 1","Hiran Magri Sector 2","Hiran Magri Sector 3","Hiran Magri Sector 4","Hiran Magri Sector 5",
"Pratap Nagar","Ambamata","Sukher","Bhuwana","Bedla","Fatehpura"
];
const uniqueLocations = [...new Set(locations)];
const input = document.getElementById("locationSearch");
input.addEventListener("keyup", function() {
    let value = this.value.toLowerCase();
    let filtered = uniqueLocations.filter(loc => loc.toLowerCase().includes(value));
    console.log("Matching locations:", filtered);
});