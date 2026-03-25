# PROPERTYSETU - Option 2 (Beginner-Friendly, Professional Setup)

No old code deleted. No existing working flow replaced.

## Stack (Option 2)
- Frontend: HTML + CSS + JS
- Backend: Node.js + Express
- Database: MongoDB (with safe local JSON fallback for continuity)
- Admin Panel: `admin-simple.html` + existing `admin-dashboard.html`

## Live Run (Root)
```bash
npm run option2:start
```

Open:
- `http://localhost:5000`
- `http://localhost:5000/api`
- `http://localhost:5000/admin-simple`

## Professional Folder Layout
```text
PropertySetu/
├── client/                 # Option 1 React path (future app growth)
│   ├── pages/
│   ├── components/
│   ├── services/
│   └── utils/
├── server/                 # Option 2 backend live system
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   └── config/
├── database/               # DB data/runtime snapshots
└── package.json            # Root run commands
```

## MongoDB Collection Structure
### Users
- `name`
- `email`
- `phone/mobile`
- `password (hashed)`
- `role (buyer/seller/admin etc.)`
- `verified`
- `subscriptionPlan`
- `createdAt`

### Properties
- `title`
- `description`
- `city`
- `location`
- `type (buy/rent/lease/mortgage etc.)`
- `category (house/plot/commercial etc.)`
- `price`
- `size`
- `images[]`
- `video`
- `ownerId`
- `verified`
- `featured`
- `createdAt`

### Reviews
- `propertyId`
- `userId`
- `rating`
- `comment`

### Subscriptions
- `userId`
- `planName`
- `amount`
- `startDate`
- `endDate`

## Simple Admin Panel (Beginner Mode)
`/admin-simple` supports:
- OTP request + admin login
- admin overview metrics
- pending property approvals
- owner verification decisions
- user block/unblock controls

This panel uses existing backend APIs, so old system remains intact.

## Mongo Contract Verification (Professional Check)
Run:
```bash
npm run pro:db:contract
```

Live endpoint (professional server mode):
- `GET /api/v3/system/database-structure`
