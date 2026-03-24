import apiClient from "./apiClient.js";

export async function uploadPropertyImage(file) {
  const signatureResponse = await apiClient.post("/storage/signature", {
    folder: "propertysetu/properties"
  });

  const signaturePayload = signatureResponse.data;

  if (signaturePayload.provider !== "cloudinary") {
    throw new Error(
      "Current storage provider cloud upload flow support nahi karta."
    );
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", signaturePayload.folder);
  formData.append("public_id", signaturePayload.publicId);
  formData.append("timestamp", String(signaturePayload.timestamp));
  formData.append("api_key", signaturePayload.apiKey);
  formData.append("signature", signaturePayload.signature);

  const cloudinaryResponse = await fetch(signaturePayload.uploadUrl, {
    method: "POST",
    body: formData
  });

  const uploaded = await cloudinaryResponse.json();

  if (!cloudinaryResponse.ok) {
    throw new Error(uploaded?.error?.message || "Cloud upload failed.");
  }

  return uploaded.secure_url;
}
