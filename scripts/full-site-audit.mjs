import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const LOCAL_PORT = Number(process.env.SITE_AUDIT_PORT || 5000);
const LOCAL_BASE = `http://localhost:${LOCAL_PORT}`;
const LIVE_BASE = process.env.SITE_AUDIT_LIVE_BASE || "https://bhaugehlot159.github.io/PropertySetu";
const SKIP_LIVE = process.argv.includes("--skip-live");
const SKIP_SERVER_START = process.argv.includes("--no-server") || process.env.SITE_AUDIT_SKIP_SERVER_START === "1";
const AUDIT_IP = process.env.SITE_AUDIT_IP || "127.0.0.1";
const AUDIT_UA = process.env.SITE_AUDIT_UA || "PropertySetu-AuditBot/1.0";

const report = {
  startedAt: new Date().toISOString(),
  localBase: LOCAL_BASE,
  liveBase: LIVE_BASE,
  totals: {
    pageChecks: 0,
    apiChecks: 0,
    linkChecks: 0,
    issues: 0
  },
  pages: {
    local: [],
    live: []
  },
  links: {
    missingAssets: [],
    missingAnchors: []
  },
  api: {
    checks: []
  },
  notes: []
};

const otpLogQueue = [];
const API_CALL_DELAY_MS = Number(process.env.SITE_AUDIT_API_DELAY_MS || 220);

function toPosix(input) {
  return input.replace(/\\/g, "/");
}

function nowStamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function addIssue(kind, message, details = {}) {
  report.totals.issues += 1;
  report.notes.push({ kind, message, details });
}

function pushPageResult(scope, item) {
  report.totals.pageChecks += 1;
  report.pages[scope].push(item);
  if (!item.ok) addIssue("page", `${scope.toUpperCase()} page check failed`, item);
}

function pushApiResult(item) {
  report.totals.apiChecks += 1;
  report.api.checks.push(item);
  if (!item.ok) addIssue("api", `API check failed: ${item.name}`, item);
}

function pushLinkIssue(kind, payload) {
  report.totals.linkChecks += 1;
  report.links[kind].push(payload);
  addIssue("link", `${kind} detected`, payload);
}

async function walkHtmlFiles(dirPath, relativeBase = "") {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const found = [];
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules" || entry.name === "frontend") continue;
    const abs = path.join(dirPath, entry.name);
    const rel = relativeBase ? path.join(relativeBase, entry.name) : entry.name;
    const relPosix = toPosix(rel);
    if (
      relPosix.startsWith("client/node_modules/") ||
      relPosix === "client/node_modules" ||
      relPosix.startsWith("client/dist/") ||
      relPosix === "client/dist"
    ) {
      continue;
    }
    if (entry.isDirectory()) {
      const nested = await walkHtmlFiles(abs, rel);
      found.push(...nested);
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) {
      found.push(toPosix(rel));
    }
  }
  return found;
}

function shouldAuditHtmlPage(relPath) {
  const p = toPosix(relPath);
  if (/^[^/]+\.html$/i.test(p)) return true;
  if (p.startsWith("pages/")) return true;
  if (p.startsWith("folders/")) return true;
  if (p.startsWith("legal/")) return true;
  if (p.startsWith("client/pages/")) return true;
  return false;
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServerReady(baseUrl, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) return true;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  return false;
}

function captureOtpFromLogs(chunk) {
  const text = chunk.toString();
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/\[otp\].*code=(\d{4,12})/i);
    if (match?.[1]) otpLogQueue.push(match[1]);
  }
}

