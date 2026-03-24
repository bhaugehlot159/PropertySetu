import crypto from "crypto";

const DEFAULT_CLOUDINARY_FOLDER = "propertysetu/properties";

export function getStorageProvider() {
  return (process.env.STORAGE_PROVIDER || "cloudinary").toLowerCase();
}

export function createCloudinarySignature(payload = {}) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary environment values are missing.");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = payload.folder || process.env.CLOUDINARY_UPLOAD_FOLDER || DEFAULT_CLOUDINARY_FOLDER;
  const publicId = payload.publicId || `property-${timestamp}`;

  const params = {
    folder,
    public_id: publicId,
    timestamp
  };

  const paramString = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  const signature = crypto
    .createHash("sha1")
    .update(`${paramString}${apiSecret}`)
    .digest("hex");

  return {
    provider: "cloudinary",
    cloudName,
    apiKey,
    folder,
    publicId,
    timestamp,
    signature,
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`
  };
}

export function getS3ClientHints() {
  return {
    provider: "s3",
    region: process.env.AWS_REGION || "ap-south-1",
    bucket: process.env.AWS_S3_BUCKET || "",
    note: "Use AWS SDK presign endpoint if you choose S3 mode."
  };
}
