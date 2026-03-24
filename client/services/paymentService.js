import apiClient from "./apiClient.js";

const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpayScript() {
  if (window.Razorpay) {
    return Promise.resolve(true);
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () =>
      reject(new Error("Razorpay SDK load nahi hua. Network check karein."));
    document.body.appendChild(script);
  });
}

async function createRazorpayOrder(payload) {
  const response = await apiClient.post("/payments/order", payload);
  return response.data;
}

async function verifyRazorpayPayment(payload) {
  const response = await apiClient.post("/payments/verify", payload);
  return response.data;
}

export async function startRazorpayCheckout({
  amountInRupees,
  propertyId,
  buyerName = "Guest Buyer",
  buyerEmail = "guest@propertysetu.in",
  buyerPhone = "9876543210"
}) {
  await loadRazorpayScript();

  const orderResponse = await createRazorpayOrder({
    amountInRupees,
    propertyId
  });

  const order = orderResponse.data;
  const keyId = orderResponse.keyId;

  if (!keyId) {
    throw new Error("Razorpay key missing. Backend env configuration required.");
  }

  await new Promise((resolve, reject) => {
    const options = {
      key: keyId,
      amount: order.amount,
      currency: order.currency,
      name: "PropertySetu",
      description: `Booking token for ${propertyId}`,
      order_id: order.id,
      prefill: {
        name: buyerName,
        email: buyerEmail,
        contact: buyerPhone
      },
      theme: {
        color: "#0b8a71"
      },
      handler: async (response) => {
        try {
          await verifyRazorpayPayment(response);
          resolve(response);
        } catch (error) {
          reject(
            new Error(
              error?.response?.data?.message ||
                "Payment verify failed. Signature mismatch."
            )
          );
        }
      },
      modal: {
        ondismiss: () => reject(new Error("Checkout closed by user."))
      }
    };

    const checkout = new window.Razorpay(options);
    checkout.open();
  });
}
