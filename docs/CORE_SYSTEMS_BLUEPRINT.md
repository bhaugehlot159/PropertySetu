# PropertySetu Core Systems Blueprint

Legacy code is preserved. No old working module removed.

## MongoDB Structure

### Users Collection
- `name`
- `email`
- `phone`
- `password` (hashed)
- `role` (`buyer/seller/admin`)
- `verified` (`true/false`)
- `subscriptionPlan`
- `createdAt`

### Properties Collection
- `title`
- `description`
- `city`
- `location`
- `type` (`buy/rent`)
- `category` (`house/plot/commercial`)
- `price`
- `size`
- `images[]`
- `video`
- `ownerId`
- `verified`
- `featured`
- `createdAt`

### Reviews Collection
- `propertyId`
- `userId`
- `rating`
- `comment`

### Subscriptions Collection
- `userId`
- `planName`
- `amount`
- `startDate`
- `endDate`

## Core Systems We Build

1. Authentication System
- OTP login
- JWT token
- Role based access

2. Property Upload System
- Minimum 5 photos validation
- 1 video upload
- Private document upload flow
- Auto description generator

3. Verified Badge System
- Admin approval based verification
- Shows `Verified by PropertySetu` badge

4. Subscription and Payment
- Razorpay integration
- Featured listing flow
- Property care monthly package

5. AI Features (Phase 2)
- Smart pricing suggestion
- Similar property recommendation
- Fake listing detection

## Live Endpoints

- Professional API:
  - `GET /api/v3/system/database-structure`
  - `GET /api/v3/system/core-systems`
- Legacy API:
  - `GET /api/system/core-systems`