async function requestJson(url, { method = "GET", token = "", body = undefined, timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = {
      Accept: "application/json",
      "User-Agent": AUDIT_UA,
      "x-forwarded-for": AUDIT_IP
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    const text = await response.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    return { ok: response.ok, status: response.status, body: parsed, raw: text };
  } catch (error) {
    return { ok: false, status: 0, body: null, raw: "", error: error?.message || String(error) };
  } finally {
    clearTimeout(timer);
  }
}

function buildTrustedFingerprint(ip, userAgent) {
  return crypto.createHash("sha256").update(`${ip}|${userAgent}`).digest("hex").slice(0, 24);
}

function buildAuditSecurityState(trustedFingerprint) {
  const stamp = new Date().toISOString();
  return {
    version: 1,
    persistedAt: stamp,
    state: {
      mode: "balanced",
      modules: {
        requestFirewall: true,
        tokenFirewall: true,
        aiThreatDetector: false,
        fakeListingAi: false,
        authFailureIntelligence: true,
        autoQuarantine: false,
        strictAdminMutationGuard: false
      },
      thresholds: {
        threatAlert: 1000,
        threatBlock: 9999,
        fakeListingAlert: 1000,
        fakeListingBlock: 9999,
        auth401: 80,
        auth403: 60,
        tokenReplayEvents: 80,
        tokenReplayDistinctFingerprints: 15,
        tokenReplayDistinctIps: 15,
        subjectReplayEvents: 80,
        subjectReplayDistinctFingerprints: 15,
        subjectReplayDistinctIps: 15,
        autoPromoteWindowMinutes: 120,
        autoPromoteFingerprintEvents: 1000,
        autoPromoteIpEvents: 1000,
        autoPromoteSubjectEvents: 1000,
        autoPromoteBlockedEvents: 1000,
        autoEscalationWindowMinutes: 120,
        autoEscalationCooldownMinutes: 120,
        autoEscalateToHardenedEvents: 1000,
        autoEscalateToLockdownEvents: 1000,
        autoEscalateBlockedEvents: 1000,
        autoDeEscalationWindowMinutes: 120,
        autoDeEscalationCooldownMinutes: 120,
        autoDeEscalateToHardenedMaxEvents: 1000,
        autoDeEscalateToBalancedMaxEvents: 1000,
        autoDeEscalateBlockedMaxEvents: 1000,
        criticalLockdownCooldownMinutes: 120
      },
      adminControls: {
        actionKeyEnforced: false,
        readOnlyApi: false,
        autoPromoteBlocklists: false,
        autoEscalateMode: false,
        autoDeEscalateMode: false,
        autoCriticalResponse: false,
        autoCriticalLockdown: false,
        autoCriticalImmediateBlocklist: false
      },
      lists: {
        blockedIps: [],
        blockedFingerprints: [],
        blockedUserAgentSignatures: [],
        blockedTokenSubjects: []
      },
      trustedFingerprints: trustedFingerprint ? [trustedFingerprint] : [],
      meta: {
        updatedAt: stamp,
        updatedById: "audit-runner",
        updatedByRole: "admin",
        revision: 1
      }
    }
  };
}

function normalizeRef(refValue) {
  const trimmed = String(refValue || "").trim();
  if (!trimmed) return "";
  return trimmed.split("#")[0].split("?")[0].trim();
}

function isExternalRef(refValue) {
  const value = String(refValue || "").trim().toLowerCase();
  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("//") ||
    value.startsWith("mailto:") ||
    value.startsWith("tel:") ||
    value.startsWith("javascript:") ||
    value.startsWith("data:")
  );
}

function isApiRef(refValue) {
  const value = String(refValue || "").trim();
  return value.startsWith("/api/") || value.startsWith("../api/") || value.startsWith("../../api/");
}

async function resolveReferenceFile(sourceRelPath, refValue, routePaths) {
  const normalized = normalizeRef(refValue);
  if (!normalized || normalized === ".") return { resolved: null, skip: true, reason: "empty" };
  if (normalized.startsWith("#")) return { resolved: null, skip: true, reason: "anchor" };
  if (isExternalRef(normalized)) return { resolved: null, skip: true, reason: "external" };
  if (isApiRef(normalized)) return { resolved: null, skip: true, reason: "api" };

  if (normalized.startsWith("/")) {
    if (routePaths.has(normalized)) return { resolved: null, skip: true, reason: "server-route" };
    const abs = path.join(projectRoot, normalized.replace(/^\/+/, ""));
    return { resolved: abs, skip: false, reason: "absolute" };
  }

  const sourceDir = path.dirname(path.join(projectRoot, sourceRelPath));
  const abs = path.resolve(sourceDir, normalized);
  return { resolved: abs, skip: false, reason: "relative" };
}

async function runPageChecks(pageRelPaths) {
  for (const relPath of pageRelPaths) {
    const localUrl = `${LOCAL_BASE}/${toPosix(relPath)}`;
    const localRes = await requestJson(localUrl, { method: "GET" });
    pushPageResult("local", {
      page: relPath,
      url: localUrl,
      ok: localRes.status === 200,
      status: localRes.status,
      error: localRes.error || ""
    });

    if (!SKIP_LIVE) {
      const liveUrl = `${LIVE_BASE}/${toPosix(relPath)}`;
      const liveRes = await requestJson(liveUrl, { method: "GET" });
      pushPageResult("live", {
        page: relPath,
        url: liveUrl,
        ok: liveRes.status === 200,
        status: liveRes.status,
        error: liveRes.error || ""
      });
    }
  }
}

