import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const proRateBuckets = new Map();
const proSecurityAuditEvents = [];
const proThreatProfiles = new Map();
const proThreatIncidents = [];
const proFakeListingSignatureIntel = new Map();
const proTokenIntelligence = new Map();
const proSubjectIntelligence = new Map();
const proAutoPromoteIntel = new Map();
const proAutoPromotionEvents = [];
const proAutoEscalationEvents = [];
const proCriticalResponseEvents = [];
const proCampaignResponseEvents = [];
const proAuthFailureTelemetry = [];
const proAuthShieldEvents = [];
const proProtectedAuthIdentities = new Map();
const proIdentityProtectionEvents = [];
const proProtectedTokenSubjects = new Map();
const proSubjectProtectionEvents = [];
const proSubjectSessionIntel = new Map();
const proSubjectSessionShieldEvents = [];
const proSubjectNetworkShieldEvents = [];
const proAdminMutationAttemptIntel = [];
const proAdminMutationShieldEvents = [];
const proAdminMutationSignatureNonces = new Map();
let proLastAutoModeChangeAt = 0;
let proLastCriticalLockdownAt = 0;
let proLastCampaignLockdownAt = 0;
let proAuthShieldUntil = 0;
let proLastAuthShieldAppliedAt = 0;
let proAdminMutationShieldUntil = 0;
let proLastAdminMutationShieldAppliedAt = 0;
let proSecurityAuditChainHead = "";
let proThreatIncidentChainHead = "";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configuredSecurityControlStateFile = String(process.env.SECURITY_CONTROL_STATE_FILE || "").trim();
const SECURITY_CONTROL_STATE_FILE = configuredSecurityControlStateFile ||
  path.resolve(__dirname, "../../database/security-control-state.json");
const SECURITY_CONTROL_STATE_PERSIST_ENABLED =
  String(process.env.SECURITY_CONTROL_STATE_PERSIST_ENABLED || "true").trim().toLowerCase() !== "false";
const SECURITY_CONTROL_STATE_SIGNING_KEY = String(
  process.env.SECURITY_CONTROL_STATE_SIGNING_KEY || ""
).trim();
const SECURITY_CONTROL_STATE_SIGNATURE_REQUIRED =
  String(process.env.SECURITY_CONTROL_STATE_SIGNATURE_REQUIRED || "false").trim().toLowerCase() === "true";

const SECURITY_AUDIT_MAX_ITEMS = Math.max(
  200,
  Number(process.env.SECURITY_AUDIT_MAX_ITEMS || 1000)
);
const SECURITY_MAX_OBJECT_DEPTH = Math.max(
  5,
  Number(process.env.SECURITY_MAX_OBJECT_DEPTH || 12)
);
const SECURITY_MAX_OBJECT_NODES = Math.max(
  100,
  Number(process.env.SECURITY_MAX_OBJECT_NODES || 4000)
);
const SECURITY_INCIDENT_MAX_ITEMS = Math.max(
  200,
  Number(process.env.SECURITY_INCIDENT_MAX_ITEMS || 1200)
);
const SECURITY_AI_AUTO_DETECT_ENABLED =
  text(process.env.SECURITY_AI_AUTO_DETECT_ENABLED || "true").toLowerCase() !== "false";
const THREAT_SCORE_BLOCK_THRESHOLD = Math.max(
  40,
  Number(process.env.THREAT_SCORE_BLOCK_THRESHOLD || 120)
);
const THREAT_SCORE_ALERT_THRESHOLD = Math.max(
  20,
  Number(process.env.THREAT_SCORE_ALERT_THRESHOLD || 35)
);
const THREAT_SCORE_DECAY_WINDOW_MS = Math.max(
  60_000,
  Number(process.env.THREAT_SCORE_DECAY_WINDOW_MS || 15 * 60 * 1000)
);
const THREAT_BLOCK_DURATION_MS = Math.max(
  60_000,
  Number(process.env.THREAT_BLOCK_DURATION_MS || 30 * 60 * 1000)
);
const THREAT_PROFILE_MAX_SIZE = Math.max(
  200,
  Number(process.env.THREAT_PROFILE_MAX_SIZE || 6000)
);
const THREAT_BURST_WINDOW_MS = Math.max(
  5_000,
  Number(process.env.THREAT_BURST_WINDOW_MS || 60_000)
);
const THREAT_BURST_REQUEST_THRESHOLD = Math.max(
  10,
  Number(process.env.THREAT_BURST_REQUEST_THRESHOLD || 75)
);
const THREAT_SCAN_WINDOW_MS = Math.max(
  30_000,
  Number(process.env.THREAT_SCAN_WINDOW_MS || 5 * 60 * 1000)
);
const THREAT_SCAN_PATH_THRESHOLD = Math.max(
  5,
  Number(process.env.THREAT_SCAN_PATH_THRESHOLD || 30)
);
const THREAT_CREDENTIAL_STUFFING_WINDOW_MS = Math.max(
  60_000,
  Number(process.env.THREAT_CREDENTIAL_STUFFING_WINDOW_MS || 10 * 60 * 1000)
);
const THREAT_CREDENTIAL_STUFFING_IDENTITY_THRESHOLD = Math.max(
  3,
  Number(process.env.THREAT_CREDENTIAL_STUFFING_IDENTITY_THRESHOLD || 15)
);
const THREAT_MANUAL_QUARANTINE_MAX_MS = Math.max(
  THREAT_BLOCK_DURATION_MS,
  Number(process.env.THREAT_MANUAL_QUARANTINE_MAX_MS || 24 * 60 * 60 * 1000)
);
const THREAT_REPEAT_OFFENDER_THRESHOLD = Math.max(
  2,
  Number(process.env.THREAT_REPEAT_OFFENDER_THRESHOLD || 3)
);
const THREAT_REPEAT_OFFENDER_MULTIPLIER = Math.max(
  1.1,
  Number(process.env.THREAT_REPEAT_OFFENDER_MULTIPLIER || 1.8)
);
const THREAT_REPEAT_OFFENDER_MAX_BLOCK_MS = Math.max(
  THREAT_BLOCK_DURATION_MS,
  Number(process.env.THREAT_REPEAT_OFFENDER_MAX_BLOCK_MS || 12 * 60 * 60 * 1000)
);
const FAKE_LISTING_AI_ENABLED =
  text(process.env.FAKE_LISTING_AI_ENABLED || "true").toLowerCase() !== "false";
const FAKE_LISTING_ALERT_THRESHOLD = Math.max(
  30,
  Number(process.env.FAKE_LISTING_ALERT_THRESHOLD || 48)
);
const FAKE_LISTING_BLOCK_THRESHOLD = Math.max(
  FAKE_LISTING_ALERT_THRESHOLD,
  Number(process.env.FAKE_LISTING_BLOCK_THRESHOLD || 84)
);
const FAKE_LISTING_SIGNAL_WINDOW_MS = Math.max(
  5 * 60 * 1000,
  Number(process.env.FAKE_LISTING_SIGNAL_WINDOW_MS || 12 * 60 * 60 * 1000)
);
const FAKE_LISTING_REPEAT_SIGNATURE_THRESHOLD = Math.max(
  2,
  Number(process.env.FAKE_LISTING_REPEAT_SIGNATURE_THRESHOLD || 3)
);
const FAKE_LISTING_BURST_THRESHOLD = Math.max(
  2,
  Number(process.env.FAKE_LISTING_BURST_THRESHOLD || 4)
);
const FAKE_LISTING_MAX_SIGNAL_ITEMS = Math.max(
  20,
  Number(process.env.FAKE_LISTING_MAX_SIGNAL_ITEMS || 160)
);
const FAKE_LISTING_SIGNATURE_INTEL_WINDOW_MS = Math.max(
  10 * 60 * 1000,
  Number(process.env.FAKE_LISTING_SIGNATURE_INTEL_WINDOW_MS || 24 * 60 * 60 * 1000)
);
const FAKE_LISTING_SIGNATURE_MAX_ITEMS = Math.max(
  200,
  Number(process.env.FAKE_LISTING_SIGNATURE_MAX_ITEMS || 6000)
);
const FAKE_LISTING_SIGNATURE_FINGERPRINT_THRESHOLD = Math.max(
  2,
  Number(process.env.FAKE_LISTING_SIGNATURE_FINGERPRINT_THRESHOLD || 2)
);
const FAKE_LISTING_SIGNATURE_OCCURRENCE_THRESHOLD = Math.max(
  3,
  Number(process.env.FAKE_LISTING_SIGNATURE_OCCURRENCE_THRESHOLD || 4)
);
const AUTH_FAILURE_WINDOW_MS = Math.max(
  60_000,
  Number(process.env.AUTH_FAILURE_WINDOW_MS || 10 * 60 * 1000)
);
const AUTH_FAILURE_401_THRESHOLD = Math.max(
  4,
  Number(process.env.AUTH_FAILURE_401_THRESHOLD || 18)
);
const AUTH_FAILURE_403_THRESHOLD = Math.max(
  3,
  Number(process.env.AUTH_FAILURE_403_THRESHOLD || 10)
);
const AUTH_FAILURE_SAMPLE_MAX = Math.max(
  20,
  Number(process.env.AUTH_FAILURE_SAMPLE_MAX || 120)
);
const THREAT_FINGERPRINT_PATTERN = /^[a-f0-9]{24}$/i;
const API_ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]);
const API_MAX_PATH_LENGTH = Math.max(
  400,
  Number(process.env.API_MAX_PATH_LENGTH || 2048)
);
const API_MAX_HOST_HEADER_LENGTH = Math.max(
  80,
  Number(process.env.API_MAX_HOST_HEADER_LENGTH || 255)
);
const TOKEN_FIREWALL_ENABLED =
  text(process.env.TOKEN_FIREWALL_ENABLED || "true").toLowerCase() !== "false";
const TOKEN_FIREWALL_ALLOWED_ALGS = new Set(["HS256"]);
const TOKEN_MAX_LENGTH = Math.max(
  512,
  Number(process.env.TOKEN_MAX_LENGTH || 4096)
);
const TOKEN_MAX_CLOCK_SKEW_SEC = Math.max(
  30,
  Number(process.env.TOKEN_MAX_CLOCK_SKEW_SEC || 120)
);
const TOKEN_MAX_FUTURE_EXP_SEC = Math.max(
  24 * 60 * 60,
  Number(process.env.TOKEN_MAX_FUTURE_EXP_SEC || 45 * 24 * 60 * 60)
);
const TOKEN_MAX_FUTURE_NBF_SEC = Math.max(
  120,
  Number(process.env.TOKEN_MAX_FUTURE_NBF_SEC || 10 * 60)
);
const TOKEN_REPLAY_WINDOW_MS = Math.max(
  10 * 60 * 1000,
  Number(process.env.TOKEN_REPLAY_WINDOW_MS || 30 * 60 * 1000)
);
const TOKEN_REPLAY_EVENT_THRESHOLD = Math.max(
  4,
  Number(process.env.TOKEN_REPLAY_EVENT_THRESHOLD || 8)
);
const TOKEN_REPLAY_DISTINCT_FINGERPRINT_THRESHOLD = Math.max(
  2,
  Number(process.env.TOKEN_REPLAY_DISTINCT_FINGERPRINT_THRESHOLD || 3)
);
const TOKEN_REPLAY_DISTINCT_IP_THRESHOLD = Math.max(
  2,
  Number(process.env.TOKEN_REPLAY_DISTINCT_IP_THRESHOLD || 3)
);
const TOKEN_INTEL_MAX_ITEMS = Math.max(
  200,
  Number(process.env.TOKEN_INTEL_MAX_ITEMS || 6000)
);
const SUBJECT_INTEL_WINDOW_MS = Math.max(
  10 * 60 * 1000,
  Number(process.env.SUBJECT_INTEL_WINDOW_MS || 30 * 60 * 1000)
);
const SUBJECT_INTEL_EVENT_THRESHOLD = Math.max(
  4,
  Number(process.env.SUBJECT_INTEL_EVENT_THRESHOLD || 8)
);
const SUBJECT_INTEL_DISTINCT_FINGERPRINT_THRESHOLD = Math.max(
  2,
  Number(process.env.SUBJECT_INTEL_DISTINCT_FINGERPRINT_THRESHOLD || 3)
);
const SUBJECT_INTEL_DISTINCT_IP_THRESHOLD = Math.max(
  2,
  Number(process.env.SUBJECT_INTEL_DISTINCT_IP_THRESHOLD || 3)
);
const SUBJECT_INTEL_MAX_ITEMS = Math.max(
  200,
  Number(process.env.SUBJECT_INTEL_MAX_ITEMS || 6000)
);
const AUTO_PROMOTE_STORAGE_WINDOW_MS = Math.max(
  60 * 60 * 1000,
  Number(process.env.AUTO_PROMOTE_STORAGE_WINDOW_MS || 24 * 60 * 60 * 1000)
);
const AUTO_PROMOTE_INTEL_MAX_ITEMS = Math.max(
  200,
  Number(process.env.AUTO_PROMOTE_INTEL_MAX_ITEMS || 8000)
);
const AUTO_PROMOTION_EVENT_MAX_ITEMS = Math.max(
  50,
  Number(process.env.AUTO_PROMOTION_EVENT_MAX_ITEMS || 500)
);
const AUTO_ESCALATION_EVENT_MAX_ITEMS = Math.max(
  20,
  Number(process.env.AUTO_ESCALATION_EVENT_MAX_ITEMS || 200)
);
const CRITICAL_RESPONSE_EVENT_MAX_ITEMS = Math.max(
  20,
  Number(process.env.CRITICAL_RESPONSE_EVENT_MAX_ITEMS || 200)
);
const CAMPAIGN_RESPONSE_EVENT_MAX_ITEMS = Math.max(
  20,
  Number(process.env.CAMPAIGN_RESPONSE_EVENT_MAX_ITEMS || 200)
);
const AUTH_FAILURE_TELEMETRY_MAX_ITEMS = Math.max(
  200,
  Number(process.env.AUTH_FAILURE_TELEMETRY_MAX_ITEMS || 8000)
);
const AUTH_SHIELD_EVENT_MAX_ITEMS = Math.max(
  20,
  Number(process.env.AUTH_SHIELD_EVENT_MAX_ITEMS || 250)
);
const PROTECTED_AUTH_IDENTITIES_MAX_ITEMS = Math.max(
  50,
  Number(process.env.PROTECTED_AUTH_IDENTITIES_MAX_ITEMS || 3000)
);
const IDENTITY_PROTECTION_EVENT_MAX_ITEMS = Math.max(
  20,
  Number(process.env.IDENTITY_PROTECTION_EVENT_MAX_ITEMS || 500)
);
const PROTECTED_TOKEN_SUBJECTS_MAX_ITEMS = Math.max(
  50,
  Number(process.env.PROTECTED_TOKEN_SUBJECTS_MAX_ITEMS || 3000)
);
const SUBJECT_PROTECTION_EVENT_MAX_ITEMS = Math.max(
  20,
  Number(process.env.SUBJECT_PROTECTION_EVENT_MAX_ITEMS || 500)
);
const SUBJECT_SESSION_STORAGE_WINDOW_MS = Math.max(
  60 * 60 * 1000,
  Number(process.env.SUBJECT_SESSION_STORAGE_WINDOW_MS || 24 * 60 * 60 * 1000)
);
const SUBJECT_SESSION_INTEL_MAX_ITEMS = Math.max(
  200,
  Number(process.env.SUBJECT_SESSION_INTEL_MAX_ITEMS || 6000)
);
const SUBJECT_SESSION_SHIELD_EVENT_MAX_ITEMS = Math.max(
  20,
  Number(process.env.SUBJECT_SESSION_SHIELD_EVENT_MAX_ITEMS || 500)
);
const SUBJECT_NETWORK_SHIELD_EVENT_MAX_ITEMS = Math.max(
  20,
  Number(process.env.SUBJECT_NETWORK_SHIELD_EVENT_MAX_ITEMS || 500)
);
const ADMIN_MUTATION_ATTEMPT_MAX_ITEMS = Math.max(
  200,
  Number(process.env.ADMIN_MUTATION_ATTEMPT_MAX_ITEMS || 8000)
);
const ADMIN_MUTATION_SHIELD_EVENT_MAX_ITEMS = Math.max(
  20,
  Number(process.env.ADMIN_MUTATION_SHIELD_EVENT_MAX_ITEMS || 500)
);
const ADMIN_MUTATION_SIGNATURE_NONCE_MAX_ITEMS = Math.max(
  200,
  Number(process.env.ADMIN_MUTATION_SIGNATURE_NONCE_MAX_ITEMS || 10000)
);
const ADMIN_MUTATION_SIGNATURE_CLOCK_SKEW_SEC = Math.max(
  15,
  Number(process.env.ADMIN_MUTATION_SIGNATURE_CLOCK_SKEW_SEC || 300)
);
const ADMIN_MUTATION_SIGNATURE_NONCE_TTL_MS = Math.max(
  60_000,
  Number(process.env.ADMIN_MUTATION_SIGNATURE_NONCE_TTL_SEC || 900) * 1000
);
const CRITICAL_THREAT_PATTERNS = [
  /token-alg-none/i,
  /token-header-injection-pattern/i,
  /header-smuggling/i,
  /firewall-scanner-path/i,
  /sql-injection-pattern/i,
  /command-injection-pattern/i,
  /xss-pattern/i,
  /path-traversal-pattern/i,
  /ssti-pattern/i,
  /token-replay-suspected/i,
  /subject-takeover-suspected/i,
  /manual-admin-quarantine/i
];
const API_ADMIN_ACTION_KEY = text(process.env.ADMIN_ACTION_KEY);
const API_ADMIN_ACTION_KEY_ENFORCED =
  text(process.env.ADMIN_ACTION_KEY_REQUIRED, "false").toLowerCase() === "true";
const ADMIN_MUTATION_SIGNATURE_SECRET = text(process.env.ADMIN_MUTATION_SIGNATURE_SECRET);
const API_ADMIN_MUTATION_SIGNATURE_REQUIRED =
  text(process.env.ADMIN_MUTATION_SIGNATURE_REQUIRED, "false").toLowerCase() === "true";
const API_ADMIN_MUTATION_SIGNATURE_BOOT_ENFORCED =
  API_ADMIN_MUTATION_SIGNATURE_REQUIRED && Boolean(ADMIN_MUTATION_SIGNATURE_SECRET);
const API_ADMIN_ALLOWLIST_IPS = text(process.env.ADMIN_IP_ALLOWLIST)
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const SUSPICIOUS_KEY_RULES = [/^\$/, /__proto__/i, /^constructor$/i, /^prototype$/i];
const ADMIN_SIGNATURE_NONCE_PATTERN = /^[a-zA-Z0-9._:-]{16,180}$/;
const NULL_BYTE_PATTERN = /\0/;
const SUSPICIOUS_USER_AGENT_PATTERNS = [
  /sqlmap/i,
  /nikto/i,
  /acunetix/i,
  /nmap/i,
  /masscan/i,
  /w3af/i,
  /havij/i,
  /python-requests\/\d+/i,
  /curl\/\d+/i,
  /wget\/\d+/i
];
const HONEYPOT_FIELD_NAMES = [
  "website",
  "url",
  "homepage",
  "honeypot",
  "contact_time",
  "middle_name",
  "fax_number",
  "bot_field",
  "hp_token"
];
const ALLOWED_API_CONTENT_TYPES = [
  "application/json",
  "application/x-www-form-urlencoded",
  "multipart/form-data"
];
const THREAT_DETECTION_RULES = [
  {
    id: "sql-injection-pattern",
    score: 55,
    pattern: /\b(?:union\s+select|drop\s+table|insert\s+into|delete\s+from|or\s+1\s*=\s*1|sleep\s*\(|benchmark\s*\()/i
  },
  {
    id: "xss-pattern",
    score: 50,
    pattern: /(?:<script\b|javascript:|onerror\s*=|onload\s*=|<img[^>]+onerror=)/i
  },
  {
    id: "command-injection-pattern",
    score: 60,
    pattern: /(?:\|\||&&|;)\s*(?:curl|wget|bash|sh|powershell|cmd|nc|python)\b/i
  },
  {
    id: "path-traversal-pattern",
    score: 45,
    pattern: /(?:\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\\)/i
  },
  {
    id: "ssti-pattern",
    score: 35,
    pattern: /(?:\{\{.*\}\}|\$\{.*\}|<%=?\s*.*\s*%>)/i
  }
];
const SENSITIVE_PUBLIC_PATH_RULES = [
  /^\/(?:server|backend|database|deploy|docs|scripts|models|legal)(?:\/|$)/i,
  /^\/(?:\.git|\.github|\.vscode|node_modules)(?:\/|$)/i,
  /^\/(?:.*\/)?\.env(?:\..*)?$/i,
  /^\/(?:.*\/)?package-lock\.json$/i,
  /^\/(?:.*\/)?pnpm-lock\.ya?ml$/i,
  /^\/(?:.*\/)?yarn\.lock$/i,
  /^\/database\/.*\.json$/i,
  /^\/server\/.*\.(?:js|mjs|cjs|map)$/i,
  /^\/backend\/.*\.(?:js|mjs|cjs|map)$/i
];
const THREAT_DETECTION_EXCLUDED_PATHS = [
  /^\/api\/health(?:\/|$)/i,
  /^\/api\/v2\/health(?:\/|$)/i,
  /^\/api\/v3\/health(?:\/|$)/i,
  /^\/api\/system\/security-intelligence(?:\/|$)/i,
  /^\/api\/v3\/system\/security-intelligence(?:\/|$)/i,
  /^\/api\/system\/security-control(?:\/|$)/i,
  /^\/api\/v3\/system\/security-control(?:\/|$)/i
];
const API_SCANNER_PATH_RULES = [
  /^\/api\/(?:wp-admin|wp-login|wordpress)(?:\/|$)/i,
  /^\/api\/(?:phpmyadmin|pma|mysql-admin)(?:\/|$)/i,
  /^\/api\/(?:\.env|config\.php|web\.config)(?:\/|$)/i,
  /^\/api\/(?:vendor\/phpunit|cgi-bin|boaform|actuator|jenkins|hudson)(?:\/|$)/i,
  /^\/api\/(?:server-status|debug\/pprof|_ignition|_profiler)(?:\/|$)/i
];
const API_METHOD_OVERRIDE_HEADERS = [
  "x-http-method-override",
  "x-method-override",
  "x-original-url",
  "x-rewrite-url"
];
const FAKE_LISTING_RISK_PHRASES = [
  "urgent sale",
  "token now",
  "advance first",
  "cash only",
  "deal today",
  "final today",
  "owner abroad",
  "no visit required",
  "dm for payment",
  "booking amount now"
];
const FAKE_LISTING_HIGH_RISK_PHRASES = [
  "send otp",
  "send token amount",
  "pay before visit",
  "wire transfer",
  "crypto payment",
  "security code share"
];
const DIRECT_CONTACT_PATTERNS = [
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /\+?\d[\d\s\-()]{8,}\d/,
  /\b(?:whatsapp|wa\.me|telegram|t\.me)\b/i
];
const SUSPICIOUS_LINK_PATTERN =
  /\b(?:bit\.ly|tinyurl\.com|rb\.gy|is\.gd|cutt\.ly|rebrand\.ly|t\.me|wa\.me)\b/i;
const ADMIN_MUTATION_PATH_RULES = [
  /^\/api\/system\/security-intelligence\/(?:release|quarantine)(?:\/|$)/i,
  /^\/api\/v3\/system\/security-intelligence\/(?:release|quarantine)(?:\/|$)/i,
  /^\/api\/system\/security-control(?:\/|$)/i,
  /^\/api\/v3\/system\/security-control(?:\/|$)/i,
  /^\/api\/sealed-bids\/decision(?:\/|$)/i,
  /^\/api\/v3\/sealed-bids\/decision(?:\/|$)/i,
  /^\/api\/admin(?:\/|$)/i,
  /^\/api\/v3\/admin(?:\/|$)/i,
  /^\/api\/export(?:\/|$)/i
];
const SECURITY_CONTROL_PATH_RULES = [
  /^\/api\/system\/security-control(?:\/|$)/i,
  /^\/api\/v3\/system\/security-control(?:\/|$)/i
];
const READ_ONLY_BYPASS_PATH_RULES = [
  /^\/api\/auth(?:\/|$)/i,
  /^\/api\/v3\/auth(?:\/|$)/i,
  /^\/api\/health(?:\/|$)/i,
  /^\/api\/v2\/health(?:\/|$)/i,
  /^\/api\/v3\/health(?:\/|$)/i,
  /^\/api\/system\/security-control(?:\/|$)/i,
  /^\/api\/v3\/system\/security-control(?:\/|$)/i,
  /^\/api\/system\/security-intelligence(?:\/|$)/i,
  /^\/api\/v3\/system\/security-intelligence(?:\/|$)/i
];
const AUTH_ENDPOINT_PATH_RULES = [
  /^\/api\/auth(?:\/|$)/i,
  /^\/api\/v3\/auth(?:\/|$)/i
];
const MAX_TRUSTED_FINGERPRINTS = Math.max(
  20,
  Number(process.env.MAX_TRUSTED_FINGERPRINTS || 200)
);
const MAX_BLOCKED_IP_ITEMS = Math.max(
  20,
  Number(process.env.MAX_BLOCKED_IP_ITEMS || 500)
);
const MAX_BLOCKED_FINGERPRINT_ITEMS = Math.max(
  20,
  Number(process.env.MAX_BLOCKED_FINGERPRINT_ITEMS || 400)
);
const MAX_BLOCKED_USER_AGENT_ITEMS = Math.max(
  20,
  Number(process.env.MAX_BLOCKED_USER_AGENT_ITEMS || 300)
);
const MAX_BLOCKED_TOKEN_SUBJECT_ITEMS = Math.max(
  20,
  Number(process.env.MAX_BLOCKED_TOKEN_SUBJECT_ITEMS || 500)
);
const SECURITY_CONTROL_PROFILE_DEFS = Object.freeze({
  balanced: {
    id: "balanced",
    label: "Balanced",
    description: "Normal production mode with strong defaults.",
    patch: {
      mode: "balanced",
      modules: {
        requestFirewall: true,
        tokenFirewall: true,
        aiThreatDetector: true,
        fakeListingAi: true,
        authFailureIntelligence: true,
        autoQuarantine: true,
        strictAdminMutationGuard: true
      },
      thresholds: {
        threatAlert: 35,
        threatBlock: 120,
        fakeListingAlert: 48,
        fakeListingBlock: 84,
        auth401: 18,
        auth403: 10,
        tokenReplayEvents: 8,
        tokenReplayDistinctFingerprints: 3,
        tokenReplayDistinctIps: 3,
        subjectReplayEvents: 8,
        subjectReplayDistinctFingerprints: 3,
        subjectReplayDistinctIps: 3,
        autoPromoteWindowMinutes: 120,
        autoPromoteFingerprintEvents: 12,
        autoPromoteIpEvents: 15,
        autoPromoteSubjectEvents: 8,
        autoPromoteBlockedEvents: 3,
        autoEscalationWindowMinutes: 60,
        autoEscalationCooldownMinutes: 20,
        autoEscalateToHardenedEvents: 20,
        autoEscalateToLockdownEvents: 40,
        autoEscalateBlockedEvents: 8,
        autoDeEscalationWindowMinutes: 180,
        autoDeEscalationCooldownMinutes: 30,
        autoDeEscalateToHardenedMaxEvents: 12,
        autoDeEscalateToBalancedMaxEvents: 4,
        autoDeEscalateBlockedMaxEvents: 1,
        criticalLockdownCooldownMinutes: 10,
        campaignWindowMinutes: 45,
        campaignIncidentThreshold: 35,
        campaignDistinctFingerprintThreshold: 8,
        campaignDistinctIpThreshold: 6,
        campaignBlockedThreshold: 10,
        campaignCooldownMinutes: 15,
        authStormWindowMinutes: 20,
        authStormFailureThreshold: 55,
        authStormDistinctFingerprints: 10,
        authStormDistinctIps: 8,
        authStormDistinctIdentities: 24,
        authStormShieldDurationMinutes: 15,
        authStormCooldownMinutes: 10,
        identityProtectionWindowMinutes: 45,
        identityProtectionFailureThreshold: 22,
        identityProtectionDistinctFingerprints: 6,
        identityProtectionDistinctIps: 6,
        identityProtectionDurationMinutes: 30,
        identityProtectionCooldownMinutes: 10,
        subjectProtectionWindowMinutes: 45,
        subjectProtectionIncidentThreshold: 8,
        subjectProtectionDistinctFingerprints: 4,
        subjectProtectionDistinctIps: 4,
        subjectProtectionDurationMinutes: 30,
        subjectProtectionCooldownMinutes: 10,
        subjectSessionWindowMinutes: 60,
        subjectSessionEventThreshold: 10,
        subjectSessionDistinctTokenKeys: 5,
        subjectSessionDistinctFingerprints: 4,
        subjectSessionDistinctIps: 4,
        subjectSessionShieldDurationMinutes: 45,
        subjectSessionCooldownMinutes: 10,
        subjectNetworkWindowMinutes: 45,
        subjectNetworkEventThreshold: 8,
        subjectNetworkDistinctPrefixes: 4,
        subjectNetworkJumpThreshold: 3,
        subjectNetworkShieldDurationMinutes: 60,
        subjectNetworkCooldownMinutes: 10,
        adminMutationWindowMinutes: 30,
        adminMutationAttemptThreshold: 8,
        adminMutationDistinctFingerprints: 4,
        adminMutationDistinctIps: 3,
        adminMutationShieldDurationMinutes: 30,
        adminMutationCooldownMinutes: 10
      },
      adminControls: {
        actionKeyEnforced: API_ADMIN_ACTION_KEY_ENFORCED,
        adminMutationSignatureEnforced: API_ADMIN_MUTATION_SIGNATURE_BOOT_ENFORCED,
        readOnlyApi: false,
        autoPromoteBlocklists: true,
        autoEscalateMode: true,
        autoDeEscalateMode: true,
        autoCriticalResponse: true,
        autoCriticalLockdown: true,
        autoCriticalImmediateBlocklist: true,
        autoCampaignLockdown: true,
        autoAuthStormShield: true,
        autoIdentityProtection: true,
        autoSubjectProtection: true,
        autoSubjectSessionShield: true,
        autoSubjectNetworkShield: true,
        autoAdminMutationShield: true
      }
    }
  },
  hardened: {
    id: "hardened",
    label: "Hardened",
    description: "Stricter AI thresholds and tighter incident controls.",
    patch: {
      mode: "hardened",
      modules: {
        requestFirewall: true,
        tokenFirewall: true,
        aiThreatDetector: true,
        fakeListingAi: true,
        authFailureIntelligence: true,
        autoQuarantine: true,
        strictAdminMutationGuard: true
      },
      thresholds: {
        threatAlert: 28,
        threatBlock: 90,
        fakeListingAlert: 40,
        fakeListingBlock: 72,
        auth401: 12,
        auth403: 7,
        tokenReplayEvents: 6,
        tokenReplayDistinctFingerprints: 2,
        tokenReplayDistinctIps: 2,
        subjectReplayEvents: 6,
        subjectReplayDistinctFingerprints: 2,
        subjectReplayDistinctIps: 2,
        autoPromoteWindowMinutes: 120,
        autoPromoteFingerprintEvents: 9,
        autoPromoteIpEvents: 12,
        autoPromoteSubjectEvents: 6,
        autoPromoteBlockedEvents: 2,
        autoEscalationWindowMinutes: 45,
        autoEscalationCooldownMinutes: 20,
        autoEscalateToHardenedEvents: 16,
        autoEscalateToLockdownEvents: 28,
        autoEscalateBlockedEvents: 6,
        autoDeEscalationWindowMinutes: 120,
        autoDeEscalationCooldownMinutes: 30,
        autoDeEscalateToHardenedMaxEvents: 8,
        autoDeEscalateToBalancedMaxEvents: 3,
        autoDeEscalateBlockedMaxEvents: 1,
        criticalLockdownCooldownMinutes: 8,
        campaignWindowMinutes: 35,
        campaignIncidentThreshold: 25,
        campaignDistinctFingerprintThreshold: 6,
        campaignDistinctIpThreshold: 5,
        campaignBlockedThreshold: 8,
        campaignCooldownMinutes: 10,
        authStormWindowMinutes: 15,
        authStormFailureThreshold: 40,
        authStormDistinctFingerprints: 8,
        authStormDistinctIps: 6,
        authStormDistinctIdentities: 16,
        authStormShieldDurationMinutes: 20,
        authStormCooldownMinutes: 10,
        identityProtectionWindowMinutes: 35,
        identityProtectionFailureThreshold: 16,
        identityProtectionDistinctFingerprints: 5,
        identityProtectionDistinctIps: 5,
        identityProtectionDurationMinutes: 45,
        identityProtectionCooldownMinutes: 10,
        subjectProtectionWindowMinutes: 35,
        subjectProtectionIncidentThreshold: 6,
        subjectProtectionDistinctFingerprints: 3,
        subjectProtectionDistinctIps: 3,
        subjectProtectionDurationMinutes: 45,
        subjectProtectionCooldownMinutes: 10,
        subjectSessionWindowMinutes: 45,
        subjectSessionEventThreshold: 8,
        subjectSessionDistinctTokenKeys: 4,
        subjectSessionDistinctFingerprints: 3,
        subjectSessionDistinctIps: 3,
        subjectSessionShieldDurationMinutes: 60,
        subjectSessionCooldownMinutes: 10,
        subjectNetworkWindowMinutes: 35,
        subjectNetworkEventThreshold: 6,
        subjectNetworkDistinctPrefixes: 3,
        subjectNetworkJumpThreshold: 2,
        subjectNetworkShieldDurationMinutes: 75,
        subjectNetworkCooldownMinutes: 10,
        adminMutationWindowMinutes: 20,
        adminMutationAttemptThreshold: 6,
        adminMutationDistinctFingerprints: 3,
        adminMutationDistinctIps: 3,
        adminMutationShieldDurationMinutes: 45,
        adminMutationCooldownMinutes: 10
      },
      adminControls: {
        actionKeyEnforced: true,
        adminMutationSignatureEnforced: true,
        readOnlyApi: false,
        autoPromoteBlocklists: true,
        autoEscalateMode: true,
        autoDeEscalateMode: true,
        autoCriticalResponse: true,
        autoCriticalLockdown: true,
        autoCriticalImmediateBlocklist: true,
        autoCampaignLockdown: true,
        autoAuthStormShield: true,
        autoIdentityProtection: true,
        autoSubjectProtection: true,
        autoSubjectSessionShield: true,
        autoSubjectNetworkShield: true,
        autoAdminMutationShield: true
      }
    }
  },
  lockdown: {
    id: "lockdown",
    label: "Lockdown",
    description: "Emergency mode: write APIs blocked unless admin action key bypass is provided.",
    patch: {
      mode: "lockdown",
      modules: {
        requestFirewall: true,
        tokenFirewall: true,
        aiThreatDetector: true,
        fakeListingAi: true,
        authFailureIntelligence: true,
        autoQuarantine: true,
        strictAdminMutationGuard: true
      },
      thresholds: {
        threatAlert: 20,
        threatBlock: 65,
        fakeListingAlert: 34,
        fakeListingBlock: 60,
        auth401: 8,
        auth403: 5,
        tokenReplayEvents: 4,
        tokenReplayDistinctFingerprints: 2,
        tokenReplayDistinctIps: 2,
        subjectReplayEvents: 4,
        subjectReplayDistinctFingerprints: 2,
        subjectReplayDistinctIps: 2,
        autoPromoteWindowMinutes: 180,
        autoPromoteFingerprintEvents: 6,
        autoPromoteIpEvents: 8,
        autoPromoteSubjectEvents: 4,
        autoPromoteBlockedEvents: 1,
        autoEscalationWindowMinutes: 30,
        autoEscalationCooldownMinutes: 20,
        autoEscalateToHardenedEvents: 10,
        autoEscalateToLockdownEvents: 18,
        autoEscalateBlockedEvents: 4,
        autoDeEscalationWindowMinutes: 90,
        autoDeEscalationCooldownMinutes: 20,
        autoDeEscalateToHardenedMaxEvents: 6,
        autoDeEscalateToBalancedMaxEvents: 2,
        autoDeEscalateBlockedMaxEvents: 1,
        criticalLockdownCooldownMinutes: 5,
        campaignWindowMinutes: 25,
        campaignIncidentThreshold: 18,
        campaignDistinctFingerprintThreshold: 4,
        campaignDistinctIpThreshold: 3,
        campaignBlockedThreshold: 5,
        campaignCooldownMinutes: 8,
        authStormWindowMinutes: 10,
        authStormFailureThreshold: 28,
        authStormDistinctFingerprints: 6,
        authStormDistinctIps: 4,
        authStormDistinctIdentities: 10,
        authStormShieldDurationMinutes: 30,
        authStormCooldownMinutes: 8,
        identityProtectionWindowMinutes: 25,
        identityProtectionFailureThreshold: 10,
        identityProtectionDistinctFingerprints: 4,
        identityProtectionDistinctIps: 4,
        identityProtectionDurationMinutes: 60,
        identityProtectionCooldownMinutes: 8,
        subjectProtectionWindowMinutes: 25,
        subjectProtectionIncidentThreshold: 4,
        subjectProtectionDistinctFingerprints: 2,
        subjectProtectionDistinctIps: 2,
        subjectProtectionDurationMinutes: 60,
        subjectProtectionCooldownMinutes: 8,
        subjectSessionWindowMinutes: 30,
        subjectSessionEventThreshold: 6,
        subjectSessionDistinctTokenKeys: 3,
        subjectSessionDistinctFingerprints: 2,
        subjectSessionDistinctIps: 2,
        subjectSessionShieldDurationMinutes: 90,
        subjectSessionCooldownMinutes: 8,
        subjectNetworkWindowMinutes: 25,
        subjectNetworkEventThreshold: 4,
        subjectNetworkDistinctPrefixes: 2,
        subjectNetworkJumpThreshold: 1,
        subjectNetworkShieldDurationMinutes: 120,
        subjectNetworkCooldownMinutes: 8,
        adminMutationWindowMinutes: 15,
        adminMutationAttemptThreshold: 4,
        adminMutationDistinctFingerprints: 2,
        adminMutationDistinctIps: 2,
        adminMutationShieldDurationMinutes: 60,
        adminMutationCooldownMinutes: 8
      },
      adminControls: {
        actionKeyEnforced: true,
        adminMutationSignatureEnforced: true,
        readOnlyApi: true,
        autoPromoteBlocklists: true,
        autoEscalateMode: true,
        autoDeEscalateMode: true,
        autoCriticalResponse: true,
        autoCriticalLockdown: true,
        autoCriticalImmediateBlocklist: true,
        autoCampaignLockdown: true,
        autoAuthStormShield: true,
        autoIdentityProtection: true,
        autoSubjectProtection: true,
        autoSubjectSessionShield: true,
        autoSubjectNetworkShield: true,
        autoAdminMutationShield: true
      }
    }
  }
});

const DEFAULT_PRO_SECURITY_CONTROL_STATE = Object.freeze({
  mode: "balanced",
  modules: {
    requestFirewall: true,
    tokenFirewall: TOKEN_FIREWALL_ENABLED,
    aiThreatDetector: SECURITY_AI_AUTO_DETECT_ENABLED,
    fakeListingAi: FAKE_LISTING_AI_ENABLED,
    authFailureIntelligence: true,
    autoQuarantine: true,
    strictAdminMutationGuard: true
  },
  thresholds: {
    threatAlert: THREAT_SCORE_ALERT_THRESHOLD,
    threatBlock: THREAT_SCORE_BLOCK_THRESHOLD,
    fakeListingAlert: FAKE_LISTING_ALERT_THRESHOLD,
    fakeListingBlock: FAKE_LISTING_BLOCK_THRESHOLD,
    auth401: AUTH_FAILURE_401_THRESHOLD,
    auth403: AUTH_FAILURE_403_THRESHOLD,
    tokenReplayEvents: TOKEN_REPLAY_EVENT_THRESHOLD,
    tokenReplayDistinctFingerprints: TOKEN_REPLAY_DISTINCT_FINGERPRINT_THRESHOLD,
    tokenReplayDistinctIps: TOKEN_REPLAY_DISTINCT_IP_THRESHOLD,
    subjectReplayEvents: SUBJECT_INTEL_EVENT_THRESHOLD,
    subjectReplayDistinctFingerprints: SUBJECT_INTEL_DISTINCT_FINGERPRINT_THRESHOLD,
    subjectReplayDistinctIps: SUBJECT_INTEL_DISTINCT_IP_THRESHOLD,
    autoPromoteWindowMinutes: Math.max(
      30,
      Number(process.env.AUTO_PROMOTE_WINDOW_MINUTES || 120)
    ),
    autoPromoteFingerprintEvents: Math.max(
      3,
      Number(process.env.AUTO_PROMOTE_FINGERPRINT_EVENTS || 12)
    ),
    autoPromoteIpEvents: Math.max(
      3,
      Number(process.env.AUTO_PROMOTE_IP_EVENTS || 15)
    ),
    autoPromoteSubjectEvents: Math.max(
      3,
      Number(process.env.AUTO_PROMOTE_SUBJECT_EVENTS || 8)
    ),
    autoPromoteBlockedEvents: Math.max(
      1,
      Number(process.env.AUTO_PROMOTE_BLOCKED_EVENTS || 3)
    ),
    autoEscalationWindowMinutes: Math.max(
      15,
      Number(process.env.AUTO_ESCALATION_WINDOW_MINUTES || 60)
    ),
    autoEscalationCooldownMinutes: Math.max(
      5,
      Number(process.env.AUTO_ESCALATION_COOLDOWN_MINUTES || 20)
    ),
    autoEscalateToHardenedEvents: Math.max(
      5,
      Number(process.env.AUTO_ESCALATE_TO_HARDENED_EVENTS || 20)
    ),
    autoEscalateToLockdownEvents: Math.max(
      10,
      Number(process.env.AUTO_ESCALATE_TO_LOCKDOWN_EVENTS || 40)
    ),
    autoEscalateBlockedEvents: Math.max(
      1,
      Number(process.env.AUTO_ESCALATE_BLOCKED_EVENTS || 8)
    ),
    autoDeEscalationWindowMinutes: Math.max(
      30,
      Number(process.env.AUTO_DE_ESCALATION_WINDOW_MINUTES || 180)
    ),
    autoDeEscalationCooldownMinutes: Math.max(
      5,
      Number(process.env.AUTO_DE_ESCALATION_COOLDOWN_MINUTES || 30)
    ),
    autoDeEscalateToHardenedMaxEvents: Math.max(
      1,
      Number(process.env.AUTO_DE_ESCALATE_TO_HARDENED_MAX_EVENTS || 12)
    ),
    autoDeEscalateToBalancedMaxEvents: Math.max(
      1,
      Number(process.env.AUTO_DE_ESCALATE_TO_BALANCED_MAX_EVENTS || 4)
    ),
    autoDeEscalateBlockedMaxEvents: Math.max(
      0,
      Number(process.env.AUTO_DE_ESCALATE_BLOCKED_MAX_EVENTS || 1)
    ),
    criticalLockdownCooldownMinutes: Math.max(
      1,
      Number(process.env.CRITICAL_LOCKDOWN_COOLDOWN_MINUTES || 10)
    ),
    campaignWindowMinutes: Math.max(
      10,
      Number(process.env.CAMPAIGN_WINDOW_MINUTES || 45)
    ),
    campaignIncidentThreshold: Math.max(
      5,
      Number(process.env.CAMPAIGN_INCIDENT_THRESHOLD || 35)
    ),
    campaignDistinctFingerprintThreshold: Math.max(
      2,
      Number(process.env.CAMPAIGN_DISTINCT_FINGERPRINT_THRESHOLD || 8)
    ),
    campaignDistinctIpThreshold: Math.max(
      2,
      Number(process.env.CAMPAIGN_DISTINCT_IP_THRESHOLD || 6)
    ),
    campaignBlockedThreshold: Math.max(
      1,
      Number(process.env.CAMPAIGN_BLOCKED_THRESHOLD || 10)
    ),
    campaignCooldownMinutes: Math.max(
      1,
      Number(process.env.CAMPAIGN_COOLDOWN_MINUTES || 15)
    ),
    authStormWindowMinutes: Math.max(
      5,
      Number(process.env.AUTH_STORM_WINDOW_MINUTES || 20)
    ),
    authStormFailureThreshold: Math.max(
      10,
      Number(process.env.AUTH_STORM_FAILURE_THRESHOLD || 55)
    ),
    authStormDistinctFingerprints: Math.max(
      2,
      Number(process.env.AUTH_STORM_DISTINCT_FINGERPRINTS || 10)
    ),
    authStormDistinctIps: Math.max(
      2,
      Number(process.env.AUTH_STORM_DISTINCT_IPS || 8)
    ),
    authStormDistinctIdentities: Math.max(
      2,
      Number(process.env.AUTH_STORM_DISTINCT_IDENTITIES || 24)
    ),
    authStormShieldDurationMinutes: Math.max(
      1,
      Number(process.env.AUTH_STORM_SHIELD_DURATION_MINUTES || 15)
    ),
    authStormCooldownMinutes: Math.max(
      1,
      Number(process.env.AUTH_STORM_COOLDOWN_MINUTES || 10)
    ),
    identityProtectionWindowMinutes: Math.max(
      5,
      Number(process.env.IDENTITY_PROTECTION_WINDOW_MINUTES || 45)
    ),
    identityProtectionFailureThreshold: Math.max(
      3,
      Number(process.env.IDENTITY_PROTECTION_FAILURE_THRESHOLD || 22)
    ),
    identityProtectionDistinctFingerprints: Math.max(
      2,
      Number(process.env.IDENTITY_PROTECTION_DISTINCT_FINGERPRINTS || 6)
    ),
    identityProtectionDistinctIps: Math.max(
      2,
      Number(process.env.IDENTITY_PROTECTION_DISTINCT_IPS || 6)
    ),
    identityProtectionDurationMinutes: Math.max(
      1,
      Number(process.env.IDENTITY_PROTECTION_DURATION_MINUTES || 30)
    ),
    identityProtectionCooldownMinutes: Math.max(
      1,
      Number(process.env.IDENTITY_PROTECTION_COOLDOWN_MINUTES || 10)
    ),
    subjectProtectionWindowMinutes: Math.max(
      5,
      Number(process.env.SUBJECT_PROTECTION_WINDOW_MINUTES || 45)
    ),
    subjectProtectionIncidentThreshold: Math.max(
      2,
      Number(process.env.SUBJECT_PROTECTION_INCIDENT_THRESHOLD || 8)
    ),
    subjectProtectionDistinctFingerprints: Math.max(
      2,
      Number(process.env.SUBJECT_PROTECTION_DISTINCT_FINGERPRINTS || 4)
    ),
    subjectProtectionDistinctIps: Math.max(
      2,
      Number(process.env.SUBJECT_PROTECTION_DISTINCT_IPS || 4)
    ),
    subjectProtectionDurationMinutes: Math.max(
      1,
      Number(process.env.SUBJECT_PROTECTION_DURATION_MINUTES || 30)
    ),
    subjectProtectionCooldownMinutes: Math.max(
      1,
      Number(process.env.SUBJECT_PROTECTION_COOLDOWN_MINUTES || 10)
    ),
    subjectSessionWindowMinutes: Math.max(
      5,
      Number(process.env.SUBJECT_SESSION_WINDOW_MINUTES || 60)
    ),
    subjectSessionEventThreshold: Math.max(
      2,
      Number(process.env.SUBJECT_SESSION_EVENT_THRESHOLD || 10)
    ),
    subjectSessionDistinctTokenKeys: Math.max(
      2,
      Number(process.env.SUBJECT_SESSION_DISTINCT_TOKEN_KEYS || 5)
    ),
    subjectSessionDistinctFingerprints: Math.max(
      2,
      Number(process.env.SUBJECT_SESSION_DISTINCT_FINGERPRINTS || 4)
    ),
    subjectSessionDistinctIps: Math.max(
      2,
      Number(process.env.SUBJECT_SESSION_DISTINCT_IPS || 4)
    ),
    subjectSessionShieldDurationMinutes: Math.max(
      1,
      Number(process.env.SUBJECT_SESSION_SHIELD_DURATION_MINUTES || 45)
    ),
    subjectSessionCooldownMinutes: Math.max(
      1,
      Number(process.env.SUBJECT_SESSION_COOLDOWN_MINUTES || 10)
    ),
    subjectNetworkWindowMinutes: Math.max(
      5,
      Number(process.env.SUBJECT_NETWORK_WINDOW_MINUTES || 45)
    ),
    subjectNetworkEventThreshold: Math.max(
      2,
      Number(process.env.SUBJECT_NETWORK_EVENT_THRESHOLD || 8)
    ),
    subjectNetworkDistinctPrefixes: Math.max(
      2,
      Number(process.env.SUBJECT_NETWORK_DISTINCT_PREFIXES || 4)
    ),
    subjectNetworkJumpThreshold: Math.max(
      1,
      Number(process.env.SUBJECT_NETWORK_JUMP_THRESHOLD || 3)
    ),
    subjectNetworkShieldDurationMinutes: Math.max(
      1,
      Number(process.env.SUBJECT_NETWORK_SHIELD_DURATION_MINUTES || 60)
    ),
    subjectNetworkCooldownMinutes: Math.max(
      1,
      Number(process.env.SUBJECT_NETWORK_COOLDOWN_MINUTES || 10)
    ),
    adminMutationWindowMinutes: Math.max(
      5,
      Number(process.env.ADMIN_MUTATION_WINDOW_MINUTES || 30)
    ),
    adminMutationAttemptThreshold: Math.max(
      2,
      Number(process.env.ADMIN_MUTATION_ATTEMPT_THRESHOLD || 8)
    ),
    adminMutationDistinctFingerprints: Math.max(
      2,
      Number(process.env.ADMIN_MUTATION_DISTINCT_FINGERPRINTS || 4)
    ),
    adminMutationDistinctIps: Math.max(
      2,
      Number(process.env.ADMIN_MUTATION_DISTINCT_IPS || 3)
    ),
    adminMutationShieldDurationMinutes: Math.max(
      1,
      Number(process.env.ADMIN_MUTATION_SHIELD_DURATION_MINUTES || 30)
    ),
    adminMutationCooldownMinutes: Math.max(
      1,
      Number(process.env.ADMIN_MUTATION_COOLDOWN_MINUTES || 10)
    )
  },
  adminControls: {
    actionKeyEnforced: API_ADMIN_ACTION_KEY_ENFORCED,
    adminMutationSignatureEnforced: API_ADMIN_MUTATION_SIGNATURE_BOOT_ENFORCED,
    readOnlyApi: false,
    autoPromoteBlocklists: true,
    autoEscalateMode: true,
    autoDeEscalateMode: true,
    autoCriticalResponse: true,
    autoCriticalLockdown: true,
    autoCriticalImmediateBlocklist: true,
    autoCampaignLockdown: true,
    autoAuthStormShield: true,
    autoIdentityProtection: true,
    autoSubjectProtection: true,
    autoSubjectSessionShield: true,
    autoSubjectNetworkShield: true,
    autoAdminMutationShield: true
  },
  lists: {
    blockedIps: [],
    blockedFingerprints: [],
    blockedUserAgentSignatures: [],
    blockedTokenSubjects: []
  },
  trustedFingerprints: [],
  meta: {
    updatedAt: "",
    updatedById: "",
    updatedByRole: "",
    revision: 1
  }
});

let proSecurityControlState = cloneSecurityControlState(DEFAULT_PRO_SECURITY_CONTROL_STATE);

function text(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toIntegerInRange(value, fallback, min, max) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  const normalized = text(value).toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return fallback;
}

function cloneSecurityControlState(value = {}) {
  return JSON.parse(JSON.stringify(value || {}));
}

function nowIso() {
  return new Date().toISOString();
}

function safeReadJson(filePath = "") {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
  const body = keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",");
  return `{${body}}`;
}

function buildSecurityControlSignatureInput(payload = {}) {
  const normalizedPayload = payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload
    : {};
  const version = Math.max(1, Number(normalizedPayload.version || 1));
  const persistedAt = text(normalizedPayload.persistedAt);
  const state = normalizedPayload.state && typeof normalizedPayload.state === "object" && !Array.isArray(normalizedPayload.state)
    ? normalizedPayload.state
    : {};
  return `${version}|${persistedAt}|${stableStringify(state)}`;
}

function computeSecurityControlStateSignature(payload = {}) {
  if (!SECURITY_CONTROL_STATE_SIGNING_KEY) return "";
  return crypto
    .createHmac("sha256", SECURITY_CONTROL_STATE_SIGNING_KEY)
    .update(buildSecurityControlSignatureInput(payload))
    .digest("hex");
}

function verifySecurityControlStatePayload(payload = {}) {
  const warnings = [];
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      valid: false,
      signed: false,
      warnings,
      reason: "invalid-payload",
      hasSigningKey: Boolean(SECURITY_CONTROL_STATE_SIGNING_KEY),
      signatureRequired: SECURITY_CONTROL_STATE_SIGNATURE_REQUIRED
    };
  }

  const integrity = payload.integrity && typeof payload.integrity === "object" && !Array.isArray(payload.integrity)
    ? payload.integrity
    : {};
  const signature = text(integrity.signature).toLowerCase();
  const hasSignature = Boolean(signature);
  const hasSigningKey = Boolean(SECURITY_CONTROL_STATE_SIGNING_KEY);

  if (!hasSignature) {
    if (SECURITY_CONTROL_STATE_SIGNATURE_REQUIRED) {
      return {
        valid: false,
        signed: false,
        warnings,
        reason: "missing-signature",
        hasSigningKey,
        signatureRequired: SECURITY_CONTROL_STATE_SIGNATURE_REQUIRED
      };
    }
    if (hasSigningKey) {
      warnings.push("Persisted security control state is unsigned.");
    }
    return {
      valid: true,
      signed: false,
      warnings,
      reason: hasSigningKey ? "unsigned-state-with-key" : "unsigned-state",
      hasSigningKey,
      signatureRequired: SECURITY_CONTROL_STATE_SIGNATURE_REQUIRED
    };
  }

  if (!/^[a-f0-9]{64}$/i.test(signature)) {
    return {
      valid: false,
      signed: true,
      warnings,
      reason: "invalid-signature-format",
      hasSigningKey,
      signatureRequired: SECURITY_CONTROL_STATE_SIGNATURE_REQUIRED
    };
  }

  if (!hasSigningKey) {
    if (SECURITY_CONTROL_STATE_SIGNATURE_REQUIRED) {
      return {
        valid: false,
        signed: true,
        warnings,
        reason: "signature-key-missing",
        hasSigningKey,
        signatureRequired: SECURITY_CONTROL_STATE_SIGNATURE_REQUIRED
      };
    }
    warnings.push("Persisted security control signature could not be verified because signing key is missing.");
    return {
      valid: true,
      signed: true,
      warnings,
      reason: "signature-unverified-no-key",
      hasSigningKey,
      signatureRequired: SECURITY_CONTROL_STATE_SIGNATURE_REQUIRED
    };
  }

  const expected = computeSecurityControlStateSignature(payload);
  if (!expected || !timingSafeEqualText(signature, expected)) {
    return {
      valid: false,
      signed: true,
      warnings,
      reason: "signature-mismatch",
      hasSigningKey,
      signatureRequired: SECURITY_CONTROL_STATE_SIGNATURE_REQUIRED
    };
  }

  return {
    valid: true,
    signed: true,
    warnings,
    reason: "signature-verified",
    hasSigningKey,
    signatureRequired: SECURITY_CONTROL_STATE_SIGNATURE_REQUIRED
  };
}

