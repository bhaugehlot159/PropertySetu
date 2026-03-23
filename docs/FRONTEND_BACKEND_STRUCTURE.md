# PropertySetu Frontend + Backend Structure (Live)

Legacy files are preserved. No previous code is deleted.

## Frontend Root

- `frontend/`
  - `index.html`
  - `add-property.html`
  - `admin-dashboard.html`
  - `user-dashboard.html`
  - `property-details.html`
  - `css/`
  - `js/`
  - `pages/`
  - `legal/`
  - `folders/`
  - `live-route-map.json`

## Backend Root

- `backend/`
  - `src/server-entry.js` (boots existing `server/server.js`)
  - `package.json`
  - `.env.example`

## Live Serving Rule

Server now serves in this order:

1. `frontend/` (professional active web root)
2. legacy project root (fallback for backward compatibility)

## Live Routes

Clean routes are mapped in backend:

- `/` and `/udaipur`
- `/buy-sell`
- `/rent`
- `/property-care`
- `/city-structure`
- `/trusted-agents`
- `/legal-help`
- `/insurance-security`
- `/premium-services`
- `/add-property`
- `/property-details`
- `/customer-dashboard`
- `/admin-dashboard`
- `/seller-dashboard`
- future-ready city paths: `/jaipur`, `/jodhpur`, `/ahmedabad`, `/delhi`

API discovery endpoint:

- `/api/system/live-roots`

