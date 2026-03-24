# PropertySetu Professional Upgrade (Non-Destructive)

This upgrade adds a modern React + Node/Express layer without editing legacy files.

## What Was Added

- `client/` React (Vite) app layer using:
  - `pages/`
  - `components/`
  - `services/`
  - `utils/`
- `server/professional-server.js` and modular pro API files:
  - `controllers/`
  - `models/`
  - `routes/`
  - `middleware/`
  - `config/`
- `database/pro-seed/properties.seed.json` sample records.

## Local Run

### 1) Start professional API server

```bash
cd server
node professional-server.js
```

Health:

`http://localhost:5200/api/v2/health`

### 2) Start React client

```bash
cd client
npm install
npm run dev
```

Frontend:

`http://localhost:5174`

Legacy UI through pro server bridge:

`http://localhost:5200/legacy/index.html`

## Environment Setup

- Copy `server/.env.pro.example` to `server/.env.pro`
- Copy `client/.env.example` to `client/.env`

Saved defaults already added:

- `server/.env.pro`
- `client/.env`

## API Endpoints (Pro)

- `GET /api/v2/health`
- `GET /api/v2/properties`
- `GET /api/v2/properties/:propertyId`
- `POST /api/v2/properties`
- `POST /api/v2/storage/signature`
- `POST /api/v2/payments/order`
- `POST /api/v2/payments/verify`

Legacy bridge endpoints for old UI:

- `/api/health`
- `/api/system/capabilities`
- `/api/system/live-roots`
- `/api/properties` (+ patch/delete/approve/feature/visit)
- `/api/uploads/property-media`
- `/api/ai/*` + `/api/insights/locality` + `/api/recommendations`

## Deploy (Vercel + Render)

### Frontend on Vercel

- Root directory: `client`
- Build command: `npm run build`
- Output directory: `dist`
- Env:
  - `VITE_API_BASE_URL=https://<your-render-domain>/api/v2`

`client/vercel.json` already includes SPA rewrite.

### Backend on Render

- Root directory: `server`
- Build command: `npm install`
- Start command: `node professional-server.js`
- Add env vars from `server/.env.pro.example`

`server/render.yaml` is included for quick service creation.

## Storage & Payment Notes

- Cloudinary mode works with server-signed upload parameters.
- Razorpay order and signature verification routes are production pattern ready.
- If MongoDB is temporarily unavailable, properties API runs in memory mode (degraded but live).
