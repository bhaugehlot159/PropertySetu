import { Router } from "express";
import { createUploadSignature } from "../controllers/proStorageController.js";

const router = Router();

router.post("/signature", createUploadSignature);

export default router;
