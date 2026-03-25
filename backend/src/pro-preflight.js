import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");
const envProPath = path.join(rootDir, "server", ".env.pro");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const raw = String(line || "").trim();
    if (!raw || raw.startsWith("#")) return;
    const eqIdx = raw.indexOf("=");
    if (eqIdx < 0) return;
    const key = raw.slice(0, eqIdx).trim();
    const value = raw.slice(eqIdx + 1).trim();
    if (!key) return;
    if (typeof process.env[key] === "undefined") {
      process.env[key] = value;
    }
  });
}

loadEnvFile(envProPath);

function text(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function isConfiguredCredential(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return false;
  return (
    !raw.includes("replace_with") &&
    !raw.includes("placeholder") &&
    !raw.startsWith("your_")
  );
}

function line(status, label, detail = "") {
  const suffix = detail ? ` - ${detail}` : "";
  console.log(`${status} ${label}${suffix}`);
}

const storageProvider = text(process.env.STORAGE_PROVIDER, "cloudinary").toLowerCase();
const checks = [
  {
    name: "MONGO_URI",
    ok: isConfiguredCredential(process.env.MONGO_URI || process.env.MONGODB_URI),
    required: true,
    hint: "Set Mongo connection string"
  },
  {
    name: "JWT_SECRET",
    ok: isConfiguredCredential(process.env.JWT_SECRET),
    required: true,
    hint: "Set strong JWT secret"
  },
  {
    name: "ADMIN_REGISTRATION_KEY",
    ok: isConfiguredCredential(process.env.ADMIN_REGISTRATION_KEY),
    required: true,
    hint: "Required for admin signup safety"
  },
  {
    name: "STORAGE_PROVIDER",
    ok: ["cloudinary", "s3"].includes(storageProvider),
    required: true,
    hint: "Use cloudinary or s3"
  },
  {
    name: "CLOUDINARY_CREDENTIALS",
    ok:
      storageProvider !== "cloudinary" ||
      (
        isConfiguredCredential(process.env.CLOUDINARY_CLOUD_NAME) &&
        isConfiguredCredential(process.env.CLOUDINARY_API_KEY) &&
        isConfiguredCredential(process.env.CLOUDINARY_API_SECRET)
      ),
    required: storageProvider === "cloudinary",
    hint: "Required when STORAGE_PROVIDER=cloudinary"
  },
  {
    name: "S3_CONFIG",
    ok:
      storageProvider !== "s3" ||
      (
        isConfiguredCredential(process.env.AWS_REGION) &&
        isConfiguredCredential(process.env.AWS_S3_BUCKET)
      ),
    required: storageProvider === "s3",
    hint: "Required when STORAGE_PROVIDER=s3"
  },
  {
    name: "RAZORPAY_KEYS",
    ok:
      isConfiguredCredential(process.env.RAZORPAY_KEY_ID) &&
      isConfiguredCredential(process.env.RAZORPAY_KEY_SECRET),
    required: true,
    hint: "Set Razorpay live/test key + secret"
  },
  {
    name: "CORS_ORIGIN",
    ok: isConfiguredCredential(process.env.CORS_ORIGIN),
    required: true,
    hint: "Add allowed frontend domains"
  },
  {
    name: "VERCEL_CONFIG",
    ok: fs.existsSync(path.join(rootDir, "client", "vercel.json")),
    required: false,
    hint: "client/vercel.json"
  },
  {
    name: "RENDER_CONFIG",
    ok: fs.existsSync(path.join(rootDir, "server", "render.yaml")),
    required: false,
    hint: "server/render.yaml"
  }
];

console.log("PropertySetu Option-1 Preflight");
console.log("Recommended stack: React/Next + Node/Express + MongoDB + Cloudinary/S3 + Vercel/Render + Razorpay");
console.log(`Loaded env: ${fs.existsSync(envProPath) ? envProPath : "process env only"}`);
console.log("");

let requiredFailures = 0;
checks.forEach((check) => {
  if (check.ok) {
    line("[OK]", check.name);
    return;
  }
  if (check.required) {
    requiredFailures += 1;
    line("[FAIL]", check.name, check.hint);
    return;
  }
  line("[WARN]", check.name, check.hint);
});

console.log("");
if (requiredFailures > 0) {
  console.log(`Preflight result: FAILED (${requiredFailures} required checks missing).`);
  process.exitCode = 1;
} else {
  console.log("Preflight result: PASS (required production checks are satisfied).");
}
