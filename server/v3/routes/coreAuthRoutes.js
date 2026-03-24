import { Router } from "express";
import {
  getCoreMe,
  listCoreUsers,
  loginCoreUser,
  registerCoreUser,
  setCoreUserVerified
} from "../controllers/coreAuthController.js";
import {
  coreAuthRequired,
  coreRoleRequired
} from "../middleware/coreAuthMiddleware.js";

const router = Router();

router.post("/register", registerCoreUser);
router.post("/login", loginCoreUser);
router.get("/me", coreAuthRequired, getCoreMe);
router.get("/users", coreAuthRequired, coreRoleRequired("admin"), listCoreUsers);
router.patch(
  "/users/:userId/verify",
  coreAuthRequired,
  coreRoleRequired("admin"),
  setCoreUserVerified
);

export default router;
