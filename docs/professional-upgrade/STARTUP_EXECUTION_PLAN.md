# PropertySetu Startup Execution Plan (Step 1 to 7)

Goal: build and run startup-grade platform without deleting legacy code.

## Step 1: Backend Setup

- Use professional server entry: `server/professional-server.js`
- Run:
  - `cd backend`
  - `npm install`
  - `npm run pro:start`
- Health checks:
  - `GET /api/v2/health`
  - `GET /api/v3/health`
  - `GET /api/v3/system/stack-options`
  - `GET /api/v3/system/execution-plan`

## Step 2: Database Connect

- Configure `server/.env.pro`:
  - `MONGO_URI=...`
  - `PRO_PORT=5200`
- If MongoDB is down, system still runs in memory fallback mode.

## Step 3: Auth System

- v3 auth:
  - `POST /api/v3/auth/register`
  - `POST /api/v3/auth/login`
  - `POST /api/v3/auth/request-otp`
  - `POST /api/v3/auth/login-otp`
- JWT enforced on protected routes.
- Role checks:
  - seller/admin for property create
  - admin for verification actions

## Step 4: Property CRUD

- Core CRUD:
  - `GET /api/v3/properties`
  - `POST /api/v3/properties`
  - `POST /api/v3/properties/professional`
  - `PATCH /api/v3/properties/:propertyId`
  - `PATCH /api/v3/properties/:propertyId/professional`
  - `DELETE /api/v3/properties/:propertyId`
- Admin moderation:
  - `POST /api/v3/properties/:propertyId/verify`
  - `POST /api/v3/properties/:propertyId/feature`
- Verified badge appears after admin verification metadata update.

## Step 5: File Upload

- Professional upload validation (v3):
  - Minimum 5 photos
  - 1 short video (30-60 sec)
  - Private docs metadata required
- Media upload API (legacy-compatible live flow):
  - `POST /api/uploads/property-media`

## Step 6: Subscription and Payment

- v3 subscriptions:
  - `GET /api/v3/subscriptions/plans`
  - `POST /api/v3/subscriptions/payment/order`
  - `POST /api/v3/subscriptions/payment/verify`
  - `POST /api/v3/subscriptions`
  - `GET /api/v3/subscriptions/me`
- Featured listing:
  - pass `planId=featured-7` or `planId=featured-30` + `propertyId`
  - property auto-featured with `featuredUntil`
- Property care:
  - monthly care plans via `/api/v3/subscriptions/plans`
  - request flow via `/api/v3/property-care/requests`
- Razorpay:
  - `POST /api/v3/subscriptions/payment/order`
  - `POST /api/v3/subscriptions/payment/verify`
  - (legacy bridge also available)
  - `POST /api/v2/payments/order`
  - `POST /api/v2/payments/verify`

## Step 7: AI Features (Phase 2)

- Smart pricing:
  - `POST /api/v3/ai/pricing-suggestion`
  - `POST /api/v3/ai/smart-pricing`
- Similar recommendation:
  - `GET /api/v3/ai/recommendations`
  - `GET /api/v3/ai/similar-properties`
- Fake listing detection:
  - `POST /api/v3/ai/fraud-scan`
  - `POST /api/v3/ai/fake-listing-detection`

## Step Check Commands

- `npm run pro:preflight`
- `npm run pro:db:contract`
- `npm run pro:steps:check`

## Frontend Live Note

- `js/live-api.js` and `frontend/js/live-api.js` provide compatibility bridge:
  - v3 core systems first
  - fallback to legacy `/api` where required
