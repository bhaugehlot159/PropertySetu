import { Router } from "express";
import {
  getCoreMe,
  loginCoreUserWithOtp,
  listCoreUsers,
  loginCoreUser,
  logoutCoreUser,
  requestCoreOtp,
  registerCoreUser,
  setCoreUserVerified
} from "../controllers/coreAuthController.js";
import {
  coreAuthRequired,
  coreRoleRequired
} from "../middleware/coreAuthMiddleware.js";
import {
  coreAuthLoginLimiter,
  coreAuthLogoutLimiter,
  coreAuthOtpRequestLimiter,
  coreAuthOtpVerifyLimiter,
  coreAuthRegisterLimiter
} from "../middleware/coreSecurityMiddleware.js";

const router = Router();

router.post("/register", coreAuthRegisterLimiter, registerCoreUser);
router.post("/login", coreAuthLoginLimiter, loginCoreUser);
router.post("/request-otp", coreAuthOtpRequestLimiter, requestCoreOtp);
router.post("/login-otp", coreAuthOtpVerifyLimiter, loginCoreUserWithOtp);
router.post("/logout", coreAuthRequired, coreAuthLogoutLimiter, logoutCoreUser);
router.get("/me", coreAuthRequired, getCoreMe);
router.get("/users", coreAuthRequired, coreRoleRequired("admin"), listCoreUsers);
router.patch(
  "/users/:userId/verify",
  coreAuthRequired,
  coreRoleRequired("admin"),
  setCoreUserVerified
);

export default router;
