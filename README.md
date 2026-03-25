# PropertySetu

## Quick Start (Fully Running)

### 1) Run website + API
```bash
cd server
npm install
npm start
```

Open:
- Frontend: `http://localhost:5000/index.html`
- API info: `http://localhost:5000/api`
- Health check: `http://localhost:5000/api/health`

## Secure Auth Demo (Customer/Admin)
Demo OTP for both roles: `123456`

Login now supports **email OR mobile number** for both customer and admin roles. Signup includes basic fake-account detection (disposable email, repeated digits mobile, weak obvious passwords).

Register/Login flow is automatic from UI modal. You can also test via API:

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "content-type: application/json" \
  -d '{"name":"Demo Customer","email":"customer@propertysetu.in","mobile":"9876543210","password":"customer123","role":"customer","otp":"123456"}'
```

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "content-type: application/json" \
  -d '{"mobile":"9876543210","password":"customer123","role":"customer","otp":"123456"}'
```

## Sealed Bid Demo API
Submit bid (requires customer token):
```bash
curl -X POST http://localhost:5000/api/sealed-bids \
  -H "content-type: application/json" \
  -H "authorization: Bearer <customer_token>" \
  -d '{"propertyId":"villa-bhuwana","propertyTitle":"4BHK Premium Villa • Bhuwana","amount":21000000}'
```

Reveal winners (requires admin token):
```bash
curl -H "authorization: Bearer <admin_token>" \
  http://localhost:5000/api/sealed-bids/reveal
```

## Environment
Create `.env` inside `server/` if needed:
```env
PORT=5000
JWT_SECRET=your-secure-jwt-secret
```

## Legal Pages
Available in `/legal`:
- Terms & Conditions
- Privacy Policy
- Refund Policy
- Disclaimer
- Service Agreement


## Production Blueprint
Detailed non-destructive production roadmap: `PRODUCTION_GRADE_BLUEPRINT.md`

## Real Backend Structure Plan
Production-level backend + database-ready architecture map: `docs/REAL_BACKEND_STRUCTURE_PLAN.md`

## Production Feature Backend Map
Requested real features to backend endpoint mapping (OTP, upload, verification, chat, AI, property-care, city SEO): `docs/PRODUCTION_FEATURE_BACKEND_MAP.md`

## Direct Production Deploy
Domain + PM2 + Nginx + SSL checklist: `docs/PRODUCTION_DEPLOY_CHECKLIST.md`

## One-Shot Server Provision
Fast single-command VPS setup: `docs/PRODUCTION_ONE_SHOT_DEPLOY.md`

Production helper scripts:
- `deploy/scripts/preflight.sh`
- `deploy/scripts/provision-ubuntu.sh`
- `deploy/scripts/deploy.sh`
- `deploy/scripts/verify-live.sh`
- `deploy/scripts/backup.sh`
- `deploy/scripts/rollback.sh`
- `deploy/scripts/health-watch.sh`
- `deploy/scripts/install-ops-cron.sh`
- `deploy/scripts/uninstall-ops-cron.sh`

Operations runbook:
- `docs/PRODUCTION_OPERATIONS_RUNBOOK.md`
- `docs/PRODUCTION_AUTOMATION_SCHEDULE.md`

## Codex PR workflow note
If Codex shows this message:
- `Codex does not currently support updating PRs that are updated outside of Codex.`

Use this flow:
1. Commit new changes on the same branch.
2. Create a **new PR** from Codex instead of trying to update the old PR.
3. Close/supersede the previous PR in GitHub if needed.
## Production Blueprint
Detailed production roadmap/documentation is available at `PRODUCTION_BLUEPRINT.md`.


```bash
curl -X POST http://localhost:5000/api/auth/logout \
  -H "authorization: Bearer <token>"
```


## Connected Demo Flow (All major folders linked)
1. Add property from `add-property.html` **or** `seller-dashboard.html`.
2. See same data on `dashboard.html` (user view).
3. Approve/reject from `admin-dashboard.html` (admin view).
4. Status updates sync via shared browser storage key: `propertySetu:listings`.

## Folder-wise Layout (New)
- Compact Home: `/index.html`
- All features hub: `/folders/common/all-features.html`
- Customer folder: `/folders/customer/customer-features.html`
- Admin folder: `/folders/admin/admin-features.html`

Home page now keeps only compulsory items; detailed modules are linked folder-wise without deleting old pages.
