import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");
const serverDir = path.join(rootDir, "server");
const envProPath = path.join(serverDir, ".env.pro");

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

function isConfiguredCredential(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return false;
  return (
    !raw.includes("replace_with") &&
    !raw.includes("placeholder") &&
    !raw.startsWith("your_")
  );
}

function hasFile(relativePath) {
  return fs.existsSync(path.join(rootDir, relativePath));
}

function printStep(stepNo, title, ready, detail = "") {
  const flag = ready ? "[READY]" : "[SETUP]";
  const suffix = detail ? ` - ${detail}` : "";
  console.log(`${flag} Step ${stepNo}: ${title}${suffix}`);
}

loadEnvFile(envProPath);

const checks = {
  step1BackendSetup:
    hasFile("server/professional-server.js") &&
    hasFile("server/package.json"),
  step2DatabaseConnect:
    isConfiguredCredential(process.env.MONGO_URI || process.env.MONGODB_URI),
  step3AuthSystem:
    isConfiguredCredential(process.env.JWT_SECRET) &&
    isConfiguredCredential(process.env.ADMIN_REGISTRATION_KEY),
  step4PropertyCrud:
    hasFile("server/v3/routes/corePropertyRoutes.js") &&
    hasFile("server/v3/controllers/corePropertyController.js"),
  step5FileUpload:
    hasFile("server/v3/routes/coreUploadRoutes.js") &&
    hasFile("server/v3/controllers/coreUploadController.js"),
  step6Subscription:
    hasFile("server/v3/routes/coreSubscriptionRoutes.js") &&
    hasFile("server/v3/controllers/coreSubscriptionController.js"),
  step7Ai:
    hasFile("server/v3/routes/coreAiRoutes.js") &&
    hasFile("server/v3/controllers/coreAiController.js")
};

console.log("PropertySetu Real Backend Structure - Step Check");
console.log(`Loaded env: ${fs.existsSync(envProPath) ? envProPath : "process env only"}`);
console.log("");

printStep(
  1,
  "Backend setup",
  checks.step1BackendSetup,
  checks.step1BackendSetup ? "professional server files present" : "professional server files missing"
);
printStep(
  2,
  "Database connect",
  checks.step2DatabaseConnect,
  checks.step2DatabaseConnect ? "Mongo URI configured" : "set MONGO_URI/MONGODB_URI"
);
printStep(
  3,
  "Auth system (OTP + JWT + role)",
  checks.step3AuthSystem,
  checks.step3AuthSystem ? "JWT/admin secrets configured" : "set JWT_SECRET + ADMIN_REGISTRATION_KEY"
);
printStep(4, "Property CRUD", checks.step4PropertyCrud);
printStep(5, "File upload", checks.step5FileUpload);
printStep(6, "Subscription + payment", checks.step6Subscription);
printStep(7, "AI features", checks.step7Ai);

console.log("");
console.log("Required for startup-grade platform (not possible with HTML-only):");
console.log("- Backend server");
console.log("- Database");
console.log("- Authentication");
console.log("- File storage");
console.log("- Payment gateway");
console.log("- Hosting setup");

const done = Object.values(checks).filter(Boolean).length;
const total = Object.keys(checks).length;
console.log("");
console.log(`Summary: ${done}/${total} steps ready.`);

if (done < total) {
  process.exitCode = 1;
}
