const form = document.getElementById('propertyForm');

form.addEventListener('submit', function(e){
    e.preventDefault();

    const data = new FormData();
    data.append("title", document.getElementById("title").value);
    data.append("location", document.getElementById("location").value);
    data.append("category", document.getElementById("category").value);
    data.append("price", document.getElementById("price").value);
    data.append("description", document.getElementById("description").value);

    const images = document.getElementById("images").files;
    if(images.length > 5){
        alert("Maximum 5 images allowed!");
        return;
    }
    for(let i=0;i<images.length;i++){
        data.append("images", images[i]);
    }

    const video = document.getElementById("video").files[0];
    if(video) data.append("video", video);

    console.log("Form Data ready for backend:", data);
    alert("Property submitted! (Demo Frontend Only)");
});