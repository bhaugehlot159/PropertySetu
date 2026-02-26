const form = document.getElementById("addPropertyForm");
const photosInput = document.getElementById("photos");
const videoInput = document.getElementById("video");
const photoPreview = document.getElementById("photoPreview");
const videoPreview = document.getElementById("videoPreview");

// Photo Preview
photosInput.addEventListener("change", function(){
    photoPreview.innerHTML = "";
    if(this.files.length > 5){
        alert("You can upload max 5 photos");
        this.value = "";
        return;
    }
    Array.from(this.files).forEach(file => {
        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.className = "preview";
        photoPreview.appendChild(img);
    });
});

// Video Preview
videoInput.addEventListener("change", function(){
    videoPreview.innerHTML = "";
    const file = this.files[0];
    if(file){
        const vid = document.createElement("video");
        vid.src = URL.createObjectURL(file);
        vid.className = "preview";
        vid.controls = true;
        videoPreview.appendChild(vid);
    }
});

// Form Submission
form.addEventListener("submit", function(e){
    e.preventDefault();
    alert("Property submitted successfully! ✅ (Demo Only)");
    form.reset();
    photoPreview.innerHTML = "";
    videoPreview.innerHTML = "";
});