function persistSecurityControlStateToDisk(state = {}) {
  if (!SECURITY_CONTROL_STATE_PERSIST_ENABLED) {
    return {
      ok: false,
      skipped: true,
      reason: "disabled"
    };
  }

  try {
    const target = String(SECURITY_CONTROL_STATE_FILE || "").trim();
    if (!target) {
      return {
        ok: false,
        skipped: true,
        reason: "missing-path"
      };
    }
    const dir = path.dirname(target);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${target}.tmp`;
    const payload = {
      version: 1,
      persistedAt: nowIso(),
      state
    };
    const signature = computeSecurityControlStateSignature(payload);
    payload.integrity = {
      algo: signature ? "hmac-sha256" : "none",
      signature,
      signatureRequired: SECURITY_CONTROL_STATE_SIGNATURE_REQUIRED
    };
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8");
    fs.renameSync(tmp, target);
    return {
      ok: true,
      path: target,
      signed: Boolean(signature)
    };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      reason: String(error?.message || "persist-failed")
    };
  }
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function timingSafeEqualText(a = "", b = "") {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");
  if (left.length !== right.length || left.length === 0) return false;
  try {
    return crypto.timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

function decodeBase64UrlToText(value = "") {
  const normalized = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  if (!normalized) return "";
  const padding = normalized.length % 4;
  const padded = padding ? normalized + "=".repeat(4 - padding) : normalized;
  return Buffer.from(padded, "base64").toString("utf8");
}

function safeParseJwtSegment(segment = "") {
  try {
    const decoded = decodeBase64UrlToText(segment);
    if (!decoded) return null;
    const parsed = JSON.parse(decoded);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function getForwardedIp(req) {
  const forwarded = req?.headers?.["x-forwarded-for"];
  if (Array.isArray(forwarded) && forwarded.length) {
    return text(forwarded[0]).split(",")[0].trim();
  }
  if (text(forwarded)) {
    return text(forwarded).split(",")[0].trim();
  }
  return "";
}

export function getClientIp(req) {
  return (
    getForwardedIp(req) ||
    text(req?.ip || req?.socket?.remoteAddress || "0.0.0.0")
  );
}

function sanitizeRequestId(value) {
  const cleaned = text(value)
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 80);
  return cleaned;
}

function requestFingerprint(req) {
  const ip = getClientIp(req);
  const ua = text(req?.headers?.["user-agent"]).slice(0, 256);
  return sha256(`${ip}|${ua}`).slice(0, 24);
}

export function normalizeProSecurityThreatFingerprint(value = "") {
  return text(value).toLowerCase();
}

export function isValidProSecurityThreatFingerprint(value = "") {
  const normalized = normalizeProSecurityThreatFingerprint(value);
  return THREAT_FINGERPRINT_PATTERN.test(normalized);
}

function sanitizeTrustedFingerprints(value) {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .map((item) => normalizeProSecurityThreatFingerprint(item))
    .filter((item) => isValidProSecurityThreatFingerprint(item));
  return [...new Set(normalized)].slice(0, MAX_TRUSTED_FINGERPRINTS);
}

function normalizeIpEntry(value = "") {
  return text(value).toLowerCase().replace(/^::ffff:/i, "");
}

function isValidBlockedIpEntry(value = "") {
  const candidate = normalizeIpEntry(value);
  if (!candidate) return false;
  if (candidate.length > 90) return false;
  if (candidate.includes("*")) return false;
  const ipv4WithOptionalCidr = /^(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?$/;
  const ipv6WithOptionalCidr = /^[a-f0-9:]+(?:\/\d{1,3})?$/i;
  return ipv4WithOptionalCidr.test(candidate) || ipv6WithOptionalCidr.test(candidate);
}

function sanitizeBlockedIps(value) {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .map((item) => normalizeIpEntry(item))
    .filter((item) => isValidBlockedIpEntry(item));
  return [...new Set(normalized)].slice(0, MAX_BLOCKED_IP_ITEMS);
}

function sanitizeBlockedFingerprints(value) {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .map((item) => normalizeProSecurityThreatFingerprint(item))
    .filter((item) => isValidProSecurityThreatFingerprint(item));
  return [...new Set(normalized)].slice(0, MAX_BLOCKED_FINGERPRINT_ITEMS);
}

function sanitizeBlockedUserAgentSignatures(value) {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .map((item) => text(item).toLowerCase())
    .filter((item) => item.length >= 3 && item.length <= 80);
  return [...new Set(normalized)].slice(0, MAX_BLOCKED_USER_AGENT_ITEMS);
}

function sanitizeBlockedTokenSubjects(value) {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .map((item) => text(item).toLowerCase())
    .filter((item) => item.length >= 1 && item.length <= 180);
  return [...new Set(normalized)].slice(0, MAX_BLOCKED_TOKEN_SUBJECT_ITEMS);
}

function currentSecurityControlModules() {
  return proSecurityControlState?.modules || DEFAULT_PRO_SECURITY_CONTROL_STATE.modules;
}

function currentSecurityThresholds() {
  return proSecurityControlState?.thresholds || DEFAULT_PRO_SECURITY_CONTROL_STATE.thresholds;
}

function currentSecurityAdminControls() {
  return proSecurityControlState?.adminControls || DEFAULT_PRO_SECURITY_CONTROL_STATE.adminControls;
}

function currentSecurityLists() {
  return proSecurityControlState?.lists || DEFAULT_PRO_SECURITY_CONTROL_STATE.lists;
}

function currentSecurityMode() {
  return text(proSecurityControlState?.mode || DEFAULT_PRO_SECURITY_CONTROL_STATE.mode || "balanced").toLowerCase();
}

function isTrustedSecurityFingerprint(fingerprint = "") {
  const safe = normalizeProSecurityThreatFingerprint(fingerprint);
  if (!safe) return false;
  const trusted = Array.isArray(proSecurityControlState?.trustedFingerprints)
    ? proSecurityControlState.trustedFingerprints
    : [];
  return trusted.includes(safe);
}

function isBlockedSecurityFingerprint(fingerprint = "") {
  const safe = normalizeProSecurityThreatFingerprint(fingerprint);
  if (!safe) return false;
  const blocked = Array.isArray(currentSecurityLists()?.blockedFingerprints)
    ? currentSecurityLists().blockedFingerprints
    : [];
  return blocked.includes(safe);
}

function isBlockedSecurityIp(ip = "") {
  const safe = normalizeIpEntry(ip);
  if (!safe) return false;
  const blocked = Array.isArray(currentSecurityLists()?.blockedIps)
    ? currentSecurityLists().blockedIps
    : [];
  const exactIpOnly = safe.split("/")[0];

  const matchesIpv4Cidr = (candidateIp, cidrBase, cidrBits) => {
    const ipParts = candidateIp.split(".");
    const baseParts = cidrBase.split(".");
    if (ipParts.length !== 4 || baseParts.length !== 4) return false;
    if (!Number.isFinite(cidrBits) || cidrBits <= 0 || cidrBits > 32) return false;
    const wholeOctets = Math.floor(cidrBits / 8);
    for (let index = 0; index < wholeOctets; index += 1) {
      if (ipParts[index] !== baseParts[index]) return false;
    }
    if (wholeOctets === 0) return true;
    return true;
  };

  const matchesIpv6Cidr = (candidateIp, cidrBase, cidrBits) => {
    if (!Number.isFinite(cidrBits) || cidrBits <= 0 || cidrBits > 128) return false;
    const ipParts = candidateIp.toLowerCase().split(":");
    const baseParts = cidrBase.toLowerCase().split(":");
    const wholeGroups = Math.floor(cidrBits / 16);
    if (!wholeGroups) return true;
    for (let index = 0; index < wholeGroups; index += 1) {
      if (text(ipParts[index]) !== text(baseParts[index])) return false;
    }
    return true;
  };

  for (const item of blocked) {
    const rule = normalizeIpEntry(item);
    if (!rule) continue;
    if (!rule.includes("/")) {
      if (exactIpOnly === rule) return true;
      continue;
    }

    const [cidrBaseRaw, cidrBitsRaw] = rule.split("/");
    const cidrBase = normalizeIpEntry(cidrBaseRaw);
    const cidrBits = Number(cidrBitsRaw);
    if (!cidrBase || !Number.isFinite(cidrBits)) continue;
    if (cidrBase.includes(".")) {
      if (matchesIpv4Cidr(exactIpOnly, cidrBase, cidrBits)) return true;
      continue;
    }
    if (cidrBase.includes(":")) {
      if (matchesIpv6Cidr(exactIpOnly, cidrBase, cidrBits)) return true;
    }
  }

  return false;
}

function isBlockedSecurityUserAgent(rawUserAgent = "") {
  const safe = text(rawUserAgent).toLowerCase();
  if (!safe) return false;
  const blocked = Array.isArray(currentSecurityLists()?.blockedUserAgentSignatures)
    ? currentSecurityLists().blockedUserAgentSignatures
    : [];
  return blocked.some((signature) => safe.includes(text(signature).toLowerCase()));
}

function isBlockedSecurityTokenSubject(value = "") {
  const subject = text(value).toLowerCase();
  if (!subject) return false;
  const blocked = Array.isArray(currentSecurityLists()?.blockedTokenSubjects)
    ? currentSecurityLists().blockedTokenSubjects
    : [];
  return blocked.includes(subject);
}

function listSecurityControlProfilesInternal() {
  return Object.values(SECURITY_CONTROL_PROFILE_DEFS).map((profile) => ({
    id: profile.id,
    label: profile.label,
    description: profile.description,
    mode: text(profile.patch?.mode || profile.id).toLowerCase(),
    defaults: cloneSecurityControlState(profile.patch || {})
  }));
}

export function getProSecurityControlState() {
  return cloneSecurityControlState(proSecurityControlState);
}

export function listProSecurityControlProfiles() {
  return listSecurityControlProfilesInternal();
}

export function getProSecurityControlPersistenceStatus() {
  const target = String(SECURITY_CONTROL_STATE_FILE || "").trim();
  const exists = target ? fs.existsSync(target) : false;
  const stats = exists ? fs.statSync(target) : null;
  const payload = exists ? safeReadJson(target) : null;
  const integritySource = payload && payload.integrity && typeof payload.integrity === "object" && !Array.isArray(payload.integrity)
    ? payload.integrity
    : {};
  const signature = text(integritySource.signature).toLowerCase();
  const hasPayload = Boolean(payload && typeof payload === "object" && !Array.isArray(payload));
  const integrityCheck = hasPayload
    ? verifySecurityControlStatePayload(payload)
    : {
      valid: false,
      signed: false,
      warnings: exists ? ["Persisted security control state file is unreadable or invalid JSON."] : [],
      reason: exists ? "invalid-json" : "missing-state-file",
      hasSigningKey: Boolean(SECURITY_CONTROL_STATE_SIGNING_KEY),
      signatureRequired: SECURITY_CONTROL_STATE_SIGNATURE_REQUIRED
    };
  return {
    enabled: SECURITY_CONTROL_STATE_PERSIST_ENABLED,
    path: target,
    exists,
    sizeBytes: stats ? Number(stats.size || 0) : 0,
    updatedAt: stats ? new Date(stats.mtimeMs).toISOString() : "",
    signature: {
      configured: Boolean(SECURITY_CONTROL_STATE_SIGNING_KEY),
      required: SECURITY_CONTROL_STATE_SIGNATURE_REQUIRED,
      present: Boolean(signature),
      algorithm: text(integritySource.algo || (signature ? "unknown" : "none"))
    },
    integrity: {
      valid: Boolean(integrityCheck.valid),
      reason: text(integrityCheck.reason),
      warnings: Array.isArray(integrityCheck.warnings) ? integrityCheck.warnings : [],
      signed: Boolean(integrityCheck.signed)
    }
  };
}

export function restoreProSecurityControlStateFromDisk({
  actorId = "system",
  actorRole = "system"
} = {}) {
  const warnings = [];
  const payload = safeReadJson(SECURITY_CONTROL_STATE_FILE);
  if (!payload || typeof payload !== "object") {
    return {
      restored: false,
      state: getProSecurityControlState(),
      warnings: ["No persisted security control state found on disk."]
    };
  }

  const integrity = verifySecurityControlStatePayload(payload);
  if (Array.isArray(integrity.warnings) && integrity.warnings.length) {
    warnings.push(...integrity.warnings);
  }
  if (!integrity.valid) {
    const reason = text(integrity.reason, "integrity-check-failed");
    warnings.push(`Persisted security control state rejected: ${reason}.`);
    pushSecurityAuditEventInternal({
      severity: "critical",
      type: "security-control-persistence-integrity-failed",
      method: "POST",
      path: "/api/system/security-control/restore",
      details: {
        actorId: text(actorId),
        actorRole: text(actorRole),
        reason,
        signatureRequired: SECURITY_CONTROL_STATE_SIGNATURE_REQUIRED,
        signatureConfigured: Boolean(SECURITY_CONTROL_STATE_SIGNING_KEY)
      }
    });
    return {
      restored: false,
      state: getProSecurityControlState(),
      warnings
    };
  }
  if (Array.isArray(integrity.warnings) && integrity.warnings.length) {
    pushSecurityAuditEventInternal({
      severity: "medium",
      type: "security-control-persistence-integrity-warning",
      method: "POST",
      path: "/api/system/security-control/restore",
      details: {
        actorId: text(actorId),
        actorRole: text(actorRole),
        reason: text(integrity.reason),
        warnings: integrity.warnings.slice(0, 5)
      }
    });
  }

  const persisted = payload.state && typeof payload.state === "object" && !Array.isArray(payload.state)
    ? payload.state
    : payload;
  const patch = {
    mode: persisted.mode,
    modules: persisted.modules,
    thresholds: persisted.thresholds,
    adminControls: persisted.adminControls,
    trustedFingerprints: persisted.trustedFingerprints,
    lists: persisted.lists
  };
  const result = updateProSecurityControlState(patch, {
    actorId,
    actorRole
  });
  return {
    restored: true,
    state: result.state,
    warnings: [
      ...warnings,
      ...(Array.isArray(result.warnings) ? result.warnings : [])
    ]
  };
}

export function resetProSecurityControlState({
  actorId = "",
  actorRole = ""
} = {}) {
  const warnings = [];
  const next = cloneSecurityControlState(DEFAULT_PRO_SECURITY_CONTROL_STATE);
  next.meta = {
    ...next.meta,
    updatedAt: nowIso(),
    updatedById: text(actorId),
    updatedByRole: text(actorRole),
    revision: Math.max(1, Number(proSecurityControlState?.meta?.revision || 1)) + 1
  };
  proSecurityControlState = next;
  pushSecurityAuditEventInternal({
    severity: "high",
    type: "security-control-reset",
    method: "POST",
    path: "/api/system/security-control/reset",
    details: {
      actorId: text(actorId),
      actorRole: text(actorRole),
      mode: currentSecurityMode()
    }
  });
  const persist = persistSecurityControlStateToDisk(proSecurityControlState);
  if (!persist.ok && !persist.skipped) {
    warnings.push(`Security control persistence failed: ${text(persist.reason)}`);
  }
  return {
    state: getProSecurityControlState(),
    warnings
  };
}

export function updateProSecurityControlState(
  patch = {},
  {
    actorId = "",
    actorRole = ""
  } = {}
) {
  const warnings = [];
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    return {
      state: getProSecurityControlState(),
      warnings: ["Invalid patch payload. Existing security control state returned."]
    };
  }

  const next = cloneSecurityControlState(proSecurityControlState);

  if (typeof patch.mode !== "undefined") {
    const safeMode = text(patch.mode).toLowerCase();
    if (safeMode === "balanced" || safeMode === "hardened" || safeMode === "lockdown") {
      next.mode = safeMode;
    } else if (safeMode) {
      warnings.push("Unsupported mode ignored. Allowed values: balanced, hardened, lockdown.");
    }
  }

  if (patch.modules && typeof patch.modules === "object" && !Array.isArray(patch.modules)) {
    const moduleKeys = [
      "requestFirewall",
      "tokenFirewall",
      "aiThreatDetector",
      "fakeListingAi",
      "authFailureIntelligence",
      "autoQuarantine",
      "strictAdminMutationGuard"
    ];
    for (const key of moduleKeys) {
      if (typeof patch.modules[key] === "undefined") continue;
      next.modules[key] = toBoolean(patch.modules[key], Boolean(next.modules[key]));
    }
  }

  if (patch.thresholds && typeof patch.thresholds === "object" && !Array.isArray(patch.thresholds)) {
    const incoming = patch.thresholds;
    if (typeof incoming.threatAlert !== "undefined") {
      next.thresholds.threatAlert = toIntegerInRange(incoming.threatAlert, next.thresholds.threatAlert, 10, 300);
    }
    if (typeof incoming.threatBlock !== "undefined") {
      next.thresholds.threatBlock = toIntegerInRange(incoming.threatBlock, next.thresholds.threatBlock, 20, 600);
    }
    if (typeof incoming.fakeListingAlert !== "undefined") {
      next.thresholds.fakeListingAlert = toIntegerInRange(
        incoming.fakeListingAlert,
        next.thresholds.fakeListingAlert,
        20,
        100
      );
    }
    if (typeof incoming.fakeListingBlock !== "undefined") {
      next.thresholds.fakeListingBlock = toIntegerInRange(
        incoming.fakeListingBlock,
        next.thresholds.fakeListingBlock,
        30,
        100
      );
    }
    if (typeof incoming.auth401 !== "undefined") {
      next.thresholds.auth401 = toIntegerInRange(incoming.auth401, next.thresholds.auth401, 3, 200);
    }
    if (typeof incoming.auth403 !== "undefined") {
      next.thresholds.auth403 = toIntegerInRange(incoming.auth403, next.thresholds.auth403, 2, 200);
    }
    if (typeof incoming.tokenReplayEvents !== "undefined") {
      next.thresholds.tokenReplayEvents = toIntegerInRange(
        incoming.tokenReplayEvents,
        next.thresholds.tokenReplayEvents,
        3,
        200
      );
    }
    if (typeof incoming.tokenReplayDistinctFingerprints !== "undefined") {
      next.thresholds.tokenReplayDistinctFingerprints = toIntegerInRange(
        incoming.tokenReplayDistinctFingerprints,
        next.thresholds.tokenReplayDistinctFingerprints,
        2,
        50
      );
    }
    if (typeof incoming.tokenReplayDistinctIps !== "undefined") {
      next.thresholds.tokenReplayDistinctIps = toIntegerInRange(
        incoming.tokenReplayDistinctIps,
        next.thresholds.tokenReplayDistinctIps,
        2,
        50
      );
    }
    if (typeof incoming.subjectReplayEvents !== "undefined") {
      next.thresholds.subjectReplayEvents = toIntegerInRange(
        incoming.subjectReplayEvents,
        next.thresholds.subjectReplayEvents,
        3,
        200
      );
    }
    if (typeof incoming.subjectReplayDistinctFingerprints !== "undefined") {
      next.thresholds.subjectReplayDistinctFingerprints = toIntegerInRange(
        incoming.subjectReplayDistinctFingerprints,
        next.thresholds.subjectReplayDistinctFingerprints,
        2,
        50
      );
    }
    if (typeof incoming.subjectReplayDistinctIps !== "undefined") {
      next.thresholds.subjectReplayDistinctIps = toIntegerInRange(
        incoming.subjectReplayDistinctIps,
        next.thresholds.subjectReplayDistinctIps,
        2,
        50
      );
    }
    if (typeof incoming.autoPromoteWindowMinutes !== "undefined") {
      next.thresholds.autoPromoteWindowMinutes = toIntegerInRange(
        incoming.autoPromoteWindowMinutes,
        next.thresholds.autoPromoteWindowMinutes,
        30,
        1440
      );
    }
    if (typeof incoming.autoPromoteFingerprintEvents !== "undefined") {
      next.thresholds.autoPromoteFingerprintEvents = toIntegerInRange(
        incoming.autoPromoteFingerprintEvents,
        next.thresholds.autoPromoteFingerprintEvents,
        3,
        500
      );
    }
    if (typeof incoming.autoPromoteIpEvents !== "undefined") {
      next.thresholds.autoPromoteIpEvents = toIntegerInRange(
        incoming.autoPromoteIpEvents,
        next.thresholds.autoPromoteIpEvents,
        3,
        500
      );
    }
    if (typeof incoming.autoPromoteSubjectEvents !== "undefined") {
      next.thresholds.autoPromoteSubjectEvents = toIntegerInRange(
        incoming.autoPromoteSubjectEvents,
        next.thresholds.autoPromoteSubjectEvents,
        3,
        500
      );
    }
    if (typeof incoming.autoPromoteBlockedEvents !== "undefined") {
      next.thresholds.autoPromoteBlockedEvents = toIntegerInRange(
        incoming.autoPromoteBlockedEvents,
        next.thresholds.autoPromoteBlockedEvents,
        1,
        100
      );
    }
    if (typeof incoming.autoEscalationWindowMinutes !== "undefined") {
      next.thresholds.autoEscalationWindowMinutes = toIntegerInRange(
        incoming.autoEscalationWindowMinutes,
        next.thresholds.autoEscalationWindowMinutes,
        15,
        1440
      );
    }
    if (typeof incoming.autoEscalationCooldownMinutes !== "undefined") {
      next.thresholds.autoEscalationCooldownMinutes = toIntegerInRange(
        incoming.autoEscalationCooldownMinutes,
        next.thresholds.autoEscalationCooldownMinutes,
        5,
        720
      );
    }
    if (typeof incoming.autoEscalateToHardenedEvents !== "undefined") {
      next.thresholds.autoEscalateToHardenedEvents = toIntegerInRange(
        incoming.autoEscalateToHardenedEvents,
        next.thresholds.autoEscalateToHardenedEvents,
        5,
        1000
      );
    }
    if (typeof incoming.autoEscalateToLockdownEvents !== "undefined") {
      next.thresholds.autoEscalateToLockdownEvents = toIntegerInRange(
        incoming.autoEscalateToLockdownEvents,
        next.thresholds.autoEscalateToLockdownEvents,
        10,
        2000
      );
    }
    if (typeof incoming.autoEscalateBlockedEvents !== "undefined") {
      next.thresholds.autoEscalateBlockedEvents = toIntegerInRange(
        incoming.autoEscalateBlockedEvents,
        next.thresholds.autoEscalateBlockedEvents,
        1,
        500
      );
    }
    if (typeof incoming.autoDeEscalationWindowMinutes !== "undefined") {
      next.thresholds.autoDeEscalationWindowMinutes = toIntegerInRange(
        incoming.autoDeEscalationWindowMinutes,
        next.thresholds.autoDeEscalationWindowMinutes,
        30,
        1440
      );
    }
    if (typeof incoming.autoDeEscalationCooldownMinutes !== "undefined") {
      next.thresholds.autoDeEscalationCooldownMinutes = toIntegerInRange(
        incoming.autoDeEscalationCooldownMinutes,
        next.thresholds.autoDeEscalationCooldownMinutes,
        5,
        720
      );
    }
    if (typeof incoming.autoDeEscalateToHardenedMaxEvents !== "undefined") {
      next.thresholds.autoDeEscalateToHardenedMaxEvents = toIntegerInRange(
        incoming.autoDeEscalateToHardenedMaxEvents,
        next.thresholds.autoDeEscalateToHardenedMaxEvents,
        1,
        1000
      );
    }
    if (typeof incoming.autoDeEscalateToBalancedMaxEvents !== "undefined") {
      next.thresholds.autoDeEscalateToBalancedMaxEvents = toIntegerInRange(
        incoming.autoDeEscalateToBalancedMaxEvents,
        next.thresholds.autoDeEscalateToBalancedMaxEvents,
        1,
        1000
      );
    }
    if (typeof incoming.autoDeEscalateBlockedMaxEvents !== "undefined") {
      next.thresholds.autoDeEscalateBlockedMaxEvents = toIntegerInRange(
        incoming.autoDeEscalateBlockedMaxEvents,
        next.thresholds.autoDeEscalateBlockedMaxEvents,
        0,
        500
      );
    }
    if (typeof incoming.criticalLockdownCooldownMinutes !== "undefined") {
      next.thresholds.criticalLockdownCooldownMinutes = toIntegerInRange(
        incoming.criticalLockdownCooldownMinutes,
        next.thresholds.criticalLockdownCooldownMinutes,
        1,
        720
      );
    }
    if (typeof incoming.campaignWindowMinutes !== "undefined") {
      next.thresholds.campaignWindowMinutes = toIntegerInRange(
        incoming.campaignWindowMinutes,
        next.thresholds.campaignWindowMinutes,
        10,
        1440
      );
    }
    if (typeof incoming.campaignIncidentThreshold !== "undefined") {
      next.thresholds.campaignIncidentThreshold = toIntegerInRange(
        incoming.campaignIncidentThreshold,
        next.thresholds.campaignIncidentThreshold,
        5,
        5000
      );
    }
    if (typeof incoming.campaignDistinctFingerprintThreshold !== "undefined") {
      next.thresholds.campaignDistinctFingerprintThreshold = toIntegerInRange(
        incoming.campaignDistinctFingerprintThreshold,
        next.thresholds.campaignDistinctFingerprintThreshold,
        2,
        1000
      );
    }
    if (typeof incoming.campaignDistinctIpThreshold !== "undefined") {
      next.thresholds.campaignDistinctIpThreshold = toIntegerInRange(
        incoming.campaignDistinctIpThreshold,
        next.thresholds.campaignDistinctIpThreshold,
        2,
        1000
      );
    }
    if (typeof incoming.campaignBlockedThreshold !== "undefined") {
      next.thresholds.campaignBlockedThreshold = toIntegerInRange(
        incoming.campaignBlockedThreshold,
        next.thresholds.campaignBlockedThreshold,
        1,
        2000
      );
    }
    if (typeof incoming.campaignCooldownMinutes !== "undefined") {
      next.thresholds.campaignCooldownMinutes = toIntegerInRange(
        incoming.campaignCooldownMinutes,
        next.thresholds.campaignCooldownMinutes,
        1,
        1440
      );
    }
    if (typeof incoming.authStormWindowMinutes !== "undefined") {
      next.thresholds.authStormWindowMinutes = toIntegerInRange(
        incoming.authStormWindowMinutes,
        next.thresholds.authStormWindowMinutes,
        5,
        1440
      );
    }
    if (typeof incoming.authStormFailureThreshold !== "undefined") {
      next.thresholds.authStormFailureThreshold = toIntegerInRange(
        incoming.authStormFailureThreshold,
        next.thresholds.authStormFailureThreshold,
        10,
        10000
      );
    }
    if (typeof incoming.authStormDistinctFingerprints !== "undefined") {
      next.thresholds.authStormDistinctFingerprints = toIntegerInRange(
        incoming.authStormDistinctFingerprints,
        next.thresholds.authStormDistinctFingerprints,
        2,
        2000
      );
    }
    if (typeof incoming.authStormDistinctIps !== "undefined") {
      next.thresholds.authStormDistinctIps = toIntegerInRange(
        incoming.authStormDistinctIps,
        next.thresholds.authStormDistinctIps,
        2,
        2000
      );
    }
    if (typeof incoming.authStormDistinctIdentities !== "undefined") {
      next.thresholds.authStormDistinctIdentities = toIntegerInRange(
        incoming.authStormDistinctIdentities,
        next.thresholds.authStormDistinctIdentities,
        2,
        5000
      );
    }
    if (typeof incoming.authStormShieldDurationMinutes !== "undefined") {
      next.thresholds.authStormShieldDurationMinutes = toIntegerInRange(
        incoming.authStormShieldDurationMinutes,
        next.thresholds.authStormShieldDurationMinutes,
        1,
        720
      );
    }
    if (typeof incoming.authStormCooldownMinutes !== "undefined") {
      next.thresholds.authStormCooldownMinutes = toIntegerInRange(
        incoming.authStormCooldownMinutes,
        next.thresholds.authStormCooldownMinutes,
        1,
        720
      );
    }
    if (typeof incoming.identityProtectionWindowMinutes !== "undefined") {
      next.thresholds.identityProtectionWindowMinutes = toIntegerInRange(
        incoming.identityProtectionWindowMinutes,
        next.thresholds.identityProtectionWindowMinutes,
        5,
        1440
      );
    }
    if (typeof incoming.identityProtectionFailureThreshold !== "undefined") {
      next.thresholds.identityProtectionFailureThreshold = toIntegerInRange(
        incoming.identityProtectionFailureThreshold,
        next.thresholds.identityProtectionFailureThreshold,
        3,
        5000
      );
    }
    if (typeof incoming.identityProtectionDistinctFingerprints !== "undefined") {
      next.thresholds.identityProtectionDistinctFingerprints = toIntegerInRange(
        incoming.identityProtectionDistinctFingerprints,
        next.thresholds.identityProtectionDistinctFingerprints,
        2,
        1000
      );
    }
    if (typeof incoming.identityProtectionDistinctIps !== "undefined") {
      next.thresholds.identityProtectionDistinctIps = toIntegerInRange(
        incoming.identityProtectionDistinctIps,
        next.thresholds.identityProtectionDistinctIps,
        2,
        1000
      );
    }
    if (typeof incoming.identityProtectionDurationMinutes !== "undefined") {
      next.thresholds.identityProtectionDurationMinutes = toIntegerInRange(
        incoming.identityProtectionDurationMinutes,
        next.thresholds.identityProtectionDurationMinutes,
        1,
        1440
      );
    }
    if (typeof incoming.identityProtectionCooldownMinutes !== "undefined") {
      next.thresholds.identityProtectionCooldownMinutes = toIntegerInRange(
        incoming.identityProtectionCooldownMinutes,
        next.thresholds.identityProtectionCooldownMinutes,
        1,
        720
      );
    }
    if (typeof incoming.subjectProtectionWindowMinutes !== "undefined") {
      next.thresholds.subjectProtectionWindowMinutes = toIntegerInRange(
        incoming.subjectProtectionWindowMinutes,
        next.thresholds.subjectProtectionWindowMinutes,
        5,
        1440
      );
    }
    if (typeof incoming.subjectProtectionIncidentThreshold !== "undefined") {
      next.thresholds.subjectProtectionIncidentThreshold = toIntegerInRange(
        incoming.subjectProtectionIncidentThreshold,
        next.thresholds.subjectProtectionIncidentThreshold,
        2,
        5000
      );
    }
    if (typeof incoming.subjectProtectionDistinctFingerprints !== "undefined") {
      next.thresholds.subjectProtectionDistinctFingerprints = toIntegerInRange(
        incoming.subjectProtectionDistinctFingerprints,
        next.thresholds.subjectProtectionDistinctFingerprints,
        2,
        1000
      );
    }
    if (typeof incoming.subjectProtectionDistinctIps !== "undefined") {
      next.thresholds.subjectProtectionDistinctIps = toIntegerInRange(
        incoming.subjectProtectionDistinctIps,
        next.thresholds.subjectProtectionDistinctIps,
        2,
        1000
      );
    }
    if (typeof incoming.subjectProtectionDurationMinutes !== "undefined") {
      next.thresholds.subjectProtectionDurationMinutes = toIntegerInRange(
        incoming.subjectProtectionDurationMinutes,
        next.thresholds.subjectProtectionDurationMinutes,
        1,
        1440
      );
    }
    if (typeof incoming.subjectProtectionCooldownMinutes !== "undefined") {
      next.thresholds.subjectProtectionCooldownMinutes = toIntegerInRange(
        incoming.subjectProtectionCooldownMinutes,
        next.thresholds.subjectProtectionCooldownMinutes,
        1,
        720
      );
    }
    if (typeof incoming.subjectSessionWindowMinutes !== "undefined") {
      next.thresholds.subjectSessionWindowMinutes = toIntegerInRange(
        incoming.subjectSessionWindowMinutes,
        next.thresholds.subjectSessionWindowMinutes,
        5,
        1440
      );
    }
    if (typeof incoming.subjectSessionEventThreshold !== "undefined") {
      next.thresholds.subjectSessionEventThreshold = toIntegerInRange(
        incoming.subjectSessionEventThreshold,
        next.thresholds.subjectSessionEventThreshold,
        2,
        5000
      );
    }
    if (typeof incoming.subjectSessionDistinctTokenKeys !== "undefined") {
      next.thresholds.subjectSessionDistinctTokenKeys = toIntegerInRange(
        incoming.subjectSessionDistinctTokenKeys,
        next.thresholds.subjectSessionDistinctTokenKeys,
        2,
        1000
      );
    }
    if (typeof incoming.subjectSessionDistinctFingerprints !== "undefined") {
      next.thresholds.subjectSessionDistinctFingerprints = toIntegerInRange(
        incoming.subjectSessionDistinctFingerprints,
        next.thresholds.subjectSessionDistinctFingerprints,
        2,
        1000
      );
    }
    if (typeof incoming.subjectSessionDistinctIps !== "undefined") {
      next.thresholds.subjectSessionDistinctIps = toIntegerInRange(
        incoming.subjectSessionDistinctIps,
        next.thresholds.subjectSessionDistinctIps,
        2,
        1000
      );
    }
    if (typeof incoming.subjectSessionShieldDurationMinutes !== "undefined") {
      next.thresholds.subjectSessionShieldDurationMinutes = toIntegerInRange(
        incoming.subjectSessionShieldDurationMinutes,
        next.thresholds.subjectSessionShieldDurationMinutes,
        1,
        1440
      );
    }
    if (typeof incoming.subjectSessionCooldownMinutes !== "undefined") {
      next.thresholds.subjectSessionCooldownMinutes = toIntegerInRange(
        incoming.subjectSessionCooldownMinutes,
        next.thresholds.subjectSessionCooldownMinutes,
        1,
        720
      );
    }
    if (typeof incoming.subjectNetworkWindowMinutes !== "undefined") {
      next.thresholds.subjectNetworkWindowMinutes = toIntegerInRange(
        incoming.subjectNetworkWindowMinutes,
        next.thresholds.subjectNetworkWindowMinutes,
        5,
        1440
      );
    }
    if (typeof incoming.subjectNetworkEventThreshold !== "undefined") {
      next.thresholds.subjectNetworkEventThreshold = toIntegerInRange(
        incoming.subjectNetworkEventThreshold,
        next.thresholds.subjectNetworkEventThreshold,
        2,
        5000
      );
    }
    if (typeof incoming.subjectNetworkDistinctPrefixes !== "undefined") {
      next.thresholds.subjectNetworkDistinctPrefixes = toIntegerInRange(
        incoming.subjectNetworkDistinctPrefixes,
        next.thresholds.subjectNetworkDistinctPrefixes,
        2,
        1000
      );
    }
    if (typeof incoming.subjectNetworkJumpThreshold !== "undefined") {
      next.thresholds.subjectNetworkJumpThreshold = toIntegerInRange(
        incoming.subjectNetworkJumpThreshold,
        next.thresholds.subjectNetworkJumpThreshold,
        1,
        1000
      );
    }
    if (typeof incoming.subjectNetworkShieldDurationMinutes !== "undefined") {
      next.thresholds.subjectNetworkShieldDurationMinutes = toIntegerInRange(
        incoming.subjectNetworkShieldDurationMinutes,
        next.thresholds.subjectNetworkShieldDurationMinutes,
        1,
        1440
      );
    }
    if (typeof incoming.subjectNetworkCooldownMinutes !== "undefined") {
      next.thresholds.subjectNetworkCooldownMinutes = toIntegerInRange(
        incoming.subjectNetworkCooldownMinutes,
        next.thresholds.subjectNetworkCooldownMinutes,
        1,
        720
      );
    }
    if (typeof incoming.adminMutationWindowMinutes !== "undefined") {
      next.thresholds.adminMutationWindowMinutes = toIntegerInRange(
        incoming.adminMutationWindowMinutes,
        next.thresholds.adminMutationWindowMinutes,
        5,
        1440
      );
    }
    if (typeof incoming.adminMutationAttemptThreshold !== "undefined") {
      next.thresholds.adminMutationAttemptThreshold = toIntegerInRange(
        incoming.adminMutationAttemptThreshold,
        next.thresholds.adminMutationAttemptThreshold,
        2,
        5000
      );
    }
    if (typeof incoming.adminMutationDistinctFingerprints !== "undefined") {
      next.thresholds.adminMutationDistinctFingerprints = toIntegerInRange(
        incoming.adminMutationDistinctFingerprints,
        next.thresholds.adminMutationDistinctFingerprints,
        2,
        1000
      );
    }
    if (typeof incoming.adminMutationDistinctIps !== "undefined") {
      next.thresholds.adminMutationDistinctIps = toIntegerInRange(
        incoming.adminMutationDistinctIps,
        next.thresholds.adminMutationDistinctIps,
        2,
        1000
      );
    }
    if (typeof incoming.adminMutationShieldDurationMinutes !== "undefined") {
      next.thresholds.adminMutationShieldDurationMinutes = toIntegerInRange(
        incoming.adminMutationShieldDurationMinutes,
        next.thresholds.adminMutationShieldDurationMinutes,
        1,
        1440
      );
    }
    if (typeof incoming.adminMutationCooldownMinutes !== "undefined") {
      next.thresholds.adminMutationCooldownMinutes = toIntegerInRange(
        incoming.adminMutationCooldownMinutes,
        next.thresholds.adminMutationCooldownMinutes,
        1,
        720
      );
    }
  }

  if (typeof patch.trustedFingerprints !== "undefined") {
    next.trustedFingerprints = sanitizeTrustedFingerprints(patch.trustedFingerprints);
    if (Array.isArray(patch.trustedFingerprints) && patch.trustedFingerprints.length > next.trustedFingerprints.length) {
      warnings.push("Some trusted fingerprints were ignored because they were invalid.");
    }
  }

  if (patch.adminControls && typeof patch.adminControls === "object" && !Array.isArray(patch.adminControls)) {
    if (typeof patch.adminControls.actionKeyEnforced !== "undefined") {
      const desired = toBoolean(
        patch.adminControls.actionKeyEnforced,
        Boolean(next.adminControls.actionKeyEnforced)
      );
      const hasConfiguredSecret = text(API_ADMIN_ACTION_KEY).length > 0;
      if (desired && !hasConfiguredSecret) {
        next.adminControls.actionKeyEnforced = false;
        warnings.push("actionKeyEnforced not enabled because ADMIN_ACTION_KEY is missing.");
      } else {
        next.adminControls.actionKeyEnforced = desired;
      }
    }
    if (typeof patch.adminControls.adminMutationSignatureEnforced !== "undefined") {
      const desired = toBoolean(
        patch.adminControls.adminMutationSignatureEnforced,
        Boolean(next.adminControls.adminMutationSignatureEnforced)
      );
      const hasSignatureSecret = text(ADMIN_MUTATION_SIGNATURE_SECRET).length > 0;
      if (desired && !hasSignatureSecret) {
        next.adminControls.adminMutationSignatureEnforced = false;
        warnings.push("adminMutationSignatureEnforced not enabled because ADMIN_MUTATION_SIGNATURE_SECRET is missing.");
      } else {
        next.adminControls.adminMutationSignatureEnforced = desired;
      }
    }
    if (typeof patch.adminControls.readOnlyApi !== "undefined") {
      next.adminControls.readOnlyApi = toBoolean(
        patch.adminControls.readOnlyApi,
        Boolean(next.adminControls.readOnlyApi)
      );
    }
    if (typeof patch.adminControls.autoPromoteBlocklists !== "undefined") {
      next.adminControls.autoPromoteBlocklists = toBoolean(
        patch.adminControls.autoPromoteBlocklists,
        Boolean(next.adminControls.autoPromoteBlocklists)
      );
    }
    if (typeof patch.adminControls.autoEscalateMode !== "undefined") {
      next.adminControls.autoEscalateMode = toBoolean(
        patch.adminControls.autoEscalateMode,
        Boolean(next.adminControls.autoEscalateMode)
      );
    }
    if (typeof patch.adminControls.autoDeEscalateMode !== "undefined") {
      next.adminControls.autoDeEscalateMode = toBoolean(
        patch.adminControls.autoDeEscalateMode,
        Boolean(next.adminControls.autoDeEscalateMode)
      );
    }
    if (typeof patch.adminControls.autoCriticalResponse !== "undefined") {
      next.adminControls.autoCriticalResponse = toBoolean(
        patch.adminControls.autoCriticalResponse,
        Boolean(next.adminControls.autoCriticalResponse)
      );
    }
    if (typeof patch.adminControls.autoCriticalLockdown !== "undefined") {
      next.adminControls.autoCriticalLockdown = toBoolean(
        patch.adminControls.autoCriticalLockdown,
        Boolean(next.adminControls.autoCriticalLockdown)
      );
    }
    if (typeof patch.adminControls.autoCriticalImmediateBlocklist !== "undefined") {
      next.adminControls.autoCriticalImmediateBlocklist = toBoolean(
        patch.adminControls.autoCriticalImmediateBlocklist,
        Boolean(next.adminControls.autoCriticalImmediateBlocklist)
      );
    }
    if (typeof patch.adminControls.autoCampaignLockdown !== "undefined") {
      next.adminControls.autoCampaignLockdown = toBoolean(
        patch.adminControls.autoCampaignLockdown,
        Boolean(next.adminControls.autoCampaignLockdown)
      );
    }
    if (typeof patch.adminControls.autoAuthStormShield !== "undefined") {
      next.adminControls.autoAuthStormShield = toBoolean(
        patch.adminControls.autoAuthStormShield,
        Boolean(next.adminControls.autoAuthStormShield)
      );
    }
    if (typeof patch.adminControls.autoIdentityProtection !== "undefined") {
      next.adminControls.autoIdentityProtection = toBoolean(
        patch.adminControls.autoIdentityProtection,
        Boolean(next.adminControls.autoIdentityProtection)
      );
    }
    if (typeof patch.adminControls.autoSubjectProtection !== "undefined") {
      next.adminControls.autoSubjectProtection = toBoolean(
        patch.adminControls.autoSubjectProtection,
        Boolean(next.adminControls.autoSubjectProtection)
      );
    }
    if (typeof patch.adminControls.autoSubjectSessionShield !== "undefined") {
      next.adminControls.autoSubjectSessionShield = toBoolean(
        patch.adminControls.autoSubjectSessionShield,
        Boolean(next.adminControls.autoSubjectSessionShield)
      );
    }
    if (typeof patch.adminControls.autoSubjectNetworkShield !== "undefined") {
      next.adminControls.autoSubjectNetworkShield = toBoolean(
        patch.adminControls.autoSubjectNetworkShield,
        Boolean(next.adminControls.autoSubjectNetworkShield)
      );
    }
    if (typeof patch.adminControls.autoAdminMutationShield !== "undefined") {
      next.adminControls.autoAdminMutationShield = toBoolean(
        patch.adminControls.autoAdminMutationShield,
        Boolean(next.adminControls.autoAdminMutationShield)
      );
    }
  }

  if (patch.lists && typeof patch.lists === "object" && !Array.isArray(patch.lists)) {
    if (typeof patch.lists.blockedIps !== "undefined") {
      next.lists.blockedIps = sanitizeBlockedIps(patch.lists.blockedIps);
      if (Array.isArray(patch.lists.blockedIps) && patch.lists.blockedIps.length > next.lists.blockedIps.length) {
        warnings.push("Some blocked IP entries were ignored because they were invalid.");
      }
    }
    if (typeof patch.lists.blockedFingerprints !== "undefined") {
      next.lists.blockedFingerprints = sanitizeBlockedFingerprints(patch.lists.blockedFingerprints);
      if (
        Array.isArray(patch.lists.blockedFingerprints) &&
        patch.lists.blockedFingerprints.length > next.lists.blockedFingerprints.length
      ) {
        warnings.push("Some blocked fingerprints were ignored because they were invalid.");
      }
    }
    if (typeof patch.lists.blockedUserAgentSignatures !== "undefined") {
      next.lists.blockedUserAgentSignatures = sanitizeBlockedUserAgentSignatures(
        patch.lists.blockedUserAgentSignatures
      );
      if (
        Array.isArray(patch.lists.blockedUserAgentSignatures) &&
        patch.lists.blockedUserAgentSignatures.length > next.lists.blockedUserAgentSignatures.length
      ) {
        warnings.push("Some blocked user-agent signatures were ignored because they were invalid.");
      }
    }
    if (typeof patch.lists.blockedTokenSubjects !== "undefined") {
      next.lists.blockedTokenSubjects = sanitizeBlockedTokenSubjects(patch.lists.blockedTokenSubjects);
      if (
        Array.isArray(patch.lists.blockedTokenSubjects) &&
        patch.lists.blockedTokenSubjects.length > next.lists.blockedTokenSubjects.length
      ) {
        warnings.push("Some blocked token subjects were ignored because they were invalid.");
      }
    }
  }

  if (next.thresholds.threatBlock < next.thresholds.threatAlert) {
    next.thresholds.threatBlock = next.thresholds.threatAlert;
    warnings.push("threatBlock was auto-adjusted to be >= threatAlert.");
  }
  if (next.thresholds.fakeListingBlock < next.thresholds.fakeListingAlert) {
    next.thresholds.fakeListingBlock = next.thresholds.fakeListingAlert;
    warnings.push("fakeListingBlock was auto-adjusted to be >= fakeListingAlert.");
  }
  if (next.thresholds.autoEscalateToLockdownEvents <= next.thresholds.autoEscalateToHardenedEvents) {
    next.thresholds.autoEscalateToLockdownEvents = next.thresholds.autoEscalateToHardenedEvents + 1;
    warnings.push("autoEscalateToLockdownEvents was auto-adjusted to be > autoEscalateToHardenedEvents.");
  }
  if (next.thresholds.autoDeEscalateToHardenedMaxEvents <= next.thresholds.autoDeEscalateToBalancedMaxEvents) {
    next.thresholds.autoDeEscalateToHardenedMaxEvents = next.thresholds.autoDeEscalateToBalancedMaxEvents + 1;
    warnings.push("autoDeEscalateToHardenedMaxEvents was auto-adjusted to be > autoDeEscalateToBalancedMaxEvents.");
  }
  if (next.thresholds.autoEscalateToHardenedEvents <= next.thresholds.autoDeEscalateToHardenedMaxEvents) {
    next.thresholds.autoEscalateToHardenedEvents = next.thresholds.autoDeEscalateToHardenedMaxEvents + 1;
    warnings.push("autoEscalateToHardenedEvents was auto-adjusted to stay above de-escalation threshold.");
  }

  next.meta = {
    ...next.meta,
    updatedAt: nowIso(),
    updatedById: text(actorId),
    updatedByRole: text(actorRole),
    revision: Math.max(1, Number(proSecurityControlState?.meta?.revision || 1)) + 1
  };

  proSecurityControlState = next;
  pushSecurityAuditEventInternal({
    severity: "high",
    type: "security-control-updated",
    method: "PATCH",
    path: "/api/system/security-control",
    details: {
      actorId: text(actorId),
      actorRole: text(actorRole),
      mode: currentSecurityMode(),
      warnings: warnings.slice(0, 12)
    }
  });
  const persist = persistSecurityControlStateToDisk(proSecurityControlState);
  if (!persist.ok && !persist.skipped) {
    warnings.push(`Security control persistence failed: ${text(persist.reason)}`);
  }
  return {
    state: getProSecurityControlState(),
    warnings
  };
}

export function applyProSecurityControlProfile(
  profileId = "",
  {
    actorId = "",
    actorRole = ""
  } = {}
) {
  const safeProfileId = text(profileId).toLowerCase();
  const profile = SECURITY_CONTROL_PROFILE_DEFS[safeProfileId];
  if (!profile) {
    return {
      applied: false,
      profileId: safeProfileId,
      state: getProSecurityControlState(),
      warnings: ["Invalid profile. Allowed values: balanced, hardened, lockdown."]
    };
  }

  const result = updateProSecurityControlState(profile.patch, {
    actorId,
    actorRole
  });
  const warnings = [...(Array.isArray(result.warnings) ? result.warnings : [])];
  pushSecurityAuditEventInternal({
    severity: "high",
    type: "security-control-profile-applied",
    method: "POST",
    path: "/api/system/security-control/profile",
    details: {
      actorId: text(actorId),
      actorRole: text(actorRole),
      profileId: profile.id,
      mode: currentSecurityMode()
    }
  });
  return {
    applied: true,
    profileId: profile.id,
    state: result.state,
    warnings
  };
}

let hasInitializedSecurityControlFromDisk = false;

function initializeSecurityControlStateFromDisk() {
  if (hasInitializedSecurityControlFromDisk) return;
  hasInitializedSecurityControlFromDisk = true;
  if (!SECURITY_CONTROL_STATE_PERSIST_ENABLED) return;
  const payload = safeReadJson(SECURITY_CONTROL_STATE_FILE);
  if (!payload || typeof payload !== "object") return;
  const integrity = verifySecurityControlStatePayload(payload);
  if (!integrity.valid) {
    pushSecurityAuditEventInternal({
      severity: "critical",
      type: "security-control-persistence-boot-rejected",
      method: "BOOT",
      path: "/system/security-control/boot-restore",
      details: {
        actorId: "system-boot",
        actorRole: "system",
        reason: text(integrity.reason, "integrity-check-failed"),
        signatureRequired: SECURITY_CONTROL_STATE_SIGNATURE_REQUIRED,
        signatureConfigured: Boolean(SECURITY_CONTROL_STATE_SIGNING_KEY)
      }
    });
    return;
  }
  if (Array.isArray(integrity.warnings) && integrity.warnings.length) {
    pushSecurityAuditEventInternal({
      severity: "medium",
      type: "security-control-persistence-boot-warning",
      method: "BOOT",
      path: "/system/security-control/boot-restore",
      details: {
        actorId: "system-boot",
        actorRole: "system",
        reason: text(integrity.reason),
        warnings: integrity.warnings.slice(0, 5)
      }
    });
  }
  const persisted = payload.state && typeof payload.state === "object" && !Array.isArray(payload.state)
    ? payload.state
    : payload;
  const patch = {
    mode: persisted.mode,
    modules: persisted.modules,
    thresholds: persisted.thresholds,
    adminControls: persisted.adminControls,
    trustedFingerprints: persisted.trustedFingerprints,
    lists: persisted.lists
  };
  const updateResult = updateProSecurityControlState(patch, {
    actorId: "system-boot",
    actorRole: "system"
  });
  if (Array.isArray(updateResult.warnings) && updateResult.warnings.length) {
    pushSecurityAuditEventInternal({
      severity: "medium",
      type: "security-control-persistence-boot-restore-warning",
      method: "BOOT",
      path: "/system/security-control/boot-restore",
      details: {
        actorId: "system-boot",
        actorRole: "system",
        warnings: updateResult.warnings.slice(0, 5)
      }
    });
  }
}

initializeSecurityControlStateFromDisk();

function normalizeContentType(value) {
  return text(value).split(";")[0].trim().toLowerCase();
}

function isApiBodyMethod(method = "") {
  const raw = text(method).toUpperCase();
  return raw === "POST" || raw === "PUT" || raw === "PATCH" || raw === "DELETE";
}

function hasBodyPayload(req) {
  const contentLength = Number(req?.headers?.["content-length"] || 0);
  if (Number.isFinite(contentLength) && contentLength > 0) return true;
  const body = req?.body;
  if (body === null || typeof body === "undefined") return false;
  if (typeof body === "string") return body.trim().length > 0;
  if (Array.isArray(body)) return body.length > 0;
  if (typeof body === "object") return Object.keys(body).length > 0;
  return false;
}

function isSuspiciousUserAgent(req) {
  const ua = text(req?.headers?.["user-agent"]);
  if (!ua) return false;
  return SUSPICIOUS_USER_AGENT_PATTERNS.some((rule) => rule.test(ua));
}

function findHoneypotFieldHit(req) {
  const body = req?.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return "";
  for (const fieldName of HONEYPOT_FIELD_NAMES) {
    const value = body[fieldName];
    if (!text(value)) continue;
    return fieldName;
  }
  return "";
}

function extractAuthIdentitySample(req) {
  const requestPath = String(req?.originalUrl || req?.path || "");
  if (!requestPath.includes("/auth")) return "";
  const identity = text(
    req?.body?.emailOrPhone || req?.body?.email || req?.body?.phone || req?.body?.mobile
  ).toLowerCase();
  if (!identity) return "";
  return identity.slice(0, 120);
}

function normalizeAuthIdentity(value = "") {
  return text(value).toLowerCase().slice(0, 120);
}

function normalizeTokenSubject(value = "") {
  return text(value).toLowerCase().slice(0, 120);
}

function normalizeIpNetworkPrefix(value = "") {
  const ip = normalizeIpEntry(value);
  if (!ip) return "";
  if (ip.includes(".")) {
    const parts = ip.split(".");
    if (parts.length !== 4) return "";
    return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  }
  if (ip.includes(":")) {
    const parts = ip.split(":").filter(Boolean);
    if (!parts.length) return "";
    return `${parts.slice(0, 4).join(":")}::/64`;
  }
  return "";
}

function pruneProtectedAuthIdentities(nowTs = Date.now()) {
  const now = Number(nowTs);
  for (const [identity, row] of proProtectedAuthIdentities.entries()) {
    const until = Number(row?.until || 0);
    if (!Number.isFinite(until) || until <= now) {
      proProtectedAuthIdentities.delete(identity);
    }
  }
  if (proProtectedAuthIdentities.size <= PROTECTED_AUTH_IDENTITIES_MAX_ITEMS) return;
  const overflow = proProtectedAuthIdentities.size - PROTECTED_AUTH_IDENTITIES_MAX_ITEMS;
  const ordered = [...proProtectedAuthIdentities.entries()].sort(
    (a, b) => Number(a?.[1]?.updatedAt || 0) - Number(b?.[1]?.updatedAt || 0)
  );
  for (let index = 0; index < overflow; index += 1) {
    const key = text(ordered[index]?.[0]);
    if (key) proProtectedAuthIdentities.delete(key);
  }
}

function getProtectedAuthIdentityStatus(identity = "", nowTs = Date.now()) {
  const key = normalizeAuthIdentity(identity);
  if (!key) return { active: false, identity: "" };
  const row = proProtectedAuthIdentities.get(key);
  const safeNow = Number(nowTs);
  const until = Math.max(0, Number(row?.until || 0));
  if (!row || until <= safeNow) {
    if (row) proProtectedAuthIdentities.delete(key);
    return { active: false, identity: key };
  }
  return {
    active: true,
    identity: key,
    until,
    remainingSec: Math.max(0, Math.ceil((until - safeNow) / 1000)),
    reason: text(row?.reason),
    failureCount: Math.max(0, Number(row?.failureCount || 0)),
    distinctFingerprintCount: Math.max(0, Number(row?.distinctFingerprintCount || 0)),
    distinctIpCount: Math.max(0, Number(row?.distinctIpCount || 0)),
    lastAppliedAt: Math.max(0, Number(row?.lastAppliedAt || 0))
  };
}

function pruneProtectedTokenSubjects(nowTs = Date.now()) {
  const now = Number(nowTs);
  for (const [subject, row] of proProtectedTokenSubjects.entries()) {
    const until = Number(row?.until || 0);
    if (!Number.isFinite(until) || until <= now) {
      proProtectedTokenSubjects.delete(subject);
    }
  }
  if (proProtectedTokenSubjects.size <= PROTECTED_TOKEN_SUBJECTS_MAX_ITEMS) return;
  const overflow = proProtectedTokenSubjects.size - PROTECTED_TOKEN_SUBJECTS_MAX_ITEMS;
  const ordered = [...proProtectedTokenSubjects.entries()].sort(
    (a, b) => Number(a?.[1]?.updatedAt || 0) - Number(b?.[1]?.updatedAt || 0)
  );
  for (let index = 0; index < overflow; index += 1) {
    const key = text(ordered[index]?.[0]);
    if (key) proProtectedTokenSubjects.delete(key);
  }
}

function getProtectedTokenSubjectStatus(subject = "", nowTs = Date.now()) {
  const key = normalizeTokenSubject(subject);
  if (!key) return { active: false, subject: "" };
  const row = proProtectedTokenSubjects.get(key);
  const safeNow = Number(nowTs);
  const until = Math.max(0, Number(row?.until || 0));
  if (!row || until <= safeNow) {
    if (row) proProtectedTokenSubjects.delete(key);
    return { active: false, subject: key };
  }
  return {
    active: true,
    subject: key,
    until,
    remainingSec: Math.max(0, Math.ceil((until - safeNow) / 1000)),
    reason: text(row?.reason),
    incidentCount: Math.max(0, Number(row?.incidentCount || 0)),
    distinctFingerprintCount: Math.max(0, Number(row?.distinctFingerprintCount || 0)),
    distinctIpCount: Math.max(0, Number(row?.distinctIpCount || 0)),
    lastAppliedAt: Math.max(0, Number(row?.lastAppliedAt || 0))
  };
}

function pruneThreatProfiles() {
  if (proThreatProfiles.size <= THREAT_PROFILE_MAX_SIZE) return;
  const entries = [...proThreatProfiles.entries()].sort(
    (a, b) => Number(a[1]?.lastSeenAt || 0) - Number(b[1]?.lastSeenAt || 0)
  );
  const overflow = proThreatProfiles.size - THREAT_PROFILE_MAX_SIZE;
  for (let index = 0; index < overflow; index += 1) {
    const key = entries[index]?.[0];
    if (key) proThreatProfiles.delete(key);
  }
}

function pruneFakeListingSignatureIntel(nowTs = Date.now()) {
  if (!proFakeListingSignatureIntel.size) return;
  for (const [signature, row] of proFakeListingSignatureIntel.entries()) {
    const recent = (Array.isArray(row?.events) ? row.events : []).filter(
      (item) => Number(item?.at || 0) >= nowTs - FAKE_LISTING_SIGNATURE_INTEL_WINDOW_MS
    );
    if (!recent.length) {
      proFakeListingSignatureIntel.delete(signature);
      continue;
    }
    proFakeListingSignatureIntel.set(signature, {
      ...row,
      events: recent,
      lastSeenAt: Math.max(...recent.map((item) => Number(item?.at || 0)))
    });
  }

  if (proFakeListingSignatureIntel.size <= FAKE_LISTING_SIGNATURE_MAX_ITEMS) return;
  const overflow = proFakeListingSignatureIntel.size - FAKE_LISTING_SIGNATURE_MAX_ITEMS;
  const ordered = [...proFakeListingSignatureIntel.entries()].sort(
    (a, b) => Number(a[1]?.lastSeenAt || 0) - Number(b[1]?.lastSeenAt || 0)
  );
  for (let index = 0; index < overflow; index += 1) {
    const key = ordered[index]?.[0];
    if (key) proFakeListingSignatureIntel.delete(key);
  }
}

function registerFakeListingSignatureEvent(signature = "", fingerprint = "", nowTs = Date.now()) {
  const safeSignature = text(signature);
  const safeFingerprint = text(fingerprint);
  if (!safeSignature || !safeFingerprint) {
    return {
      occurrences: 0,
      distinctFingerprintCount: 0,
      recentBurstCount: 0,
      firstSeenAt: 0,
      lastSeenAt: nowTs
    };
  }

  const previous = proFakeListingSignatureIntel.get(safeSignature);
  const events = [
    ...(Array.isArray(previous?.events) ? previous.events : []),
    {
      at: nowTs,
      fingerprint: safeFingerprint
    }
  ].filter((item) => Number(item?.at || 0) >= nowTs - FAKE_LISTING_SIGNATURE_INTEL_WINDOW_MS);

  const distinctFingerprintCount = new Set(events.map((item) => text(item?.fingerprint))).size;
  const recentBurstCount = events.filter(
    (item) => Number(item?.at || 0) >= nowTs - 10 * 60 * 1000
  ).length;
  const signatureRow = {
    signature: safeSignature,
    events,
    occurrences: events.length,
    distinctFingerprintCount,
    firstSeenAt: Number(events[0]?.at || nowTs),
    lastSeenAt: Number(events[events.length - 1]?.at || nowTs),
    recentBurstCount
  };

  proFakeListingSignatureIntel.set(safeSignature, signatureRow);
  pruneFakeListingSignatureIntel(nowTs);

  return {
    occurrences: signatureRow.occurrences,
    distinctFingerprintCount: signatureRow.distinctFingerprintCount,
    recentBurstCount: signatureRow.recentBurstCount,
    firstSeenAt: signatureRow.firstSeenAt,
    lastSeenAt: signatureRow.lastSeenAt
  };
}

function hotFakeListingSignatures(limit = 20) {
  const nowTs = Date.now();
  pruneFakeListingSignatureIntel(nowTs);
  return [...proFakeListingSignatureIntel.values()]
    .map((row) => ({
      signature: text(row?.signature),
      occurrences: Math.max(0, Number(row?.occurrences || 0)),
      distinctFingerprintCount: Math.max(0, Number(row?.distinctFingerprintCount || 0)),
      recentBurstCount: Math.max(0, Number(row?.recentBurstCount || 0)),
      firstSeenAt: Number(row?.firstSeenAt || 0),
      lastSeenAt: Number(row?.lastSeenAt || 0)
    }))
    .sort((a, b) =>
      b.distinctFingerprintCount - a.distinctFingerprintCount ||
      b.occurrences - a.occurrences ||
      b.lastSeenAt - a.lastSeenAt
    )
    .slice(0, Math.max(1, Math.min(100, Number(limit || 20))));
}

function tokenKeyFromEvaluation(evaluation = {}, token = "") {
  const metadata = evaluation?.metadata && typeof evaluation.metadata === "object"
    ? evaluation.metadata
    : {};
  const jti = text(metadata.jti);
  if (jti) return `jti:${sha256(jti).slice(0, 24)}`;
  return `tok:${sha256(text(token)).slice(0, 24)}`;
}

function pruneTokenIntelligence(nowTs = Date.now()) {
  if (!proTokenIntelligence.size) return;

  for (const [tokenKey, row] of proTokenIntelligence.entries()) {
    const recent = (Array.isArray(row?.events) ? row.events : []).filter(
      (item) => Number(item?.at || 0) >= nowTs - TOKEN_REPLAY_WINDOW_MS
    );
    if (!recent.length) {
      proTokenIntelligence.delete(tokenKey);
      continue;
    }
    proTokenIntelligence.set(tokenKey, {
      ...row,
      events: recent,
      lastSeenAt: Math.max(...recent.map((item) => Number(item?.at || 0)))
    });
  }

  if (proTokenIntelligence.size <= TOKEN_INTEL_MAX_ITEMS) return;
  const overflow = proTokenIntelligence.size - TOKEN_INTEL_MAX_ITEMS;
  const ordered = [...proTokenIntelligence.entries()].sort(
    (a, b) => Number(a[1]?.lastSeenAt || 0) - Number(b[1]?.lastSeenAt || 0)
  );
  for (let index = 0; index < overflow; index += 1) {
    const key = ordered[index]?.[0];
    if (key) proTokenIntelligence.delete(key);
  }
}

function registerTokenUsage({
  tokenKey = "",
  fingerprint = "",
  ip = "",
  subject = "",
  jti = "",
  issuer = "",
  audience = "",
  nowTs = Date.now()
} = {}) {
  const safeTokenKey = text(tokenKey);
  if (!safeTokenKey) {
    return {
      occurrences: 0,
      distinctFingerprintCount: 0,
      distinctIpCount: 0,
      firstSeenAt: 0,
      lastSeenAt: nowTs
    };
  }

  const previous = proTokenIntelligence.get(safeTokenKey);
  const events = [
    ...(Array.isArray(previous?.events) ? previous.events : []),
    {
      at: nowTs,
      fingerprint: text(fingerprint),
      ip: text(ip),
      subject: text(subject),
      jti: text(jti),
      issuer: text(issuer),
      audience: text(audience)
    }
  ].filter((item) => Number(item?.at || 0) >= nowTs - TOKEN_REPLAY_WINDOW_MS);

  const distinctFingerprintCount = new Set(
    events.map((item) => text(item?.fingerprint)).filter(Boolean)
  ).size;
  const distinctIpCount = new Set(
    events.map((item) => text(item?.ip).replace(/^::ffff:/i, "")).filter(Boolean)
  ).size;
  const row = {
    tokenKey: safeTokenKey,
    subject: text(subject),
    jti: text(jti),
    issuer: text(issuer),
    audience: text(audience),
    events,
    occurrences: events.length,
    distinctFingerprintCount,
    distinctIpCount,
    firstSeenAt: Number(events[0]?.at || nowTs),
    lastSeenAt: Number(events[events.length - 1]?.at || nowTs)
  };
  proTokenIntelligence.set(safeTokenKey, row);
  pruneTokenIntelligence(nowTs);

  return {
    tokenKey: safeTokenKey,
    occurrences: row.occurrences,
    distinctFingerprintCount: row.distinctFingerprintCount,
    distinctIpCount: row.distinctIpCount,
    firstSeenAt: row.firstSeenAt,
    lastSeenAt: row.lastSeenAt,
    subject: row.subject,
    jti: row.jti,
    issuer: row.issuer,
    audience: row.audience
  };
}

function hotTokenIntelligence(limit = 20) {
  const nowTs = Date.now();
  pruneTokenIntelligence(nowTs);
  return [...proTokenIntelligence.values()]
    .map((row) => ({
      tokenKey: text(row?.tokenKey),
      subject: text(row?.subject),
      issuer: text(row?.issuer),
      audience: text(row?.audience),
      hasJti: Boolean(text(row?.jti)),
      occurrences: Math.max(0, Number(row?.occurrences || 0)),
      distinctFingerprintCount: Math.max(0, Number(row?.distinctFingerprintCount || 0)),
      distinctIpCount: Math.max(0, Number(row?.distinctIpCount || 0)),
      firstSeenAt: Number(row?.firstSeenAt || 0),
      lastSeenAt: Number(row?.lastSeenAt || 0)
    }))
    .sort((a, b) =>
      b.distinctFingerprintCount - a.distinctFingerprintCount ||
      b.distinctIpCount - a.distinctIpCount ||
      b.occurrences - a.occurrences ||
      b.lastSeenAt - a.lastSeenAt
    )
    .slice(0, Math.max(1, Math.min(100, Number(limit || 20))));
}

function pruneSubjectIntelligence(nowTs = Date.now()) {
  if (!proSubjectIntelligence.size) return;

  for (const [subjectKey, row] of proSubjectIntelligence.entries()) {
    const recent = (Array.isArray(row?.events) ? row.events : []).filter(
      (item) => Number(item?.at || 0) >= nowTs - SUBJECT_INTEL_WINDOW_MS
    );
    if (!recent.length) {
      proSubjectIntelligence.delete(subjectKey);
      continue;
    }
    proSubjectIntelligence.set(subjectKey, {
      ...row,
      events: recent,
      lastSeenAt: Math.max(...recent.map((item) => Number(item?.at || 0)))
    });
  }

  if (proSubjectIntelligence.size <= SUBJECT_INTEL_MAX_ITEMS) return;
  const overflow = proSubjectIntelligence.size - SUBJECT_INTEL_MAX_ITEMS;
  const ordered = [...proSubjectIntelligence.entries()].sort(
    (a, b) => Number(a[1]?.lastSeenAt || 0) - Number(b[1]?.lastSeenAt || 0)
  );
  for (let index = 0; index < overflow; index += 1) {
    const key = ordered[index]?.[0];
    if (key) proSubjectIntelligence.delete(key);
  }
}

function registerSubjectUsage({
  subject = "",
  fingerprint = "",
  ip = "",
  tokenKey = "",
  nowTs = Date.now()
} = {}) {
  const safeSubject = text(subject).toLowerCase();
  if (!safeSubject) {
    return {
      subject: "",
      occurrences: 0,
      distinctFingerprintCount: 0,
      distinctIpCount: 0,
      firstSeenAt: 0,
      lastSeenAt: nowTs
    };
  }

  const previous = proSubjectIntelligence.get(safeSubject);
  const events = [
    ...(Array.isArray(previous?.events) ? previous.events : []),
    {
      at: nowTs,
      fingerprint: text(fingerprint),
      ip: text(ip).replace(/^::ffff:/i, ""),
      tokenKey: text(tokenKey)
    }
  ].filter((item) => Number(item?.at || 0) >= nowTs - SUBJECT_INTEL_WINDOW_MS);

  const distinctFingerprintCount = new Set(
    events.map((item) => text(item?.fingerprint)).filter(Boolean)
  ).size;
  const distinctIpCount = new Set(
    events.map((item) => text(item?.ip)).filter(Boolean)
  ).size;
  const row = {
    subject: safeSubject,
    events,
    occurrences: events.length,
    distinctFingerprintCount,
    distinctIpCount,
    firstSeenAt: Number(events[0]?.at || nowTs),
    lastSeenAt: Number(events[events.length - 1]?.at || nowTs)
  };
  proSubjectIntelligence.set(safeSubject, row);
  pruneSubjectIntelligence(nowTs);

  return {
    subject: safeSubject,
    occurrences: row.occurrences,
    distinctFingerprintCount: row.distinctFingerprintCount,
    distinctIpCount: row.distinctIpCount,
    firstSeenAt: row.firstSeenAt,
    lastSeenAt: row.lastSeenAt
  };
}

function hotSubjectIntelligence(limit = 20) {
  const nowTs = Date.now();
  pruneSubjectIntelligence(nowTs);
  return [...proSubjectIntelligence.values()]
    .map((row) => ({
      subject: text(row?.subject),
      occurrences: Math.max(0, Number(row?.occurrences || 0)),
      distinctFingerprintCount: Math.max(0, Number(row?.distinctFingerprintCount || 0)),
      distinctIpCount: Math.max(0, Number(row?.distinctIpCount || 0)),
      firstSeenAt: Number(row?.firstSeenAt || 0),
      lastSeenAt: Number(row?.lastSeenAt || 0)
    }))
    .sort((a, b) =>
      b.distinctFingerprintCount - a.distinctFingerprintCount ||
      b.distinctIpCount - a.distinctIpCount ||
      b.occurrences - a.occurrences ||
      b.lastSeenAt - a.lastSeenAt
    )
    .slice(0, Math.max(1, Math.min(100, Number(limit || 20))));
}

function pruneSubjectSessionIntel(nowTs = Date.now()) {
  if (!proSubjectSessionIntel.size) return;

  for (const [subjectKey, row] of proSubjectSessionIntel.entries()) {
    const recent = (Array.isArray(row?.events) ? row.events : []).filter(
      (item) => Number(item?.at || 0) >= nowTs - SUBJECT_SESSION_STORAGE_WINDOW_MS
    );
    if (!recent.length) {
      proSubjectSessionIntel.delete(subjectKey);
      continue;
    }
    const distinctTokenKeyCount = new Set(
      recent.map((item) => text(item?.tokenKey)).filter(Boolean)
    ).size;
    const distinctFingerprintCount = new Set(
      recent.map((item) => text(item?.fingerprint)).filter(Boolean)
    ).size;
    const distinctIpCount = new Set(
      recent.map((item) => text(item?.ip)).filter(Boolean)
    ).size;
    const distinctNetworkPrefixCount = new Set(
      recent.map((item) => text(item?.networkPrefix)).filter(Boolean)
    ).size;
    proSubjectSessionIntel.set(subjectKey, {
      ...row,
      events: recent,
      occurrences: recent.length,
      distinctTokenKeyCount,
      distinctFingerprintCount,
      distinctIpCount,
      distinctNetworkPrefixCount,
      firstSeenAt: Number(recent[0]?.at || nowTs),
      lastSeenAt: Number(recent[recent.length - 1]?.at || nowTs)
    });
  }

  if (proSubjectSessionIntel.size <= SUBJECT_SESSION_INTEL_MAX_ITEMS) return;
  const overflow = proSubjectSessionIntel.size - SUBJECT_SESSION_INTEL_MAX_ITEMS;
  const ordered = [...proSubjectSessionIntel.entries()].sort(
    (a, b) => Number(a[1]?.lastSeenAt || 0) - Number(b[1]?.lastSeenAt || 0)
  );
  for (let index = 0; index < overflow; index += 1) {
    const key = ordered[index]?.[0];
    if (key) proSubjectSessionIntel.delete(key);
  }
}

function registerSubjectSessionSignal({
  subject = "",
  tokenKey = "",
  fingerprint = "",
  ip = "",
  nowTs = Date.now()
} = {}) {
  const safeSubject = normalizeTokenSubject(subject);
  if (!safeSubject) {
    return {
      subject: "",
      occurrences: 0,
      distinctTokenKeyCount: 0,
      distinctFingerprintCount: 0,
      distinctIpCount: 0,
      firstSeenAt: 0,
      lastSeenAt: nowTs
    };
  }

  const previous = proSubjectSessionIntel.get(safeSubject);
  const safeTokenKey = text(tokenKey).slice(0, 180) || "unknown-token";
  const safeFingerprint = text(fingerprint);
  const safeIp = text(ip).replace(/^::ffff:/i, "");
  const safeNetworkPrefix = normalizeIpNetworkPrefix(safeIp);
  const events = [
    ...(Array.isArray(previous?.events) ? previous.events : []),
    {
      at: nowTs,
      tokenKey: safeTokenKey,
      fingerprint: safeFingerprint,
      ip: safeIp,
      networkPrefix: safeNetworkPrefix
    }
  ].filter((item) => Number(item?.at || 0) >= nowTs - SUBJECT_SESSION_STORAGE_WINDOW_MS);

  const distinctTokenKeyCount = new Set(
    events.map((item) => text(item?.tokenKey)).filter(Boolean)
  ).size;
  const distinctFingerprintCount = new Set(
    events.map((item) => text(item?.fingerprint)).filter(Boolean)
  ).size;
  const distinctIpCount = new Set(
    events.map((item) => text(item?.ip)).filter(Boolean)
  ).size;
  const distinctNetworkPrefixCount = new Set(
    events.map((item) => text(item?.networkPrefix)).filter(Boolean)
  ).size;
  const row = {
    subject: safeSubject,
    events,
    occurrences: events.length,
    distinctTokenKeyCount,
    distinctFingerprintCount,
    distinctIpCount,
    distinctNetworkPrefixCount,
    firstSeenAt: Number(events[0]?.at || nowTs),
    lastSeenAt: Number(events[events.length - 1]?.at || nowTs)
  };
  proSubjectSessionIntel.set(safeSubject, row);
  pruneSubjectSessionIntel(nowTs);

  return {
    subject: safeSubject,
    occurrences: row.occurrences,
    distinctTokenKeyCount: row.distinctTokenKeyCount,
    distinctFingerprintCount: row.distinctFingerprintCount,
    distinctIpCount: row.distinctIpCount,
    distinctNetworkPrefixCount: row.distinctNetworkPrefixCount,
    firstSeenAt: row.firstSeenAt,
    lastSeenAt: row.lastSeenAt
  };
}

function countNetworkPrefixJumps(events = []) {
  const ordered = [...events]
    .filter((item) => Number(item?.at || 0) > 0)
    .sort((a, b) => Number(a?.at || 0) - Number(b?.at || 0));
  if (ordered.length < 2) return 0;
  let jumps = 0;
  let previousPrefix = text(ordered[0]?.networkPrefix);
  for (let index = 1; index < ordered.length; index += 1) {
    const currentPrefix = text(ordered[index]?.networkPrefix);
    if (!currentPrefix) continue;
    if (previousPrefix && currentPrefix !== previousPrefix) {
      jumps += 1;
    }
    previousPrefix = currentPrefix;
  }
  return jumps;
}

function hotSubjectSessionIntelligence(limit = 20, windowMs = SUBJECT_SESSION_STORAGE_WINDOW_MS) {
  const nowTs = Date.now();
  pruneSubjectSessionIntel(nowTs);
  const safeWindowMs = Math.max(5 * 60 * 1000, Number(windowMs || SUBJECT_SESSION_STORAGE_WINDOW_MS));
  const cutoff = nowTs - safeWindowMs;
  return [...proSubjectSessionIntel.values()]
    .map((row) => {
      const recent = (Array.isArray(row?.events) ? row.events : []).filter(
        (item) => Number(item?.at || 0) >= cutoff
      );
      const distinctTokenKeyCount = new Set(
        recent.map((item) => text(item?.tokenKey)).filter(Boolean)
      ).size;
      const distinctFingerprintCount = new Set(
        recent.map((item) => text(item?.fingerprint)).filter(Boolean)
      ).size;
      const distinctIpCount = new Set(
        recent.map((item) => text(item?.ip)).filter(Boolean)
      ).size;
      const distinctNetworkPrefixCount = new Set(
        recent.map((item) => text(item?.networkPrefix)).filter(Boolean)
      ).size;
      const networkJumpCount = countNetworkPrefixJumps(recent);
      return {
        subject: text(row?.subject),
        occurrences: recent.length,
        distinctTokenKeyCount,
        distinctFingerprintCount,
        distinctIpCount,
        distinctNetworkPrefixCount,
        networkJumpCount,
        firstSeenAt: Number(recent[0]?.at || 0),
        lastSeenAt: Number(recent[recent.length - 1]?.at || 0)
      };
    })
    .filter((row) => row.occurrences > 0)
    .sort((a, b) =>
      b.networkJumpCount - a.networkJumpCount ||
      b.distinctNetworkPrefixCount - a.distinctNetworkPrefixCount ||
      b.distinctTokenKeyCount - a.distinctTokenKeyCount ||
      b.distinctFingerprintCount - a.distinctFingerprintCount ||
      b.distinctIpCount - a.distinctIpCount ||
      b.occurrences - a.occurrences ||
      b.lastSeenAt - a.lastSeenAt
    )
    .slice(0, Math.max(1, Math.min(100, Number(limit || 20))));
}

function pruneAutoPromoteIntel(nowTs = Date.now()) {
  if (!proAutoPromoteIntel.size) return;

  for (const [key, row] of proAutoPromoteIntel.entries()) {
    const recent = (Array.isArray(row?.events) ? row.events : []).filter(
      (item) => Number(item?.at || 0) >= nowTs - AUTO_PROMOTE_STORAGE_WINDOW_MS
    );
    if (!recent.length) {
      proAutoPromoteIntel.delete(key);
      continue;
    }
    proAutoPromoteIntel.set(key, {
      ...row,
      events: recent,
      lastSeenAt: Math.max(...recent.map((item) => Number(item?.at || 0)))
    });
  }

  if (proAutoPromoteIntel.size <= AUTO_PROMOTE_INTEL_MAX_ITEMS) return;
  const overflow = proAutoPromoteIntel.size - AUTO_PROMOTE_INTEL_MAX_ITEMS;
  const ordered = [...proAutoPromoteIntel.entries()].sort(
    (a, b) => Number(a[1]?.lastSeenAt || 0) - Number(b[1]?.lastSeenAt || 0)
  );
  for (let index = 0; index < overflow; index += 1) {
    const key = ordered[index]?.[0];
    if (key) proAutoPromoteIntel.delete(key);
  }
}

function registerAutoPromoteSignal({
  kind = "",
  key = "",
  blocked = false,
  reason = "",
  nowTs = Date.now(),
  windowMs = 2 * 60 * 60 * 1000
} = {}) {
  const safeKind = text(kind).toLowerCase();
  const safeKey = text(key).toLowerCase();
  if (!safeKind || !safeKey) {
    return {
      key: "",
      kind: safeKind,
      events: 0,
      blockedEvents: 0,
      firstSeenAt: 0,
      lastSeenAt: nowTs
    };
  }

  const mapKey = `${safeKind}:${safeKey}`;
  const previous = proAutoPromoteIntel.get(mapKey);
  const events = [
    ...(Array.isArray(previous?.events) ? previous.events : []),
    {
      at: nowTs,
      blocked: Boolean(blocked),
      reason: text(reason).slice(0, 120)
    }
  ].filter((item) => Number(item?.at || 0) >= nowTs - AUTO_PROMOTE_STORAGE_WINDOW_MS);

  const recent = events.filter((item) => Number(item?.at || 0) >= nowTs - Math.max(60_000, Number(windowMs || 0)));
  const blockedEvents = recent.filter((item) => Boolean(item?.blocked)).length;
  const row = {
    kind: safeKind,
    key: safeKey,
    events,
    totalEvents: events.length,
    recentEvents: recent.length,
    recentBlockedEvents: blockedEvents,
    firstSeenAt: Number(events[0]?.at || nowTs),
    lastSeenAt: Number(events[events.length - 1]?.at || nowTs)
  };
  proAutoPromoteIntel.set(mapKey, row);
  pruneAutoPromoteIntel(nowTs);

  return {
    key: safeKey,
    kind: safeKind,
    events: row.recentEvents,
    blockedEvents: row.recentBlockedEvents,
    firstSeenAt: row.firstSeenAt,
    lastSeenAt: row.lastSeenAt
  };
}

function pushAutoPromotionEvent(event = {}) {
  const row = {
    id: `promo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: nowIso(),
    kind: text(event.kind),
    value: text(event.value),
    reason: text(event.reason),
    blocked: Boolean(event.blocked),
    requestId: text(event.requestId),
    path: text(event.path),
    fingerprint: text(event.fingerprint),
    ip: text(event.ip),
    subject: text(event.subject)
  };
  proAutoPromotionEvents.unshift(row);
  if (proAutoPromotionEvents.length > AUTO_PROMOTION_EVENT_MAX_ITEMS) {
    proAutoPromotionEvents.length = AUTO_PROMOTION_EVENT_MAX_ITEMS;
  }
}

