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
- API health: `http://localhost:5000/api`
- Health check: `http://localhost:5000/api/health`

### 2) Sealed Bid Demo API
Submit bid:
```bash
curl -X POST http://localhost:5000/api/sealed-bids \
  -H "content-type: application/json" \
  -d '{"propertyId":"villa-bhuwana","propertyTitle":"4BHK Premium Villa • Bhuwana","amount":21000000,"bidderName":"Demo Buyer"}'
```

Reveal winners (admin):
```bash
curl "http://localhost:5000/api/sealed-bids/reveal?adminKey=propertysetu-admin"
```

> Change admin key with `.env` in `server/`:
```env
PORT=5000
ADMIN_KEY=your-secure-admin-key
```

## Codex PR workflow note
If Codex shows this message:
- `Codex does not currently support updating PRs that are updated outside of Codex.`

Use this flow:
1. Commit new changes on the same branch.
2. Create a **new PR** from Codex instead of trying to update the old PR.
3. Close/supersede the previous PR in GitHub if needed.
