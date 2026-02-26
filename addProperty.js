const form = document.getElementById('propertyForm');
const preview = document.getElementById('preview');

const aiDescriptionDemo = (title, category) => {
    return `This is a professional AI-generated description for ${category} titled "${title}". It highlights all the features and benefits for potential buyers or renters.`;
};

form.addEventListener('submit', function(e){
    e.preventDefault();

    const title = document.getElementById('title').value;
    const category = document.getElementById('category').value;
    const city = document.getElementById('city').value;
    const location = document.getElementById('location').value;
    const price = document.getElementById('price').value;
    const description = document.getElementById('description').value || aiDescriptionDemo(title, category);

    const photos = document.getElementById('photos').files;
    const video = document.getElementById('video').files[0];

    if(photos.length < 5){
        alert("Please upload minimum 5 photos");
        return;
    }

    // Demo preview
    preview.innerHTML = `<h3>Property Preview</h3>
    <p><b>Title:</b> ${title}</p>
    <p><b>Category:</b> ${category}</p>
    <p><b>City:</b> ${city}</p>
    <p><b>Location:</b> ${location}</p>
    <p><b>Price:</b> ₹${price}</p>
    <p><b>Description:</b> ${description}</p>
    <p><b>Photos:</b></p>`;

    for(let i=0;i<photos.length;i++){
        const img = document.createElement('img');
        img.className = 'preview-img';
        img.src = URL.createObjectURL(photos[i]);
        preview.appendChild(img);
    }

    if(video){
        const vid = document.createElement('video');
        vid.controls = true;
        vid.src = URL.createObjectURL(video);
        vid.style.maxWidth = "300px";
        preview.appendChild(document.createElement('br'));
        preview.appendChild(vid);
    }

    alert("Property added demo! ✅ (In real app, this goes to backend with verification, featured & subscription handling)");
});

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
