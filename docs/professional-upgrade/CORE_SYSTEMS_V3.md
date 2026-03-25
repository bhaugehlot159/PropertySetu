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
- `POST /api/v3/properties/professional` (seller/admin, strict professional rules)
- `POST /api/v3/properties/auto-description` (seller/admin, preview auto-description)
- `PATCH /api/v3/properties/:propertyId` (owner/admin)
- `PATCH /api/v3/properties/:propertyId/professional` (owner/admin, strict professional rules)
- `DELETE /api/v3/properties/:propertyId` (owner/admin)
- `POST /api/v3/properties/:propertyId/verify` (admin)
- `POST /api/v3/properties/:propertyId/feature` (admin)

Professional upload rules (strict endpoints always enforce):

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

Subscription payload supports:

- `planType` (`featured | care | verification | agent | subscription`)
- `propertyId` (required for featured plans)
- Optional payment refs: `paymentProvider`, `paymentOrderId`, `paymentId`, `paymentStatus`

Featured listing behavior:

- On featured subscription, target property is auto-marked `featured: true`
- `featuredUntil` is auto-derived from subscription duration

### Health

- `GET /api/v3/health`

## Business Features

- Verified badge: admin verification updates property verification metadata and badge eligibility.
- Payment bridge: Razorpay order/verify endpoints remain on `/api/v2/payments/*` and are bridged by live adapter routes `/payments/order` and `/payments/verify`.
- AI phase 2: smart pricing, recommendations, and fraud scan continue through `/api/ai/*` + `/api/recommendations`.

## Security

- Passwords are hashed with `bcryptjs`.
- JWT auth is enabled for protected routes.
- Role checks are applied on admin/seller operations.
- If MongoDB is unavailable, system runs in memory mode so APIs stay live.
