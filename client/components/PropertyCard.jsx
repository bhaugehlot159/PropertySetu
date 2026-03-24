import { Link } from "react-router-dom";
import { formatCurrencyINR, formatSquareFeet } from "../utils/formatters.js";

function PropertyCard({ property }) {
  const image = property.imageUrls?.[0];

  return (
    <article className="card property-card">
      <div className="property-media">
        {image ? (
          <img src={image} alt={property.title} loading="lazy" />
        ) : (
          <div className="property-placeholder">No Image</div>
        )}
      </div>

      <div className="property-content">
        <p className="property-city">{property.city}</p>
        <h3>{property.title}</h3>
        <p className="property-price">{formatCurrencyINR(property.price)}</p>
        <p className="property-meta">
          {property.propertyType} | {property.bedrooms} BHK |{" "}
          {formatSquareFeet(property.areaSqft)}
        </p>
        <Link to={`/properties/${property._id}`} className="button button-outline">
          View Details
        </Link>
      </div>
    </article>
  );
}

export default PropertyCard;
