# PropertySetu Startup Execution Plan (Step 1 to 7)

Goal: build and run startup-grade platform without deleting legacy code.

## Step 1: Backend Setup

- Use professional server entry: `server/professional-server.js`
- Run:
  - `cd server`
  - `npm install`
  - `npm run pro:start`
- Health checks:
  - `GET /api/v2/health`
  - `GET /api/v3/health`

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
  - `PATCH /api/v3/properties/:propertyId`
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
  - `POST /api/v3/subscriptions`
  - `GET /api/v3/subscriptions/me`
- Featured listing:
  - pass `planType=featured` + `propertyId`
  - property auto-featured with `featuredUntil`
- Property care:
  - monthly care plans via subscription + care request flow
- Razorpay:
  - `POST /api/v2/payments/order`
  - `POST /api/v2/payments/verify`

## Step 7: AI Features (Phase 2)

- Smart pricing:
  - `POST /api/ai/pricing-suggestion`
- Similar recommendation:
  - `GET /api/recommendations`
  - `GET /api/ai/recommendations`
- Fake listing detection:
  - `POST /api/ai/fraud-scan`

## Frontend Live Note

- `js/live-api.js` and `frontend/js/live-api.js` provide compatibility bridge:
  - v3 core systems first
  - fallback to legacy `/api` where required
