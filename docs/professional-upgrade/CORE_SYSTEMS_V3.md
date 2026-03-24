# Core Systems v3 (Mongo + Memory Fallback)

Professional additive API layer is available at:

`/api/v3`

## Database Collections

### users

- `name`
- `email`
- `phone`
- `password` (hashed)
- `role` (`buyer | seller | admin`)
- `verified`
- `subscriptionPlan`
- `createdAt`

### properties

- `title`
- `description`
- `city`
- `location`
- `type` (`buy | rent`)
- `category` (`house | plot | commercial`)
- `price`
- `size`
- `images[]`
- `video`
- `ownerId`
- `verified`
- `featured`
- `createdAt`

### reviews

- `propertyId`
- `userId`
- `rating`
- `comment`
- `createdAt`

### subscriptions

- `userId`
- `planName`
- `amount`
- `startDate`
- `endDate`
- `createdAt`

## Core Endpoints

### Auth

- `POST /api/v3/auth/register`
- `POST /api/v3/auth/login`
- `POST /api/v3/auth/request-otp`
- `POST /api/v3/auth/login-otp`
- `GET /api/v3/auth/me` (auth)
- `GET /api/v3/auth/users` (admin)
- `PATCH /api/v3/auth/users/:userId/verify` (admin)

### Properties

- `GET /api/v3/properties`
- `GET /api/v3/properties/:propertyId`
- `POST /api/v3/properties` (seller/admin)
- `PATCH /api/v3/properties/:propertyId` (owner/admin)
- `DELETE /api/v3/properties/:propertyId` (owner/admin)
- `POST /api/v3/properties/:propertyId/verify` (admin)
- `POST /api/v3/properties/:propertyId/feature` (admin)

Professional upload rules (applied when professional payload fields are present):

- Minimum `5` photos
- `1` short video (30-60 sec)
- Private document metadata required
- Auto description generated server-side when description is blank

### Reviews

- `GET /api/v3/reviews/:propertyId`
- `POST /api/v3/reviews` (auth)

### Subscriptions

- `POST /api/v3/subscriptions` (auth)
- `GET /api/v3/subscriptions/me` (auth)
- `GET /api/v3/subscriptions` (admin)

### Health

- `GET /api/v3/health`

## Security

- Passwords are hashed with `bcryptjs`.
- JWT auth is enabled for protected routes.
- Role checks are applied on admin/seller operations.
- If MongoDB is unavailable, system runs in memory mode so APIs stay live.