function addToLimitedUniqueList(list = [], value = "", max = 100) {
  const safe = text(value).toLowerCase();
  if (!safe) return false;
  if (list.includes(safe)) return false;
  if (list.length >= Math.max(1, Number(max || 1))) {
    list.shift();
  }
  list.push(safe);
  return true;
}

function maybeAutoPromoteSecurityBlocklists({
  fingerprint = "",
  ip = "",
  subject = "",
  reason = "",
  blocked = false,
  path: requestPath = "",
  requestId = ""
} = {}) {
  const safeReason = text(reason).toLowerCase();
  const safePath = normalizeRequestPath(requestPath);
  if (!fingerprint && !ip && !subject) return;
  if (safeReason.startsWith("manual-")) return;
  if (isSecurityControlPath(safePath)) return;

  const adminControls = currentSecurityAdminControls();
  if (!toBoolean(adminControls.autoPromoteBlocklists, true)) return;

  const thresholds = currentSecurityThresholds();
  const windowMinutes = Math.max(30, Number(thresholds.autoPromoteWindowMinutes || 120));
  const windowMs = Math.min(24 * 60 * 60 * 1000, Math.max(5 * 60 * 1000, windowMinutes * 60 * 1000));
  const fingerprintThreshold = Math.max(3, Number(thresholds.autoPromoteFingerprintEvents || 12));
  const ipThreshold = Math.max(3, Number(thresholds.autoPromoteIpEvents || 15));
  const subjectThreshold = Math.max(3, Number(thresholds.autoPromoteSubjectEvents || 8));
  const blockedThreshold = Math.max(1, Number(thresholds.autoPromoteBlockedEvents || 3));

  const currentLists = currentSecurityLists();
  const nextLists = {
    blockedIps: Array.isArray(currentLists.blockedIps) ? [...currentLists.blockedIps] : [],
    blockedFingerprints: Array.isArray(currentLists.blockedFingerprints) ? [...currentLists.blockedFingerprints] : [],
    blockedUserAgentSignatures: Array.isArray(currentLists.blockedUserAgentSignatures)
      ? [...currentLists.blockedUserAgentSignatures]
      : [],
    blockedTokenSubjects: Array.isArray(currentLists.blockedTokenSubjects) ? [...currentLists.blockedTokenSubjects] : []
  };
  const promotions = [];
  const nowTs = Date.now();

  const safeFingerprint = normalizeProSecurityThreatFingerprint(fingerprint);
  if (
    isValidProSecurityThreatFingerprint(safeFingerprint) &&
    !isTrustedSecurityFingerprint(safeFingerprint) &&
    !nextLists.blockedFingerprints.includes(safeFingerprint)
  ) {
    const stats = registerAutoPromoteSignal({
      kind: "fingerprint",
      key: safeFingerprint,
      blocked,
      reason: safeReason,
      nowTs,
      windowMs
    });
    if (stats.events >= fingerprintThreshold || stats.blockedEvents >= blockedThreshold) {
      const inserted = addToLimitedUniqueList(nextLists.blockedFingerprints, safeFingerprint, MAX_BLOCKED_FINGERPRINT_ITEMS);
      if (inserted) {
        promotions.push({
          kind: "fingerprint",
          value: safeFingerprint,
          stats
        });
      }
    }
  }

  const safeIp = normalizeIpEntry(ip);
  if (isValidBlockedIpEntry(safeIp) && !isBlockedSecurityIp(safeIp)) {
    const stats = registerAutoPromoteSignal({
      kind: "ip",
      key: safeIp,
      blocked,
      reason: safeReason,
      nowTs,
      windowMs
    });
    if (stats.events >= ipThreshold || stats.blockedEvents >= blockedThreshold) {
      const inserted = addToLimitedUniqueList(nextLists.blockedIps, safeIp, MAX_BLOCKED_IP_ITEMS);
      if (inserted) {
        promotions.push({
          kind: "ip",
          value: safeIp,
          stats
        });
      }
    }
  }

  const safeSubject = text(subject).toLowerCase();
  if (safeSubject && !nextLists.blockedTokenSubjects.includes(safeSubject)) {
    const stats = registerAutoPromoteSignal({
      kind: "subject",
      key: safeSubject,
      blocked,
      reason: safeReason,
      nowTs,
      windowMs
    });
    if (stats.events >= subjectThreshold || stats.blockedEvents >= blockedThreshold) {
      const inserted = addToLimitedUniqueList(nextLists.blockedTokenSubjects, safeSubject, MAX_BLOCKED_TOKEN_SUBJECT_ITEMS);
      if (inserted) {
        promotions.push({
          kind: "subject",
          value: safeSubject,
          stats
        });
      }
    }
  }

  if (!promotions.length) return;

  const updateResult = updateProSecurityControlState(
    {
      lists: nextLists
    },
    {
      actorId: "ai-guardian",
      actorRole: "system"
    }
  );

  pushSecurityAuditEventInternal({
    severity: "high",
    type: "auto-blocklist-promoted",
    method: "PATCH",
    path: safePath || "/api",
    fingerprint: safeFingerprint,
    details: {
      requestId: text(requestId),
      reason: safeReason,
      blocked: Boolean(blocked),
      promotions: promotions.map((item) => ({
        kind: item.kind,
        value: item.value,
        events: item.stats.events,
        blockedEvents: item.stats.blockedEvents
      })),
      warnings: Array.isArray(updateResult?.warnings) ? updateResult.warnings.slice(0, 8) : []
    }
  });

  promotions.forEach((item) => {
    pushAutoPromotionEvent({
      kind: item.kind,
      value: item.value,
      reason: safeReason,
      blocked: Boolean(blocked),
      requestId: text(requestId),
      path: safePath,
      fingerprint: safeFingerprint,
      ip: safeIp,
      subject: safeSubject
    });
  });
}

