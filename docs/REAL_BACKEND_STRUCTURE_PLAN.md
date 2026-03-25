# PROPERTYSETU – Real Backend Structure Plan (Option 1)

Legacy code preserved. No old flow removed or deleted.

## 1) Recommended Stack (Option 1)
- Frontend: React / Next.js
- Backend: Node.js + Express
- Database: MongoDB
- File Storage: Cloudinary / AWS S3
- Hosting: Vercel + Render
- Payment: Razorpay

## 2) Current Live Implementation Mapping
- Frontend (React): `client/` (Vite React app)
- Frontend fallback (existing multipage): `frontend/` + root html pages
- Backend:
  - Legacy live API: `server/server.js` (`/api/*`)
  - Professional API: `server/professional-server.js` (`/api/v2/*` + `/api/v3/*`)
- Database:
  - Primary path: MongoDB (`server/v3/models/*`, `server/config/proDatabase.js`)
  - Safe fallback: memory mode when Mongo unavailable
- File upload:
  - v2 bridge: `/api/uploads/property-media`
  - v3 core: `/api/v3/uploads/property-media`
- Payment:
  - Razorpay order/verify via `/api/v2/payments/*`

## 3) Professional v3 API Coverage
- Auth + OTP:
  - `POST /api/v3/auth/register`
  - `POST /api/v3/auth/login`
  - `POST /api/v3/auth/request-otp`
  - `POST /api/v3/auth/login-otp`
  - `GET /api/v3/auth/me`
- Properties:
  - `GET /api/v3/properties`
  - `POST /api/v3/properties`
  - `PATCH /api/v3/properties/:propertyId`
  - `DELETE /api/v3/properties/:propertyId`
  - `POST /api/v3/properties/:propertyId/verify` (admin)
  - `POST /api/v3/properties/:propertyId/feature` (admin)
- Reviews:
  - `POST /api/v3/reviews`
  - `GET /api/v3/reviews/:propertyId`
- Subscriptions:
  - `POST /api/v3/subscriptions`
  - `GET /api/v3/subscriptions/me`
  - `GET /api/v3/subscriptions` (admin)
- In-app chat:
  - `POST /api/v3/chat/send`
  - `GET /api/v3/chat/:propertyId`
  - `GET /api/v3/chat/mine`
- Uploads:
  - `POST /api/v3/uploads/property-media`
  - `GET /api/v3/uploads/mine`
- Owner verification:
  - `POST /api/v3/owner-verification/request`
  - `GET /api/v3/owner-verification/me`
  - `GET /api/v3/owner-verification` (admin)
  - `POST /api/v3/owner-verification/:requestId/decision` (admin)
- Property care:
  - `POST /api/v3/property-care/requests`
  - `GET /api/v3/property-care/requests/me`
  - `GET /api/v3/property-care/requests` (admin)
  - `POST /api/v3/property-care/requests/:requestId/status` (admin)
- AI:
  - `POST /api/v3/ai/pricing-suggestion`
  - `POST /api/v3/ai/description-generate`
  - `POST /api/v3/ai/fraud-scan`
  - `GET /api/v3/ai/market-trend`
  - `GET /api/v3/ai/recommendations`
- City SEO:
  - `GET /api/v3/seo/city-structure`
- System readiness:
  - `GET /api/v3/system/architecture-plan`
  - `GET /api/v3/system/stack-readiness`
  - `GET /api/v3/system/database-structure`

## 4) Feature Mapping (Requested)
- User dashboard: `user-dashboard.html`, `dashboard.html`, React app pages in `client/pages`
- OTP login: `/api/auth/request-otp` + `/api/v3/auth/request-otp`
- Verification system: add-property + `/api/owner-verification/*` + `/api/v3/owner-verification/*`
- Photo + video upload: add-property + `/api/uploads/*` + `/api/v3/uploads/*`
- Subscription + payment: `subscription.html`, `/api/subscriptions/*`, `/api/v2/payments/*`
- In-app chat: `/api/chat/*`, `/api/v3/chat/*`
- AI pricing + fraud detection + recommendations: `/api/ai/*`, `/api/v3/ai/*`
- City-wise SEO structure: `/api/cities/structure`, `/api/v3/seo/city-structure`
- Property care subscription: `/api/property-care/requests`, `/api/v3/property-care/requests`

## 5) Run Commands
- Legacy mode:
```bash
cd backend
npm start
```
- Professional mode:
```bash
cd backend
npm run pro:start
```
- Production preflight:
```bash
cd backend
npm run pro:preflight
```
- MongoDB structure contract check:
```bash
cd backend
npm run pro:db:contract
```

## 6) Deployment Targets
- Frontend: Vercel (`client/vercel.json`)
- Backend: Render (`server/render.yaml`)
- Ops scripts: `deploy/scripts/*`

## 7) Non-Breaking Upgrade Rule
- Existing working modules remain untouched.
- New v3 modules are additive.
- Same project can run legacy and professional API flows side by side.
