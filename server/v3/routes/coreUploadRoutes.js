import { Router } from "express";
import {
  decideCorePrivateDocIntegrity,
  getCorePrivateDocThreatPolicy,
  listCorePrivateDocEmergencyLockQueue,
  listCorePrivateDocIntegrityDecisionAudits,
  listCorePrivateDocIntegrityQueue,
  listCorePrivateDocSecurityEvents,
  listMyCoreUploads,
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
  listCorePrivateDocSecurityEvents
);
router.get(
  "/private-docs/security/threat-policy",
  coreAuthRequired,
  coreRoleRequired("admin"),
  getCorePrivateDocThreatPolicy
);
router.patch(
  "/private-docs/security/threat-policy",
  coreAuthRequired,
  coreRoleRequired("admin"),
  coreUploadWriteLimiter,
  updateCorePrivateDocThreatPolicy
);
router.post(
  "/private-docs/security/release",
  coreAuthRequired,
  coreRoleRequired("admin"),
  releaseCorePrivateDocSecurityShield
);
router.get(
  "/private-docs/integrity/review",
  coreAuthRequired,
  coreRoleRequired("admin"),
  listCorePrivateDocIntegrityQueue
);
router.post(
  "/private-docs/integrity/decision",
  coreAuthRequired,
  coreRoleRequired("admin"),
  decideCorePrivateDocIntegrity
);
router.get(
  "/private-docs/integrity/audit",
  coreAuthRequired,
  coreRoleRequired("admin"),
  listCorePrivateDocIntegrityDecisionAudits
);
router.get("/mine", coreAuthRequired, listMyCoreUploads);

export default router;
