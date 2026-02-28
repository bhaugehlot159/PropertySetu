# PropertySetu Production-Grade Blueprint

> Goal: Existing website ko **delete kiye bina** production-grade, reliable, secure aur scalable platform me evolve karna.

## 1) Production ka asli matlab

Production-ready banane ka matlab sirf UI polish nahi hota. Iska matlab hai:
- strong auth + authorization,
- reliable data workflows,
- uploads + payments + moderation working end-to-end,
- trust/safety,
- legal/privacy compliance,
- observability and ops readiness.

Is project ke liye right strategy hai: **incremental modernization (Strangler pattern)**.
- Purani website live rahegi.
- Naye modules gradually add honge.
- Risk low rahega, shipping continuous rahegi.

## 2) Target platform architecture (Buy/Sell/Rent + Property Care)

System ko 4 collaborating blocks me split karo:

1. **Public Marketplace**
   - listings, search/filters, city pages, lead capture.
2. **User Accounts**
   - OTP login, buyer/seller/agent/admin roles, dashboards.
3. **Property Care Operations**
   - service catalog, booking, scheduling, assignment, proof-of-service, subscriptions.
4. **Admin + Trust/Safety Console**
   - moderation, verification approvals, fraud reports, disputes, audit logs.

## 3) Data model that supports real workflows

### Marketplace entities
- **User**: role, phone_verified, verification_state, abuse_flags.
- **PropertyListing**: transaction type, property type, location hierarchy, media, trust flags.
- **Lead/Enquiry**: chat, visit request, phone reveal, WhatsApp/email events.
- **VisitBooking**: slot + status + reminders.
- **Review/Rating**: moderated and scoped feedback.

### Property Care entities
- **ServiceCatalogItem**
- **ServiceOrder** (schedule, assigned staff, completion proof)
- **SubscriptionPlan** (renew/pause/cancel lifecycle)

### Sealed bid module
- bidder data private-by-default.
- admin-only reveal endpoint.
- full audit trail for every reveal/decision action.

## 4) Security and trust baseline (must-have)

- OTP login with strict rate limiting.
- Role and object-level access checks on every sensitive endpoint.
- File upload hardening:
  - allowlist extensions,
  - MIME/content validation,
  - generated server-side file names,
  - size limits,
  - malware scan pipeline.
- Admin audit logs immutable format me maintain karo.
- Private docs (verification docs) private storage bucket me rakho.

## 5) Compliance-first product requirements

- DPDP-aligned consent + notice logs.
- consent withdrawal flow.
- retention and deletion policy implementation.
- legal pages operationally linked in UI and user flows.
- identity verification flows ko privacy-by-design model me रखो (minimum data principle).
- project/promoter listings ke liye RERA-sensitive moderation checks.

## 6) Payments and monetization reliability

Monetization modules:
- featured listing fees,
- agent subscriptions,
- property care subscriptions.

Implementation rules:
- payment status webhooks mandatory.
- idempotent webhook processing.
- internal transaction ledger table.
- reconciliation views in admin panel.

## 7) SEO and performance for multi-city growth

- city routes: `/udaipur`, `/jaipur`, `/kota`, etc.
- locality/category landing pages for high-intent indexing.
- canonical strategy for filtered pages.
- sitemap + structured metadata.
- SSR/SSG where appropriate so indexable HTML consistently serve ho.

## 8) Incremental delivery roadmap (without removing old work)

### Phase 1 — Foundation
- existing UI untouched.
- backend auth, roles, listing ownership checks.
- DB as single source of truth.
- audit log skeleton.

### Phase 2 — Marketplace hardening
- Add Property flow with secure uploads.
- lead tracking and visit requests.
- report listing + moderation queue.
- featured listing payment wiring.

### Phase 3 — Property Care operationalization
- service catalog + packages.
- booking/scheduling/assignment.
- completion proof upload.
- recurring billing lifecycle.

### Phase 4 — Trust advanced features
- verified badge process.
- moderated reviews.
- sealed-bid admin reveal controls.

### Phase 5 — Compliance + scale
- consent records + retention workflows.
- RERA-sensitive controls.
- analytics, alerts, incident runbooks, backups.

## 9) Definition of Done for “Production Ready”

Project tab tak production-ready nahi maana jayega jab tak:
- auth + authorization + ownership checks stable na ho,
- uploads secure pipeline me na ho,
- payments webhook+ledger reconciliation ke saath stable na ho,
- moderation and dispute workflows live na ho,
- compliance + legal + data-governance controls documented and implemented na ho,
- operational monitoring + backup/restore drills validated na ho.

---

### Non-destructive commitment
Is blueprint ka objective exactly yehi hai: **existing product ko hataye bina**, modules add karke, safely production-level capability tak pahunchna.
