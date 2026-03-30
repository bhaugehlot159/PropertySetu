import crypto from "crypto";

function text(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function bool(value, fallback = false) {
  const normalized = text(value).toLowerCase();
  if (!normalized) return Boolean(fallback);
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return Boolean(fallback);
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const NODE_ENV = text(process.env.NODE_ENV, "development").toLowerCase();
const OTP_DELIVERY_PROVIDER = text(
  process.env.OTP_DELIVERY_PROVIDER,
  NODE_ENV === "production" ? "webhook" : "console"
).toLowerCase();
const OTP_DELIVERY_REQUIRE_REAL = bool(
  process.env.OTP_DELIVERY_REQUIRE_REAL,
  NODE_ENV === "production"
);
const OTP_DELIVERY_TIMEOUT_MS = Math.max(
  2_000,
  Math.min(20_000, numberValue(process.env.OTP_DELIVERY_TIMEOUT_MS, 8_000))
);

function maskDestination(destination) {
  const raw = text(destination);
  if (!raw) return "";
  if (raw.includes("@")) {
    const [name = "", domain = ""] = raw.split("@");
    const maskedName =
      name.length <= 2 ? `${name.slice(0, 1)}*` : `${name.slice(0, 2)}***`;
    return `${maskedName}@${domain}`;
  }
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= 4) return `${"*".repeat(Math.max(2, digits.length))}`;
  return `${digits.slice(0, 2)}******${digits.slice(-2)}`;
}

function toSmsDestination(value) {
  const raw = text(value);
  if (!raw) return "";
  if (raw.startsWith("+")) {
    const normalized = `+${raw.slice(1).replace(/\D/g, "")}`;
    return normalized.length >= 9 ? normalized : "";
  }
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const countryCodeRaw = text(process.env.OTP_DEFAULT_COUNTRY_CODE, "+91");
  const countryCodeDigits = countryCodeRaw.replace(/[^\d]/g, "");
  const countryCode = countryCodeDigits ? `+${countryCodeDigits}` : "+91";
  return `${countryCode}${digits}`;
}

function channelFromIdentity(identity) {
  const normalized = text(identity);
  if (!normalized) return "";
  return normalized.includes("@") ? "email" : "sms";
}

function buildOtpMessage(otpCode, ttlSec) {
  const ttlMinutes = Math.max(1, Math.ceil(numberValue(ttlSec, 300) / 60));
  const template = text(
    process.env.OTP_SMS_TEMPLATE,
    "PropertySetu OTP: {OTP}. Valid for {TTL_MIN} minutes."
  );
  return template
    .replaceAll("{OTP}", text(otpCode))
    .replaceAll("{TTL_MIN}", String(ttlMinutes));
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OTP_DELIVERY_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

async function sendViaWebhook({ channel, destination, otpCode, ttlSec, purpose, metadata }) {
  const url = text(process.env.OTP_WEBHOOK_URL);
  if (!url) {
    throw new Error("OTP_WEBHOOK_URL is not configured.");
  }

  const payload = {
    channel,
    destination,
    otpCode: text(otpCode),
    ttlSec: Math.max(30, numberValue(ttlSec, 300)),
    purpose: text(purpose, "auth-login"),
    metadata: metadata && typeof metadata === "object" ? metadata : {}
  };
  const body = JSON.stringify(payload);
  const headers = {
    "content-type": "application/json"
  };

  const authToken = text(process.env.OTP_WEBHOOK_AUTH_TOKEN);
  if (authToken) {
    headers.authorization = `Bearer ${authToken}`;
  }

  const webhookSecret = text(process.env.OTP_WEBHOOK_SECRET);
  if (webhookSecret) {
    headers["x-propertysetu-signature"] = crypto
      .createHmac("sha256", webhookSecret)
      .update(body)
      .digest("hex");
  }

  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers,
    body
  });

  const parsed = await response.json().catch(() => ({}));
  if (!response.ok) {
    const statusCode = Number(response.status || 500);
    const message = text(parsed?.message || `OTP webhook delivery failed (${statusCode}).`);
    const error = new Error(message);
    error.status = statusCode;
    throw error;
  }

  return {
    provider: "webhook",
    deliveryId: text(parsed?.id || parsed?.deliveryId || parsed?.messageId),
    metadata: parsed
  };
}

