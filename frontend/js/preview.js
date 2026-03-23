const fileInput = document.querySelector('input[type="file"]');
const previewContainer = document.createElement("div");
document.querySelector("form").appendChild(previewContainer);
fileInput.addEventListener("change", function () {
    previewContainer.innerHTML = "";
    Array.from(this.files).forEach(file => {
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = document.createElement("img");
            img.src = e.target.result;
            img.style.width = "120px";
            img.style.margin = "10px";
            img.style.borderRadius = "8px";
            previewContainer.appendChild(img);
        }
        reader.readAsDataURL(file);
    });
});