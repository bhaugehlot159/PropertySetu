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