function isCriticalThreatIncidentRow(row = {}) {
  const reason = text(row?.reason).toLowerCase();
  const path = text(row?.path).toLowerCase();
  const rules = Array.isArray(row?.rules) ? row.rules.map((item) => text(item).toLowerCase()) : [];
  const bag = [reason, path, ...rules].join(" | ");
  return CRITICAL_THREAT_PATTERNS.some((pattern) => pattern.test(bag));
}

function maybeApplyCriticalThreatResponse(row = {}) {
  if (!row || typeof row !== "object") return;
  if (!isCriticalThreatIncidentRow(row)) return;

  const adminControls = currentSecurityAdminControls();
  if (!toBoolean(adminControls.autoCriticalResponse, true)) return;

  const reason = text(row.reason).toLowerCase();
  const safePath = normalizeRequestPath(row.path || "/api");
  if (isSecurityControlPath(safePath)) return;

  const nowTs = Date.now();
  const currentLists = currentSecurityLists();
  const nextLists = {
    blockedIps: Array.isArray(currentLists.blockedIps) ? [...currentLists.blockedIps] : [],
    blockedFingerprints: Array.isArray(currentLists.blockedFingerprints) ? [...currentLists.blockedFingerprints] : [],
    blockedUserAgentSignatures: Array.isArray(currentLists.blockedUserAgentSignatures)
      ? [...currentLists.blockedUserAgentSignatures]
      : [],
    blockedTokenSubjects: Array.isArray(currentLists.blockedTokenSubjects) ? [...currentLists.blockedTokenSubjects] : []
  };
  const promotions = [];

  if (toBoolean(adminControls.autoCriticalImmediateBlocklist, true)) {
    const safeFingerprint = normalizeProSecurityThreatFingerprint(row.fingerprint);
    if (
      isValidProSecurityThreatFingerprint(safeFingerprint) &&
      !isTrustedSecurityFingerprint(safeFingerprint) &&
      !nextLists.blockedFingerprints.includes(safeFingerprint)
    ) {
      const inserted = addToLimitedUniqueList(nextLists.blockedFingerprints, safeFingerprint, MAX_BLOCKED_FINGERPRINT_ITEMS);
      if (inserted) promotions.push({ kind: "fingerprint", value: safeFingerprint });
    }

    const safeIp = normalizeIpEntry(row.ip);
    if (isValidBlockedIpEntry(safeIp) && !isBlockedSecurityIp(safeIp)) {
      const inserted = addToLimitedUniqueList(nextLists.blockedIps, safeIp, MAX_BLOCKED_IP_ITEMS);
      if (inserted) promotions.push({ kind: "ip", value: safeIp });
    }

    const safeSubject = text(row.subject).toLowerCase();
    if (safeSubject && !nextLists.blockedTokenSubjects.includes(safeSubject)) {
      const inserted = addToLimitedUniqueList(nextLists.blockedTokenSubjects, safeSubject, MAX_BLOCKED_TOKEN_SUBJECT_ITEMS);
      if (inserted) promotions.push({ kind: "subject", value: safeSubject });
    }
  }

  let warnings = [];
  if (promotions.length) {
    const updateResult = updateProSecurityControlState(
      { lists: nextLists },
      { actorId: "ai-guardian", actorRole: "system" }
    );
    warnings = Array.isArray(updateResult?.warnings) ? updateResult.warnings.slice(0, 8) : [];
  }

  const fromMode = currentSecurityMode();
  let toMode = fromMode;
  let modeChanged = false;
  if (toBoolean(adminControls.autoCriticalLockdown, true) && fromMode !== "lockdown") {
    const thresholds = currentSecurityThresholds();
    const cooldownMs = Math.max(
      60_000,
      Math.min(
        12 * 60 * 60 * 1000,
        Number(thresholds.criticalLockdownCooldownMinutes || 10) * 60 * 1000
      )
    );
    if (proLastCriticalLockdownAt === 0 || nowTs - proLastCriticalLockdownAt >= cooldownMs) {
      const profileResult = applyProSecurityControlProfile("lockdown", {
        actorId: "ai-guardian",
        actorRole: "system"
      });
      if (profileResult.applied) {
        modeChanged = true;
        toMode = "lockdown";
        proLastCriticalLockdownAt = nowTs;
        proLastAutoModeChangeAt = nowTs;
        if (Array.isArray(profileResult.warnings) && profileResult.warnings.length) {
          warnings = [...warnings, ...profileResult.warnings.slice(0, 4)];
        }
      }
    }
  }

  const responseEvent = {
    id: `critical-${nowTs}-${Math.random().toString(36).slice(2, 7)}`,
    at: nowIso(),
    reason,
    path: safePath,
    requestId: text(row.requestId),
    fingerprint: text(row.fingerprint),
    ip: text(row.ip),
    subject: text(row.subject),
    blocked: Boolean(row.blocked),
    modeChanged,
    fromMode,
    toMode,
    promotions
  };
  proCriticalResponseEvents.unshift(responseEvent);
  if (proCriticalResponseEvents.length > CRITICAL_RESPONSE_EVENT_MAX_ITEMS) {
    proCriticalResponseEvents.length = CRITICAL_RESPONSE_EVENT_MAX_ITEMS;
  }

  pushSecurityAuditEventInternal({
    severity: "high",
    type: modeChanged ? "critical-threat-lockdown-response" : "critical-threat-immediate-response",
    requestId: text(row.requestId),
    ip: text(row.ip),
    fingerprint: text(row.fingerprint),
    path: safePath,
    method: text(row.method || "POST"),
    details: {
      reason,
      blocked: Boolean(row.blocked),
      modeChanged,
      fromMode,
      toMode,
      promotions,
      warnings: warnings.slice(0, 8)
    }
  });
}

