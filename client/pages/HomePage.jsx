import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import StatusBadge from "../components/StatusBadge.jsx";
import { getSystemHealth } from "../services/healthService.js";

function HomePage() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadHealth = async () => {
      try {
        const response = await getSystemHealth();
        if (mounted) {
          setHealth(response);
        }
      } catch (_error) {
        if (mounted) {
          setHealth(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadHealth();
    return () => {
      mounted = false;
    };
  }, []);

  const apiState = loading ? "warning" : health ? "success" : "error";
  const dbState = health?.database === "connected" ? "success" : "warning";

  return (
    <section className="page">
      <div className="hero card">
        <p className="eyebrow">Modern Stack Upgrade</p>
        <h1>PropertySetu Professional Frontend</h1>
        <p>
          Ye React layer backend API ke saath ready hai. Purana code untouched
          hai, aur naya stack parallel me run hoga.
        </p>
        <div className="hero-actions">
          <Link className="button" to="/properties">
            Explore Properties
          </Link>
          <Link className="button button-outline" to="/add-property">
            Add New Listing
          </Link>
        </div>
      </div>

      <div className="health-grid">
        <article className="card">
          <h2>API Health</h2>
          <StatusBadge
            label={loading ? "Checking..." : health ? "Online" : "Unavailable"}
            state={apiState}
          />
          {health ? <p>Environment: {health.environment}</p> : null}
        </article>

        <article className="card">
          <h2>Database</h2>
          <StatusBadge
            label={health?.database || "degraded"}
            state={dbState}
          />
          <p>
            Agar MongoDB available nahi hoga to API memory mode me bhi run
            karega.
          </p>
        </article>
      </div>
    </section>
  );
}

export default HomePage;
