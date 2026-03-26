# Customer Advanced Features (Core v3)

Legacy code is preserved. Existing working APIs are unchanged.

Base URL: `http://localhost:5200/api/v3`

## Step 1 to Step 7 Status

1. Backend setup: ready (`server/professional-server.js`)
2. Database connect: MongoDB + memory fallback ready
3. Auth system: OTP + JWT + role-based ready
4. Property CRUD: ready
5. File upload: ready (professional validation + private docs)
6. Subscription: ready (Razorpay + featured + care package flow)
7. AI: ready (pricing + recommendation + fake listing detection)

## Customer Feature APIs

### 1) Smart Filter System
- `GET /properties?minPrice=5000000&maxPrice=9000000`
- `GET /properties?bhk=3&furnishing=furnished&constructionStatus=ready-to-move`
- `GET /properties?loanAvailable=true&verifiedOnly=true`
- `GET /properties?centerLat=24.58&centerLng=73.71&radiusKm=5`

Filter keys:
- `minPrice`, `maxPrice`
- `bhk`
- `furnishing` (`furnished|semi|unfurnished`)
- `constructionStatus` (`ready-to-move|under-construction`)
- `loanAvailable` (`true|false`)
- `verifiedOnly` (`true|false`)
- `centerLat`, `centerLng`, `radiusKm`

### 2) Wishlist / Save Property
- `POST /wishlist/:propertyId`
- `DELETE /wishlist/:propertyId`
- `GET /wishlist`

### 3) Property Compare (2 to 3 properties)
- `GET /wishlist/compare?propertyIds=<id1,id2,id3>`
- If `propertyIds` not passed, API tries top wishlist properties.
- `GET /properties/compare?propertyIds=<id1,id2,id3>`
- `POST /properties/compare` with `propertyIds` in body for explicit compare.

### 4) Property Visit Booking
- `POST /properties/:propertyId/visit`
- `POST /visits` (with `propertyId` in body)

Request payload example:
```json
{
  "preferredAt": "2026-03-28T10:30:00.000Z",
  "note": "Sunday morning visit"
}
```

### 5) Visit Tracking + Notification
- `GET /visits/mine` (customer)
- `GET /visits/owner` (seller/owner side)
- `GET /visits` (admin)
- `POST /visits/:visitId/status` (owner/admin)
- `GET /notifications/mine`
- `POST /notifications/:notificationId/read`
- `POST /notifications/read-all`

### 6) Direct Chat + WhatsApp Handoff
- `POST /chat/send`
- `GET /chat/:propertyId`
- `GET /chat/mine`
- `GET /chat/:propertyId/whatsapp-link`

Notes:
- Buyer chat send automatically targets property owner.
- Seller/admin replies can include `receiverId`.
- Direct personal contact in message body is blocked by moderation rules.

### 7) EMI Calculator
- `GET /ai/emi-calculator?loanAmount=3500000&annualRatePercent=8.6&tenureYears=20`
- `POST /ai/emi-calculator`

Response includes:
- `emi.monthlyEmi`
- `emi.totalInterest`
- `emi.totalAmount`

### 8) Map Integration + Verified Badge
- `GET /properties`
- `GET /properties/:propertyId`

Property response includes:
- `mapView.googleMapsUrl`
- `mapView.googleDirectionsUrl`
- `mapView.googleEmbedUrl`
- `verifiedBadge.show`
- `verifiedBadge.label`

## Professional Upload Notes (for filter-ready property data)

When creating/updating properties in professional mode:
- `bhk`
- `furnishing`
- `constructionStatus`
- `loanAvailable`
- `coordinates` (`lat`, `lng`)

can be provided to improve smart filter accuracy.
