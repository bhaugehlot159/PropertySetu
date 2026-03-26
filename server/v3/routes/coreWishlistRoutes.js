import { Router } from "express";
import {
  addCoreWishlistItem,
  compareCoreWishlistProperties,
  listCoreWishlistItems,
  removeCoreWishlistItem
} from "../controllers/coreWishlistController.js";
import { coreAuthRequired } from "../middleware/coreAuthMiddleware.js";

const router = Router();

router.get("/", coreAuthRequired, listCoreWishlistItems);
router.get("/compare", coreAuthRequired, compareCoreWishlistProperties);
router.post("/:propertyId", coreAuthRequired, addCoreWishlistItem);
router.delete("/:propertyId", coreAuthRequired, removeCoreWishlistItem);

export default router;
