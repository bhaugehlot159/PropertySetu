# Production Feature Backend Map

This map shows how requested real features are handled in backend APIs (professional mode).

## Run Professional Backend

```bash
cd backend
npm run pro:start
```

Base URL: `http://localhost:5200/api/v3`

## Feature -> API Mapping

1. User dashboard data
- `GET /health`
- `GET /properties`
- `GET /subscriptions/me`
- `GET /chat/mine`
- `GET /uploads/mine`
- `GET /wishlist`
- `GET /visits/mine`
- `GET /notifications/mine`

2. OTP login
- `POST /auth/request-otp`
- `POST /auth/login-otp`

3. Verification system
- `POST /owner-verification/request`
- `GET /owner-verification/me`
- `GET /owner-verification` (admin)
- `POST /owner-verification/:requestId/decision` (admin)
- `POST /properties/:propertyId/verify` (admin)
- Property response now includes `verifiedByPropertySetu` and `verifiedBadge`

4. Photo + video upload
- `POST /uploads/property-media`
- `GET /uploads/mine`
- `POST /properties/professional` (strict professional validation)
- `PATCH /properties/:propertyId/professional` (strict professional validation)
- `POST /properties/auto-description` (server auto description preview)
- `GET /properties/:propertyId/private-docs` (owner/admin private document access)
- Public property APIs automatically mask private document details for non-owner users

5. Subscription + payment-ready flow
- `GET /subscriptions/plans`
- `POST /subscriptions/payment/order`
- `POST /subscriptions/payment/verify`
- `POST /subscriptions`
- `GET /subscriptions/me`
- `GET /subscriptions` (admin)
- Payment order/verify (v2 bridge): `/api/v2/payments/*`
- Featured listing activation is handled inside `/subscriptions` when `planType=featured`
- Property care monthly plans are exposed via `/subscriptions/plans`
- `planType=care` now auto-creates a property care request for monthly service lifecycle
- Payment verify API now returns `paymentProof` (used when strict payment proof mode is enabled)

6. In-app chat
- `POST /chat/send`
- `GET /chat/:propertyId`
- `GET /chat/mine`
- `GET /chat/:propertyId/whatsapp-link`
- Buyer -> seller direct flow is automatic on `POST /chat/send`
- Seller/admin can pass `receiverId` in `POST /chat/send` for reply threads

7. Customer smart filter system
- `GET /properties?minPrice=&maxPrice=`
- `GET /properties?bhk=&furnishing=&constructionStatus=&loanAvailable=`
- `GET /properties?verifiedOnly=true`
- `GET /properties?centerLat=&centerLng=&radiusKm=`

8. Wishlist + compare
- `POST /wishlist/:propertyId`
- `DELETE /wishlist/:propertyId`
- `GET /wishlist`
- `GET /wishlist/compare?propertyIds=<id1,id2,id3>`
- `GET /properties/compare?propertyIds=<id1,id2,id3>`
- `POST /properties/compare` with body `{ "propertyIds": ["id1","id2","id3"] }`

9. Property visit booking + owner notifications
- `POST /properties/:propertyId/visit`
- `POST /visits` (propertyId in body)
- `GET /visits/mine`
- `GET /visits/owner`
- `GET /visits` (admin)
- `POST /visits/:visitId/status` (owner/admin)
- `GET /notifications/mine`
- `POST /notifications/:notificationId/read`
- `POST /notifications/read-all`

10. AI pricing
- `POST /ai/pricing-suggestion`
- `POST /ai/smart-pricing`
- `GET /ai/emi-calculator?loanAmount=&annualRatePercent=&tenureYears=`
- `POST /ai/emi-calculator`

11. Fraud detection
- `POST /ai/fraud-scan`
- `POST /ai/fake-listing-detection`

12. Similar property recommendation
- `GET /ai/recommendations`
- `GET /ai/similar-properties`

13. Map integration
- `GET /properties`
- `GET /properties/:propertyId`
- Property response includes `mapView.googleMapsUrl`, `mapView.googleDirectionsUrl`, `mapView.googleEmbedUrl`

14. City-wise SEO structure
- `GET /seo/city-structure`

15. Property care subscription workflow
- `POST /property-care/requests`
- `GET /property-care/requests/me`
- `GET /property-care/requests` (admin)
- `POST /property-care/requests/:requestId/status` (admin)

16. System readiness + architecture checks
- `GET /system/stack-options`
- `GET /system/stack-readiness`
- `GET /system/architecture-plan`
- `GET /system/core-systems`
- `GET /system/execution-plan`

## Notes

- Legacy working APIs remain untouched.
- Professional APIs are additive and MongoDB-ready.
- If MongoDB is unavailable, APIs gracefully run in memory mode for continuity.
- If storage/payment credentials are not configured and `NODE_ENV` is not `production`, APIs use development fallback mode for local testing.
- Strict professional upload flow enforces:
  - Minimum 5 photos
  - 1 short video
  - Private docs required
  - Auto-generated description when blank
- Smart filter supports price, BHK, furnishing, construction status, loan flag, verified-only and geo radius filters.
- Wishlist compare supports up to 3 properties with compare table output.
- Visit booking creates owner notification and status-update notification to customer.
- Verified badge is controlled by admin via `/properties/:propertyId/verify` and shown through `verifiedBadge` payload in property APIs.