function maybeApplyCampaignThreatResponse(row = {}) {
  if (!row || typeof row !== "object") return;

  const safePath = normalizeRequestPath(row.path || "/api");
  if (isSecurityControlPath(safePath)) return;

  const adminControls = currentSecurityAdminControls();
  if (!toBoolean(adminControls.autoCampaignLockdown, true)) return;

  const currentMode = currentSecurityMode();
  if (currentMode === "lockdown") return;

  const thresholds = currentSecurityThresholds();
  const windowMs = Math.max(
    10 * 60 * 1000,
    Math.min(24 * 60 * 60 * 1000, Number(thresholds.campaignWindowMinutes || 45) * 60 * 1000)
  );
  const incidentThreshold = Math.max(5, Number(thresholds.campaignIncidentThreshold || 35));
  const distinctFingerprintThreshold = Math.max(
    2,
    Number(thresholds.campaignDistinctFingerprintThreshold || 8)
  );
  const distinctIpThreshold = Math.max(
    2,
    Number(thresholds.campaignDistinctIpThreshold || 6)
  );
  const blockedThreshold = Math.max(1, Number(thresholds.campaignBlockedThreshold || 10));
  const cooldownMs = Math.max(
    60_000,
    Math.min(12 * 60 * 60 * 1000, Number(thresholds.campaignCooldownMinutes || 15) * 60 * 1000)
  );

  const nowTs = Date.now();
  if (proLastCampaignLockdownAt > 0 && nowTs - proLastCampaignLockdownAt < cooldownMs) {
    return;
  }

  const cutoff = nowTs - windowMs;
  const recent = proThreatIncidents.filter((item) => {
    const at = Date.parse(text(item?.at));
    if (!Number.isFinite(at) || at < cutoff) return false;
    return !isSecurityControlPath(normalizeRequestPath(item?.path || "/api"));
  });
  if (!recent.length) return;

  const fingerprintSet = new Set();
  const ipSet = new Set();
  let blockedEvents = 0;
  for (const item of recent) {
    const fingerprint = normalizeProSecurityThreatFingerprint(item?.fingerprint);
    if (isValidProSecurityThreatFingerprint(fingerprint)) {
      fingerprintSet.add(fingerprint);
    }
    const safeIp = normalizeIpEntry(item?.ip);
    if (safeIp) ipSet.add(safeIp);
    if (toBoolean(item?.blocked, false)) blockedEvents += 1;
  }

  const totalEvents = recent.length;
  const distinctFingerprintCount = fingerprintSet.size;
  const distinctIpCount = ipSet.size;
  const meetsVolume = totalEvents >= incidentThreshold;
  const meetsSpread =
    distinctFingerprintCount >= distinctFingerprintThreshold &&
    distinctIpCount >= distinctIpThreshold;
  const meetsBlocked = blockedEvents >= blockedThreshold;

  if (!meetsVolume || (!meetsSpread && !meetsBlocked)) return;

  const profileResult = applyProSecurityControlProfile("lockdown", {
    actorId: "ai-guardian",
    actorRole: "system"
  });
  if (!profileResult.applied) return;

  proLastCampaignLockdownAt = nowTs;
  proLastAutoModeChangeAt = nowTs;

  const responseEvent = {
    id: `campaign-${nowTs}-${Math.random().toString(36).slice(2, 7)}`,
    at: nowIso(),
    reason: text(row.reason).toLowerCase(),
    path: safePath,
    requestId: text(row.requestId),
    fingerprint: text(row.fingerprint),
    ip: text(row.ip),
    subject: text(row.subject),
    fromMode: currentMode,
    toMode: "lockdown",
    windowMinutes: Math.round(windowMs / 60_000),
    cooldownMinutes: Math.round(cooldownMs / 60_000),
    totalEvents,
    blockedEvents,
    distinctFingerprintCount,
    distinctIpCount,
    incidentThreshold,
    distinctFingerprintThreshold,
    distinctIpThreshold,
    blockedThreshold
  };
  proCampaignResponseEvents.unshift(responseEvent);
  if (proCampaignResponseEvents.length > CAMPAIGN_RESPONSE_EVENT_MAX_ITEMS) {
    proCampaignResponseEvents.length = CAMPAIGN_RESPONSE_EVENT_MAX_ITEMS;
  }

  pushSecurityAuditEventInternal({
    severity: "high",
    type: "auto-campaign-lockdown",
    requestId: text(row.requestId),
    ip: text(row.ip),
    fingerprint: text(row.fingerprint),
    path: safePath,
    method: text(row.method || "POST"),
    details: {
      reason: text(row.reason).toLowerCase(),
      fromMode: currentMode,
      toMode: "lockdown",
      windowMinutes: Math.round(windowMs / 60_000),
      cooldownMinutes: Math.round(cooldownMs / 60_000),
      totalEvents,
      blockedEvents,
      distinctFingerprintCount,
      distinctIpCount,
      thresholds: {
        incidentThreshold,
        distinctFingerprintThreshold,
        distinctIpThreshold,
        blockedThreshold
      },
      warnings: Array.isArray(profileResult.warnings) ? profileResult.warnings.slice(0, 8) : []
    }
  });
}

function currentAuthShieldStatus(nowTs = Date.now()) {
  const safeNow = Number(nowTs);
  const expiresAt = Math.max(0, Number(proAuthShieldUntil || 0));
  const active = expiresAt > safeNow;
  return {
    active,
    expiresAt,
    remainingSec: active ? Math.max(0, Math.ceil((expiresAt - safeNow) / 1000)) : 0
  };
}

function currentAdminMutationShieldStatus(nowTs = Date.now()) {
  const safeNow = Number(nowTs);
  const expiresAt = Math.max(0, Number(proAdminMutationShieldUntil || 0));
  const active = expiresAt > safeNow;
  return {
    active,
    expiresAt,
    remainingSec: active ? Math.max(0, Math.ceil((expiresAt - safeNow) / 1000)) : 0
  };
}

function maybeApplyAdminMutationShield({
  requestId = "",
  path: requestPath = "",
  method = "POST",
  reason = "admin-mutation-attempt",
  fingerprint = "",
  ip = ""
} = {}) {
  const safePath = normalizeRequestPath(requestPath || "/api/admin");
  const safeMethod = text(method).toUpperCase();
  if (!isAdminMutationPath(safePath, safeMethod)) return;

  const nowTs = Date.now();
  const attemptRow = {
    id: `admin-attempt-${nowTs}-${Math.random().toString(36).slice(2, 7)}`,
    at: nowIso(),
    atTs: nowTs,
    requestId: text(requestId),
    path: safePath,
    method: safeMethod,
    reason: text(reason).toLowerCase(),
    fingerprint: normalizeProSecurityThreatFingerprint(fingerprint),
    ip: normalizeIpEntry(ip)
  };
  proAdminMutationAttemptIntel.unshift(attemptRow);
  if (proAdminMutationAttemptIntel.length > ADMIN_MUTATION_ATTEMPT_MAX_ITEMS) {
    proAdminMutationAttemptIntel.length = ADMIN_MUTATION_ATTEMPT_MAX_ITEMS;
  }

  const adminControls = currentSecurityAdminControls();
  if (!toBoolean(adminControls.autoAdminMutationShield, true)) return;

  const thresholds = currentSecurityThresholds();
  const windowMs = Math.max(
    5 * 60 * 1000,
    Math.min(24 * 60 * 60 * 1000, Number(thresholds.adminMutationWindowMinutes || 30) * 60 * 1000)
  );
  const attemptThreshold = Math.max(2, Number(thresholds.adminMutationAttemptThreshold || 8));
  const distinctFingerprintThreshold = Math.max(
    2,
    Number(thresholds.adminMutationDistinctFingerprints || 4)
  );
  const distinctIpThreshold = Math.max(2, Number(thresholds.adminMutationDistinctIps || 3));
  const cooldownMs = Math.max(
    60_000,
    Math.min(12 * 60 * 60 * 1000, Number(thresholds.adminMutationCooldownMinutes || 10) * 60 * 1000)
  );
  if (
    proLastAdminMutationShieldAppliedAt > 0 &&
    nowTs - proLastAdminMutationShieldAppliedAt < cooldownMs
  ) {
    return;
  }

  const cutoff = nowTs - windowMs;
  const recent = proAdminMutationAttemptIntel.filter((item) => {
    const atTs = Number(item?.atTs || 0);
    if (!Number.isFinite(atTs) || atTs < cutoff) return false;
    const itemPath = normalizeRequestPath(item?.path || "/api");
    const itemMethod = text(item?.method).toUpperCase();
    return isAdminMutationPath(itemPath, itemMethod);
  });
  if (!recent.length) return;

  const distinctFingerprintCount = new Set(
    recent.map((item) => normalizeProSecurityThreatFingerprint(item?.fingerprint)).filter(Boolean)
  ).size;
  const distinctIpCount = new Set(
    recent.map((item) => normalizeIpEntry(item?.ip)).filter(Boolean)
  ).size;
  const attemptCount = recent.length;

  if (
    attemptCount < attemptThreshold ||
    (distinctFingerprintCount < distinctFingerprintThreshold && distinctIpCount < distinctIpThreshold)
  ) {
    return;
  }

  const durationMs = Math.max(
    60_000,
    Math.min(24 * 60 * 60 * 1000, Number(thresholds.adminMutationShieldDurationMinutes || 30) * 60 * 1000)
  );
  const nextUntil = nowTs + durationMs;
  proAdminMutationShieldUntil = Math.max(proAdminMutationShieldUntil, nextUntil);
  proLastAdminMutationShieldAppliedAt = nowTs;

  const event = {
    id: `admin-shield-${nowTs}-${Math.random().toString(36).slice(2, 7)}`,
    at: nowIso(),
    requestId: text(requestId),
    path: safePath,
    method: safeMethod,
    reason: text(reason).toLowerCase(),
    windowMinutes: Math.round(windowMs / 60_000),
    cooldownMinutes: Math.round(cooldownMs / 60_000),
    shieldDurationMinutes: Math.round(durationMs / 60_000),
    activeUntil: new Date(proAdminMutationShieldUntil).toISOString(),
    attempts: attemptCount,
    distinctFingerprintCount,
    distinctIpCount,
    thresholds: {
      attemptThreshold,
      distinctFingerprintThreshold,
      distinctIpThreshold
    }
  };
  proAdminMutationShieldEvents.unshift(event);
  if (proAdminMutationShieldEvents.length > ADMIN_MUTATION_SHIELD_EVENT_MAX_ITEMS) {
    proAdminMutationShieldEvents.length = ADMIN_MUTATION_SHIELD_EVENT_MAX_ITEMS;
  }

  pushSecurityAuditEventInternal({
    severity: "high",
    type: "auto-admin-mutation-shield",
    requestId: text(requestId),
    fingerprint: text(fingerprint),
    ip: text(ip),
    path: safePath,
    method: safeMethod,
    details: {
      reason: text(reason).toLowerCase(),
      activeUntil: new Date(proAdminMutationShieldUntil).toISOString(),
      windowMinutes: Math.round(windowMs / 60_000),
      cooldownMinutes: Math.round(cooldownMs / 60_000),
      shieldDurationMinutes: Math.round(durationMs / 60_000),
      attempts: attemptCount,
      distinctFingerprintCount,
      distinctIpCount,
      thresholds: {
        attemptThreshold,
        distinctFingerprintThreshold,
        distinctIpThreshold
      }
    }
  });
}

function maybeApplyAuthStormShield({
  requestId = "",
  path: requestPath = "",
  reason = "auth-failure-storm",
  method = "POST",
  statusCode = 401
} = {}) {
  const safePath = normalizeRequestPath(requestPath || "/api/auth");
  if (!isAuthApiPath(safePath)) return;
  if (isSecurityControlPath(safePath)) return;

  const adminControls = currentSecurityAdminControls();
  if (!toBoolean(adminControls.autoAuthStormShield, true)) return;

  const thresholds = currentSecurityThresholds();
  const nowTs = Date.now();
  const windowMs = Math.max(
    5 * 60 * 1000,
    Math.min(24 * 60 * 60 * 1000, Number(thresholds.authStormWindowMinutes || 20) * 60 * 1000)
  );
  const cooldownMs = Math.max(
    60_000,
    Math.min(12 * 60 * 60 * 1000, Number(thresholds.authStormCooldownMinutes || 10) * 60 * 1000)
  );
  if (proLastAuthShieldAppliedAt > 0 && nowTs - proLastAuthShieldAppliedAt < cooldownMs) {
    return;
  }

  const failureThreshold = Math.max(10, Number(thresholds.authStormFailureThreshold || 55));
  const distinctFingerprintThreshold = Math.max(2, Number(thresholds.authStormDistinctFingerprints || 10));
  const distinctIpThreshold = Math.max(2, Number(thresholds.authStormDistinctIps || 8));
  const distinctIdentityThreshold = Math.max(2, Number(thresholds.authStormDistinctIdentities || 24));

  const cutoff = nowTs - windowMs;
  const recent = proAuthFailureTelemetry
    .filter((item) => Number(item?.at || 0) >= cutoff)
    .slice(0, AUTH_FAILURE_TELEMETRY_MAX_ITEMS);
  if (!recent.length) return;

  const fingerprintSet = new Set();
  const ipSet = new Set();
  const identitySet = new Set();
  for (const item of recent) {
    const fingerprint = normalizeProSecurityThreatFingerprint(item?.fingerprint);
    if (isValidProSecurityThreatFingerprint(fingerprint)) {
      fingerprintSet.add(fingerprint);
    }
    const safeIp = normalizeIpEntry(item?.ip);
    if (safeIp) ipSet.add(safeIp);
    const identity = text(item?.identity).toLowerCase();
    if (identity) identitySet.add(identity);
  }

  const failureCount = recent.length;
  const distinctFingerprintCount = fingerprintSet.size;
  const distinctIpCount = ipSet.size;
  const distinctIdentityCount = identitySet.size;
  const spreadDetected =
    distinctFingerprintCount >= distinctFingerprintThreshold ||
    distinctIpCount >= distinctIpThreshold ||
    distinctIdentityCount >= distinctIdentityThreshold;

  if (failureCount < failureThreshold || !spreadDetected) return;

  const durationMs = Math.max(
    60_000,
    Math.min(12 * 60 * 60 * 1000, Number(thresholds.authStormShieldDurationMinutes || 15) * 60 * 1000)
  );
  const nextUntil = nowTs + durationMs;
  const previousStatus = currentAuthShieldStatus(nowTs);
  proAuthShieldUntil = Math.max(previousStatus.expiresAt, nextUntil);
  proLastAuthShieldAppliedAt = nowTs;

  const event = {
    id: `auth-shield-${nowTs}-${Math.random().toString(36).slice(2, 7)}`,
    at: nowIso(),
    requestId: text(requestId),
    reason: text(reason).toLowerCase(),
    path: safePath,
    method: text(method).toUpperCase(),
    statusCode: Math.max(0, Number(statusCode || 0)),
    windowMinutes: Math.round(windowMs / 60_000),
    cooldownMinutes: Math.round(cooldownMs / 60_000),
    shieldDurationMinutes: Math.round(durationMs / 60_000),
    activeUntil: new Date(proAuthShieldUntil).toISOString(),
    failures: failureCount,
    distinctFingerprintCount,
    distinctIpCount,
    distinctIdentityCount,
    thresholds: {
      failureThreshold,
      distinctFingerprintThreshold,
      distinctIpThreshold,
      distinctIdentityThreshold
    }
  };
  proAuthShieldEvents.unshift(event);
  if (proAuthShieldEvents.length > AUTH_SHIELD_EVENT_MAX_ITEMS) {
    proAuthShieldEvents.length = AUTH_SHIELD_EVENT_MAX_ITEMS;
  }

  pushSecurityAuditEventInternal({
    severity: "high",
    type: "auto-auth-storm-shield-activated",
    requestId: text(requestId),
    path: safePath,
    method: text(method).toUpperCase(),
    details: {
      reason: text(reason).toLowerCase(),
      activeUntil: new Date(proAuthShieldUntil).toISOString(),
      windowMinutes: Math.round(windowMs / 60_000),
      cooldownMinutes: Math.round(cooldownMs / 60_000),
      shieldDurationMinutes: Math.round(durationMs / 60_000),
      failures: failureCount,
      distinctFingerprintCount,
      distinctIpCount,
      distinctIdentityCount,
      thresholds: {
        failureThreshold,
        distinctFingerprintThreshold,
        distinctIpThreshold,
        distinctIdentityThreshold
      }
    }
  });
}

function maybeApplyAuthIdentityProtection({
  requestId = "",
  path: requestPath = "",
  reason = "auth-identity-targeted",
  method = "POST",
  statusCode = 401,
  identity = ""
} = {}) {
  const safePath = normalizeRequestPath(requestPath || "/api/auth");
  if (!isAuthApiPath(safePath)) return;
  if (isSecurityControlPath(safePath)) return;
  const safeIdentity = normalizeAuthIdentity(identity);
  if (!safeIdentity) return;

  const adminControls = currentSecurityAdminControls();
  if (!toBoolean(adminControls.autoIdentityProtection, true)) return;

  const thresholds = currentSecurityThresholds();
  const nowTs = Date.now();
  pruneProtectedAuthIdentities(nowTs);

  const windowMs = Math.max(
    5 * 60 * 1000,
    Math.min(24 * 60 * 60 * 1000, Number(thresholds.identityProtectionWindowMinutes || 45) * 60 * 1000)
  );
  const cooldownMs = Math.max(
    60_000,
    Math.min(
      12 * 60 * 60 * 1000,
      Number(thresholds.identityProtectionCooldownMinutes || 10) * 60 * 1000
    )
  );
  const existing = proProtectedAuthIdentities.get(safeIdentity);
  const lastAppliedAt = Math.max(0, Number(existing?.lastAppliedAt || 0));
  if (lastAppliedAt > 0 && nowTs - lastAppliedAt < cooldownMs) {
    return;
  }

  const cutoff = nowTs - windowMs;
  const recent = proAuthFailureTelemetry.filter((item) => {
    const at = Number(item?.at || 0);
    if (!Number.isFinite(at) || at < cutoff) return false;
    return normalizeAuthIdentity(item?.identity) === safeIdentity;
  });
  if (!recent.length) return;

  const failureThreshold = Math.max(3, Number(thresholds.identityProtectionFailureThreshold || 22));
  const distinctFingerprintThreshold = Math.max(
    2,
    Number(thresholds.identityProtectionDistinctFingerprints || 6)
  );
  const distinctIpThreshold = Math.max(2, Number(thresholds.identityProtectionDistinctIps || 6));

  const fingerprintSet = new Set();
  const ipSet = new Set();
  for (const item of recent) {
    const fingerprint = normalizeProSecurityThreatFingerprint(item?.fingerprint);
    if (isValidProSecurityThreatFingerprint(fingerprint)) {
      fingerprintSet.add(fingerprint);
    }
    const safeIp = normalizeIpEntry(item?.ip);
    if (safeIp) ipSet.add(safeIp);
  }
  const failureCount = recent.length;
  const distinctFingerprintCount = fingerprintSet.size;
  const distinctIpCount = ipSet.size;
  const spreadDetected =
    distinctFingerprintCount >= distinctFingerprintThreshold ||
    distinctIpCount >= distinctIpThreshold;
  if (failureCount < failureThreshold || !spreadDetected) return;

  const durationMs = Math.max(
    60_000,
    Math.min(24 * 60 * 60 * 1000, Number(thresholds.identityProtectionDurationMinutes || 30) * 60 * 1000)
  );
  const activeUntilTs = Math.max(Math.max(0, Number(existing?.until || 0)), nowTs + durationMs);
  const record = {
    identity: safeIdentity,
    reason: text(reason).toLowerCase(),
    until: activeUntilTs,
    updatedAt: nowTs,
    lastAppliedAt: nowTs,
    failureCount,
    distinctFingerprintCount,
    distinctIpCount
  };
  proProtectedAuthIdentities.set(safeIdentity, record);
  pruneProtectedAuthIdentities(nowTs);

  const event = {
    id: `identity-protect-${nowTs}-${Math.random().toString(36).slice(2, 7)}`,
    at: nowIso(),
    requestId: text(requestId),
    path: safePath,
    method: text(method).toUpperCase(),
    statusCode: Math.max(0, Number(statusCode || 0)),
    identity: safeIdentity,
    reason: text(reason).toLowerCase(),
    windowMinutes: Math.round(windowMs / 60_000),
    cooldownMinutes: Math.round(cooldownMs / 60_000),
    protectionDurationMinutes: Math.round(durationMs / 60_000),
    activeUntil: new Date(activeUntilTs).toISOString(),
    failureCount,
    distinctFingerprintCount,
    distinctIpCount,
    thresholds: {
      failureThreshold,
      distinctFingerprintThreshold,
      distinctIpThreshold
    }
  };
  proIdentityProtectionEvents.unshift(event);
  if (proIdentityProtectionEvents.length > IDENTITY_PROTECTION_EVENT_MAX_ITEMS) {
    proIdentityProtectionEvents.length = IDENTITY_PROTECTION_EVENT_MAX_ITEMS;
  }

  pushSecurityAuditEventInternal({
    severity: "high",
    type: "auto-auth-identity-protection",
    requestId: text(requestId),
    path: safePath,
    method: text(method).toUpperCase(),
    details: {
      identity: safeIdentity,
      reason: text(reason).toLowerCase(),
      activeUntil: new Date(activeUntilTs).toISOString(),
      windowMinutes: Math.round(windowMs / 60_000),
      cooldownMinutes: Math.round(cooldownMs / 60_000),
      protectionDurationMinutes: Math.round(durationMs / 60_000),
      failureCount,
      distinctFingerprintCount,
      distinctIpCount,
      thresholds: {
        failureThreshold,
        distinctFingerprintThreshold,
        distinctIpThreshold
      }
    }
  });
}

function maybeApplySubjectProtection({
  requestId = "",
  path: requestPath = "",
  reason = "subject-takeover-suspected",
  method = "GET",
  subject = "",
  replaySuspected = false,
  subjectTakeoverSuspected = false,
  subjectUsage = null
} = {}) {
  const safeSubject = normalizeTokenSubject(subject);
  if (!safeSubject) return;
  const safePath = normalizeRequestPath(requestPath || "/api");
  if (isSecurityControlPath(safePath)) return;

  const adminControls = currentSecurityAdminControls();
  if (!toBoolean(adminControls.autoSubjectProtection, true)) return;

  const thresholds = currentSecurityThresholds();
  const nowTs = Date.now();
  pruneProtectedTokenSubjects(nowTs);

  const windowMs = Math.max(
    5 * 60 * 1000,
    Math.min(24 * 60 * 60 * 1000, Number(thresholds.subjectProtectionWindowMinutes || 45) * 60 * 1000)
  );
  const cooldownMs = Math.max(
    60_000,
    Math.min(12 * 60 * 60 * 1000, Number(thresholds.subjectProtectionCooldownMinutes || 10) * 60 * 1000)
  );
  const existing = proProtectedTokenSubjects.get(safeSubject);
  const lastAppliedAt = Math.max(0, Number(existing?.lastAppliedAt || 0));
  if (lastAppliedAt > 0 && nowTs - lastAppliedAt < cooldownMs) {
    return;
  }

  const cutoff = nowTs - windowMs;
  const subjectIncidents = proThreatIncidents.filter((item) => {
    const at = Date.parse(text(item?.at));
    if (!Number.isFinite(at) || at < cutoff) return false;
    return normalizeTokenSubject(item?.subject) === safeSubject;
  });
  const incidentThreshold = Math.max(2, Number(thresholds.subjectProtectionIncidentThreshold || 8));
  const distinctFingerprintThreshold = Math.max(
    2,
    Number(thresholds.subjectProtectionDistinctFingerprints || 4)
  );
  const distinctIpThreshold = Math.max(2, Number(thresholds.subjectProtectionDistinctIps || 4));

  const incidentFingerprintSet = new Set();
  const incidentIpSet = new Set();
  for (const row of subjectIncidents) {
    const fp = normalizeProSecurityThreatFingerprint(row?.fingerprint);
    if (isValidProSecurityThreatFingerprint(fp)) incidentFingerprintSet.add(fp);
    const safeIp = normalizeIpEntry(row?.ip);
    if (safeIp) incidentIpSet.add(safeIp);
  }

  const usageFingerprintCount = Math.max(0, Number(subjectUsage?.distinctFingerprintCount || 0));
  const usageIpCount = Math.max(0, Number(subjectUsage?.distinctIpCount || 0));
  const usageOccurrenceCount = Math.max(0, Number(subjectUsage?.occurrences || 0));

  const incidentCount = Math.max(subjectIncidents.length, usageOccurrenceCount);
  const distinctFingerprintCount = Math.max(incidentFingerprintSet.size, usageFingerprintCount);
  const distinctIpCount = Math.max(incidentIpSet.size, usageIpCount);
  const spreadDetected =
    distinctFingerprintCount >= distinctFingerprintThreshold ||
    distinctIpCount >= distinctIpThreshold;
  const anomalyDetected = Boolean(replaySuspected) || Boolean(subjectTakeoverSuspected);

  if ((incidentCount < incidentThreshold && !anomalyDetected) || !spreadDetected) return;

  const durationMs = Math.max(
    60_000,
    Math.min(24 * 60 * 60 * 1000, Number(thresholds.subjectProtectionDurationMinutes || 30) * 60 * 1000)
  );
  const activeUntilTs = Math.max(Math.max(0, Number(existing?.until || 0)), nowTs + durationMs);
  const record = {
    subject: safeSubject,
    reason: text(reason).toLowerCase(),
    until: activeUntilTs,
    updatedAt: nowTs,
    lastAppliedAt: nowTs,
    incidentCount,
    distinctFingerprintCount,
    distinctIpCount
  };
  proProtectedTokenSubjects.set(safeSubject, record);
  pruneProtectedTokenSubjects(nowTs);

  const event = {
    id: `subject-protect-${nowTs}-${Math.random().toString(36).slice(2, 7)}`,
    at: nowIso(),
    requestId: text(requestId),
    path: safePath,
    method: text(method).toUpperCase(),
    subject: safeSubject,
    reason: text(reason).toLowerCase(),
    replaySuspected: Boolean(replaySuspected),
    subjectTakeoverSuspected: Boolean(subjectTakeoverSuspected),
    windowMinutes: Math.round(windowMs / 60_000),
    cooldownMinutes: Math.round(cooldownMs / 60_000),
    protectionDurationMinutes: Math.round(durationMs / 60_000),
    activeUntil: new Date(activeUntilTs).toISOString(),
    incidentCount,
    distinctFingerprintCount,
    distinctIpCount,
    thresholds: {
      incidentThreshold,
      distinctFingerprintThreshold,
      distinctIpThreshold
    }
  };
  proSubjectProtectionEvents.unshift(event);
  if (proSubjectProtectionEvents.length > SUBJECT_PROTECTION_EVENT_MAX_ITEMS) {
    proSubjectProtectionEvents.length = SUBJECT_PROTECTION_EVENT_MAX_ITEMS;
  }

  pushSecurityAuditEventInternal({
    severity: "high",
    type: "auto-token-subject-protection",
    requestId: text(requestId),
    path: safePath,
    method: text(method).toUpperCase(),
    details: {
      subject: safeSubject,
      reason: text(reason).toLowerCase(),
      replaySuspected: Boolean(replaySuspected),
      subjectTakeoverSuspected: Boolean(subjectTakeoverSuspected),
      activeUntil: new Date(activeUntilTs).toISOString(),
      windowMinutes: Math.round(windowMs / 60_000),
      cooldownMinutes: Math.round(cooldownMs / 60_000),
      protectionDurationMinutes: Math.round(durationMs / 60_000),
      incidentCount,
      distinctFingerprintCount,
      distinctIpCount,
      thresholds: {
        incidentThreshold,
        distinctFingerprintThreshold,
        distinctIpThreshold
      }
    }
  });
}

function maybeApplySubjectSessionShield({
  requestId = "",
  path: requestPath = "",
  method = "GET",
  subject = "",
  tokenKey = "",
  fingerprint = "",
  ip = ""
} = {}) {
  const safeSubject = normalizeTokenSubject(subject);
  if (!safeSubject) return { activated: false, subject: "" };
  const safePath = normalizeRequestPath(requestPath || "/api");
  if (isSecurityControlPath(safePath)) return { activated: false, subject: safeSubject };

  const nowTs = Date.now();
  const signal = registerSubjectSessionSignal({
    subject: safeSubject,
    tokenKey,
    fingerprint,
    ip,
    nowTs
  });
  const adminControls = currentSecurityAdminControls();
  if (!toBoolean(adminControls.autoSubjectSessionShield, true)) {
    return {
      activated: false,
      subject: safeSubject,
      signal
    };
  }

  const thresholds = currentSecurityThresholds();
  const windowMs = Math.max(
    5 * 60 * 1000,
    Math.min(24 * 60 * 60 * 1000, Number(thresholds.subjectSessionWindowMinutes || 60) * 60 * 1000)
  );
  const eventThreshold = Math.max(2, Number(thresholds.subjectSessionEventThreshold || 10));
  const distinctTokenKeyThreshold = Math.max(2, Number(thresholds.subjectSessionDistinctTokenKeys || 5));
  const distinctFingerprintThreshold = Math.max(
    2,
    Number(thresholds.subjectSessionDistinctFingerprints || 4)
  );
  const distinctIpThreshold = Math.max(2, Number(thresholds.subjectSessionDistinctIps || 4));
  const cooldownMs = Math.max(
    60_000,
    Math.min(12 * 60 * 60 * 1000, Number(thresholds.subjectSessionCooldownMinutes || 10) * 60 * 1000)
  );

  const existing = proProtectedTokenSubjects.get(safeSubject);
  const lastAppliedAt = Math.max(0, Number(existing?.lastAppliedAt || 0));
  if (lastAppliedAt > 0 && nowTs - lastAppliedAt < cooldownMs) {
    return {
      activated: false,
      subject: safeSubject,
      signal,
      cooldownActive: true
    };
  }

  const row = proSubjectSessionIntel.get(safeSubject);
  const cutoff = nowTs - windowMs;
  const recent = (Array.isArray(row?.events) ? row.events : []).filter(
    (item) => Number(item?.at || 0) >= cutoff
  );
  const occurrences = recent.length;
  const distinctTokenKeyCount = new Set(
    recent.map((item) => text(item?.tokenKey)).filter(Boolean)
  ).size;
  const distinctFingerprintCount = new Set(
    recent.map((item) => text(item?.fingerprint)).filter(Boolean)
  ).size;
  const distinctIpCount = new Set(
    recent.map((item) => text(item?.ip)).filter(Boolean)
  ).size;

  if (
    occurrences < eventThreshold ||
    distinctTokenKeyCount < distinctTokenKeyThreshold ||
    (distinctFingerprintCount < distinctFingerprintThreshold &&
      distinctIpCount < distinctIpThreshold)
  ) {
    return {
      activated: false,
      subject: safeSubject,
      signal: {
        ...signal,
        occurrences,
        distinctTokenKeyCount,
        distinctFingerprintCount,
        distinctIpCount
      }
    };
  }

  const durationMs = Math.max(
    60_000,
    Math.min(24 * 60 * 60 * 1000, Number(thresholds.subjectSessionShieldDurationMinutes || 45) * 60 * 1000)
  );
  const activeUntilTs = Math.max(Math.max(0, Number(existing?.until || 0)), nowTs + durationMs);
  const reason = "subject-session-anomaly";
  proProtectedTokenSubjects.set(safeSubject, {
    subject: safeSubject,
    reason,
    until: activeUntilTs,
    updatedAt: nowTs,
    lastAppliedAt: nowTs,
    incidentCount: occurrences,
    distinctFingerprintCount,
    distinctIpCount
  });
  pruneProtectedTokenSubjects(nowTs);

  const event = {
    id: `subject-session-${nowTs}-${Math.random().toString(36).slice(2, 7)}`,
    at: nowIso(),
    requestId: text(requestId),
    path: safePath,
    method: text(method).toUpperCase(),
    subject: safeSubject,
    reason,
    windowMinutes: Math.round(windowMs / 60_000),
    cooldownMinutes: Math.round(cooldownMs / 60_000),
    shieldDurationMinutes: Math.round(durationMs / 60_000),
    activeUntil: new Date(activeUntilTs).toISOString(),
    occurrences,
    distinctTokenKeyCount,
    distinctFingerprintCount,
    distinctIpCount,
    thresholds: {
      eventThreshold,
      distinctTokenKeyThreshold,
      distinctFingerprintThreshold,
      distinctIpThreshold
    }
  };
  proSubjectSessionShieldEvents.unshift(event);
  if (proSubjectSessionShieldEvents.length > SUBJECT_SESSION_SHIELD_EVENT_MAX_ITEMS) {
    proSubjectSessionShieldEvents.length = SUBJECT_SESSION_SHIELD_EVENT_MAX_ITEMS;
  }

  pushSecurityAuditEventInternal({
    severity: "high",
    type: "auto-subject-session-shield",
    requestId: text(requestId),
    path: safePath,
    method: text(method).toUpperCase(),
    details: {
      subject: safeSubject,
      reason,
      activeUntil: new Date(activeUntilTs).toISOString(),
      windowMinutes: Math.round(windowMs / 60_000),
      cooldownMinutes: Math.round(cooldownMs / 60_000),
      shieldDurationMinutes: Math.round(durationMs / 60_000),
      occurrences,
      distinctTokenKeyCount,
      distinctFingerprintCount,
      distinctIpCount,
      thresholds: {
        eventThreshold,
        distinctTokenKeyThreshold,
        distinctFingerprintThreshold,
        distinctIpThreshold
      }
    }
  });

  return {
    activated: true,
    subject: safeSubject,
    reason,
    until: activeUntilTs,
    remainingSec: Math.max(0, Math.ceil((activeUntilTs - nowTs) / 1000)),
    signal: {
      occurrences,
      distinctTokenKeyCount,
      distinctFingerprintCount,
      distinctIpCount
    }
  };
}

function maybeApplySubjectNetworkShield({
  requestId = "",
  path: requestPath = "",
  method = "GET",
  subject = "",
  tokenKey = "",
  fingerprint = "",
  ip = ""
} = {}) {
  const safeSubject = normalizeTokenSubject(subject);
  if (!safeSubject) return { activated: false, subject: "" };
  const safePath = normalizeRequestPath(requestPath || "/api");
  if (isSecurityControlPath(safePath)) return { activated: false, subject: safeSubject };

  const nowTs = Date.now();
  const signal = registerSubjectSessionSignal({
    subject: safeSubject,
    tokenKey,
    fingerprint,
    ip,
    nowTs
  });
  const adminControls = currentSecurityAdminControls();
  if (!toBoolean(adminControls.autoSubjectNetworkShield, true)) {
    return {
      activated: false,
      subject: safeSubject,
      signal
    };
  }

  const thresholds = currentSecurityThresholds();
  const windowMs = Math.max(
    5 * 60 * 1000,
    Math.min(24 * 60 * 60 * 1000, Number(thresholds.subjectNetworkWindowMinutes || 45) * 60 * 1000)
  );
  const eventThreshold = Math.max(2, Number(thresholds.subjectNetworkEventThreshold || 8));
  const distinctPrefixThreshold = Math.max(2, Number(thresholds.subjectNetworkDistinctPrefixes || 4));
  const jumpThreshold = Math.max(1, Number(thresholds.subjectNetworkJumpThreshold || 3));
  const cooldownMs = Math.max(
    60_000,
    Math.min(12 * 60 * 60 * 1000, Number(thresholds.subjectNetworkCooldownMinutes || 10) * 60 * 1000)
  );

  const existing = proProtectedTokenSubjects.get(safeSubject);
  const lastAppliedAt = Math.max(0, Number(existing?.lastAppliedAt || 0));
  if (lastAppliedAt > 0 && nowTs - lastAppliedAt < cooldownMs) {
    return {
      activated: false,
      subject: safeSubject,
      signal,
      cooldownActive: true
    };
  }

  const row = proSubjectSessionIntel.get(safeSubject);
  const cutoff = nowTs - windowMs;
  const recent = (Array.isArray(row?.events) ? row.events : []).filter(
    (item) => Number(item?.at || 0) >= cutoff
  );
  const occurrences = recent.length;
  const distinctNetworkPrefixCount = new Set(
    recent.map((item) => text(item?.networkPrefix)).filter(Boolean)
  ).size;
  const networkJumpCount = countNetworkPrefixJumps(recent);
  const distinctFingerprintCount = new Set(
    recent.map((item) => text(item?.fingerprint)).filter(Boolean)
  ).size;
  const distinctIpCount = new Set(
    recent.map((item) => text(item?.ip)).filter(Boolean)
  ).size;

  if (
    occurrences < eventThreshold ||
    distinctNetworkPrefixCount < distinctPrefixThreshold ||
    networkJumpCount < jumpThreshold
  ) {
    return {
      activated: false,
      subject: safeSubject,
      signal: {
        ...signal,
        occurrences,
        distinctNetworkPrefixCount,
        networkJumpCount,
        distinctFingerprintCount,
        distinctIpCount
      }
    };
  }

  const durationMs = Math.max(
    60_000,
    Math.min(24 * 60 * 60 * 1000, Number(thresholds.subjectNetworkShieldDurationMinutes || 60) * 60 * 1000)
  );
  const activeUntilTs = Math.max(Math.max(0, Number(existing?.until || 0)), nowTs + durationMs);
  const reason = "subject-network-velocity-anomaly";
  proProtectedTokenSubjects.set(safeSubject, {
    subject: safeSubject,
    reason,
    until: activeUntilTs,
    updatedAt: nowTs,
    lastAppliedAt: nowTs,
    incidentCount: occurrences,
    distinctFingerprintCount,
    distinctIpCount
  });
  pruneProtectedTokenSubjects(nowTs);

  const event = {
    id: `subject-network-${nowTs}-${Math.random().toString(36).slice(2, 7)}`,
    at: nowIso(),
    requestId: text(requestId),
    path: safePath,
    method: text(method).toUpperCase(),
    subject: safeSubject,
    reason,
    windowMinutes: Math.round(windowMs / 60_000),
    cooldownMinutes: Math.round(cooldownMs / 60_000),
    shieldDurationMinutes: Math.round(durationMs / 60_000),
    activeUntil: new Date(activeUntilTs).toISOString(),
    occurrences,
    distinctNetworkPrefixCount,
    networkJumpCount,
    distinctFingerprintCount,
    distinctIpCount,
    thresholds: {
      eventThreshold,
      distinctPrefixThreshold,
      jumpThreshold
    }
  };
  proSubjectNetworkShieldEvents.unshift(event);
  if (proSubjectNetworkShieldEvents.length > SUBJECT_NETWORK_SHIELD_EVENT_MAX_ITEMS) {
    proSubjectNetworkShieldEvents.length = SUBJECT_NETWORK_SHIELD_EVENT_MAX_ITEMS;
  }

  pushSecurityAuditEventInternal({
    severity: "high",
    type: "auto-subject-network-shield",
    requestId: text(requestId),
    path: safePath,
    method: text(method).toUpperCase(),
    details: {
      subject: safeSubject,
      reason,
      activeUntil: new Date(activeUntilTs).toISOString(),
      windowMinutes: Math.round(windowMs / 60_000),
      cooldownMinutes: Math.round(cooldownMs / 60_000),
      shieldDurationMinutes: Math.round(durationMs / 60_000),
      occurrences,
      distinctNetworkPrefixCount,
      networkJumpCount,
      distinctFingerprintCount,
      distinctIpCount,
      thresholds: {
        eventThreshold,
        distinctPrefixThreshold,
        jumpThreshold
      }
    }
  });

  return {
    activated: true,
    subject: safeSubject,
    reason,
    until: activeUntilTs,
    remainingSec: Math.max(0, Math.ceil((activeUntilTs - nowTs) / 1000)),
    signal: {
      occurrences,
      distinctNetworkPrefixCount,
      networkJumpCount,
      distinctFingerprintCount,
      distinctIpCount
    }
  };
}