async function runLinkChecks(pageRelPaths, routePaths) {
  const attrRegex = /\b(?:href|src)\s*=\s*["']([^"']+)["']/gi;
  const idRegex = /\bid\s*=\s*["']([^"']+)["']/gi;
  const sameFileAnchorRegex = /\bhref\s*=\s*["']#([^"']+)["']/gi;

  for (const relPath of pageRelPaths) {
    const abs = path.join(projectRoot, relPath);
    let html = "";
    try {
      html = await fs.readFile(abs, "utf8");
    } catch (error) {
      pushLinkIssue("missingAssets", {
        page: relPath,
        ref: "(page unreadable)",
        reason: error?.message || String(error)
      });
      continue;
    }

    const idSet = new Set();
    for (const match of html.matchAll(idRegex)) {
      const id = String(match?.[1] || "").trim();
      if (id) idSet.add(id);
    }

    for (const match of html.matchAll(sameFileAnchorRegex)) {
      const anchor = String(match?.[1] || "").trim();
      if (!anchor) continue;
      report.totals.linkChecks += 1;
      if (!idSet.has(anchor)) {
        pushLinkIssue("missingAnchors", {
          page: relPath,
          anchor
        });
      }
    }

    for (const match of html.matchAll(attrRegex)) {
      const rawRef = String(match?.[1] || "").trim();
      const resolved = await resolveReferenceFile(relPath, rawRef, routePaths);
      if (resolved.skip || !resolved.resolved) continue;
      report.totals.linkChecks += 1;
      if (!(await pathExists(resolved.resolved))) {
        pushLinkIssue("missingAssets", {
          page: relPath,
          ref: rawRef,
          resolvedPath: toPosix(path.relative(projectRoot, resolved.resolved)),
          resolveMode: resolved.reason
        });
      }
    }
  }
}

async function runApiCheck(name, pathSuffix, { method = "GET", token = "", body = undefined, expect = [200] } = {}) {
  if (API_CALL_DELAY_MS > 0) await sleep(API_CALL_DELAY_MS);
  const url = `${LOCAL_BASE}${pathSuffix}`;
  const response = await requestJson(url, { method, token, body });
  const ok = expect.includes(response.status);
  pushApiResult({
    name,
    method,
    url: pathSuffix,
    expected: expect,
    ok,
    status: response.status,
    error: response.error || "",
    message: response.body?.message || ""
  });
  return response;
}

async function waitForOtpCode(previousCount, timeoutMs = 7000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (otpLogQueue.length > previousCount) return otpLogQueue[otpLogQueue.length - 1];
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  return "";
}

async function loginWithOtp(roleName, identity) {
  let response = null;
  const otpBody = identity.includes("@")
    ? { role: roleName, email: identity }
    : { role: roleName, mobile: identity };

  const beforeCount = otpLogQueue.length;
  response = await runApiCheck(`otp-request-${roleName}`, "/api/auth/request-otp", {
    method: "POST",
    body: otpBody,
    expect: [200, 429]
  });
  if (response.status === 429 && Number(response.body?.retryAfterSec) > 0) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(5000, Number(response.body.retryAfterSec) * 1000)));
    response = await runApiCheck(`otp-request-retry-${roleName}`, "/api/auth/request-otp", {
      method: "POST",
      body: otpBody,
      expect: [200]
    });
  }
  if (response.status !== 200) {
    return { token: "", user: null, otp: "", ok: false };
  }

  const otp =
    String(response.body?.otpHint || "").trim() ||
    String(await waitForOtpCode(beforeCount, 9000)).trim();
  if (!otp) {
    pushApiResult({
      name: `otp-capture-${roleName}`,
      method: "INTERNAL",
      url: "server-log",
      expected: [1],
      ok: false,
      status: 0,
      error: "OTP not captured from response or server logs.",
      message: ""
    });
    return { token: "", user: null, otp: "", ok: false };
  }

  const loginBody = identity.includes("@")
    ? { role: roleName, email: identity, otp }
    : { role: roleName, mobile: identity, otp };
  const loginResponse = await runApiCheck(`otp-login-${roleName}`, "/api/auth/login", {
    method: "POST",
    body: loginBody,
    expect: [200]
  });
  return {
    token: String(loginResponse.body?.token || ""),
    user: loginResponse.body?.user || null,
    otp,
    ok: loginResponse.status === 200 && !!loginResponse.body?.token
  };
}

