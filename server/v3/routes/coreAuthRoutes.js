import { Router } from "express";
import {
  getCoreMe,
  loginCoreUserWithOtp,
  listCoreUsers,
  loginCoreUser,
  requestCoreOtp,
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
router.post("/request-otp", requestCoreOtp);
router.post("/login-otp", loginCoreUserWithOtp);
router.get("/me", coreAuthRequired, getCoreMe);
router.get("/users", coreAuthRequired, coreRoleRequired("admin"), listCoreUsers);
router.patch(
  "/users/:userId/verify",
  coreAuthRequired,
  coreRoleRequired("admin"),
  setCoreUserVerified
);

export default router;
