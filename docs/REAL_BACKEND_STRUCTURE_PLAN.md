# PROPERTYSETU – Real Backend Structure Plan (Live + Production Ready)

Legacy code preserved. No old flow removed.

## 1) Target Stack
- Frontend: static multi-page web app (`frontend/`)
- Backend API: Node.js + Express (`server/server.js`)
- Database (current live): file DB `database/live-data.json`
- Database (production-ready path): MongoDB models in `server/models/`
- Auth: JWT + OTP login flow (`/api/auth/*`)
- Upload storage: local file storage (`uploads/`) via `/api/uploads/property-media`
- Payment path: token slot + subscription logic + Razorpay-ready config

## 2) Live Folder Architecture
- `frontend/`
  - all pages, css, js, folders, legal
- `backend/`
  - `src/server-entry.js` entry wrapper for professional backend root
- `server/`
  - `server.js` live API (active)
  - `models/` Mongo-ready schemas
  - `controllers/`, `routes/`, `middleware/`, `config/` (expansion-ready backend layering)
- `database/`
  - `live-data.json` current persistent data
- `uploads/`
  - property media + private docs storage

## 3) Core Live APIs (Running)
- Auth + OTP:
  - `POST /api/auth/register`
  - `POST /api/auth/request-otp`
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
- Property CRUD + moderation:
  - `GET /api/properties`
  - `POST /api/properties`
  - `PATCH /api/properties/:id`
  - `DELETE /api/properties/:id`
  - `POST /api/properties/:id/approve`
  - `POST /api/properties/:id/feature`
- Upload system:
  - `POST /api/uploads/property-media`
  - `GET /api/uploads/mine`
- Verification:
  - `POST /api/owner-verification/request`
  - `GET /api/owner-verification/me`
  - `GET /api/admin/owner-verification`
  - `POST /api/admin/owner-verification/:id/decision`
- Reviews + trust:
  - `POST /api/reviews`
  - `GET /api/reviews/:propertyId`
- Communication:
  - `POST /api/chat/send`
  - `GET /api/chat/:propertyId`
  - `POST /api/call-mask/request`
  - `GET /api/call-mask/mine`
- Subscription + care + legal:
  - `GET /api/subscriptions/plans`
  - `POST /api/subscriptions/activate`
  - `GET /api/subscriptions/me`
  - `POST /api/property-care/requests`
  - `POST /api/legal/requests`
- AI workflows:
  - `POST /api/ai/pricing-suggestion`
  - `POST /api/ai/description-generate`
  - `POST /api/ai/fraud-scan`
  - `GET /api/ai/market-trend`
  - `GET /api/ai/recommendations`

## 4) Requested Feature Coverage (Live Mapping)
- User dashboard: `user-dashboard.html`, `dashboard.html`
- OTP login: home auth modal + `/api/auth/request-otp`
- Verification system: add-property flow + `/api/owner-verification/*`
- Photo/video upload: add-property UI + `/api/uploads/property-media`
- Subscription payment flow: `subscription.html` + `/api/subscriptions/*`
- In-app chat + spam protection: `user-dashboard.html` + `/api/chat/*`
- AI pricing + recommendations + trend + description + fraud:
  - add-property + marketplace + `/api/ai/*`
- City-wise structure:
  - `pages/city-expansion.html`
  - `/api/cities/structure`
  - clean city route mapping in `server/server.js`
- Property care subscription:
  - `pages/property-care-plans.html`
  - `/api/property-care/requests`

## 5) Production Deployment Path
- Domain + reverse proxy + SSL checklist:
  - `docs/PRODUCTION_DEPLOY_CHECKLIST.md`
- One-shot provisioning:
  - `docs/PRODUCTION_ONE_SHOT_DEPLOY.md`
- Operations + automation:
  - `docs/PRODUCTION_OPERATIONS_RUNBOOK.md`
  - `docs/PRODUCTION_AUTOMATION_SCHEDULE.md`

## 6) Next Enterprise Step (No Legacy Break)
- Keep `server/server.js` live.
- Gradually split each module into `server/routes/* + controllers/*` and mount in one app bootstrap file.
- Keep same API contracts so frontend never breaks.
- Optional: enable MongoDB mode via env toggle while retaining file DB fallback.