async function runFeatureApiSuite() {
  await runApiCheck("health", "/api/health", { expect: [200] });
  await runApiCheck("system-capabilities", "/api/system/capabilities", { expect: [200] });
  await runApiCheck("system-core-systems", "/api/system/core-systems", { expect: [200] });
  await runApiCheck("bootstrap", "/api/bootstrap", { expect: [200] });
  await runApiCheck("properties-public", "/api/properties?city=Udaipur", { expect: [200] });
  await runApiCheck("insights-locality", "/api/insights/locality?name=Bhuwana", { expect: [200] });
  await runApiCheck("ai-market-trend", "/api/ai/market-trend?locality=Bhuwana", { expect: [200] });
  await runApiCheck("ai-recommendations", "/api/ai/recommendations?locality=Bhuwana", { expect: [200] });
  await runApiCheck("recommendations", "/api/recommendations?locality=Bhuwana", { expect: [200] });
  await runApiCheck("subscriptions-plans", "/api/subscriptions/plans", { expect: [200] });
  await runApiCheck("documentation-services", "/api/documentation/services", { expect: [200] });
  await runApiCheck("loan-banks", "/api/loan/banks", { expect: [200] });
  await runApiCheck("ecosystem-services", "/api/ecosystem/services", { expect: [200] });
  await runApiCheck("franchise-regions-public", "/api/franchise/regions", { expect: [200] });
  await runApiCheck("agents-public", "/api/agents", { expect: [200] });

  const dbFile = path.join(projectRoot, "database", "live-data.json");
  const db = JSON.parse(await fs.readFile(dbFile, "utf8"));
  const adminIdentity = db.users.find((u) => String(u.role).toLowerCase() === "admin" && /^\d{10}$/.test(String(u.mobile || "")))?.mobile || "9999999999";
  const customerIdentity = db.users.find((u) => String(u.role).toLowerCase() === "customer" && /^\d{10}$/.test(String(u.mobile || "")))?.mobile || "9865456545";
  const sellerIdentity = db.users.find((u) => String(u.role).toLowerCase() === "seller" && /^\d{10}$/.test(String(u.mobile || "")))?.mobile || "9722452245";

  const adminSession = await loginWithOtp("admin", String(adminIdentity));
  const customerSession = await loginWithOtp("customer", String(customerIdentity));
  const sellerSession = await loginWithOtp("seller", String(sellerIdentity));

  if (!adminSession.ok || !customerSession.ok || !sellerSession.ok) {
    addIssue("auth", "One or more OTP logins failed.", {
      admin: adminSession.ok,
      customer: customerSession.ok,
      seller: sellerSession.ok
    });
    return;
  }

  await runApiCheck("auth-me-admin", "/api/auth/me", { token: adminSession.token, expect: [200] });
  await runApiCheck("auth-me-customer", "/api/auth/me", { token: customerSession.token, expect: [200] });
  await runApiCheck("auth-me-seller", "/api/auth/me", { token: sellerSession.token, expect: [200] });

  const listForCustomer = await runApiCheck("properties-for-customer", "/api/properties?city=Udaipur", {
    token: customerSession.token,
    expect: [200]
  });
  const approvedPropertyId = String(listForCustomer.body?.items?.[0]?.id || "");
  if (!approvedPropertyId) {
    addIssue("api", "No approved property found for feature tests.", {});
    return;
  }

  await runApiCheck("visit-booking", `/api/properties/${approvedPropertyId}/visit`, {
    method: "POST",
    token: customerSession.token,
    body: { preferredAt: new Date(Date.now() + 2 * 3600 * 1000).toISOString(), note: "Site visit request for this property." },
    expect: [201]
  });
  await runApiCheck("visits-list", "/api/visits", { token: customerSession.token, expect: [200] });

  await runApiCheck("chat-send", "/api/chat/send", {
    method: "POST",
    token: customerSession.token,
    body: {
      propertyId: approvedPropertyId,
      receiverId: String(adminSession.user?.id || ""),
      message: "Interested in visit details for this property."
    },
    expect: [201]
  });
  await runApiCheck("chat-list", `/api/chat/${approvedPropertyId}`, {
    token: customerSession.token,
    expect: [200]
  });

  await runApiCheck("review-submit", "/api/reviews", {
    method: "POST",
    token: customerSession.token,
    body: {
      propertyId: approvedPropertyId,
      rating: 4,
      propertyAccuracy: 4,
      ownerBehavior: 4,
      agentService: 4,
      comment: "Good listing details and response."
    },
    expect: [201, 409]
  });
  await runApiCheck("review-list", `/api/reviews/${approvedPropertyId}`, { expect: [200] });

  await runApiCheck("subscription-activate", "/api/subscriptions/activate", {
    method: "POST",
    token: customerSession.token,
    body: { planId: "basic-plan" },
    expect: [201]
  });
  await runApiCheck("subscription-my", "/api/subscriptions/me", {
    token: customerSession.token,
    expect: [200]
  });

  await runApiCheck("property-care-request", "/api/property-care/requests", {
    method: "POST",
    token: customerSession.token,
    body: {
      planId: "care-basic",
      propertyId: approvedPropertyId,
      location: "Bhuwana, Udaipur",
      preferredDate: new Date(Date.now() + 86400000).toISOString()
    },
    expect: [201]
  });
  await runApiCheck("property-care-list", "/api/property-care/requests", {
    token: customerSession.token,
    expect: [200]
  });

  await runApiCheck("legal-request", "/api/legal/requests", {
    method: "POST",
    token: customerSession.token,
    body: { templateId: "sale-agreement", details: "Audit legal request test" },
    expect: [201]
  });
  await runApiCheck("legal-request-list", "/api/legal/requests", {
    token: customerSession.token,
    expect: [200]
  });

  const documentationRequest = await runApiCheck("documentation-request", "/api/documentation/requests", {
    method: "POST",
    token: customerSession.token,
    body: {
      serviceId: "agreement-service",
      propertyId: approvedPropertyId,
      city: "Udaipur",
      details: "Need agreement draft support for this listing."
    },
    expect: [201]
  });
  await runApiCheck("documentation-request-list", "/api/documentation/requests", {
    token: customerSession.token,
    expect: [200]
  });

  const loanRequest = await runApiCheck("loan-assistance-request", "/api/loan/assistance", {
    method: "POST",
    token: customerSession.token,
    body: {
      bankId: "hdfc",
      requestedAmount: 1500000,
      propertyValue: 2500000,
      locality: "Pratap Nagar",
      city: "Udaipur"
    },
    expect: [201]
  });
  await runApiCheck("loan-assistance-list", "/api/loan/assistance", {
    token: customerSession.token,
    expect: [200]
  });

  const ecosystemBooking = await runApiCheck("ecosystem-booking", "/api/ecosystem/bookings", {
    method: "POST",
    token: customerSession.token,
    body: {
      serviceId: "movers-packers",
      propertyId: approvedPropertyId,
      preferredDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
      contactPhone: String(customerIdentity)
    },
    expect: [201]
  });
  await runApiCheck("ecosystem-booking-list", "/api/ecosystem/bookings", {
    token: customerSession.token,
    expect: [200]
  });

  await runApiCheck("valuation-estimate", "/api/valuation/estimate", {
    method: "POST",
    token: customerSession.token,
    body: {
      locality: "Bhuwana",
      propertyType: "House",
      areaSqft: 1400,
      expectedPrice: 6200000
    },
    expect: [200]
  });

  await runApiCheck("rent-agreement-generate", "/api/rent-agreement/generate", {
    method: "POST",
    token: customerSession.token,
    body: {
      ownerName: "Audit Owner",
      tenantName: "Audit Tenant",
      propertyAddress: "Hiran Magri, Udaipur",
      rentAmount: 18000,
      depositAmount: 40000,
      durationMonths: 11
    },
    expect: [201]
  });
  await runApiCheck("rent-agreement-list", "/api/rent-agreement/drafts", {
    token: customerSession.token,
    expect: [200]
  });

  const franchiseRequest = await runApiCheck("franchise-request", "/api/franchise/requests", {
    method: "POST",
    token: customerSession.token,
    body: {
      city: "Udaipur",
      investmentBudget: 600000,
      notes: "Interested in launching in this city."
    },
    expect: [201]
  });
  await runApiCheck("franchise-request-list", "/api/franchise/requests", {
    token: customerSession.token,
    expect: [200]
  });

  await runApiCheck("ai-pricing-suggestion", "/api/ai/pricing-suggestion", {
    method: "POST",
    body: { locality: "Bhuwana", price: 6500000, category: "House" },
    expect: [200]
  });
  await runApiCheck("ai-description-generate", "/api/ai/description-generate", {
    method: "POST",
    body: { title: "Family House in Bhuwana", location: "Bhuwana", type: "Sell", category: "House", price: 6500000 },
    expect: [200]
  });
  await runApiCheck("ai-fraud-scan", "/api/ai/fraud-scan", {
    method: "POST",
    body: { title: "Family House in Bhuwana", price: 6500000, location: "Bhuwana", photosCount: 5 },
    expect: [200]
  });

  const sellerProperty = await runApiCheck("seller-create-property", "/api/properties", {
    method: "POST",
    token: sellerSession.token,
    body: {
      title: `Premium House ${Date.now()}`,
      city: "Udaipur",
      type: "Sell",
      category: "House",
      location: "Sukher",
      price: 4200000,
      media: {
        photosCount: 5,
        videoUploaded: true,
        videoDurationSec: 42
      },
      aiReview: {
        fraudRiskScore: 16
      }
    },
    expect: [201]
  });
  const sellerPropertyId = String(sellerProperty.body?.property?.id || "");
  await runApiCheck("seller-properties-mine", "/api/properties?mine=1", {
    token: sellerSession.token,
    expect: [200]
  });

  if (sellerPropertyId) {
    await runApiCheck("owner-verification-request", "/api/owner-verification/request", {
      method: "POST",
      token: sellerSession.token,
      body: {
        propertyId: sellerPropertyId,
        ownerAadhaarPanStatus: "Submitted",
        addressVerificationStatus: "Submitted",
        ownerAadhaarPanRef: "PAN1234K",
        addressVerificationRef: "ADDR9988",
        privateDocsUploaded: true
      },
      expect: [201]
    });

    await runApiCheck("admin-approve-property", `/api/properties/${sellerPropertyId}/approve`, {
      method: "POST",
      token: adminSession.token,
      body: { status: "Approved" },
      expect: [200]
    });
    await runApiCheck("admin-feature-property", `/api/properties/${sellerPropertyId}/feature`, {
      method: "POST",
      token: adminSession.token,
      body: { days: 7 },
      expect: [200]
    });
  }

  const ownerVerificationQueue = await runApiCheck("admin-owner-verification-list", "/api/admin/owner-verification", {
    token: adminSession.token,
    expect: [200]
  });
  const ownerVerificationId = String(ownerVerificationQueue.body?.items?.[0]?.id || "");
  if (ownerVerificationId) {
    await runApiCheck("admin-owner-verification-decision", `/api/admin/owner-verification/${ownerVerificationId}/decision`, {
      method: "POST",
      token: adminSession.token,
      body: { status: "verified", note: "Verification completed by admin." },
      expect: [200]
    });
  }

  await runApiCheck("admin-overview", "/api/admin/overview", {
    token: adminSession.token,
    expect: [200]
  });
  await runApiCheck("admin-config-categories", "/api/admin/config/categories", {
    token: adminSession.token,
    expect: [200]
  });
  await runApiCheck("admin-config-cities", "/api/admin/config/cities", {
    token: adminSession.token,
    expect: [200]
  });
  await runApiCheck("admin-featured-pricing", "/api/admin/config/featured-pricing", {
    token: adminSession.token,
    expect: [200]
  });
  await runApiCheck("admin-users-list", "/api/admin/users", {
    token: adminSession.token,
    expect: [200]
  });

  await runApiCheck("sealed-bid-submit", "/api/sealed-bids", {
    method: "POST",
    token: customerSession.token,
    body: {
      propertyId: approvedPropertyId,
      amount: 7100000
    },
    expect: [201, 409, 429]
  });
  await runApiCheck("sealed-bid-mine", "/api/sealed-bids/mine", {
    token: customerSession.token,
    expect: [200]
  });
  await runApiCheck("sealed-bid-summary", "/api/sealed-bids/summary", {
    token: adminSession.token,
    expect: [200]
  });
  const adminBidView = await runApiCheck("sealed-bid-admin-view", "/api/sealed-bids/admin", {
    token: adminSession.token,
    expect: [200]
  });
  const decisionPropertyId = String(adminBidView.body?.items?.[0]?.propertyId || "");
  if (decisionPropertyId) {
    await runApiCheck("sealed-bid-admin-decision-reveal", "/api/sealed-bids/decision", {
      method: "POST",
      token: adminSession.token,
      body: {
        propertyId: decisionPropertyId,
        action: "reveal",
        decisionReason: "Winning bid has been reviewed and approved for reveal."
      },
      expect: [200]
    });
    await runApiCheck("sealed-bid-winner-public", `/api/sealed-bids/winner/${decisionPropertyId}`, {
      expect: [200, 403]
    });
  }

  if (documentationRequest.body?.request?.id) {
    await runApiCheck("admin-documentation-status-update", `/api/admin/documentation/requests/${documentationRequest.body.request.id}/status`, {
      method: "POST",
      token: adminSession.token,
      body: { status: "In Progress", adminNote: "Processing the request." },
      expect: [200]
    });
  }
  if (loanRequest.body?.lead?.id) {
    await runApiCheck("admin-loan-status-update", `/api/admin/loan/assistance/${loanRequest.body.lead.id}/status`, {
      method: "POST",
      token: adminSession.token,
      body: { status: "in-progress", finalCommissionAmount: 21000 },
      expect: [200]
    });
  }
  if (ecosystemBooking.body?.booking?.id) {
    await runApiCheck("admin-ecosystem-status-update", `/api/admin/ecosystem/bookings/${ecosystemBooking.body.booking.id}/status`, {
      method: "POST",
      token: adminSession.token,
      body: { status: "Assigned", adminNote: "Partner assigned." },
      expect: [200]
    });
  }
  if (franchiseRequest.body?.request?.id) {
    await runApiCheck("admin-franchise-status-update", `/api/admin/franchise/requests/${franchiseRequest.body.request.id}/status`, {
      method: "POST",
      token: adminSession.token,
      body: { status: "shortlisted", adminNote: "Audit shortlist update." },
      expect: [200]
    });
  }

  await runApiCheck("notifications-customer", "/api/notifications", {
    token: customerSession.token,
    expect: [200]
  });
  await runApiCheck("notifications-admin", "/api/notifications", {
    token: adminSession.token,
    expect: [200]
  });
}