function maybeAutoEscalateSecurityMode({
  reason = "",
  path: requestPath = "",
  requestId = ""
} = {}) {
  const safePath = normalizeRequestPath(requestPath);
  if (isSecurityControlPath(safePath)) return;

  const adminControls = currentSecurityAdminControls();
  if (!toBoolean(adminControls.autoEscalateMode, true)) return;

  const thresholds = currentSecurityThresholds();
  const nowTs = Date.now();
  const cooldownMs = Math.max(
    5 * 60 * 1000,
    Math.min(12 * 60 * 60 * 1000, Number(thresholds.autoEscalationCooldownMinutes || 20) * 60 * 1000)
  );
  if (proLastAutoModeChangeAt > 0 && nowTs - proLastAutoModeChangeAt < cooldownMs) {
    return;
  }

  const windowMs = Math.max(
    10 * 60 * 1000,
    Math.min(24 * 60 * 60 * 1000, Number(thresholds.autoEscalationWindowMinutes || 60) * 60 * 1000)
  );
  const hardenedThreshold = Math.max(5, Number(thresholds.autoEscalateToHardenedEvents || 20));
  const lockdownThreshold = Math.max(
    hardenedThreshold + 1,
    Number(thresholds.autoEscalateToLockdownEvents || 40)
  );
  const blockedThreshold = Math.max(1, Number(thresholds.autoEscalateBlockedEvents || 8));
  const cutoff = nowTs - windowMs;
  const recent = proThreatIncidents.filter((item) => {
    const at = Date.parse(text(item?.at));
    return Number.isFinite(at) && at >= cutoff;
  });
  if (!recent.length) return;

  const totalEvents = recent.length;
  const blockedEvents = recent.filter((item) => Boolean(item?.blocked)).length;
  const currentMode = currentSecurityMode();

  let targetMode = "";
  if (currentMode !== "lockdown") {
    if (totalEvents >= lockdownThreshold || blockedEvents >= blockedThreshold) {
      targetMode = "lockdown";
    } else if (currentMode === "balanced" && totalEvents >= hardenedThreshold) {
      targetMode = "hardened";
    }
  }
  if (!targetMode) return;

  const result = applyProSecurityControlProfile(targetMode, {
    actorId: "ai-guardian",
    actorRole: "system"
  });
  if (!result.applied) return;

  proLastAutoModeChangeAt = nowTs;
  const row = {
    id: `escalate-${nowTs}-${Math.random().toString(36).slice(2, 7)}`,
    at: nowIso(),
    direction: "escalate",
    fromMode: currentMode,
    toMode: targetMode,
    reason: text(reason).toLowerCase(),
    requestId: text(requestId),
    path: safePath,
    windowMinutes: Math.round(windowMs / 60_000),
    totalEvents,
    blockedEvents
  };
  proAutoEscalationEvents.unshift(row);
  if (proAutoEscalationEvents.length > AUTO_ESCALATION_EVENT_MAX_ITEMS) {
    proAutoEscalationEvents.length = AUTO_ESCALATION_EVENT_MAX_ITEMS;
  }

  pushSecurityAuditEventInternal({
    severity: "high",
    type: "auto-security-mode-escalated",
    method: "POST",
    path: safePath || "/api",
    details: {
      fromMode: currentMode,
      toMode: targetMode,
      requestId: text(requestId),
      reason: text(reason).toLowerCase(),
      windowMinutes: Math.round(windowMs / 60_000),
      totalEvents,
      blockedEvents,
      cooldownMinutes: Math.round(cooldownMs / 60_000)
    }
  });
}

function maybeAutoDeEscalateSecurityMode({
  reason = "",
  path: requestPath = "",
  requestId = ""
} = {}) {
  const safePath = normalizeRequestPath(requestPath);
  if (isSecurityControlPath(safePath)) return;

  const currentMode = currentSecurityMode();
  if (currentMode === "balanced") return;

  const adminControls = currentSecurityAdminControls();
  if (!toBoolean(adminControls.autoDeEscalateMode, true)) return;

  const thresholds = currentSecurityThresholds();
  const nowTs = Date.now();
  const cooldownMs = Math.max(
    5 * 60 * 1000,
    Math.min(12 * 60 * 60 * 1000, Number(thresholds.autoDeEscalationCooldownMinutes || 30) * 60 * 1000)
  );
  if (proLastAutoModeChangeAt > 0 && nowTs - proLastAutoModeChangeAt < cooldownMs) {
    return;
  }

  const windowMs = Math.max(
    10 * 60 * 1000,
    Math.min(24 * 60 * 60 * 1000, Number(thresholds.autoDeEscalationWindowMinutes || 180) * 60 * 1000)
  );
  const cutoff = nowTs - windowMs;
  const recent = proThreatIncidents.filter((item) => {
    const at = Date.parse(text(item?.at));
    return Number.isFinite(at) && at >= cutoff;
  });

  const totalEvents = recent.length;
  const blockedEvents = recent.filter((item) => Boolean(item?.blocked)).length;
  const toHardenedMax = Math.max(1, Number(thresholds.autoDeEscalateToHardenedMaxEvents || 12));
  const toBalancedMax = Math.max(1, Number(thresholds.autoDeEscalateToBalancedMaxEvents || 4));
  const blockedMax = Math.max(0, Number(thresholds.autoDeEscalateBlockedMaxEvents || 1));

  let targetMode = "";
  if (currentMode === "lockdown") {
    if (totalEvents <= toHardenedMax && blockedEvents <= blockedMax) {
      targetMode = "hardened";
    }
  } else if (currentMode === "hardened") {
    if (totalEvents <= toBalancedMax && blockedEvents <= blockedMax) {
      targetMode = "balanced";
    }
  }

  if (!targetMode) return;

  const result = applyProSecurityControlProfile(targetMode, {
    actorId: "ai-guardian",
    actorRole: "system"
  });
  if (!result.applied) return;

  proLastAutoModeChangeAt = nowTs;
  const row = {
    id: `deescalate-${nowTs}-${Math.random().toString(36).slice(2, 7)}`,
    at: nowIso(),
    direction: "de-escalate",
    fromMode: currentMode,
    toMode: targetMode,
    reason: text(reason).toLowerCase(),
    requestId: text(requestId),
    path: safePath,
    windowMinutes: Math.round(windowMs / 60_000),
    totalEvents,
    blockedEvents
  };
  proAutoEscalationEvents.unshift(row);
  if (proAutoEscalationEvents.length > AUTO_ESCALATION_EVENT_MAX_ITEMS) {
    proAutoEscalationEvents.length = AUTO_ESCALATION_EVENT_MAX_ITEMS;
  }

  pushSecurityAuditEventInternal({
    severity: "high",
    type: "auto-security-mode-de-escalated",
    method: "POST",
    path: safePath || "/api",
    details: {
      fromMode: currentMode,
      toMode: targetMode,
      requestId: text(requestId),
      reason: text(reason).toLowerCase(),
      windowMinutes: Math.round(windowMs / 60_000),
      totalEvents,
      blockedEvents,
      cooldownMinutes: Math.round(cooldownMs / 60_000)
    }
  });
}