async function sendViaTwilioSms({ destination, otpCode, ttlSec }) {
  const accountSid = text(process.env.TWILIO_ACCOUNT_SID);
  const authToken = text(process.env.TWILIO_AUTH_TOKEN);
  const fromNumber = text(process.env.TWILIO_FROM_NUMBER);
  const messagingServiceSid = text(process.env.TWILIO_MESSAGING_SERVICE_SID);

  if (!accountSid || !authToken) {
    throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required.");
  }
  if (!fromNumber && !messagingServiceSid) {
    throw new Error("Configure TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID.");
  }

  const to = toSmsDestination(destination);
  if (!to) {
    throw new Error("OTP SMS destination is invalid.");
  }

  const params = new URLSearchParams();
  params.set("To", to);
  params.set("Body", buildOtpMessage(otpCode, ttlSec));
  if (messagingServiceSid) {
    params.set("MessagingServiceSid", messagingServiceSid);
  } else {
    params.set("From", fromNumber);
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const authValue = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${authValue}`
    },
    body: params
  });

  const parsed = await response.json().catch(() => ({}));
  if (!response.ok) {
    const statusCode = Number(response.status || 500);
    const message = text(parsed?.message || `Twilio OTP delivery failed (${statusCode}).`);
    const error = new Error(message);
    error.status = statusCode;
    throw error;
  }

  return {
    provider: "twilio-sms",
    deliveryId: text(parsed?.sid),
    metadata: parsed
  };
}

function assertProviderAllowed() {
  const simulatedProviders = new Set(["console", "disabled", "none"]);
  if (OTP_DELIVERY_REQUIRE_REAL && simulatedProviders.has(OTP_DELIVERY_PROVIDER)) {
    throw new Error(
      "OTP real delivery required. Configure OTP_DELIVERY_PROVIDER as webhook or twilio-sms."
    );
  }
}

export function shouldExposeOtpHint({ scope = "core" } = {}) {
  if (scope === "legacy") {
    return bool(process.env.EXPOSE_OTP_HINT, false);
  }
  return bool(process.env.CORE_EXPOSE_OTP, false);
}

export function resolveStaticOtp({ scope = "core" } = {}) {
  const primary =
    scope === "legacy"
      ? text(process.env.LEGACY_STATIC_OTP || process.env.CORE_STATIC_OTP)
      : text(process.env.CORE_STATIC_OTP);
  if (!primary) return "";
  const allowInProduction = bool(process.env.OTP_ALLOW_STATIC_IN_PRODUCTION, false);
  if (NODE_ENV === "production" && !allowInProduction) return "";
  return primary.replace(/\s+/g, "").slice(0, 12);
}

export function otpDeliveryHealth() {
  return {
    provider: OTP_DELIVERY_PROVIDER,
    requireReal: OTP_DELIVERY_REQUIRE_REAL,
    timeoutMs: OTP_DELIVERY_TIMEOUT_MS
  };
}

export async function deliverOtpCode({
  identity,
  otpCode,
  ttlSec = 300,
  purpose = "auth-login",
  metadata = {}
} = {}) {
  assertProviderAllowed();

  const normalizedIdentity = text(identity);
  const normalizedOtp = text(otpCode);
  if (!normalizedIdentity || !normalizedOtp) {
    throw new Error("OTP identity and otpCode are required.");
  }

  const channel = channelFromIdentity(normalizedIdentity);
  if (!channel) {
    throw new Error("Unable to determine OTP channel.");
  }

  if (OTP_DELIVERY_PROVIDER === "webhook") {
    const delivery = await sendViaWebhook({
      channel,
      destination: normalizedIdentity,
      otpCode: normalizedOtp,
      ttlSec,
      purpose,
      metadata
    });
    return {
      ...delivery,
      channel,
      destinationMasked: maskDestination(normalizedIdentity)
    };
  }

  if (OTP_DELIVERY_PROVIDER === "twilio-sms") {
    if (channel !== "sms") {
      throw new Error("twilio-sms provider supports mobile identities only.");
    }
    const delivery = await sendViaTwilioSms({
      destination: normalizedIdentity,
      otpCode: normalizedOtp,
      ttlSec
    });
    return {
      ...delivery,
      channel,
      destinationMasked: maskDestination(normalizedIdentity)
    };
  }

  if (OTP_DELIVERY_PROVIDER === "console") {
    if (NODE_ENV !== "production") {
      console.info(
        `[otp] console delivery ${channel} ${maskDestination(normalizedIdentity)} code=${normalizedOtp}`
      );
    }
    return {
      provider: "console",
      deliveryId: "",
      channel,
      destinationMasked: maskDestination(normalizedIdentity),
      simulated: true
    };
  }

  if (OTP_DELIVERY_PROVIDER === "disabled" || OTP_DELIVERY_PROVIDER === "none") {
    throw new Error("OTP delivery provider is disabled.");
  }

  throw new Error(
    `Unsupported OTP_DELIVERY_PROVIDER "${OTP_DELIVERY_PROVIDER}". Use webhook or twilio-sms.`
  );
}
