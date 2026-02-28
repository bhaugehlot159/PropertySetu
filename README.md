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

Register/Login flow is automatic from UI modal. You can also test via API:

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "content-type: application/json" \
  -d '{"name":"Demo Customer","email":"customer@propertysetu.in","password":"customer123","role":"customer","otp":"123456"}'
```

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "content-type: application/json" \
  -d '{"email":"customer@propertysetu.in","password":"customer123","role":"customer","otp":"123456"}'
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

## Codex PR workflow note
If Codex shows this message:
- `Codex does not currently support updating PRs that are updated outside of Codex.`

Use this flow:
1. Commit new changes on the same branch.
2. Create a **new PR** from Codex instead of trying to update the old PR.
3. Close/supersede the previous PR in GitHub if needed.
