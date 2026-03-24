import {
  createCloudinarySignature,
  getS3ClientHints,
  getStorageProvider
} from "../config/proStorage.js";

export function createUploadSignature(req, res, next) {
  try {
    const provider = getStorageProvider();

    if (provider === "cloudinary") {
      const payload = createCloudinarySignature(req.body || {});
      return res.json({
        success: true,
        ...payload
      });
    }

    return res.json({
      success: true,
      ...getS3ClientHints()
    });
  } catch (error) {
    return next(error);
  }
}
