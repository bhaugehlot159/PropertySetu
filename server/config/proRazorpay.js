import Razorpay from "razorpay";

let razorpayClient;

function isConfiguredCredential(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return false;
  return (
    !raw.includes("replace_with") &&
    !raw.includes("placeholder") &&
    !raw.startsWith("your_")
  );
}

export function getProRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!isConfiguredCredential(keyId) || !isConfiguredCredential(keySecret)) {
    return null;
  }

  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    });
  }

  return razorpayClient;
}

export function getRazorpayPublicKey() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  return isConfiguredCredential(keyId) ? keyId : "";
}
