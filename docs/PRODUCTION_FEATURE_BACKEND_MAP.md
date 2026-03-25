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

2. OTP login
- `POST /auth/request-otp`
- `POST /auth/login-otp`

3. Verification system
- `POST /owner-verification/request`
- `GET /owner-verification/me`
- `GET /owner-verification` (admin)
- `POST /owner-verification/:requestId/decision` (admin)
- `POST /properties/:propertyId/verify` (admin)

4. Photo + video upload
- `POST /uploads/property-media`
- `GET /uploads/mine`
- `POST /properties/professional` (strict professional validation)
- `PATCH /properties/:propertyId/professional` (strict professional validation)
- `POST /properties/auto-description` (server auto description preview)

5. Subscription + payment-ready flow
- `POST /subscriptions`
- `GET /subscriptions/me`
- `GET /subscriptions` (admin)
- Payment order/verify (v2 bridge): `/api/v2/payments/*`

6. In-app chat
- `POST /chat/send`
- `GET /chat/:propertyId`
- `GET /chat/mine`

7. AI pricing
- `POST /ai/pricing-suggestion`

8. Fraud detection
- `POST /ai/fraud-scan`

9. City-wise SEO structure
- `GET /seo/city-structure`

10. Property care subscription workflow
- `POST /property-care/requests`
- `GET /property-care/requests/me`
- `GET /property-care/requests` (admin)
- `POST /property-care/requests/:requestId/status` (admin)

11. System readiness + architecture checks
- `GET /system/stack-readiness`
- `GET /system/architecture-plan`

## Notes

- Legacy working APIs remain untouched.
- Professional APIs are additive and MongoDB-ready.
- If MongoDB is unavailable, APIs gracefully run in memory mode for continuity.
- Strict professional upload flow enforces:
  - Minimum 5 photos
  - 1 short video
  - Private docs required
  - Auto-generated description when blank
