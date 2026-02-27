import express from "express";
import { getLocationSuggestions, searchProperties } from "../controllers/searchController.js";

const router = express.Router();

router.get("/suggestions", getLocationSuggestions);
router.get("/", searchProperties);

export default router;
