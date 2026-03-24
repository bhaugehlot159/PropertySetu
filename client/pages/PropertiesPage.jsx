import { useEffect, useState } from "react";
import PropertyCard from "../components/PropertyCard.jsx";
import { listProperties } from "../services/propertyService.js";

function PropertiesPage() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadProperties = async () => {
      try {
        const data = await listProperties();
        if (mounted) {
          setProperties(data);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err?.response?.data?.message ||
              "Properties fetch nahi ho paayi. Backend run check karein."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadProperties();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="page">
      <div className="page-header">
        <h1>Live Properties</h1>
        <p>API driven listings from professional backend module.</p>
      </div>

      {loading ? <p>Loading properties...</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      {!loading && !error ? (
        <div className="property-grid">
          {properties.length ? (
            properties.map((property) => (
              <PropertyCard key={property._id} property={property} />
            ))
          ) : (
            <p>No properties found. Add a new listing first.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}

export default PropertiesPage;
