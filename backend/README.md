# PropertySetu Backend (Production-Ready Layer)

This folder is a clean backend launch layer.  
No legacy code is removed; existing working flow remains intact.

## Run Modes

### 1) Legacy live mode (current default website flow)
```bash
cd backend
npm install
npm start
```
Starts: `server/server.js`

### 2) Professional mode (real backend + DB-ready APIs)
```bash
cd backend
npm install
npm run pro:start
```
Starts: `server/professional-server.js`

## Professional API Base

- `http://localhost:5200/api/v3/health`
- `http://localhost:5200/api/v3/auth/*`
- `http://localhost:5200/api/v3/properties/*`
- `http://localhost:5200/api/v3/reviews/*`
- `http://localhost:5200/api/v3/subscriptions/*`
- `http://localhost:5200/api/v3/chat/*`
- `http://localhost:5200/api/v3/uploads/*`
- `http://localhost:5200/api/v3/owner-verification/*`
- `http://localhost:5200/api/v3/property-care/*`
- `http://localhost:5200/api/v3/ai/*`
- `http://localhost:5200/api/v3/seo/city-structure`
- `http://localhost:5200/api/v3/system/architecture-plan`
- `http://localhost:5200/api/v3/system/stack-readiness`

## Environment

Copy and configure:

```bash
cp .env.production.example ../server/.env.pro
```

Then set real values for MongoDB, Razorpay, and storage keys.

## Preflight (Production Check)

Run this before deployment:

```bash
cd backend
npm run pro:preflight
```

This verifies:
- Mongo URI
- JWT/Admin auth secrets
- Cloudinary or S3 config
- Razorpay keys
- CORS domain config
- Vercel/Render config files
