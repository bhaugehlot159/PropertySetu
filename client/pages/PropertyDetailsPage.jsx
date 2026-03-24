import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  formatCurrencyINR,
  formatDateTime,
  formatSquareFeet
} from "../utils/formatters.js";
import { getPropertyById } from "../services/propertyService.js";
import { startRazorpayCheckout } from "../services/paymentService.js";

function PropertyDetailsPage() {
  const { propertyId } = useParams();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentInfo, setPaymentInfo] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadProperty = async () => {
      try {
        const data = await getPropertyById(propertyId);
        if (mounted) {
          setProperty(data);
        }
      } catch (err) {
        if (mounted) {
          setError(err?.response?.data?.message || "Property details unavailable.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadProperty();
    return () => {
      mounted = false;
    };
  }, [propertyId]);

  const handleBooking = async () => {
    if (!property) return;
    setPaymentInfo("Opening Razorpay checkout...");
    try {
      await startRazorpayCheckout({
        amountInRupees: Math.max(1000, Math.floor(Number(property.price) * 0.01)),
        propertyId: property._id
      });
      setPaymentInfo("Payment verified successfully.");
    } catch (err) {
      setPaymentInfo(
        err?.message ||
          "Checkout failed. Razorpay keys configure karke dobara try karein."
      );
    }
  };

  if (loading) {
    return <section className="page">Loading property details...</section>;
  }

  if (error || !property) {
    return (
      <section className="page">
        <p className="error-text">{error || "Property not found."}</p>
      </section>
    );
  }

  return (
    <section className="page property-details">
      <div className="card property-details-card">
        <div className="property-media">
          {property.imageUrls?.[0] ? (
            <img src={property.imageUrls[0]} alt={property.title} />
          ) : (
            <div className="property-placeholder">No preview image</div>
          )}
        </div>
        <div className="property-detail-content">
          <p className="property-city">{property.city}</p>
          <h1>{property.title}</h1>
          <p className="property-price">{formatCurrencyINR(property.price)}</p>
          <p className="property-meta">
            {property.propertyType} | {property.bedrooms} beds | {property.bathrooms}
            {" "}baths | {formatSquareFeet(property.areaSqft)}
          </p>
          <p>{property.description}</p>
          <p className="muted-text">
            Added: {formatDateTime(property.createdAt)} | Status: {property.status}
          </p>
          <button type="button" className="button" onClick={handleBooking}>
            Pay Booking Token
          </button>
          {paymentInfo ? <p className="muted-text">{paymentInfo}</p> : null}
        </div>
      </div>
    </section>
  );
}

export default PropertyDetailsPage;
