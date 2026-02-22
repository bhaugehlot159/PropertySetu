const lengthInput = document.getElementById("length");
const widthInput = document.getElementById("width");
const totalArea = document.getElementById("totalArea");
function calculateArea() {
    const length = parseFloat(lengthInput.value) || 0;
    const width = parseFloat(widthInput.value) || 0;
    totalArea.value = length * width + " sq ft";
}
lengthInput.addEventListener("input", calculateArea);
widthInput.addEventListener("input", calculateArea);

// Video Preview
const videoInput = document.getElementById("videoUpload");
const videoPreview = document.getElementById("videoPreview");
videoInput.addEventListener("change", function () {
    videoPreview.innerHTML = "";
    const file = this.files[0];
    if (file) {
        const video = document.createElement("video");
        video.src = URL.createObjectURL(file);
        video.controls = true;
        video.style.width = "300px";
        video.style.marginTop = "15px";
        videoPreview.appendChild(video);
    }
});