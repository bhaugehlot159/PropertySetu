# V3 Live UI QA Checklist

Updated: March 26, 2026

## Scope

This checklist validates the new V3 live tools added to:
- `property-details.html`
- `user-dashboard.html`
- `seller-dashboard.html`
- `admin-dashboard.html`

## Pre-Flight

1. Start backend:
   - `npm --prefix server run pro:start`
2. Confirm health:
   - `GET http://localhost:5200/api/v3/health`
3. Login sessions available:
   - buyer, seller, admin

## Core Data Setup

1. Seller creates at least 2 properties in Udaipur with valid media/doc payload.
2. Admin verifies at least 1 property via `/api/v3/properties/:propertyId/verify`.
3. Buyer sends at least 1 chat message on one property.

## Property Details Page QA

Path: `/property-details.html?id=<propertyId>`

1. Verified badge chip reflects admin verification state.
2. Map view section shows:
   - Map query text
   - Open Map link
   - Directions link
   - Embedded map iframe
3. Chat section:
   - Message send works
   - Refresh shows latest messages
   - WhatsApp handoff opens valid `wa.me` link
4. Compare section:
   - Enter 2-3 IDs and compare table renders
5. EMI section:
   - Monthly EMI, total interest, total amount are shown
6. Mobile check (<768px):
   - Action buttons stack cleanly
   - EMI inputs stack to one column
   - No horizontal overflow

## User Dashboard QA

Path: `/user-dashboard.html`

1. V3 panel appears under existing dashboard blocks.
2. Property dropdown/input sync works.
3. Meta + chat load for selected property.
4. Send chat and WhatsApp handoff work.
5. Compare and EMI tools work.
6. Mobile layout remains readable and usable.

## Seller Dashboard QA

Path: `/seller-dashboard.html`

1. V3 panel appears and does not break existing seller flows.
2. Seller property options load from live/local list.
3. Chat refresh/send works on selected property.
4. Compare and EMI tools work.
5. Mobile layout remains usable.

## Admin Dashboard QA

Path: `/admin-dashboard.html`

1. Admin V3 panel appears below approved listings section.
2. Admin can load property meta + map.
3. `Mark Verified Badge` button updates property badge state.
4. Admin chat send + refresh works.
5. Admin WhatsApp handoff link works.
6. Compare and EMI tools work.
7. Mobile layout remains usable.

## API Assertions (Must Pass)

1. `GET /api/v3/properties/:propertyId` returns:
   - `verifiedBadge`
   - `mapView.googleMapsUrl`
2. `GET /api/v3/chat/:propertyId` returns non-empty after send.
3. `GET /api/v3/chat/:propertyId/whatsapp-link` returns URL.
4. `GET /api/v3/properties/compare?propertyIds=id1,id2` returns `compareTable`.
5. `GET /api/v3/ai/emi-calculator?...` returns EMI breakdown.

## Exit Criteria

- No JS console errors from new V3 modules.
- All page sections load with valid fallback messages when token/data missing.
- New UI is additive and old features continue to work.