function pushThreatIncident(incident = {}) {
  const row = {
    id: `threat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: nowIso(),
    fingerprint: text(incident.fingerprint),
    ip: text(incident.ip),
    subject: text(incident.subject).toLowerCase(),
    requestId: text(incident.requestId),
    path: text(incident.path),
    method: text(incident.method).toUpperCase(),
    riskScore: Math.max(0, Number(incident.riskScore || 0)),
    cumulativeRiskScore: Math.max(0, Number(incident.cumulativeRiskScore || 0)),
    blocked: Boolean(incident.blocked),
    reason: text(incident.reason, "ai-auto-detected-risk"),
    rules: Array.isArray(incident.rules) ? incident.rules.slice(0, 12) : []
  };
  const prevHash = proThreatIncidentChainHead;
  const integrityHash = sha256(JSON.stringify({
    prevHash,
    id: row.id,
    at: row.at,
    fingerprint: row.fingerprint,
    path: row.path,
    method: row.method,
    riskScore: row.riskScore,
    cumulativeRiskScore: row.cumulativeRiskScore,
    blocked: row.blocked,
    subject: row.subject,
    reason: row.reason,
    rules: row.rules
  }));
  row.prevHash = prevHash;
  row.integrityHash = integrityHash;
  proThreatIncidentChainHead = integrityHash;
  proThreatIncidents.unshift(row);
  if (proThreatIncidents.length > SECURITY_INCIDENT_MAX_ITEMS) {
    proThreatIncidents.length = SECURITY_INCIDENT_MAX_ITEMS;
  }

  maybeApplyCriticalThreatResponse(row);
  maybeAutoPromoteSecurityBlocklists({
    fingerprint: row.fingerprint,
    ip: row.ip,
    subject: row.subject,
    reason: row.reason,
    blocked: row.blocked,
    path: row.path,
    requestId: row.requestId
  });
  maybeApplyCampaignThreatResponse(row);
  maybeAutoEscalateSecurityMode({
    reason: row.reason,
    path: row.path,
    requestId: row.requestId
  });
}

function normalizeThreatPayloadString(value) {
  return text(value).replace(/\s+/g, " ").slice(0, 2000);
}

function collectRequestTextSamples(req) {
  const samples = [];
  const pushSample = (value) => {
    const normalized = normalizeThreatPayloadString(value);
    if (!normalized) return;
    samples.push(normalized);
  };

  const walk = (value, depth = 0) => {
    if (samples.length >= 120) return;
    if (depth > 8) return;
    if (value === null || typeof value === "undefined") return;

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      pushSample(value);
      return;
    }

    if (Array.isArray(value)) {
      value.slice(0, 60).forEach((item) => walk(item, depth + 1));
      return;
    }

    if (typeof value === "object") {
      const keys = Object.keys(value).slice(0, 80);
      keys.forEach((key) => {
        pushSample(key);
        walk(value[key], depth + 1);
      });
    }
  };

  walk(req?.query || {});
  walk(req?.params || {});
  walk(req?.body || {});
  pushSample(req?.originalUrl || req?.path || "");
  pushSample(req?.headers?.["user-agent"] || "");
  return samples;
}

function evaluateThreatScore(req) {
  const samples = collectRequestTextSamples(req);
  const matchedRules = [];
  let score = 0;

  for (const rule of THREAT_DETECTION_RULES) {
    const hit = samples.some((sample) => rule.pattern.test(sample));
    if (!hit) continue;
    matchedRules.push(rule.id);
    score += Number(rule.score || 0);
  }

  const totalPayloadSize = JSON.stringify({
    query: req?.query || {},
    params: req?.params || {},
    body: req?.body || {}
  }).length;
  if (totalPayloadSize > 200_000) score += 20;
  if (text(req?.method).toUpperCase() === "TRACE") score += 20;

  if (isSuspiciousUserAgent(req)) {
    score += 35;
    matchedRules.push("suspicious-user-agent-pattern");
  }

  const honeypotField = findHoneypotFieldHit(req);
  if (honeypotField) {
    score += 55;
    matchedRules.push(`honeypot-field-hit:${honeypotField}`);
  }

  if (isApiBodyMethod(req?.method) && hasBodyPayload(req)) {
    const contentType = normalizeContentType(req?.headers?.["content-type"]);
    const allowed = ALLOWED_API_CONTENT_TYPES.some((item) => contentType.startsWith(item));
    if (!allowed) {
      score += 28;
      matchedRules.push(`unexpected-content-type:${contentType || "missing"}`);
    }
  }

  return {
    score,
    matchedRules,
    totalPayloadSize
  };
}

function nextProfileState(current = {}, nowTs = Date.now()) {
  const previous = {
    riskScore: Math.max(0, Number(current.riskScore || 0)),
    lastSeenAt: Number(current.lastSeenAt || nowTs),
    blockUntil: Number(current.blockUntil || 0),
    incidentCount: Math.max(0, Number(current.incidentCount || 0)),
    recentHits: Array.isArray(current.recentHits) ? current.recentHits : [],
    recentPaths: Array.isArray(current.recentPaths) ? current.recentPaths : [],
    authIdentityTrail: Array.isArray(current.authIdentityTrail) ? current.authIdentityTrail : [],
    listingSignals: Array.isArray(current.listingSignals) ? current.listingSignals : [],
    authFailures: Array.isArray(current.authFailures) ? current.authFailures : [],
    quarantineReason: text(current.quarantineReason)
  };
  const elapsed = Math.max(0, nowTs - previous.lastSeenAt);
  const decayFactor = Math.max(0, 1 - elapsed / THREAT_SCORE_DECAY_WINDOW_MS);
  const decayedRisk = Math.round(previous.riskScore * decayFactor);
  return {
    ...previous,
    riskScore: decayedRisk,
    lastSeenAt: nowTs
  };
}

function applyBehaviorSignals({ req, state, nowTs }) {
  const matchedRules = [];
  let score = 0;

  const recentHits = [...state.recentHits, nowTs].filter(
    (stamp) => Number(stamp) >= nowTs - THREAT_BURST_WINDOW_MS
  );
  if (recentHits.length >= THREAT_BURST_REQUEST_THRESHOLD) {
    score += 28;
    matchedRules.push("burst-traffic-pattern");
  }
  if (recentHits.length >= 8) {
    const sorted = [...recentHits].sort((a, b) => a - b);
    const intervals = [];
    for (let index = 1; index < sorted.length; index += 1) {
      intervals.push(Math.max(0, Number(sorted[index] - sorted[index - 1])));
    }
    const avgIntervalMs = intervals.length
      ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length
      : 0;
    const variance = intervals.length
      ? intervals.reduce((sum, value) => sum + Math.pow(value - avgIntervalMs, 2), 0) / intervals.length
      : 0;
    const stdDevMs = Math.sqrt(Math.max(0, variance));
    if (avgIntervalMs > 0 && avgIntervalMs <= 3000 && stdDevMs <= 90) {
      score += 22;
      matchedRules.push("automation-timing-pattern");
    }
  }

  const requestPath = text(req?.originalUrl || req?.path || "/");
  const recentPaths = [...state.recentPaths, { path: requestPath, at: nowTs }].filter(
    (item) => Number(item?.at || 0) >= nowTs - THREAT_SCAN_WINDOW_MS
  );
  const distinctPathCount = new Set(recentPaths.map((item) => text(item.path))).size;
  if (distinctPathCount >= THREAT_SCAN_PATH_THRESHOLD) {
    score += 24;
    matchedRules.push("endpoint-scan-pattern");
  }

  const authIdentity = extractAuthIdentitySample(req);
  const authIdentityTrail = [...state.authIdentityTrail];
  if (authIdentity) {
    authIdentityTrail.push({ identity: authIdentity, at: nowTs });
  }
  const normalizedAuthTrail = authIdentityTrail.filter(
    (item) => Number(item?.at || 0) >= nowTs - THREAT_CREDENTIAL_STUFFING_WINDOW_MS
  );
  const distinctIdentityCount = new Set(
    normalizedAuthTrail.map((item) => text(item.identity)).filter(Boolean)
  ).size;
  if (distinctIdentityCount >= THREAT_CREDENTIAL_STUFFING_IDENTITY_THRESHOLD) {
    score += 46;
    matchedRules.push("credential-stuffing-pattern");
  }

  return {
    score,
    matchedRules,
    recentHits,
    recentPaths,
    authIdentityTrail: normalizedAuthTrail
  };
}

export function releaseProSecurityThreatProfile(fingerprint = "") {
  const key = normalizeProSecurityThreatFingerprint(fingerprint);
  if (!isValidProSecurityThreatFingerprint(key)) return null;

  const current = proThreatProfiles.get(key);
  if (!current) return null;

  const nextState = {
    ...current,
    riskScore: Math.max(0, Math.round(Number(current.riskScore || 0) * 0.4)),
    blockUntil: 0,
    quarantineReason: "",
    lastSeenAt: Date.now()
  };
  proThreatProfiles.set(key, nextState);
  pushSecurityAuditEventInternal({
    severity: "medium",
    type: "manual-threat-profile-release",
    fingerprint: key,
    method: "POST",
    path: "/api/system/security-intelligence/release",
    details: {
      riskScore: Math.max(0, Number(nextState.riskScore || 0)),
      incidentCount: Math.max(0, Number(nextState.incidentCount || 0))
    }
  });
  return {
    fingerprint: key,
    riskScore: Math.max(0, Number(nextState.riskScore || 0)),
    blockUntil: 0,
    incidentCount: Math.max(0, Number(nextState.incidentCount || 0)),
    status: "released"
  };
}

export function quarantineProSecurityThreatProfile(
  fingerprint = "",
  {
    durationMs = THREAT_BLOCK_DURATION_MS,
    reason = "manual-admin-quarantine",
    minRiskScore = THREAT_SCORE_BLOCK_THRESHOLD
  } = {}
) {
  const key = normalizeProSecurityThreatFingerprint(fingerprint);
  if (!isValidProSecurityThreatFingerprint(key)) return null;

  const nowTs = Date.now();
  const safeDuration = Math.max(
    60_000,
    Math.min(THREAT_MANUAL_QUARANTINE_MAX_MS, Number(durationMs || THREAT_BLOCK_DURATION_MS))
  );
  const current = nextProfileState(proThreatProfiles.get(key), nowTs);
  const nextState = {
    ...current,
    riskScore: Math.max(
      Math.max(0, Number(current.riskScore || 0)),
      Math.max(1, Number(minRiskScore || THREAT_SCORE_BLOCK_THRESHOLD))
    ),
    blockUntil: nowTs + safeDuration,
    quarantineReason: text(reason, "manual-admin-quarantine"),
    incidentCount: Math.max(0, Number(current.incidentCount || 0)) + 1,
    lastSeenAt: nowTs
  };
  proThreatProfiles.set(key, nextState);
  pruneThreatProfiles();

  pushThreatIncident({
    fingerprint: key,
    ip: "",
    requestId: "",
    path: "manual-admin",
    method: "POST",
    riskScore: 0,
    cumulativeRiskScore: nextState.riskScore,
    blocked: true,
    reason: nextState.quarantineReason,
    rules: ["manual-admin-quarantine"]
  });
  pushSecurityAuditEventInternal({
    severity: "high",
    type: "manual-threat-profile-quarantine",
    fingerprint: key,
    method: "POST",
    path: "/api/system/security-intelligence/quarantine",
    details: {
      riskScore: Math.max(0, Number(nextState.riskScore || 0)),
      blockUntil: nextState.blockUntil,
      reason: nextState.quarantineReason
    }
  });

  return {
    fingerprint: key,
    riskScore: Math.max(0, Number(nextState.riskScore || 0)),
    blockUntil: nextState.blockUntil,
    incidentCount: Math.max(0, Number(nextState.incidentCount || 0)),
    status: "quarantined",
    reason: nextState.quarantineReason
  };
}

export function getProSecurityThreatIntelligence(limit = 200) {
  const safeLimit = Math.min(1000, Math.max(1, toNumber(limit, 200)));
  pruneProtectedAuthIdentities(Date.now());
  pruneProtectedTokenSubjects(Date.now());
  pruneAdminMutationSignatureNonces(Date.now());
  const thresholds = currentSecurityThresholds();
  const adminControls = currentSecurityAdminControls();
  const lists = currentSecurityLists();
  const mode = currentSecurityMode();
  const authShieldStatus = currentAuthShieldStatus();
  const adminMutationShieldStatus = currentAdminMutationShieldStatus();
  const authStormWindowMs = Math.max(
    5 * 60 * 1000,
    Math.min(24 * 60 * 60 * 1000, Number(thresholds.authStormWindowMinutes || 20) * 60 * 1000)
  );
  const authStormCutoff = Date.now() - authStormWindowMs;
  const authStormFailureCount = proAuthFailureTelemetry.filter(
    (item) => Number(item?.at || 0) >= authStormCutoff
  ).length;
  const adminMutationWindowMs = Math.max(
    5 * 60 * 1000,
    Math.min(24 * 60 * 60 * 1000, Number(thresholds.adminMutationWindowMinutes || 30) * 60 * 1000)
  );
  const adminMutationCutoff = Date.now() - adminMutationWindowMs;
  const adminMutationAttemptsInWindow = proAdminMutationAttemptIntel.filter((item) => {
    const atTs = Number(item?.atTs || 0);
    if (!Number.isFinite(atTs) || atTs < adminMutationCutoff) return false;
    return isAdminMutationPath(item?.path, item?.method);
  }).length;
  const activeIdentityProtections = [...proProtectedAuthIdentities.values()]
    .filter((item) => Number(item?.until || 0) > Date.now())
    .slice(0, Math.min(200, safeLimit))
    .map((item) => ({
      identity: text(item?.identity),
      reason: text(item?.reason),
      activeUntil: Number(item?.until || 0)
        ? new Date(Number(item?.until || 0)).toISOString()
        : "",
      remainingSec: Math.max(0, Math.ceil((Number(item?.until || 0) - Date.now()) / 1000)),
      failureCount: Math.max(0, Number(item?.failureCount || 0)),
      distinctFingerprintCount: Math.max(0, Number(item?.distinctFingerprintCount || 0)),
      distinctIpCount: Math.max(0, Number(item?.distinctIpCount || 0))
    }));
  const activeSubjectProtections = [...proProtectedTokenSubjects.values()]
    .filter((item) => Number(item?.until || 0) > Date.now())
    .slice(0, Math.min(200, safeLimit))
    .map((item) => ({
      subject: text(item?.subject),
      reason: text(item?.reason),
      activeUntil: Number(item?.until || 0)
        ? new Date(Number(item?.until || 0)).toISOString()
        : "",
      remainingSec: Math.max(0, Math.ceil((Number(item?.until || 0) - Date.now()) / 1000)),
      incidentCount: Math.max(0, Number(item?.incidentCount || 0)),
      distinctFingerprintCount: Math.max(0, Number(item?.distinctFingerprintCount || 0)),
      distinctIpCount: Math.max(0, Number(item?.distinctIpCount || 0))
    }));
  const tokenReplayFingerprintThreshold = Math.max(
    2,
    Number(thresholds.tokenReplayDistinctFingerprints || TOKEN_REPLAY_DISTINCT_FINGERPRINT_THRESHOLD)
  );
  const tokenReplayIpThreshold = Math.max(
    2,
    Number(thresholds.tokenReplayDistinctIps || TOKEN_REPLAY_DISTINCT_IP_THRESHOLD)
  );
  const subjectReplayFingerprintThreshold = Math.max(
    2,
    Number(thresholds.subjectReplayDistinctFingerprints || SUBJECT_INTEL_DISTINCT_FINGERPRINT_THRESHOLD)
  );
  const subjectReplayIpThreshold = Math.max(
    2,
    Number(thresholds.subjectReplayDistinctIps || SUBJECT_INTEL_DISTINCT_IP_THRESHOLD)
  );
  const subjectSessionWindowMs = Math.max(
    5 * 60 * 1000,
    Math.min(24 * 60 * 60 * 1000, Number(thresholds.subjectSessionWindowMinutes || 60) * 60 * 1000)
  );
  const subjectNetworkWindowMs = Math.max(
    5 * 60 * 1000,
    Math.min(24 * 60 * 60 * 1000, Number(thresholds.subjectNetworkWindowMinutes || 45) * 60 * 1000)
  );
  const incidents = proThreatIncidents.slice(0, safeLimit);
  const hotSignatures = hotFakeListingSignatures(Math.min(50, safeLimit));
  const hotTokens = hotTokenIntelligence(Math.min(50, safeLimit));
  const hotSubjects = hotSubjectIntelligence(Math.min(50, safeLimit));
  const hotSubjectSessions = hotSubjectSessionIntelligence(
    Math.min(50, safeLimit),
    Math.max(subjectSessionWindowMs, subjectNetworkWindowMs)
  );
  const subjectNetworkEventThreshold = Math.max(2, Number(thresholds.subjectNetworkEventThreshold || 8));
  const subjectNetworkDistinctPrefixThreshold = Math.max(
    2,
    Number(thresholds.subjectNetworkDistinctPrefixes || 4)
  );
  const subjectNetworkJumpThreshold = Math.max(1, Number(thresholds.subjectNetworkJumpThreshold || 3));
  const subjectNetworkHotSubjects = hotSubjectSessions.filter(
    (item) =>
      Number(item?.occurrences || 0) >= subjectNetworkEventThreshold &&
      Number(item?.distinctNetworkPrefixCount || 0) >= subjectNetworkDistinctPrefixThreshold &&
      Number(item?.networkJumpCount || 0) >= subjectNetworkJumpThreshold
  ).length;
  const fakeListingIncidents = proThreatIncidents.filter(
    (item) =>
      text(item?.reason).includes("fake-listing") ||
      (Array.isArray(item?.rules) &&
        item.rules.some((rule) => text(rule).includes("listing")))
  );
  const tokenIncidents = proThreatIncidents.filter(
    (item) =>
      text(item?.reason).includes("token-") ||
      (Array.isArray(item?.rules) &&
        item.rules.some((rule) => text(rule).includes("token-")))
  );
  const subjectIncidents = proThreatIncidents.filter(
    (item) =>
      text(item?.reason).includes("subject-") ||
      (Array.isArray(item?.rules) &&
        item.rules.some((rule) => text(rule).includes("subject-")))
  );
  const hotProfiles = [...proThreatProfiles.entries()]
    .map(([fingerprint, profile]) => ({
      fingerprint,
      riskScore: Math.max(0, Number(profile?.riskScore || 0)),
      blockUntil: Number(profile?.blockUntil || 0),
      incidentCount: Math.max(0, Number(profile?.incidentCount || 0)),
      lastSeenAt: Number(profile?.lastSeenAt || 0),
      quarantineReason: text(profile?.quarantineReason),
      status: Number(profile?.blockUntil || 0) > Date.now() ? "blocked" : "watch"
    }))
    .sort((a, b) => b.riskScore - a.riskScore || b.lastSeenAt - a.lastSeenAt)
    .slice(0, Math.min(200, safeLimit));

  return {
    incidents,
    hotProfiles,
    hotFakeListingSignatures: hotSignatures,
    hotTokenIntelligence: hotTokens,
    hotSubjectIntelligence: hotSubjects,
    hotSubjectSessionIntelligence: hotSubjectSessions,
    recentAutoPromotions: proAutoPromotionEvents.slice(0, Math.min(100, safeLimit)),
    recentAutoEscalations: proAutoEscalationEvents.slice(0, Math.min(100, safeLimit)),
    recentCriticalResponses: proCriticalResponseEvents.slice(0, Math.min(100, safeLimit)),
    recentCampaignResponses: proCampaignResponseEvents.slice(0, Math.min(100, safeLimit)),
    recentAuthShieldEvents: proAuthShieldEvents.slice(0, Math.min(100, safeLimit)),
    recentIdentityProtectionEvents: proIdentityProtectionEvents.slice(0, Math.min(100, safeLimit)),
    recentSubjectProtectionEvents: proSubjectProtectionEvents.slice(0, Math.min(100, safeLimit)),
    recentSubjectSessionShieldEvents: proSubjectSessionShieldEvents.slice(0, Math.min(100, safeLimit)),
    recentSubjectNetworkShieldEvents: proSubjectNetworkShieldEvents.slice(0, Math.min(100, safeLimit)),
    recentAdminMutationShieldEvents: proAdminMutationShieldEvents.slice(0, Math.min(100, safeLimit)),
    activeIdentityProtections,
    activeSubjectProtections,
    controlState: getProSecurityControlState(),
    summary: {
      mode,
      activeProfiles: proThreatProfiles.size,
      blockedProfiles: hotProfiles.filter((item) => item.blockUntil > Date.now()).length,
      highRiskProfiles: hotProfiles.filter((item) => item.riskScore >= THREAT_SCORE_BLOCK_THRESHOLD).length,
      totalIncidents: proThreatIncidents.length,
      fakeListingIncidents: fakeListingIncidents.length,
      fakeListingBlockedIncidents: fakeListingIncidents.filter((item) => Boolean(item?.blocked)).length,
      fakeListingHotSignatures: hotSignatures.length,
      tokenThreatIncidents: tokenIncidents.length,
      subjectThreatIncidents: subjectIncidents.length,
      tokenReplayHotKeys: hotTokens.filter(
        (item) =>
          item.distinctFingerprintCount >= tokenReplayFingerprintThreshold ||
          item.distinctIpCount >= tokenReplayIpThreshold
      ).length,
      subjectTakeoverHotSubjects: hotSubjects.filter(
        (item) =>
          item.distinctFingerprintCount >= subjectReplayFingerprintThreshold ||
          item.distinctIpCount >= subjectReplayIpThreshold
      ).length,
      subjectSessionWindowMinutes: Math.round(subjectSessionWindowMs / 60_000),
      subjectSessionHotSubjects: hotSubjectSessions.length,
      subjectNetworkWindowMinutes: Math.round(subjectNetworkWindowMs / 60_000),
      subjectNetworkHotSubjects,
      autoPromotions: proAutoPromotionEvents.length,
      autoEscalations: proAutoEscalationEvents.length,
      autoEscalationLastAt: text(proAutoEscalationEvents[0]?.at),
      autoEscalationLastMode: text(proAutoEscalationEvents[0]?.toMode),
      autoModeLastDirection: text(proAutoEscalationEvents[0]?.direction),
      autoModeEscalations: proAutoEscalationEvents.filter((item) => text(item?.direction) === "escalate").length,
      autoModeDeEscalations: proAutoEscalationEvents.filter((item) => text(item?.direction) === "de-escalate").length,
      criticalResponses: proCriticalResponseEvents.length,
      criticalLockdowns: proCriticalResponseEvents.filter((item) => Boolean(item?.modeChanged)).length,
      criticalLastAt: text(proCriticalResponseEvents[0]?.at),
      campaignResponses: proCampaignResponseEvents.length,
      campaignLastAt: text(proCampaignResponseEvents[0]?.at),
      campaignLastMode: text(proCampaignResponseEvents[0]?.toMode),
      authShieldActive: Boolean(authShieldStatus.active),
      authShieldUntil: authShieldStatus.expiresAt ? new Date(authShieldStatus.expiresAt).toISOString() : "",
      authShieldRemainingSec: authShieldStatus.remainingSec,
      authShieldActivations: proAuthShieldEvents.length,
      authShieldLastAt: text(proAuthShieldEvents[0]?.at),
      authStormWindowMinutes: Math.round(authStormWindowMs / 60_000),
      authStormFailuresInWindow: authStormFailureCount,
      identityProtectionsActive: activeIdentityProtections.length,
      identityProtectionsTotal: proIdentityProtectionEvents.length,
      identityProtectionLastAt: text(proIdentityProtectionEvents[0]?.at),
      subjectProtectionsActive: activeSubjectProtections.length,
      subjectProtectionsTotal: proSubjectProtectionEvents.length,
      subjectProtectionLastAt: text(proSubjectProtectionEvents[0]?.at),
      subjectSessionShields: proSubjectSessionShieldEvents.length,
      subjectSessionShieldLastAt: text(proSubjectSessionShieldEvents[0]?.at),
      subjectNetworkShields: proSubjectNetworkShieldEvents.length,
      subjectNetworkShieldLastAt: text(proSubjectNetworkShieldEvents[0]?.at),
      adminMutationShieldActive: Boolean(adminMutationShieldStatus.active),
      adminMutationShieldUntil: adminMutationShieldStatus.expiresAt
        ? new Date(adminMutationShieldStatus.expiresAt).toISOString()
        : "",
      adminMutationShieldRemainingSec: adminMutationShieldStatus.remainingSec,
      adminMutationWindowMinutes: Math.round(adminMutationWindowMs / 60_000),
      adminMutationAttemptsInWindow,
      adminMutationShields: proAdminMutationShieldEvents.length,
      adminMutationShieldLastAt: text(proAdminMutationShieldEvents[0]?.at),
      adminMutationSignedRequestsEnforced: toBoolean(adminControls.adminMutationSignatureEnforced, false),
      adminMutationSignatureSecretConfigured: Boolean(ADMIN_MUTATION_SIGNATURE_SECRET),
      adminMutationSignatureNonceCacheSize: proAdminMutationSignatureNonces.size,
      blockLists: {
        ips: Array.isArray(lists.blockedIps) ? lists.blockedIps.length : 0,
        fingerprints: Array.isArray(lists.blockedFingerprints) ? lists.blockedFingerprints.length : 0,
        userAgentSignatures: Array.isArray(lists.blockedUserAgentSignatures)
          ? lists.blockedUserAgentSignatures.length
          : 0,
        tokenSubjects: Array.isArray(lists.blockedTokenSubjects) ? lists.blockedTokenSubjects.length : 0
      },
      auditEventCount: proSecurityAuditEvents.length,
      integrity: {
        auditChainHead: proSecurityAuditChainHead,
        threatChainHead: proThreatIncidentChainHead
      }
    }
  };
}

function pushSecurityAuditEventInternal(event = {}) {
  const row = {
    id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: nowIso(),
    severity: text(event.severity, "medium").toLowerCase(),
    type: text(event.type, "general"),
    requestId: text(event.requestId),
    ip: text(event.ip),
    fingerprint: text(event.fingerprint),
    path: text(event.path),
    method: text(event.method).toUpperCase(),
    details: event.details && typeof event.details === "object" ? event.details : {}
  };
  const prevHash = proSecurityAuditChainHead;
  const integrityHash = sha256(JSON.stringify({
    prevHash,
    id: row.id,
    at: row.at,
    severity: row.severity,
    type: row.type,
    requestId: row.requestId,
    fingerprint: row.fingerprint,
    path: row.path,
    method: row.method,
    details: row.details
  }));
  row.prevHash = prevHash;
  row.integrityHash = integrityHash;
  proSecurityAuditChainHead = integrityHash;
  proSecurityAuditEvents.unshift(row);
  if (proSecurityAuditEvents.length > SECURITY_AUDIT_MAX_ITEMS) {
    proSecurityAuditEvents.length = SECURITY_AUDIT_MAX_ITEMS;
  }
}

export function pushProSecurityAuditEvent(req, payload = {}) {
  pushSecurityAuditEventInternal({
    ...payload,
    requestId: text(payload.requestId || req?.requestId),
    ip: text(payload.ip || getClientIp(req)),
    fingerprint: text(payload.fingerprint || requestFingerprint(req)),
    path: text(payload.path || req?.originalUrl || req?.path),
    method: text(payload.method || req?.method)
  });
}

export function getProSecurityAuditEvents(limit = 200) {
  const safeLimit = Math.min(1000, Math.max(1, toNumber(limit, 200)));
  return proSecurityAuditEvents.slice(0, safeLimit);
}

function looksLikeAllowedLocalhostOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(
    text(origin)
  );
}

export function createProCorsOptions() {
  const raw = text(process.env.CORS_ORIGIN);
  const allowAll = !raw || raw === "*";
  const strictCors =
    text(process.env.STRICT_CORS, "false").toLowerCase() === "true";
  const allowLocalhost =
    text(process.env.CORS_ALLOW_LOCALHOST, "true").toLowerCase() !== "false";
  const allowList = new Set(
    raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );

  return {
    credentials: true,
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowAll && !strictCors) return callback(null, true);
      if (allowList.has(origin)) return callback(null, true);
      if (allowLocalhost && looksLikeAllowedLocalhostOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origin blocked by CORS policy."));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "X-Requested-With",
      "X-Request-Id"
    ],
    exposedHeaders: ["X-Request-Id", "Retry-After", "X-RateLimit-Limit", "X-RateLimit-Remaining"]
  };
}

function isSecureRequest(req) {
  const forwardedProto = text(req?.headers?.["x-forwarded-proto"]).toLowerCase();
  if (forwardedProto.includes("https")) return true;
  return text(req?.protocol).toLowerCase() === "https";
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeListingImageArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => text(item)).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => text(item))
      .filter(Boolean);
  }
  return [];
}

function normalizeListingMedia(value) {
  const media = isPlainObject(value) ? value : {};
  const photoNames = normalizeListingImageArray(media.photoNames);
  return {
    photosCount: Math.max(0, toNumber(media.photosCount, photoNames.length)),
    photoNames,
    videoUploaded: Boolean(media.videoUploaded || text(media.videoName) || text(media.videoUrl)),
    videoDurationSec: Math.max(0, toNumber(media.videoDurationSec, 0)),
    duplicatePhotoMatches: Math.max(0, toNumber(media.duplicatePhotoMatches, 0)),
    blurryPhotosDetected: Math.max(0, toNumber(media.blurryPhotosDetected, 0))
  };
}

function normalizeListingPrivateDocs(value) {
  const docs = isPlainObject(value) ? value : {};
  const propertyDocuments = normalizeListingImageArray(docs.propertyDocuments);
  const uploadedPrivateDocs = Array.isArray(docs.uploadedPrivateDocs)
    ? docs.uploadedPrivateDocs.filter((item) => isPlainObject(item))
    : [];

  return {
    propertyDocuments,
    ownerIdProof: text(docs.ownerIdProof),
    addressProof: text(docs.addressProof),
    uploadedPrivateDocs
  };
}

function parseListingMutationContext(req) {
  const method = normalizeRequestMethod(req?.method);
  if (!["POST", "PATCH", "PUT"].includes(method)) return null;

  const normalizedPath = normalizeRequestPath(req?.path || req?.originalUrl || "");
  const segments = normalizedPath.split("/").filter(Boolean);
  if (segments[0] !== "api") return null;

  let version = "legacy";
  let index = 1;
  if (segments[1] === "v2" || segments[1] === "v3") {
    version = segments[1];
    index = 2;
  }

  if (segments[index] !== "properties") return null;
  const tail = segments.slice(index + 1);

  const isCreate = method === "POST" && tail.length === 0;
  const isCreateProfessional =
    method === "POST" && tail.length === 1 && text(tail[0]).toLowerCase() === "professional";
  const isUpdate = ["PATCH", "PUT"].includes(method) && tail.length === 1;
  const isUpdateProfessional =
    ["PATCH", "PUT"].includes(method) &&
    tail.length === 2 &&
    text(tail[1]).toLowerCase() === "professional";

  if (!isCreate && !isCreateProfessional && !isUpdate && !isUpdateProfessional) return null;

  return {
    method,
    requestPath: normalizedPath,
    version,
    mode: isCreateProfessional || isUpdateProfessional ? "professional" : "standard",
    action: isCreate || isCreateProfessional ? "create" : "update"
  };
}

function buildFakeListingPayload(req, context) {
  const body = isPlainObject(req?.body) ? req.body : {};
  const media = normalizeListingMedia(body.media);
  const imageUrls = normalizeListingImageArray(
    body.images || body.imageUrls || media.photoNames
  );
  const uniqueImageCount = new Set(imageUrls.map((item) => text(item).toLowerCase())).size;
  const duplicateImagesInPayload = Math.max(0, imageUrls.length - uniqueImageCount);
  const privateDocs = normalizeListingPrivateDocs(body.privateDocs);
  const hasPrivateDocs = Boolean(
    privateDocs.propertyDocuments.length ||
      privateDocs.uploadedPrivateDocs.length ||
      privateDocs.ownerIdProof ||
      privateDocs.addressProof
  );

  const photosCount = Math.max(
    imageUrls.length,
    media.photoNames.length,
    toNumber(media.photosCount, 0)
  );
  const hasVideo = Boolean(text(body.video) || media.videoUploaded);

  return {
    title: text(body.title),
    description: text(body.description),
    city: text(body.city),
    location: text(body.location || body.locality),
    type: text(body.type || body.saleRentMode || "buy").toLowerCase(),
    category: text(body.category || body.propertyType || "house").toLowerCase(),
    price: Math.max(0, toNumber(body.price, 0)),
    size: Math.max(
      0,
      toNumber(body.size, toNumber(body.areaSqft, toNumber(body.builtUpArea, toNumber(body.plotSize, 0))))
    ),
    images: imageUrls,
    photosCount,
    hasVideo,
    media,
    hasPrivateDocs,
    duplicateImagesInPayload,
    context
  };
}

function buildFakeListingSignature(payload) {
  const canonical = {
    title: text(payload.title).toLowerCase(),
    description: text(payload.description).toLowerCase().slice(0, 320),
    city: text(payload.city).toLowerCase(),
    location: text(payload.location).toLowerCase(),
    type: text(payload.type).toLowerCase(),
    category: text(payload.category).toLowerCase(),
    price: Math.max(0, toNumber(payload.price, 0)),
    size: Math.max(0, toNumber(payload.size, 0)),
    photosCount: Math.max(0, toNumber(payload.photosCount, 0)),
    hasVideo: Boolean(payload.hasVideo),
    images: [...new Set((Array.isArray(payload.images) ? payload.images : []).map((item) => text(item).toLowerCase()))].sort()
  };
  return sha256(JSON.stringify(canonical)).slice(0, 24);
}

function scoreFakeListingPayload({ payload, state, nowTs, fingerprint = "" }) {
  const reasons = [];
  let score = 0;
  const rawListingText = `${text(payload.title)} ${text(payload.description)}`;
  const listingText = rawListingText.toLowerCase();
  const addSignal = (points, reason) => {
    score += Math.max(0, Number(points || 0));
    if (reason) reasons.push(reason);
  };

  if (!payload.title || payload.title.length < 10) {
    addSignal(8, "weak-listing-title");
  }
  if (!payload.description || payload.description.length < 25) {
    addSignal(8, "very-short-description");
  }
  if (/[\u200B-\u200D\uFEFF]/.test(rawListingText)) {
    addSignal(24, "hidden-unicode-obfuscation");
  }
  if (/(.)\1{5,}/.test(rawListingText)) {
    addSignal(12, "repeated-character-spam");
  }
  const textLen = rawListingText.length;
  if (textLen > 30) {
    const punctCount = (rawListingText.match(/[^\w\s]/g) || []).length;
    const punctDensity = punctCount / textLen;
    if (punctDensity >= 0.32) {
      addSignal(14, "punctuation-density-anomaly");
    }
  }

  const phraseMatches = FAKE_LISTING_RISK_PHRASES.filter((phrase) => listingText.includes(phrase));
  const highRiskPhraseMatches = FAKE_LISTING_HIGH_RISK_PHRASES.filter((phrase) =>
    listingText.includes(phrase)
  );
  if (phraseMatches.length) {
    addSignal(Math.min(30, phraseMatches.length * 10), "risky-phrase-pattern");
  }
  if (highRiskPhraseMatches.length) {
    addSignal(Math.min(42, highRiskPhraseMatches.length * 20), "high-risk-phrase-pattern");
  }

  const hasDirectContact = DIRECT_CONTACT_PATTERNS.some((rule) => rule.test(listingText));
  if (hasDirectContact) {
    addSignal(22, "direct-contact-in-listing");
  }
  if (SUSPICIOUS_LINK_PATTERN.test(listingText)) {
    addSignal(24, "suspicious-short-link");
  }

  const isRentType = payload.type.includes("rent");
  if (!isRentType && payload.price > 0 && payload.price < 100000) {
    addSignal(28, "abnormally-low-sale-price");
  }
  if (isRentType && payload.price > 350000) {
    addSignal(22, "abnormally-high-rent-price");
  }
  if (payload.size > 0 && payload.price > 0) {
    const pricePerSqft = payload.price / payload.size;
    if (pricePerSqft < 120) {
      addSignal(18, "price-per-sqft-too-low");
    } else if (pricePerSqft > 250000) {
      addSignal(16, "price-per-sqft-too-high");
    }
  }

  if (payload.photosCount > 0 && payload.photosCount < 5) {
    addSignal(15, "insufficient-photo-count");
  }
  if (!payload.hasVideo) {
    addSignal(10, "missing-property-video");
  }
  if (payload.media.duplicatePhotoMatches > 0) {
    addSignal(Math.min(42, 24 + payload.media.duplicatePhotoMatches * 6), "duplicate-photo-detected");
  }
  if (payload.media.blurryPhotosDetected >= 3) {
    addSignal(14, "multiple-blurry-photos");
  }
  if (payload.duplicateImagesInPayload > 0) {
    addSignal(16, "duplicate-images-in-payload");
  }
  if (payload.context.mode === "professional" && !payload.hasPrivateDocs) {
    addSignal(20, "missing-private-documents");
  }

  const signature = buildFakeListingSignature(payload);
  const signatureIntel = registerFakeListingSignatureEvent(signature, fingerprint, nowTs);
  const previousSignals = (Array.isArray(state?.listingSignals) ? state.listingSignals : []).filter(
    (item) => Number(item?.at || 0) >= nowTs - FAKE_LISTING_SIGNAL_WINDOW_MS
  );
  const repeatSignatureCount =
    previousSignals.filter((item) => text(item?.signature) === signature).length + 1;
  if (repeatSignatureCount >= FAKE_LISTING_REPEAT_SIGNATURE_THRESHOLD) {
    addSignal(24, "repeated-listing-signature");
  }
  if (signatureIntel.distinctFingerprintCount >= FAKE_LISTING_SIGNATURE_FINGERPRINT_THRESHOLD) {
    addSignal(30, "cross-fingerprint-signature-reuse");
  }
  if (signatureIntel.occurrences >= FAKE_LISTING_SIGNATURE_OCCURRENCE_THRESHOLD) {
    addSignal(18, "high-frequency-signature-reuse");
  }
  if (signatureIntel.recentBurstCount >= FAKE_LISTING_BURST_THRESHOLD) {
    addSignal(20, "signature-burst-window");
  }

  const highRiskRecentCount = previousSignals.filter(
    (item) => Number(item?.riskScore || 0) >= FAKE_LISTING_ALERT_THRESHOLD
  ).length + (score >= FAKE_LISTING_ALERT_THRESHOLD ? 1 : 0);
  if (highRiskRecentCount >= FAKE_LISTING_BURST_THRESHOLD) {
    addSignal(22, "high-risk-listing-burst");
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  const listingSignals = [...previousSignals, {
    at: nowTs,
    signature,
    riskScore: finalScore,
    path: payload.context.requestPath,
    blocked: finalScore >= FAKE_LISTING_BLOCK_THRESHOLD
  }].slice(-FAKE_LISTING_MAX_SIGNAL_ITEMS);

  return {
    score: finalScore,
    signature,
    reasons: [...new Set(reasons)],
    flags: {
      hasDirectContact,
      suspiciousShortLink: SUSPICIOUS_LINK_PATTERN.test(listingText),
      suspiciousPricingAlert:
        (!isRentType && payload.price > 0 && payload.price < 100000) ||
        (isRentType && payload.price > 350000),
      duplicatePhotoDetected: payload.media.duplicatePhotoMatches > 0,
      duplicatePhotoCount: payload.media.duplicatePhotoMatches,
      blurryPhotosDetected: payload.media.blurryPhotosDetected,
      repeatSignatureCount,
      signatureOccurrences: signatureIntel.occurrences,
      signatureDistinctFingerprintCount: signatureIntel.distinctFingerprintCount,
      signatureRecentBurstCount: signatureIntel.recentBurstCount,
      highRiskRecentCount,
      phraseMatches,
      highRiskPhraseMatches
    },
    listingSignals
  };
}

function applyFakeListingReviewPatch(req, context, evaluation, {
  alertThreshold = FAKE_LISTING_ALERT_THRESHOLD,
  blockThreshold = FAKE_LISTING_BLOCK_THRESHOLD
} = {}) {
  if (!isPlainObject(req?.body)) return;

  const body = req.body;
  const existingAiReview = isPlainObject(body.aiReview) ? body.aiReview : {};
  const existingSignals = Array.isArray(existingAiReview.securitySignals)
    ? existingAiReview.securitySignals.map((item) => text(item)).filter(Boolean)
    : [];
  const combinedSignals = [...new Set([...existingSignals, ...evaluation.reasons])];
  const existingFraudRiskScore = Math.max(0, toNumber(existingAiReview.fraudRiskScore, 0));
  const nextFraudRiskScore = Math.max(existingFraudRiskScore, evaluation.score);
  const autoModerationRequired = nextFraudRiskScore >= alertThreshold;

  body.aiReview = {
    ...existingAiReview,
    fraudRiskScore: nextFraudRiskScore,
    fakeListingSignal: Boolean(existingAiReview.fakeListingSignal) || autoModerationRequired,
    suspiciousPricingAlert:
      Boolean(existingAiReview.suspiciousPricingAlert) || Boolean(evaluation.flags.suspiciousPricingAlert),
    duplicatePhotoDetected:
      Boolean(existingAiReview.duplicatePhotoDetected) || Boolean(evaluation.flags.duplicatePhotoDetected),
    duplicatePhotoCount: Math.max(
      toNumber(existingAiReview.duplicatePhotoCount, 0),
      toNumber(evaluation.flags.duplicatePhotoCount, 0)
    ),
    riskyPhraseMatches: [
      ...new Set([
        ...(Array.isArray(existingAiReview.riskyPhraseMatches) ? existingAiReview.riskyPhraseMatches : []),
        ...evaluation.flags.phraseMatches,
        ...evaluation.flags.highRiskPhraseMatches
      ])
    ],
    directContactDetected:
      Boolean(existingAiReview.directContactDetected) || Boolean(evaluation.flags.hasDirectContact),
    suspiciousShortLinkDetected:
      Boolean(existingAiReview.suspiciousShortLinkDetected) || Boolean(evaluation.flags.suspiciousShortLink),
    repeatedSignatureCount: Math.max(
      toNumber(existingAiReview.repeatedSignatureCount, 0),
      toNumber(evaluation.flags.repeatSignatureCount, 0)
    ),
    highRiskRecentCount: Math.max(
      toNumber(existingAiReview.highRiskRecentCount, 0),
      toNumber(evaluation.flags.highRiskRecentCount, 0)
    ),
    autoModerationRequired,
    securitySignals: combinedSignals.slice(0, 20),
    aiModelVersion: "propertysetu-fake-listing-guard-v2",
    scannedAt: nowIso(),
    recommendation:
      nextFraudRiskScore >= blockThreshold
        ? "Blocked by AI fake listing security."
        : autoModerationRequired
          ? "Manual admin verification required."
          : text(existingAiReview.recommendation, "Looks normal")
  };

  if (autoModerationRequired) {
    body.verified = false;
    body.verifiedByPropertySetu = false;
    if (context.version === "legacy") {
      body.status = "Pending Approval";
    } else {
      body.status = "draft";
    }
  }
}

export function proAttachRequestContext(req, res, next) {
  const incoming = sanitizeRequestId(req?.headers?.["x-request-id"]);
  const requestId = incoming || crypto.randomUUID();
  req.requestId = requestId;
  req.requestStartedAt = Date.now();
  req.clientIp = getClientIp(req);
  res.setHeader("X-Request-Id", requestId);
  next();
}

export function proSecurityHeaders(req, res, next) {
  const requestPath = String(req.originalUrl || req.baseUrl || req.path || "");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  res.setHeader("Origin-Agent-Cluster", "?1");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
  );

  if (isSecureRequest(req)) {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }

  if (requestPath.startsWith("/api")) {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    );
  }

  if (
    requestPath.includes("/auth/") ||
    requestPath.startsWith("/api/auth")
  ) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }

  next();
}

function normalizeRequestPath(value) {
  const raw = String(value || "").trim();
  if (!raw) return "/";
  try {
    const decoded = decodeURIComponent(raw);
    const cleaned = decoded.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
    if (!cleaned.startsWith("/")) return `/${cleaned}`;
    return cleaned;
  } catch {
    const cleaned = raw.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
    if (!cleaned.startsWith("/")) return `/${cleaned}`;
    return cleaned;
  }
}

function isSensitivePublicPath(requestPath) {
  const normalized = normalizeRequestPath(requestPath);
  return SENSITIVE_PUBLIC_PATH_RULES.some((rule) => rule.test(normalized));
}

function isAuthApiPath(requestPath) {
  const normalized = normalizeRequestPath(requestPath);
  return AUTH_ENDPOINT_PATH_RULES.some((rule) => rule.test(normalized));
}

function isThreatDetectionExcludedPath(requestPath) {
  const normalized = normalizeRequestPath(requestPath);
  return THREAT_DETECTION_EXCLUDED_PATHS.some((rule) => rule.test(normalized));
}

function normalizeRequestMethod(value = "") {
  return text(value).toUpperCase();
}

function hasControlChars(value = "") {
  return /[\0\r\n]/.test(String(value || ""));
}

function hasEncodedControlChars(value = "") {
  return /%(?:00|0d|0a)/i.test(String(value || ""));
}

function hasMethodOverrideHeaders(req) {
  return API_METHOD_OVERRIDE_HEADERS.some((headerName) => text(req?.headers?.[headerName]));
}

function hasHeaderSmugglingSignals(req) {
  const transferEncoding = text(req?.headers?.["transfer-encoding"]).toLowerCase();
  const contentLength = text(req?.headers?.["content-length"]);
  if (transferEncoding && contentLength) return true;
  if (hasControlChars(transferEncoding) || hasControlChars(contentLength)) return true;
  return false;
}

function isSuspiciousHostHeader(req) {
  const host = text(req?.headers?.host).toLowerCase();
  if (!host) return false;
  if (host.length > API_MAX_HOST_HEADER_LENGTH) return true;
  if (host.includes(" ") || host.includes("/") || host.includes("@")) return true;
  if (hasControlChars(host)) return true;
  return !/^[a-z0-9.\-:\[\]]+$/i.test(host);
}

function isKnownScannerPath(requestPath = "") {
  const normalized = normalizeRequestPath(requestPath);
  return API_SCANNER_PATH_RULES.some((rule) => rule.test(normalized));
}

function isApiMutationMethod(method = "") {
  const normalized = normalizeRequestMethod(method);
  return normalized === "POST" || normalized === "PUT" || normalized === "PATCH" || normalized === "DELETE";
}

function isAdminMutationPath(requestPath = "", method = "") {
  if (!isApiMutationMethod(method)) return false;
  const normalized = normalizeRequestPath(requestPath);
  return ADMIN_MUTATION_PATH_RULES.some((rule) => rule.test(normalized));
}

function isSecurityControlPath(requestPath = "") {
  const normalized = normalizeRequestPath(requestPath);
  return SECURITY_CONTROL_PATH_RULES.some((rule) => rule.test(normalized));
}

function isReadOnlyBypassPath(requestPath = "") {
  const normalized = normalizeRequestPath(requestPath);
  return READ_ONLY_BYPASS_PATH_RULES.some((rule) => rule.test(normalized));
}

function isAllowedAdminIp(rawIp = "") {
  const ip = text(rawIp).toLowerCase();
  if (!ip) return false;
  if (!API_ADMIN_ALLOWLIST_IPS.length) return true;
  const normalized = ip.replace(/^::ffff:/i, "");
  return API_ADMIN_ALLOWLIST_IPS.some((allowed) => {
    const safe = text(allowed).toLowerCase().replace(/^::ffff:/i, "");
    if (!safe) return false;
    if (safe.endsWith("*")) {
      return normalized.startsWith(safe.slice(0, -1));
    }
    return safe === normalized;
  });
}

function isSecureTransport(req) {
  const forwardedProto = text(req?.headers?.["x-forwarded-proto"]).toLowerCase();
  if (forwardedProto.includes("https")) return true;
  return text(req?.protocol).toLowerCase() === "https";
}

function pruneAdminMutationSignatureNonces(nowTs = Date.now()) {
  const safeNow = Number(nowTs);
  for (const [nonce, row] of proAdminMutationSignatureNonces.entries()) {
    const expiresAt = Number(row?.expiresAt || 0);
    if (!Number.isFinite(expiresAt) || expiresAt <= safeNow) {
      proAdminMutationSignatureNonces.delete(nonce);
    }
  }

  if (proAdminMutationSignatureNonces.size <= ADMIN_MUTATION_SIGNATURE_NONCE_MAX_ITEMS) return;

  const ordered = [...proAdminMutationSignatureNonces.entries()]
    .sort((a, b) => Number(a?.[1]?.expiresAt || 0) - Number(b?.[1]?.expiresAt || 0));
  const trimCount = proAdminMutationSignatureNonces.size - ADMIN_MUTATION_SIGNATURE_NONCE_MAX_ITEMS;
  for (let index = 0; index < trimCount; index += 1) {
    const key = text(ordered[index]?.[0]);
    if (key) {
      proAdminMutationSignatureNonces.delete(key);
    }
  }
}

function hashAdminMutationSignatureInput(value) {
  try {
    return sha256(stableStringify(value));
  } catch {
    try {
      return sha256(JSON.stringify(value));
    } catch {
      return sha256("");
    }
  }
}

function buildAdminMutationBodyHash(req) {
  const body = req?.body;
  if (typeof body === "undefined" || body === null) return sha256("");
  if (typeof body === "string") return sha256(body);
  if (Buffer.isBuffer(body)) return sha256(body.toString("base64"));
  return hashAdminMutationSignatureInput(body);
}

function buildAdminMutationQueryHash(req) {
  const query = req?.query && typeof req.query === "object" && !Array.isArray(req.query)
    ? req.query
    : {};
  return hashAdminMutationSignatureInput(query);
}

function computeAdminMutationRequestSignature({
  requestPath = "",
  method = "POST",
  timestampSec = 0,
  nonce = "",
  bodyHash = "",
  queryHash = ""
} = {}) {
  if (!ADMIN_MUTATION_SIGNATURE_SECRET) return "";
  const canonicalMethod = normalizeRequestMethod(method);
  const canonicalPath = normalizeRequestPath(requestPath || "/api/system");
  const canonicalTimestamp = String(Math.trunc(Number(timestampSec || 0)));
  const canonicalNonce = text(nonce);
  const canonicalBodyHash = text(bodyHash).toLowerCase();
  const canonicalQueryHash = text(queryHash).toLowerCase();
  const signingInput = [
    canonicalMethod,
    canonicalPath,
    canonicalTimestamp,
    canonicalNonce,
    canonicalBodyHash,
    canonicalQueryHash
  ].join("|");
  return crypto
    .createHmac("sha256", ADMIN_MUTATION_SIGNATURE_SECRET)
    .update(signingInput)
    .digest("hex");
}

function evaluateAdminMutationRequestSignature(req, {
  requestPath = "",
  method = "POST"
} = {}) {
  const adminControls = currentSecurityAdminControls();
  const enforced = toBoolean(adminControls.adminMutationSignatureEnforced, false);
  if (!enforced) {
    return {
      valid: true,
      reason: "signature-disabled",
      enforced: false
    };
  }

  if (!ADMIN_MUTATION_SIGNATURE_SECRET) {
    return {
      valid: false,
      reason: "secret-missing",
      enforced: true
    };
  }

  const signature = text(req?.headers?.["x-admin-signature"]).toLowerCase();
  const nonce = text(
    req?.headers?.["x-admin-signature-nonce"] || req?.headers?.["x-admin-nonce"]
  );
  const timestampRaw = text(
    req?.headers?.["x-admin-signature-ts"] || req?.headers?.["x-admin-timestamp"]
  );

  if (!signature) {
    return {
      valid: false,
      reason: "missing-signature-header",
      enforced: true
    };
  }
  if (!timestampRaw) {
    return {
      valid: false,
      reason: "missing-timestamp-header",
      enforced: true
    };
  }
  if (!nonce) {
    return {
      valid: false,
      reason: "missing-nonce-header",
      enforced: true
    };
  }
  if (!/^[a-f0-9]{64}$/i.test(signature)) {
    return {
      valid: false,
      reason: "invalid-signature-format",
      enforced: true
    };
  }
  if (!ADMIN_SIGNATURE_NONCE_PATTERN.test(nonce)) {
    return {
      valid: false,
      reason: "invalid-nonce-format",
      enforced: true
    };
  }

  const timestampSec = Number(timestampRaw);
  if (!Number.isFinite(timestampSec) || !Number.isInteger(timestampSec) || timestampSec <= 0) {
    return {
      valid: false,
      reason: "invalid-timestamp-format",
      enforced: true
    };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const driftSec = Math.abs(nowSec - timestampSec);
  if (driftSec > ADMIN_MUTATION_SIGNATURE_CLOCK_SKEW_SEC) {
    return {
      valid: false,
      reason: "timestamp-skew",
      enforced: true,
      driftSec
    };
  }

  const nowTs = Date.now();
  pruneAdminMutationSignatureNonces(nowTs);
  const existingNonce = proAdminMutationSignatureNonces.get(nonce);
  if (existingNonce && Number(existingNonce?.expiresAt || 0) > nowTs) {
    return {
      valid: false,
      reason: "nonce-replay-detected",
      enforced: true
    };
  }

  const bodyHash = buildAdminMutationBodyHash(req);
  const queryHash = buildAdminMutationQueryHash(req);
  const expected = computeAdminMutationRequestSignature({
    requestPath,
    method,
    timestampSec,
    nonce,
    bodyHash,
    queryHash
  });
  if (!expected || !timingSafeEqualText(signature, expected)) {
    return {
      valid: false,
      reason: "signature-mismatch",
      enforced: true
    };
  }

  proAdminMutationSignatureNonces.set(nonce, {
    usedAt: nowTs,
    expiresAt: nowTs + ADMIN_MUTATION_SIGNATURE_NONCE_TTL_MS,
    method: normalizeRequestMethod(method),
    path: normalizeRequestPath(requestPath || req?.path || "/api/system"),
    requestId: text(req?.requestId)
  });
  pruneAdminMutationSignatureNonces(nowTs);

  return {
    valid: true,
    reason: "signature-verified",
    enforced: true,
    driftSec
  };
}

function extractBearerToken(req) {
  const authHeader = text(req?.headers?.authorization);
  if (!authHeader) return { scheme: "", token: "", raw: "" };
  const parts = authHeader.split(/\s+/).filter(Boolean);
  if (!parts.length) return { scheme: "", token: "", raw: authHeader };
  const scheme = text(parts[0]).toLowerCase();
  if (scheme !== "bearer") return { scheme, token: "", raw: authHeader };
  const token = text(parts.slice(1).join(""));
  return { scheme, token, raw: authHeader };
}

function inspectJwtToken(token = "", nowSec = Math.floor(Date.now() / 1000)) {
  const safeToken = text(token);
  const metadata = {
    subject: "",
    jti: "",
    issuer: "",
    audience: "",
    alg: ""
  };
  if (!safeToken) {
    return {
      suspicious: false,
      score: 0,
      reasons: [],
      metadata
    };
  }

  const reasons = [];
  let score = 0;
  const add = (points, reason) => {
    score += Math.max(0, Number(points || 0));
    if (reason) reasons.push(reason);
  };

  if (safeToken.length > TOKEN_MAX_LENGTH) {
    add(70, "token-too-large");
  }
  if (safeToken.includes(",") || safeToken.includes("Bearer")) {
    add(68, "token-header-injection-pattern");
  }
  if (safeToken.includes(" ") || /\t/.test(safeToken)) {
    add(40, "token-whitespace-anomaly");
  }

  const segments = safeToken.split(".");
  if (segments.length !== 3) {
    add(72, "token-format-invalid");
    return {
      suspicious: score >= 60,
      score,
      reasons: [...new Set(reasons)],
      metadata
    };
  }

  const header = safeParseJwtSegment(segments[0]);
  const payload = safeParseJwtSegment(segments[1]);
  if (!header) add(75, "token-header-decode-failed");
  if (!payload) add(75, "token-payload-decode-failed");
  if (!header || !payload) {
    return {
      suspicious: score >= 60,
      score,
      reasons: [...new Set(reasons)],
      metadata
    };
  }

  const alg = text(header.alg).toUpperCase();
  metadata.alg = alg;
  if (!alg || alg === "NONE") {
    add(95, "token-alg-none");
  } else if (!TOKEN_FIREWALL_ALLOWED_ALGS.has(alg)) {
    add(80, `token-alg-not-allowed:${alg}`);
  }

  if (header.jku || header.x5u || header.crit || header.cty) {
    add(76, "token-header-unsupported-fields");
  }
  if (text(header.kid).length > 80) {
    add(64, "token-kid-too-long");
  }

  const exp = Number(payload.exp);
  const nbf = Number(payload.nbf);
  const iat = Number(payload.iat);
  if (Number.isFinite(exp) && exp > nowSec + TOKEN_MAX_FUTURE_EXP_SEC) {
    add(54, "token-exp-too-far-future");
  }
  if (Number.isFinite(nbf) && nbf > nowSec + TOKEN_MAX_FUTURE_NBF_SEC) {
    add(70, "token-nbf-too-far-future");
  }
  if (Number.isFinite(iat) && iat > nowSec + TOKEN_MAX_CLOCK_SKEW_SEC) {
    add(62, "token-iat-future-anomaly");
  }

  const subject = text(payload.sub || payload.userId || payload.id);
  metadata.subject = subject.slice(0, 140);
  metadata.jti = text(payload.jti).slice(0, 180);
  metadata.issuer = text(payload.iss).slice(0, 120);
  metadata.audience = Array.isArray(payload.aud)
    ? text(payload.aud[0]).slice(0, 120)
    : text(payload.aud).slice(0, 120);
  if (subject.length > 140) {
    add(52, "token-subject-too-long");
  }
  if (!subject) {
    add(22, "token-subject-missing");
  }

  return {
    suspicious: score >= 60,
    score,
    reasons: [...new Set(reasons)],
    metadata
  };
}

function computeAdaptiveBlockDurationMs(incidentCount = 0) {
  const normalizedIncidents = Math.max(0, Number(incidentCount || 0));
  const repeatStep = Math.floor(normalizedIncidents / THREAT_REPEAT_OFFENDER_THRESHOLD);
  const multiplier = Math.pow(THREAT_REPEAT_OFFENDER_MULTIPLIER, repeatStep);
  return Math.max(
    THREAT_BLOCK_DURATION_MS,
    Math.min(
      THREAT_REPEAT_OFFENDER_MAX_BLOCK_MS,
      Math.round(THREAT_BLOCK_DURATION_MS * multiplier)
    )
  );
}

function quarantineByFirewall(req, {
  reason = "firewall-block",
  requestPath = "/api",
  method = "GET",
  riskScore = 70,
  details = {}
} = {}) {
  const fingerprint = requestFingerprint(req);
  const nowTs = Date.now();
  const current = nextProfileState(proThreatProfiles.get(fingerprint), nowTs);
  const incidentCount = Math.max(0, Number(current.incidentCount || 0)) + 1;
  const durationMs = computeAdaptiveBlockDurationMs(incidentCount);
  const nextState = {
    ...current,
    riskScore: Math.max(
      THREAT_SCORE_BLOCK_THRESHOLD,
      Math.max(0, Number(current.riskScore || 0)) + Math.max(0, Number(riskScore || 0))
    ),
    incidentCount,
    blockUntil: nowTs + durationMs,
    lastSeenAt: nowTs,
    quarantineReason: text(reason, "firewall-block")
  };
  proThreatProfiles.set(fingerprint, nextState);
  pruneThreatProfiles();

  pushThreatIncident({
    fingerprint,
    ip: getClientIp(req),
    subject: text(details?.subject).toLowerCase(),
    requestId: req.requestId,
    path: requestPath,
    method,
    riskScore: Math.max(0, Number(riskScore || 0)),
    cumulativeRiskScore: nextState.riskScore,
    blocked: true,
    reason: nextState.quarantineReason,
    rules: [nextState.quarantineReason]
  });

  const retryAfterSec = Math.max(1, Math.ceil(durationMs / 1000));
  pushProSecurityAuditEvent(req, {
    severity: "high",
    type: "request_firewall_blocked",
    details: {
      reason: nextState.quarantineReason,
      requestPath,
      method,
      riskScore: Math.max(0, Number(riskScore || 0)),
      incidentCount,
      retryAfterSec,
      ...details
    }
  });

  return {
    fingerprint,
    retryAfterSec,
    blockUntil: nextState.blockUntil
  };
}

export function proRequestFirewall(req, res, next) {
  const modules = currentSecurityControlModules();
  if (!modules.requestFirewall) return next();

  const rawPath = String(req.originalUrl || req.baseUrl || req.path || "");
  if (!rawPath.startsWith("/api")) return next();

  const method = normalizeRequestMethod(req.method);
  const pathForChecks = normalizeRequestPath(req.path || rawPath || "/");
  const fingerprint = requestFingerprint(req);
  const clientIp = getClientIp(req);
  const userAgent = text(req?.headers?.["user-agent"]).toLowerCase();
  const authIdentity = extractAuthIdentitySample(req);
  const isControlPath = isSecurityControlPath(pathForChecks);

  maybeAutoDeEscalateSecurityMode({
    reason: "request-flow",
    path: pathForChecks,
    requestId: req.requestId
  });

  const reject = ({
    reason,
    statusCode = 403,
    riskScore = 70,
    details = {},
    message = "Request blocked by firewall policy."
  }) => {
    req.proSecurityBlockSource = text(reason, "firewall-block");
    const incident = quarantineByFirewall(req, {
      reason,
      requestPath: pathForChecks,
      method,
      riskScore,
      details
    });
    if (isAdminMutationPath(pathForChecks, method)) {
      maybeApplyAdminMutationShield({
        requestId: req.requestId,
        path: pathForChecks,
        method,
        reason,
        fingerprint,
        ip: clientIp
      });
    }
    res.setHeader("Retry-After", String(incident.retryAfterSec));
    return res.status(statusCode).json({
      success: false,
      message,
      retryAfterSec: incident.retryAfterSec,
      requestId: req.requestId
    });
  };

  if (!API_ALLOWED_METHODS.has(method)) {
    return reject({
      reason: "firewall-method-not-allowed",
      statusCode: 405,
      riskScore: 95,
      message: "HTTP method is not allowed for this API."
    });
  }

  if (pathForChecks.length > API_MAX_PATH_LENGTH) {
    return reject({
      reason: "firewall-path-too-long",
      statusCode: 414,
      riskScore: 82,
      details: {
        pathLength: pathForChecks.length
      },
      message: "Request path is too long."
    });
  }

  if (hasControlChars(rawPath) || hasEncodedControlChars(rawPath)) {
    return reject({
      reason: "firewall-control-char-path",
      statusCode: 400,
      riskScore: 88,
      message: "Malformed request path blocked by firewall."
    });
  }

  if (isKnownScannerPath(pathForChecks)) {
    return reject({
      reason: "firewall-scanner-path",
      statusCode: 403,
      riskScore: 96,
      message: "Security policy blocked this request path."
    });
  }

  if (hasMethodOverrideHeaders(req)) {
    return reject({
      reason: "firewall-method-override-header",
      statusCode: 400,
      riskScore: 80,
      message: "Method override headers are not permitted."
    });
  }

  if (hasHeaderSmugglingSignals(req)) {
    return reject({
      reason: "firewall-header-smuggling-signal",
      statusCode: 400,
      riskScore: 95,
      message: "Malformed request headers blocked by firewall."
    });
  }

  if (isSuspiciousHostHeader(req)) {
    return reject({
      reason: "firewall-suspicious-host-header",
      statusCode: 400,
      riskScore: 85,
      message: "Suspicious host header blocked by firewall."
    });
  }

  if (!isControlPath && isBlockedSecurityFingerprint(fingerprint)) {
    return reject({
      reason: "firewall-fingerprint-blocklist",
      statusCode: 403,
      riskScore: 98,
      details: {
        fingerprint
      },
      message: "Request blocked by security fingerprint policy."
    });
  }

  if (!isControlPath && isBlockedSecurityIp(clientIp)) {
    return reject({
      reason: "firewall-ip-blocklist",
      statusCode: 403,
      riskScore: 99,
      details: {
        clientIp
      },
      message: "Request blocked by security IP policy."
    });
  }

  if (!isControlPath && isBlockedSecurityUserAgent(userAgent)) {
    return reject({
      reason: "firewall-user-agent-blocklist",
      statusCode: 403,
      riskScore: 93,
      details: {
        userAgent: userAgent.slice(0, 120)
      },
      message: "Request blocked by user-agent security policy."
    });
  }

  const adminControls = currentSecurityAdminControls();
  const authShield = currentAuthShieldStatus();
  if (isAuthApiPath(pathForChecks) && isApiMutationMethod(method) && authShield.active) {
    const headerKey = text(req?.headers?.["x-admin-action-key"]);
    const hasConfiguredSecret = text(API_ADMIN_ACTION_KEY).length > 0;
    const bypassByActionKey = hasConfiguredSecret && timingSafeEqualText(headerKey, API_ADMIN_ACTION_KEY);
    const bypassByTrustedFingerprint = isTrustedSecurityFingerprint(fingerprint);
    if (bypassByActionKey || bypassByTrustedFingerprint) {
      pushProSecurityAuditEvent(req, {
        severity: "medium",
        type: "auth-storm-shield-bypass",
        details: {
          path: pathForChecks,
          method,
          bypassByActionKey: Boolean(bypassByActionKey),
          bypassByTrustedFingerprint: Boolean(bypassByTrustedFingerprint),
          shieldRemainingSec: authShield.remainingSec
        }
      });
    } else {
      return reject({
        reason: "firewall-auth-storm-shield",
        statusCode: 429,
        riskScore: 92,
        details: {
          mode: currentSecurityMode(),
          shieldActiveUntil: authShield.expiresAt
            ? new Date(authShield.expiresAt).toISOString()
            : "",
          shieldRemainingSec: authShield.remainingSec
        },
        message: "Authentication endpoints are temporarily shielded due to suspicious traffic."
      });
    }
  }
  if (isAuthApiPath(pathForChecks) && isApiMutationMethod(method) && authIdentity) {
    const identityStatus = getProtectedAuthIdentityStatus(authIdentity);
    if (identityStatus.active) {
      const headerKey = text(req?.headers?.["x-admin-action-key"]);
      const hasConfiguredSecret = text(API_ADMIN_ACTION_KEY).length > 0;
      const bypassByActionKey = hasConfiguredSecret && timingSafeEqualText(headerKey, API_ADMIN_ACTION_KEY);
      const bypassByTrustedFingerprint = isTrustedSecurityFingerprint(fingerprint);
      if (bypassByActionKey || bypassByTrustedFingerprint) {
        pushProSecurityAuditEvent(req, {
          severity: "medium",
          type: "auth-identity-protection-bypass",
          details: {
            path: pathForChecks,
            method,
            identity: identityStatus.identity,
            bypassByActionKey: Boolean(bypassByActionKey),
            bypassByTrustedFingerprint: Boolean(bypassByTrustedFingerprint),
            protectionRemainingSec: identityStatus.remainingSec
          }
        });
      } else {
        return reject({
          reason: "firewall-auth-identity-protected",
          statusCode: 429,
          riskScore: 94,
          details: {
            identity: identityStatus.identity,
            protectionReason: identityStatus.reason,
            protectionRemainingSec: identityStatus.remainingSec,
            protectedUntil: identityStatus.until
              ? new Date(identityStatus.until).toISOString()
              : ""
          },
          message: "This authentication identity is temporarily protected due to suspicious attack patterns."
        });
      }
    }
  }
  if (isAdminMutationPath(pathForChecks, method)) {
    const adminMutationShield = currentAdminMutationShieldStatus();
    if (adminMutationShield.active) {
      const headerKey = text(req?.headers?.["x-admin-action-key"]);
      const hasConfiguredSecret = text(API_ADMIN_ACTION_KEY).length > 0;
      const bypassByActionKey = hasConfiguredSecret && timingSafeEqualText(headerKey, API_ADMIN_ACTION_KEY);
      const bypassByTrustedFingerprint = isTrustedSecurityFingerprint(fingerprint);
      if (bypassByActionKey || bypassByTrustedFingerprint) {
        pushProSecurityAuditEvent(req, {
          severity: "medium",
          type: "admin-mutation-shield-bypass",
          details: {
            path: pathForChecks,
            method,
            bypassByActionKey: Boolean(bypassByActionKey),
            bypassByTrustedFingerprint: Boolean(bypassByTrustedFingerprint),
            shieldRemainingSec: adminMutationShield.remainingSec
          }
        });
      } else {
        return reject({
          reason: "firewall-admin-mutation-shield",
          statusCode: 429,
          riskScore: 96,
          details: {
            shieldActiveUntil: adminMutationShield.expiresAt
              ? new Date(adminMutationShield.expiresAt).toISOString()
              : "",
            shieldRemainingSec: adminMutationShield.remainingSec
          },
          message: "Admin mutation endpoints are temporarily shielded due to suspicious activity."
        });
      }
    }
  }
  if (
    adminControls.readOnlyApi &&
    isApiMutationMethod(method) &&
    !isReadOnlyBypassPath(pathForChecks)
  ) {
    const headerKey = text(req?.headers?.["x-admin-action-key"]);
    const hasConfiguredSecret = text(API_ADMIN_ACTION_KEY).length > 0;
    const bypassAllowed = hasConfiguredSecret && timingSafeEqualText(headerKey, API_ADMIN_ACTION_KEY);
    if (!bypassAllowed) {
      return reject({
        reason: "firewall-read-only-lockdown",
        statusCode: 423,
        riskScore: 85,
        details: {
          mode: currentSecurityMode(),
          requestPath: pathForChecks
        },
        message: "API write actions are temporarily locked by admin security mode."
      });
    }
  }

  if (modules.strictAdminMutationGuard && isAdminMutationPath(pathForChecks, method)) {
    if (!isAllowedAdminIp(clientIp)) {
      return reject({
        reason: "firewall-admin-ip-not-allowlisted",
        statusCode: 403,
        riskScore: 95,
        details: {
          clientIp
        },
        message: "Admin action blocked by IP allowlist policy."
      });
    }

    if (text(process.env.NODE_ENV).toLowerCase() === "production" && !isSecureTransport(req)) {
      return reject({
        reason: "firewall-insecure-admin-transport",
        statusCode: 403,
        riskScore: 90,
        message: "Admin action requires secure transport (HTTPS)."
      });
    }

    if (adminControls.actionKeyEnforced) {
      const headerKey = text(req?.headers?.["x-admin-action-key"]);
      const hasConfiguredSecret = text(API_ADMIN_ACTION_KEY).length > 0;
      if (!hasConfiguredSecret || !timingSafeEqualText(headerKey, API_ADMIN_ACTION_KEY)) {
        return reject({
          reason: "firewall-admin-action-key-mismatch",
          statusCode: 403,
          riskScore: 98,
          message: "Admin action blocked by action-key security policy."
        });
      }
    }

    const signatureCheck = evaluateAdminMutationRequestSignature(req, {
      requestPath: pathForChecks,
      method
    });
    if (!signatureCheck.valid) {
      return reject({
        reason: `firewall-admin-signed-mutation-${text(signatureCheck.reason, "signature-validation-failed")}`,
        statusCode: 403,
        riskScore: 99,
        details: {
          signatureEnforced: Boolean(signatureCheck.enforced),
          signatureReason: text(signatureCheck.reason),
          driftSec: Math.max(0, Number(signatureCheck.driftSec || 0))
        },
        message: "Admin action blocked by signed mutation security policy."
      });
    }
  }

  return next();
}

export function proTokenFirewall(req, res, next) {
  const modules = currentSecurityControlModules();
  if (!modules.tokenFirewall) return next();

  const rawPath = String(req.originalUrl || req.baseUrl || req.path || "");
  if (!rawPath.startsWith("/api")) return next();

  const method = normalizeRequestMethod(req.method);
  const requestPath = normalizeRequestPath(req.path || rawPath || "/");
  const { scheme, token, raw } = extractBearerToken(req);

  if (!raw) return next();
  if (hasControlChars(raw)) {
    req.proSecurityBlockSource = "token-firewall-control-char-header";
    const incident = quarantineByFirewall(req, {
      reason: req.proSecurityBlockSource,
      requestPath,
      method,
      riskScore: 90
    });
    res.setHeader("Retry-After", String(incident.retryAfterSec));
    return res.status(400).json({
      success: false,
      message: "Malformed authorization header blocked by security policy.",
      retryAfterSec: incident.retryAfterSec,
      requestId: req.requestId
    });
  }

  if (scheme && scheme !== "bearer") return next();
  if (!token) return next();
  const fingerprint = requestFingerprint(req);
  const isTrusted = isTrustedSecurityFingerprint(fingerprint);

  const evaluation = inspectJwtToken(token);
  if (evaluation.suspicious) {
    if (isTrusted) {
      pushProSecurityAuditEvent(req, {
        severity: "medium",
        type: "token-firewall-trusted-bypass",
        details: {
          reasons: evaluation.reasons.slice(0, 8)
        }
      });
      return next();
    }
    const reason = text(evaluation.reasons[0], "token-firewall-suspicious-token");
    req.proSecurityBlockSource = reason;
    const incident = quarantineByFirewall(req, {
      reason,
      requestPath,
      method,
      riskScore: Math.max(60, Math.min(100, Number(evaluation.score || 70))),
      details: {
        reasons: evaluation.reasons.slice(0, 12)
      }
    });

    res.setHeader("Retry-After", String(incident.retryAfterSec));
    return res.status(401).json({
      success: false,
      message: "Authorization token blocked by AI security policy.",
      reasons: evaluation.reasons.slice(0, 8),
      retryAfterSec: incident.retryAfterSec,
      requestId: req.requestId
    });
  }

  const metadata = evaluation.metadata && typeof evaluation.metadata === "object"
    ? evaluation.metadata
    : {};
  if (isBlockedSecurityTokenSubject(metadata.subject)) {
    req.proSecurityBlockSource = "token-subject-blocklist";
    const incident = quarantineByFirewall(req, {
      reason: req.proSecurityBlockSource,
      requestPath,
      method,
      riskScore: 95,
      details: {
        subject: text(metadata.subject).slice(0, 80)
      }
    });
    res.setHeader("Retry-After", String(incident.retryAfterSec));
    return res.status(401).json({
      success: false,
      message: "Authorization token blocked by security subject policy.",
      reasons: [req.proSecurityBlockSource],
      retryAfterSec: incident.retryAfterSec,
      requestId: req.requestId
    });
  }
  const protectedSubjectStatus = getProtectedTokenSubjectStatus(metadata.subject);
  if (protectedSubjectStatus.active) {
    const headerKey = text(req?.headers?.["x-admin-action-key"]);
    const hasConfiguredSecret = text(API_ADMIN_ACTION_KEY).length > 0;
    const bypassByActionKey = hasConfiguredSecret && timingSafeEqualText(headerKey, API_ADMIN_ACTION_KEY);
    if (isTrusted || bypassByActionKey) {
      pushProSecurityAuditEvent(req, {
        severity: "medium",
        type: "token-subject-protection-bypass",
        details: {
          subject: protectedSubjectStatus.subject,
          reason: protectedSubjectStatus.reason,
          remainingSec: protectedSubjectStatus.remainingSec,
          bypassByTrustedFingerprint: Boolean(isTrusted),
          bypassByActionKey: Boolean(bypassByActionKey)
        }
      });
    } else {
      req.proSecurityBlockSource = "token-subject-temporary-protection";
      const incident = quarantineByFirewall(req, {
        reason: req.proSecurityBlockSource,
        requestPath,
        method,
        riskScore: 97,
        details: {
          subject: protectedSubjectStatus.subject,
          protectionReason: protectedSubjectStatus.reason,
          protectedUntil: protectedSubjectStatus.until
            ? new Date(protectedSubjectStatus.until).toISOString()
            : ""
        }
      });
      res.setHeader("Retry-After", String(incident.retryAfterSec));
      return res.status(401).json({
        success: false,
        message: "Authorization token temporarily protected due to takeover signals.",
        reasons: [req.proSecurityBlockSource],
        retryAfterSec: incident.retryAfterSec,
        requestId: req.requestId
      });
    }
  }
  const tokenKey = tokenKeyFromEvaluation(evaluation, token);
  const usage = registerTokenUsage({
    tokenKey,
    fingerprint,
    ip: getClientIp(req),
    subject: metadata.subject,
    jti: metadata.jti,
    issuer: metadata.issuer,
    audience: metadata.audience,
    nowTs: Date.now()
  });
  const thresholds = currentSecurityThresholds();
  const subjectUsage = registerSubjectUsage({
    subject: metadata.subject,
    fingerprint,
    ip: getClientIp(req),
    tokenKey,
    nowTs: Date.now()
  });
  const subjectSessionShield = maybeApplySubjectSessionShield({
    requestId: req.requestId,
    path: requestPath,
    method,
    subject: metadata.subject,
    tokenKey,
    fingerprint,
    ip: getClientIp(req)
  });
  if (subjectSessionShield.activated) {
    const headerKey = text(req?.headers?.["x-admin-action-key"]);
    const hasConfiguredSecret = text(API_ADMIN_ACTION_KEY).length > 0;
    const bypassByActionKey = hasConfiguredSecret && timingSafeEqualText(headerKey, API_ADMIN_ACTION_KEY);
    if (isTrusted || bypassByActionKey) {
      pushProSecurityAuditEvent(req, {
        severity: "medium",
        type: "subject-session-shield-bypass",
        details: {
          subject: text(subjectSessionShield.subject),
          reason: text(subjectSessionShield.reason),
          remainingSec: Math.max(0, Number(subjectSessionShield.remainingSec || 0)),
          bypassByTrustedFingerprint: Boolean(isTrusted),
          bypassByActionKey: Boolean(bypassByActionKey)
        }
      });
    } else {
      req.proSecurityBlockSource = "subject-session-shield";
      const incident = quarantineByFirewall(req, {
        reason: req.proSecurityBlockSource,
        requestPath,
        method,
        riskScore: 97,
        details: {
          subject: text(subjectSessionShield.subject),
          protectionReason: text(subjectSessionShield.reason),
          protectedUntil: Number(subjectSessionShield.until || 0)
            ? new Date(Number(subjectSessionShield.until || 0)).toISOString()
            : ""
        }
      });
      res.setHeader("Retry-After", String(incident.retryAfterSec));
      return res.status(401).json({
        success: false,
        message: "Authorization subject temporarily shielded due to suspicious session churn.",
        reasons: [req.proSecurityBlockSource],
        retryAfterSec: incident.retryAfterSec,
        requestId: req.requestId
      });
    }
  }
  const subjectNetworkShield = maybeApplySubjectNetworkShield({
    requestId: req.requestId,
    path: requestPath,
    method,
    subject: metadata.subject,
    tokenKey,
    fingerprint,
    ip: getClientIp(req)
  });
  if (subjectNetworkShield.activated) {
    const headerKey = text(req?.headers?.["x-admin-action-key"]);
    const hasConfiguredSecret = text(API_ADMIN_ACTION_KEY).length > 0;
    const bypassByActionKey = hasConfiguredSecret && timingSafeEqualText(headerKey, API_ADMIN_ACTION_KEY);
    if (isTrusted || bypassByActionKey) {
      pushProSecurityAuditEvent(req, {
        severity: "medium",
        type: "subject-network-shield-bypass",
        details: {
          subject: text(subjectNetworkShield.subject),
          reason: text(subjectNetworkShield.reason),
          remainingSec: Math.max(0, Number(subjectNetworkShield.remainingSec || 0)),
          bypassByTrustedFingerprint: Boolean(isTrusted),
          bypassByActionKey: Boolean(bypassByActionKey)
        }
      });
    } else {
      req.proSecurityBlockSource = "subject-network-shield";
      const incident = quarantineByFirewall(req, {
        reason: req.proSecurityBlockSource,
        requestPath,
        method,
        riskScore: 98,
        details: {
          subject: text(subjectNetworkShield.subject),
          protectionReason: text(subjectNetworkShield.reason),
          protectedUntil: Number(subjectNetworkShield.until || 0)
            ? new Date(Number(subjectNetworkShield.until || 0)).toISOString()
            : ""
        }
      });
      res.setHeader("Retry-After", String(incident.retryAfterSec));
      return res.status(401).json({
        success: false,
        message: "Authorization subject temporarily shielded due to abnormal network velocity.",
        reasons: [req.proSecurityBlockSource],
        retryAfterSec: incident.retryAfterSec,
        requestId: req.requestId
      });
    }
  }
  const replaySuspected =
    usage.occurrences >= Math.max(2, Number(thresholds.tokenReplayEvents || TOKEN_REPLAY_EVENT_THRESHOLD)) &&
    (
      usage.distinctFingerprintCount >= Math.max(
        2,
        Number(thresholds.tokenReplayDistinctFingerprints || TOKEN_REPLAY_DISTINCT_FINGERPRINT_THRESHOLD)
      ) ||
      usage.distinctIpCount >= Math.max(
        2,
        Number(thresholds.tokenReplayDistinctIps || TOKEN_REPLAY_DISTINCT_IP_THRESHOLD)
      )
    );
  const subjectTakeoverSuspected =
    subjectUsage.occurrences >= Math.max(
      2,
      Number(thresholds.subjectReplayEvents || SUBJECT_INTEL_EVENT_THRESHOLD)
    ) &&
    (
      subjectUsage.distinctFingerprintCount >= Math.max(
        2,
        Number(thresholds.subjectReplayDistinctFingerprints || SUBJECT_INTEL_DISTINCT_FINGERPRINT_THRESHOLD)
      ) ||
      subjectUsage.distinctIpCount >= Math.max(
        2,
        Number(thresholds.subjectReplayDistinctIps || SUBJECT_INTEL_DISTINCT_IP_THRESHOLD)
      )
    );
  const hasTokenAnomaly = replaySuspected || subjectTakeoverSuspected;
  if (hasTokenAnomaly && !isTrusted) {
    maybeApplySubjectProtection({
      requestId: req.requestId,
      path: requestPath,
      method,
      reason: replaySuspected ? "token-replay-suspected" : "subject-takeover-suspected",
      subject: metadata.subject,
      replaySuspected,
      subjectTakeoverSuspected,
      subjectUsage
    });
  }

  if (!hasTokenAnomaly || !modules.autoQuarantine || isTrusted) {
    if (hasTokenAnomaly) {
      pushProSecurityAuditEvent(req, {
        severity: "high",
        type: isTrusted
          ? replaySuspected
            ? "token-replay-trusted-bypass"
            : "subject-takeover-trusted-bypass"
          : replaySuspected
            ? "token-replay-alert"
            : "subject-takeover-alert",
        details: {
          tokenKey,
          occurrences: usage.occurrences,
          distinctFingerprintCount: usage.distinctFingerprintCount,
          distinctIpCount: usage.distinctIpCount,
          subject: text(subjectUsage.subject).slice(0, 80),
          subjectOccurrences: subjectUsage.occurrences,
          subjectDistinctFingerprintCount: subjectUsage.distinctFingerprintCount,
          subjectDistinctIpCount: subjectUsage.distinctIpCount,
          trustedBypass: Boolean(isTrusted)
        }
      });
    }
    return next();
  }

  req.proSecurityBlockSource = replaySuspected ? "token-replay-suspected" : "subject-takeover-suspected";
  const incident = quarantineByFirewall(req, {
    reason: req.proSecurityBlockSource,
    requestPath,
    method,
    riskScore: 96,
    details: {
      tokenKey,
      occurrences: usage.occurrences,
      distinctFingerprintCount: usage.distinctFingerprintCount,
      distinctIpCount: usage.distinctIpCount,
      subject: text(usage.subject).slice(0, 60),
      issuer: text(usage.issuer).slice(0, 60),
      subjectOccurrences: subjectUsage.occurrences,
      subjectDistinctFingerprintCount: subjectUsage.distinctFingerprintCount,
      subjectDistinctIpCount: subjectUsage.distinctIpCount
    }
  });
  res.setHeader("Retry-After", String(incident.retryAfterSec));
  return res.status(401).json({
    success: false,
    message: replaySuspected
      ? "Authorization token blocked due to replay anomaly."
      : "Authorization token blocked due to account-takeover anomaly.",
    reasons: [req.proSecurityBlockSource],
    retryAfterSec: incident.retryAfterSec,
    requestId: req.requestId
  });
}

export function proBlockSensitivePublicFiles(req, res, next) {
  const requestPath = normalizeRequestPath(req.path || req.originalUrl || "/");
  if (requestPath.startsWith("/api")) return next();

  if (isSensitivePublicPath(requestPath)) {
    pushProSecurityAuditEvent(req, {
      severity: "high",
      type: "sensitive_public_path_blocked",
      details: {
        requestPath
      }
    });
    return res.status(404).send("Not found");
  }

  return next();
}

export function createProSafeStaticOptions() {
  return {
    dotfiles: "deny",
    index: false,
    setHeaders(res, filePath) {
      const normalized = normalizeRequestPath(filePath);
      if (normalized.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache");
      } else {
        res.setHeader("Cache-Control", "public, max-age=86400");
      }
    }
  };
}

function scanPayloadValue(value, state, contextPath = "$", depth = 0) {
  if (state.nodeCount >= SECURITY_MAX_OBJECT_NODES) {
    return {
      blocked: true,
      reason: "payload-node-limit-exceeded",
      path: contextPath
    };
  }

  state.nodeCount += 1;

  if (depth > SECURITY_MAX_OBJECT_DEPTH) {
    return {
      blocked: true,
      reason: "payload-depth-limit-exceeded",
      path: contextPath
    };
  }

  if (value === null || typeof value === "undefined") {
    return { blocked: false };
  }

  if (typeof value === "string") {
    if (NULL_BYTE_PATTERN.test(value)) {
      return { blocked: true, reason: "null-byte-detected", path: contextPath };
    }
    return { blocked: false };
  }

  if (typeof value !== "object") {
    return { blocked: false };
  }

  if (state.visited.has(value)) {
    return { blocked: false };
  }
  state.visited.add(value);

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const itemPath = `${contextPath}[${index}]`;
      const result = scanPayloadValue(value[index], state, itemPath, depth + 1);
      if (result.blocked) return result;
    }
    return { blocked: false };
  }

  const keys = Object.keys(value);
  for (const key of keys) {
    if (SUSPICIOUS_KEY_RULES.some((rule) => rule.test(key))) {
      return {
        blocked: true,
        reason: "suspicious-object-key",
        path: `${contextPath}.${key}`
      };
    }
    const result = scanPayloadValue(
      value[key],
      state,
      `${contextPath}.${key}`,
      depth + 1
    );
    if (result.blocked) return result;
  }

  return { blocked: false };
}

export function proApiPayloadGuard(req, res, next) {
  const requestPath = String(req.originalUrl || req.baseUrl || req.path || "");
  if (!requestPath.startsWith("/api")) {
    return next();
  }

  const payloadSegments = [
    { label: "query", value: req.query },
    { label: "params", value: req.params },
    { label: "body", value: req.body }
  ];

  for (const segment of payloadSegments) {
    const state = {
      visited: new WeakSet(),
      nodeCount: 0
    };
    const result = scanPayloadValue(segment.value, state, segment.label, 0);
    if (result.blocked) {
      pushProSecurityAuditEvent(req, {
        severity: "high",
        type: "payload_blocked",
        details: {
          segment: segment.label,
          reason: result.reason,
          path: result.path
        }
      });

      return res.status(400).json({
        success: false,
        message: "Suspicious payload rejected by security policy.",
        requestId: req.requestId
      });
    }
  }

  return next();
}

export function proAiThreatAutoDetector(req, res, next) {
  const modules = currentSecurityControlModules();
  if (!modules.aiThreatDetector) return next();

  const requestPath = String(req.originalUrl || req.baseUrl || req.path || "");
  if (!requestPath.startsWith("/api")) return next();
  if (isThreatDetectionExcludedPath(requestPath)) return next();

  const fingerprint = requestFingerprint(req);
  const isTrusted = isTrustedSecurityFingerprint(fingerprint);
  const thresholds = currentSecurityThresholds();
  const nowTs = Date.now();
  const current = nextProfileState(proThreatProfiles.get(fingerprint), nowTs);

  if (Number(current.blockUntil || 0) > nowTs) {
    const retryAfterSec = Math.max(1, Math.ceil((current.blockUntil - nowTs) / 1000));
    res.setHeader("Retry-After", String(retryAfterSec));
    req.proSecurityBlockSource = "ai-threat-quarantine-block";
    pushProSecurityAuditEvent(req, {
      severity: "high",
      type: "ai-threat-quarantine-block",
      details: {
        fingerprint,
        retryAfterSec
      }
    });
    return res.status(403).json({
      success: false,
      message: "Request blocked by automated security quarantine.",
      retryAfterSec,
      requestId: req.requestId
    });
  }

  const evaluation = evaluateThreatScore(req);
  const behavior = applyBehaviorSignals({
    req,
    state: current,
    nowTs
  });

  const riskScore = Math.max(0, Number(evaluation.score || 0)) + Math.max(0, Number(behavior.score || 0));
  const matchedRules = [...new Set([
    ...evaluation.matchedRules,
    ...behavior.matchedRules
  ])];

  if (riskScore <= 0) {
    proThreatProfiles.set(fingerprint, {
      ...current,
      recentHits: behavior.recentHits,
      recentPaths: behavior.recentPaths,
      authIdentityTrail: behavior.authIdentityTrail
    });
    pruneThreatProfiles();
    return next();
  }

  const cumulativeRiskScore = Math.max(0, Number(current.riskScore || 0)) + riskScore;
  const threatBlockThreshold = Math.max(
    20,
    Number(thresholds.threatBlock || THREAT_SCORE_BLOCK_THRESHOLD)
  );
  const threatAlertThreshold = Math.max(
    10,
    Math.min(
      threatBlockThreshold,
      Number(thresholds.threatAlert || THREAT_SCORE_ALERT_THRESHOLD)
    )
  );
  const shouldQuarantine =
    modules.autoQuarantine &&
    !isTrusted &&
    cumulativeRiskScore >= threatBlockThreshold;
  const projectedIncidentCount = Math.max(0, Number(current.incidentCount || 0)) + 1;
  const quarantineDurationMs = shouldQuarantine
    ? computeAdaptiveBlockDurationMs(projectedIncidentCount)
    : 0;
  const nextState = {
    ...current,
    riskScore: cumulativeRiskScore,
    lastSeenAt: nowTs,
    incidentCount: projectedIncidentCount,
    blockUntil: shouldQuarantine ? nowTs + quarantineDurationMs : Number(current.blockUntil || 0),
    recentHits: behavior.recentHits,
    recentPaths: behavior.recentPaths,
    authIdentityTrail: behavior.authIdentityTrail,
    quarantineReason: shouldQuarantine ? "ai-auto-quarantine" : text(current.quarantineReason)
  };
  proThreatProfiles.set(fingerprint, nextState);
  pruneThreatProfiles();

  if (riskScore >= threatAlertThreshold || shouldQuarantine) {
    pushThreatIncident({
      fingerprint,
      ip: getClientIp(req),
      requestId: req.requestId,
      path: requestPath,
      method: req.method,
      riskScore,
      cumulativeRiskScore,
      blocked: shouldQuarantine,
      reason: shouldQuarantine ? "ai-auto-quarantine" : "ai-auto-alert",
      rules: matchedRules
    });

    pushProSecurityAuditEvent(req, {
      severity: shouldQuarantine ? "high" : "medium",
      type: shouldQuarantine ? "ai-threat-quarantine" : "ai-threat-alert",
      details: {
        fingerprint,
        riskScore,
        cumulativeRiskScore,
        rules: matchedRules,
        payloadBytes: evaluation.totalPayloadSize,
        quarantineDurationSec: shouldQuarantine ? Math.max(1, Math.ceil(quarantineDurationMs / 1000)) : 0,
        trustedBypass: Boolean(isTrusted)
      }
    });
  }

  if (shouldQuarantine) {
    const retryAfterSec = Math.max(1, Math.ceil(quarantineDurationMs / 1000));
    res.setHeader("Retry-After", String(retryAfterSec));
    req.proSecurityBlockSource = "ai-auto-quarantine";
    return res.status(403).json({
      success: false,
      message: "Request blocked by automated AI threat detection.",
      retryAfterSec,
      requestId: req.requestId
    });
  }

  return next();
}

export function proFakeListingAiGuard(req, res, next) {
  const modules = currentSecurityControlModules();
  if (!modules.fakeListingAi) return next();

  const context = parseListingMutationContext(req);
  if (!context) return next();
  if (!isPlainObject(req?.body)) return next();

  const nowTs = Date.now();
  const fingerprint = requestFingerprint(req);
  const isTrusted = isTrustedSecurityFingerprint(fingerprint);
  const thresholds = currentSecurityThresholds();
  const fakeListingAlertThreshold = Math.max(
    20,
    Number(thresholds.fakeListingAlert || FAKE_LISTING_ALERT_THRESHOLD)
  );
  const fakeListingBlockThreshold = Math.max(
    fakeListingAlertThreshold,
    Number(thresholds.fakeListingBlock || FAKE_LISTING_BLOCK_THRESHOLD)
  );
  const current = nextProfileState(proThreatProfiles.get(fingerprint), nowTs);
  const payload = buildFakeListingPayload(req, context);
  const evaluation = scoreFakeListingPayload({
    payload,
    state: current,
    nowTs,
    fingerprint
  });

  const projectedIncidentCount = Math.max(0, Number(current.incidentCount || 0)) + 1;
  const cumulativeRiskScore = Math.max(0, Number(current.riskScore || 0)) + evaluation.score;
  const shouldBlock =
    modules.autoQuarantine &&
    !isTrusted &&
    (
      evaluation.score >= fakeListingBlockThreshold ||
      cumulativeRiskScore >= Math.max(Number(thresholds.threatBlock || THREAT_SCORE_BLOCK_THRESHOLD) + 20, 150)
    );
  const quarantineDurationMs = shouldBlock
    ? computeAdaptiveBlockDurationMs(projectedIncidentCount)
    : 0;

  const nextState = {
    ...current,
    riskScore: cumulativeRiskScore,
    lastSeenAt: nowTs,
    incidentCount: projectedIncidentCount,
    listingSignals: evaluation.listingSignals,
    blockUntil: shouldBlock
      ? Math.max(Number(current.blockUntil || 0), nowTs + quarantineDurationMs)
      : Number(current.blockUntil || 0),
    quarantineReason: shouldBlock ? "fake-listing-ai-quarantine" : text(current.quarantineReason)
  };
  proThreatProfiles.set(fingerprint, nextState);
  pruneThreatProfiles();

  if (evaluation.score >= fakeListingAlertThreshold || shouldBlock) {
    const rules = [
      ...evaluation.reasons,
      `fake-listing-score:${evaluation.score}`
    ];
    pushThreatIncident({
      fingerprint,
      ip: getClientIp(req),
      requestId: req.requestId,
      path: context.requestPath,
      method: context.method,
      riskScore: evaluation.score,
      cumulativeRiskScore,
      blocked: shouldBlock,
      reason: shouldBlock ? "fake-listing-ai-quarantine" : "fake-listing-ai-alert",
      rules
    });

    pushProSecurityAuditEvent(req, {
      severity: shouldBlock ? "high" : "medium",
      type: shouldBlock ? "fake-listing-blocked" : "fake-listing-alert",
      details: {
        requestPath: context.requestPath,
        method: context.method,
        riskScore: evaluation.score,
        cumulativeRiskScore,
        reasons: evaluation.reasons.slice(0, 12),
        flags: evaluation.flags,
        quarantineDurationSec: shouldBlock
          ? Math.max(1, Math.ceil(quarantineDurationMs / 1000))
          : 0,
        trustedBypass: Boolean(isTrusted)
      }
    });
  }

  applyFakeListingReviewPatch(req, context, evaluation, {
    alertThreshold: fakeListingAlertThreshold,
    blockThreshold: fakeListingBlockThreshold
  });

  if (!shouldBlock) {
    return next();
  }

  const retryAfterSec = Math.max(1, Math.ceil(quarantineDurationMs / 1000));
  req.proSecurityBlockSource = "fake-listing-ai-quarantine";
  res.setHeader("Retry-After", String(retryAfterSec));
  return res.status(422).json({
    success: false,
    message: "Listing blocked by AI fake-listing security policy.",
    riskScore: evaluation.score,
    reasons: evaluation.reasons.slice(0, 8),
    retryAfterSec,
    requestId: req.requestId
  });
}

export function proAuthFailureIntelligence(req, res, next) {
  const modules = currentSecurityControlModules();
  if (!modules.authFailureIntelligence) return next();

  const requestPath = String(req.originalUrl || req.baseUrl || req.path || "");
  if (!requestPath.startsWith("/api")) return next();

  res.on("finish", () => {
    if (req.proSecurityBlockSource) return;

    const statusCode = Number(res.statusCode || 0);
    if (statusCode !== 401 && statusCode !== 403) return;

    const nowTs = Date.now();
    const fingerprint = requestFingerprint(req);
    const isTrusted = isTrustedSecurityFingerprint(fingerprint);
    const thresholds = currentSecurityThresholds();
    const current = nextProfileState(proThreatProfiles.get(fingerprint), nowTs);
    const normalizedPath = normalizeRequestPath(req.path || requestPath || "/");
    const method = normalizeRequestMethod(req.method);
    const identitySample = extractAuthIdentitySample(req);
    if (isAuthApiPath(normalizedPath)) {
      const telemetryRow = {
        at: nowTs,
        statusCode,
        path: normalizedPath,
        method,
        fingerprint,
        ip: getClientIp(req),
        identity: text(identitySample).toLowerCase()
      };
      proAuthFailureTelemetry.unshift(telemetryRow);
      if (proAuthFailureTelemetry.length > AUTH_FAILURE_TELEMETRY_MAX_ITEMS) {
        proAuthFailureTelemetry.length = AUTH_FAILURE_TELEMETRY_MAX_ITEMS;
      }
      maybeApplyAuthStormShield({
        requestId: req.requestId,
        path: normalizedPath,
        reason: "auth-failure-storm",
        method,
        statusCode
      });
      maybeApplyAuthIdentityProtection({
        requestId: req.requestId,
        path: normalizedPath,
        reason: "auth-identity-targeted",
        method,
        statusCode,
        identity: identitySample
      });
    }

    const authFailures = [...current.authFailures, {
      at: nowTs,
      statusCode,
      path: normalizedPath
    }]
      .filter((item) => Number(item?.at || 0) >= nowTs - AUTH_FAILURE_WINDOW_MS)
      .slice(-AUTH_FAILURE_SAMPLE_MAX);

    const count401 = authFailures.filter((item) => Number(item.statusCode) === 401).length;
    const count403 = authFailures.filter((item) => Number(item.statusCode) === 403).length;
    const isAuthPath = normalizedPath.includes("/auth");
    const riskIncrement = statusCode === 401
      ? (isAuthPath ? 16 : 10)
      : (isAuthPath ? 20 : 14);

    let quarantineReason = "";
    const auth401Threshold = Math.max(2, Number(thresholds.auth401 || AUTH_FAILURE_401_THRESHOLD));
    const auth403Threshold = Math.max(2, Number(thresholds.auth403 || AUTH_FAILURE_403_THRESHOLD));
    if (count401 >= auth401Threshold) quarantineReason = "auth-failure-burst";
    if (count403 >= auth403Threshold) quarantineReason = quarantineReason || "forbidden-probe-burst";

    const projectedIncidentCount = Math.max(0, Number(current.incidentCount || 0)) + 1;
    const shouldQuarantine = modules.autoQuarantine && !isTrusted && Boolean(quarantineReason);
    const quarantineDurationMs = shouldQuarantine ? computeAdaptiveBlockDurationMs(projectedIncidentCount) : 0;

    const nextState = {
      ...current,
      riskScore: Math.max(0, Number(current.riskScore || 0)) + riskIncrement,
      incidentCount: projectedIncidentCount,
      lastSeenAt: nowTs,
      authFailures,
      blockUntil: shouldQuarantine
        ? Math.max(Number(current.blockUntil || 0), nowTs + quarantineDurationMs)
        : Number(current.blockUntil || 0),
      quarantineReason: shouldQuarantine ? quarantineReason : text(current.quarantineReason)
    };
    proThreatProfiles.set(fingerprint, nextState);
    pruneThreatProfiles();

    if (!shouldQuarantine && nextState.riskScore < THREAT_SCORE_ALERT_THRESHOLD) {
      return;
    }

    pushThreatIncident({
      fingerprint,
      ip: getClientIp(req),
      requestId: req.requestId,
      path: normalizedPath,
      method,
      riskScore: riskIncrement,
      cumulativeRiskScore: nextState.riskScore,
      blocked: shouldQuarantine,
      reason: shouldQuarantine ? quarantineReason : "auth-failure-alert",
      rules: [
        `status-${statusCode}`,
        `auth401-count:${count401}`,
        `auth403-count:${count403}`
      ]
    });

    pushProSecurityAuditEvent(req, {
      severity: shouldQuarantine ? "high" : "medium",
      type: shouldQuarantine ? "auth-failure-quarantine" : "auth-failure-alert",
      details: {
        path: normalizedPath,
        method,
        statusCode,
        count401,
        count403,
        windowSec: Math.round(AUTH_FAILURE_WINDOW_MS / 1000),
        riskIncrement,
        trustedBypass: Boolean(isTrusted),
        quarantineDurationSec: shouldQuarantine
          ? Math.max(1, Math.ceil(quarantineDurationMs / 1000))
          : 0
      }
    });
  });

  return next();
}

export function createProRateLimiter({
  scope = "api",
  limit = 120,
  windowMs = 60_000,
  keyBuilder = (req) => getClientIp(req),
  message = "Too many requests. Please retry after a short pause."
} = {}) {
  const safeLimit = Math.max(1, toNumber(limit, 120));
  const safeWindowMs = Math.max(1000, toNumber(windowMs, 60_000));

  return (req, res, next) => {
    const key = `${text(scope)}:${text(keyBuilder(req), "anonymous")}`;
    const nowTs = Date.now();
    const minTs = nowTs - safeWindowMs;

    const current = proRateBuckets.get(key) || { hits: [] };
    const hits = (Array.isArray(current.hits) ? current.hits : []).filter(
      (stamp) => Number(stamp) >= minTs
    );

    res.setHeader("X-RateLimit-Limit", String(safeLimit));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, safeLimit - hits.length)));

    if (hits.length >= safeLimit) {
      const oldest = Math.min(...hits);
      const retryAfterSec = Math.max(
        1,
        Math.ceil((safeWindowMs - (nowTs - oldest)) / 1000)
      );
      res.setHeader("Retry-After", String(retryAfterSec));
      pushProSecurityAuditEvent(req, {
        severity: "medium",
        type: "rate_limit_exceeded",
        details: {
          scope: text(scope),
          retryAfterSec
        }
      });
      return res.status(429).json({
        success: false,
        message,
        retryAfterSec,
        requestId: req.requestId
      });
    }

    hits.push(nowTs);
    proRateBuckets.set(key, { hits });
    return next();
  };
}

export const proApiRateLimiter = createProRateLimiter({
  scope: "api-global",
  limit: Math.max(60, toNumber(process.env.API_RATE_LIMIT_PER_MINUTE, 240)),
  windowMs: 60_000,
  keyBuilder: (req) => `${getClientIp(req)}:${requestFingerprint(req)}`,
  message: "API rate limit exceeded. Please slow down and retry."
});

export const proAuthRateLimiter = createProRateLimiter({
  scope: "api-auth",
  limit: Math.max(8, toNumber(process.env.AUTH_RATE_LIMIT_PER_10_MIN, 30)),
  windowMs: 10 * 60 * 1000,
  keyBuilder: (req) => `${getClientIp(req)}:${text(req.path)}`,
  message: "Too many authentication attempts. Please retry later."
});

export const proSensitiveWriteRateLimiter = createProRateLimiter({
  scope: "api-sensitive-write",
  limit: Math.max(10, toNumber(process.env.SENSITIVE_WRITE_RATE_LIMIT_PER_10_MIN, 80)),
  windowMs: 10 * 60 * 1000,
  keyBuilder: (req) => `${getClientIp(req)}:${requestFingerprint(req)}`,
  message: "Too many write operations in a short window. Please retry later."
});
