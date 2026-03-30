import { Router } from "express";
import {
  decideCorePrivateDocIntegrity,
  getCorePrivateDocThreatPolicy,
  listCorePrivateDocEmergencyLockQueue,
  listCorePrivateDocIntegrityDecisionAudits,
  listCorePrivateDocIntegrityQueue,
  listCorePrivateDocSecurityEvents,
  listMyCoreUploads,
  resetCorePrivateDocThreatPolicy,
  revokeCorePrivateDocAccess,
  setCorePrivateDocEmergencyAccessLock,
  releaseCorePrivateDocSecurityShield,
  resolveCorePrivateDocAccess,
  streamCorePrivateDoc,
  updateCorePrivateDocThreatPolicy,
  uploadCorePropertyMedia
} from "../controllers/coreUploadController.js";
import { coreAuthRequired, coreRoleRequired } from "../middleware/coreAuthMiddleware.js";
import {
  coreUploadPrivateDocSecurityAdminLimiter,
  coreUploadPrivateDocAccessLimiter,
  coreUploadWriteLimiter
} from "../middleware/coreSecurityMiddleware.js";

const router = Router();

router.post(
  "/property-media",
  coreAuthRequired,
  coreRoleRequired("seller", "admin"),
  coreUploadWriteLimiter,
  uploadCorePropertyMedia
);
router.post(
  "/private-docs/access",
  coreAuthRequired,
  coreUploadPrivateDocAccessLimiter,
  resolveCorePrivateDocAccess
);
router.post(
  "/private-docs/access/revoke",
  coreAuthRequired,
  coreUploadWriteLimiter,
  revokeCorePrivateDocAccess
);
router.post(
  "/private-docs/access/lock",
  coreAuthRequired,
  coreUploadWriteLimiter,
  setCorePrivateDocEmergencyAccessLock
);
router.get(
  "/private-docs/access/locks",
  coreAuthRequired,
  coreRoleRequired("admin"),
  listCorePrivateDocEmergencyLockQueue
);
router.get(
  "/private-docs/stream",
  coreAuthRequired,
  coreUploadPrivateDocAccessLimiter,
  streamCorePrivateDoc
);
router.post(
  "/private-docs/stream",
  coreAuthRequired,
  coreUploadPrivateDocAccessLimiter,
  streamCorePrivateDoc
);
router.get(
  "/private-docs/security/events",
  coreAuthRequired,
  coreRoleRequired("admin"),
  coreUploadPrivateDocSecurityAdminLimiter,
  listCorePrivateDocSecurityEvents
);
router.get(
  "/private-docs/security/threat-policy",
  coreAuthRequired,
  coreRoleRequired("admin"),
  coreUploadPrivateDocSecurityAdminLimiter,
  getCorePrivateDocThreatPolicy
);
router.patch(
  "/private-docs/security/threat-policy",
  coreAuthRequired,
  coreRoleRequired("admin"),
  coreUploadPrivateDocSecurityAdminLimiter,
  coreUploadWriteLimiter,
  updateCorePrivateDocThreatPolicy
);
router.post(
  "/private-docs/security/threat-policy/reset",
  coreAuthRequired,
  coreRoleRequired("admin"),
  coreUploadPrivateDocSecurityAdminLimiter,
  coreUploadWriteLimiter,
  resetCorePrivateDocThreatPolicy
);
router.post(
  "/private-docs/security/release",
  coreAuthRequired,
  coreRoleRequired("admin"),
  coreUploadPrivateDocSecurityAdminLimiter,
  releaseCorePrivateDocSecurityShield
);
router.get(
  "/private-docs/integrity/review",
  coreAuthRequired,
  coreRoleRequired("admin"),
  coreUploadPrivateDocSecurityAdminLimiter,
  listCorePrivateDocIntegrityQueue
);
router.post(
  "/private-docs/integrity/decision",
  coreAuthRequired,
  coreRoleRequired("admin"),
  coreUploadPrivateDocSecurityAdminLimiter,
  decideCorePrivateDocIntegrity
);
router.get(
  "/private-docs/integrity/audit",
  coreAuthRequired,
  coreRoleRequired("admin"),
  coreUploadPrivateDocSecurityAdminLimiter,
  listCorePrivateDocIntegrityDecisionAudits
);
router.get("/mine", coreAuthRequired, listMyCoreUploads);

export default router;
