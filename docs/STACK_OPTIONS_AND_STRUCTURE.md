# PropertySetu Stack Options and Professional Folder Structure

No legacy code removed. Existing working flows remain intact.

## Option 1 (Best and Modern)
- Frontend: React / Next.js
- Backend: Node.js + Express
- Database: MongoDB
- File Storage: Cloudinary / AWS S3
- Hosting: Vercel + Render
- Payment: Razorpay

## Option 2 (Easier for Beginner)
- Frontend: HTML + CSS + JS
- Backend: Node.js
- Database: MongoDB
- Admin panel: Simple admin panel

If future app build is planned, Option 1 is best.

## Complete Professional Folder Structure

```text
PropertySetu/
|
|-- client/              # Frontend (React)
|   |-- pages/
|   |-- components/
|   |-- services/
|   `-- utils/
|
|-- server/              # Backend
|   |-- controllers/
|   |-- models/
|   |-- routes/
|   |-- middleware/
|   `-- config/
|
|-- database/
|
`-- package.json
```

## Live Endpoints for This Structure

- Professional API: `GET /api/v3/system/stack-options`
- Legacy API: `GET /api/system/stack-options`

Both return:
- Option 1 and Option 2 stack details
- Folder tree
- Runtime folder presence check