async function saveReport() {
  const outDir = path.join(projectRoot, "docs", "reports");
  await fs.mkdir(outDir, { recursive: true });
  const stamp = nowStamp();
  const jsonPath = path.join(outDir, `full-site-audit-${stamp}.json`);
  const mdPath = path.join(outDir, `full-site-audit-${stamp}.md`);

  report.finishedAt = new Date().toISOString();
  report.summary = {
    pageLocalOk: report.pages.local.filter((x) => x.ok).length,
    pageLocalFail: report.pages.local.filter((x) => !x.ok).length,
    pageLiveOk: report.pages.live.filter((x) => x.ok).length,
    pageLiveFail: report.pages.live.filter((x) => !x.ok).length,
    apiOk: report.api.checks.filter((x) => x.ok).length,
    apiFail: report.api.checks.filter((x) => !x.ok).length,
    missingAssets: report.links.missingAssets.length,
    missingAnchors: report.links.missingAnchors.length,
    totalIssues: report.totals.issues
  };

  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const lines = [
    "# Full Site Audit Report",
    "",
    `- Started: ${report.startedAt}`,
    `- Finished: ${report.finishedAt}`,
    `- Local base: ${report.localBase}`,
    `- Live base: ${report.liveBase}`,
    "",
    "## Summary",
    "",
    `- Local page checks: ${report.summary.pageLocalOk} passed, ${report.summary.pageLocalFail} failed`,
    `- Live page checks: ${report.summary.pageLiveOk} passed, ${report.summary.pageLiveFail} failed`,
    `- API checks: ${report.summary.apiOk} passed, ${report.summary.apiFail} failed`,
    `- Missing assets: ${report.summary.missingAssets}`,
    `- Missing anchors: ${report.summary.missingAnchors}`,
    `- Total issues: ${report.summary.totalIssues}`,
    "",
    "## Artifacts",
    "",
    `- JSON: ${toPosix(path.relative(projectRoot, jsonPath))}`
  ];
  await fs.writeFile(mdPath, `${lines.join("\n")}\n`, "utf8");
  return { jsonPath, mdPath };
}

async function main() {
  const serverDir = path.join(projectRoot, "server");
  const dbPath = path.join(projectRoot, "database", "live-data.json");
  const dbBackupPath = path.join(projectRoot, "database", "live-data.audit-backup.json");
  const securityStatePath = path.join(projectRoot, "database", "security-control-state.json");
  const securityStateBackupPath = path.join(projectRoot, "database", "security-control-state.audit-backup.json");
  const liveRouteMapPath = path.join(projectRoot, "live-route-map.json");

  const htmlPages = (await walkHtmlFiles(projectRoot))
    .map((p) => toPosix(p))
    .filter((p) => !p.startsWith("frontend/"))
    .filter((p) => shouldAuditHtmlPage(p))
    .sort((a, b) => a.localeCompare(b));
  report.notes.push({
    kind: "inventory",
    message: "HTML inventory complete",
    details: { pages: htmlPages.length }
  });

  let routePaths = new Set();
  try {
    const routeMap = JSON.parse(await fs.readFile(liveRouteMapPath, "utf8"));
    routePaths = new Set((routeMap?.routes || []).map((item) => String(item?.path || "").trim()).filter(Boolean));
  } catch {
    // optional
  }

  await fs.copyFile(dbPath, dbBackupPath);
  const trustedFingerprint = buildTrustedFingerprint(AUDIT_IP, AUDIT_UA);
  if (await pathExists(securityStatePath)) {
    await fs.copyFile(securityStatePath, securityStateBackupPath);
  }
  const auditSecurityState = buildAuditSecurityState(trustedFingerprint);
  await fs.writeFile(securityStatePath, `${JSON.stringify(auditSecurityState, null, 2)}\n`, "utf8");

  let proc = null;
  if (!SKIP_SERVER_START) {
    proc = spawn(process.execPath, ["server.js"], {
      cwd: serverDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        OTP_DELIVERY_PROVIDER: process.env.OTP_DELIVERY_PROVIDER || "console",
        EXPOSE_OTP_HINT: process.env.EXPOSE_OTP_HINT || "1",
        THREAT_SCORE_BLOCK_THRESHOLD: process.env.THREAT_SCORE_BLOCK_THRESHOLD || "600",
        FAKE_LISTING_BLOCK_THRESHOLD: process.env.FAKE_LISTING_BLOCK_THRESHOLD || "600",
        AUTO_PROMOTE_BLOCKED_EVENTS: process.env.AUTO_PROMOTE_BLOCKED_EVENTS || "120",
        AUTO_ESCALATE_BLOCKED_EVENTS: process.env.AUTO_ESCALATE_BLOCKED_EVENTS || "220"
      }
    });
    proc.stdout.on("data", (chunk) => captureOtpFromLogs(chunk));
    proc.stderr.on("data", (chunk) => captureOtpFromLogs(chunk));
  }

  try {
    const ready = await waitForServerReady(LOCAL_BASE, 35000);
    if (!ready) {
      addIssue("server", "Local server did not become ready in time.", {});
      const artifacts = await saveReport();
      console.error(`[audit] server readiness failed. Report: ${toPosix(path.relative(projectRoot, artifacts.jsonPath))}`);
      process.exitCode = 1;
      return;
    }

    await runPageChecks(htmlPages);
    await runLinkChecks(htmlPages, routePaths);
    await runFeatureApiSuite();
  } finally {
    if (proc) {
      proc.kill("SIGTERM");
      await new Promise((resolve) => setTimeout(resolve, 700));
      if (!proc.killed) {
        try {
          proc.kill("SIGKILL");
        } catch {
          // ignore
        }
      }
    }
    await fs.copyFile(dbBackupPath, dbPath);
    await fs.rm(dbBackupPath, { force: true });
    if (await pathExists(securityStateBackupPath)) {
      await fs.copyFile(securityStateBackupPath, securityStatePath);
      await fs.rm(securityStateBackupPath, { force: true });
    } else {
      await fs.rm(securityStatePath, { force: true });
    }
  }

  const artifacts = await saveReport();
  const relJson = toPosix(path.relative(projectRoot, artifacts.jsonPath));
  const relMd = toPosix(path.relative(projectRoot, artifacts.mdPath));
  console.log(`[audit] report_json=${relJson}`);
  console.log(`[audit] report_md=${relMd}`);
  console.log(`[audit] total_issues=${report.totals.issues}`);

  if (report.totals.issues > 0) {
    process.exitCode = 1;
  }
}

await main();
