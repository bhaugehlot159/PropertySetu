# Production-Grade Blueprint for PropertySetu

## What your brief implies in production terms

Your requirement ("**Meri website ko full production bana do**", "**Purana jo bhi bana hai use mat hatana**", "**Properly working bana do**", "**Ek OLX se bhi behtar**") translates to a shift from a static or partially-working site to a **reliable marketplace + services platform** with real users, real uploads, real payments, real moderation, and strong trust/safety.

A key constraint is preserving whatever is already built. The safest approach is incremental modernization: keep the existing site running while progressively routing new functionality to new modules/services so value ships gradually and risk stays controlled.

To be "better than a classifieds benchmark," success should focus on **trust, verification, higher-quality listings, privacy-first communication, visit scheduling, and Property Care subscriptions**.

## Architecture that supports Buy/Sell/Rent plus Property Care end-to-end

Production architecture should be split into four cooperating systems:

1. **Public marketplace (Buy/Sell/Rent)**
   - Listings, search, filters, city/locality pages, lead capture (chat/visit request), anti-spam.

2. **User/account system (Buyer/Seller/Agent)**
   - OTP login, role-based dashboards, saved properties, listing management, verification status.

3. **Property Care operations system**
   - Service catalog (monthly checks, cleaning, garden care, bill handling, security visits, farmhouse/vadi maintenance), subscription packages, scheduling, staff assignment, service proofs, closure notes.

4. **Admin & Trust/Safety console**
   - Listing moderation, verified badge approvals, fraud flags, reports/disputes, payment reconciliation, compliance exports, audit logs.

## Data model and workflows required for “properly working” operations

### Marketplace core entities

- **User**
  - Roles: buyer/tenant, seller/owner, agent, admin, operations staff.
  - State: phone verified, identity verification state, abuse flags, subscription state.

- **Property Listing**
  - Transaction: buy/sell, rent, lease, mortgage (girvi where applicable).
  - Type: house, flat, villa, plot, agricultural land, commercial, warehouse, PG/hostel, farmhouse/vadi.
  - Location: city → locality/area → landmark (+ optional coordinates).
  - Media: photos (minimum required), optional short video, floor plan, private docs.
  - Trust flags: verified-by-admin, owner-verified, featured/boosted, report count.

- **Lead / Enquiry**
  - Track chat started, visit request, phone reveal request, WhatsApp click, email.

- **Visit Booking**
  - Slot + status: requested/accepted/rejected/completed/no-show + reminders/follow-ups.

- **Review / Rating**
  - Scope should remain moderated and structured (accuracy, owner/agent behavior, service quality).

### Property Care entities

- **Service Catalogue Item**
- **Service Order** (schedule, assignment, before/after proof, completion notes, invoice)
- **Subscription Plan** (monthly package lifecycle, renew/pause/cancel/upgrade/downgrade)

### Sealed-bid module

- Bid records must be hidden from public users.
- Only admin endpoints can view/reveal outcomes.
- Every action must be audit-logged.

## Trust, privacy, and compliance requirements

### DPDP readiness

Treat DPDP compliance as a build requirement, not a post-launch task:

- Consent capture with purpose clarity
- Consent withdrawal flow
- Notice logs + proof of consent
- Data minimization + retention policy
- Multilingual notice support

### Identity verification safety

For owner verification, start safely with:

- Phone OTP verification
- Optional PAN-based checks for owner/agent trust badge
- Manual verification workflow + private secure document storage

### RERA-aware listing controls

For new project/promoter listings, add moderation checks and required fields (e.g., RERA number, disclosures) before publishing.

### Secure upload pipeline

File/media uploads must include:

- Extension allowlist
- MIME/type and content validation
- Renamed file keys
- Size limits
- Malware scan pipeline
- Role-based upload permissions

## Payments, featured listings, and subscriptions

For featured listings and Property Care subscriptions:

- Use recurring-capable billing rails
- Process payment webhooks with idempotency
- Maintain a ledger table for activation/deactivation reconciliation
- Add failure handling (retry/dunning) for renewals

## SEO, performance, and multi-city pages

- Keep city routes such as `/udaipur`, `/jaipur` crawlable and canonicalized
- Avoid indexing every filter permutation
- Index high-intent landing pages (city/locality/category)
- Ensure metadata/canonical tags are present in rendered HTML

## Phased delivery roadmap (without deleting old work)

### Phase 1 — Foundation

- Keep current UI running
- Add stable backend source of truth (users/listings)
- OTP auth + rate limits
- Role-based authorization
- Admin audit logs

### Phase 2 — Marketplace hardening

- Add-listing flow with secure upload + minimum photo rules
- Chat-first privacy model with optional phone reveal
- Reporting + moderation queue
- Featured listing activation tied to reconciled payments

### Phase 3 — Property Care operations

- Service catalog + package management
- Booking/scheduling/assignment/completion proofs
- Subscription lifecycle + webhook-driven status sync

### Phase 4 — Advanced trust

- Verified badge workflow
- Moderated reviews
- Sealed-bid flow with strict object-level authorization

### Phase 5 — Compliance hardening

- DPDP consent/notice/withdrawal lifecycle completion
- Strong document governance for verification workflows
- RERA-aware moderation policy enforcement

## Delivery principle

**Do not remove existing working modules.**
Add all production features incrementally, behind stable routes and role checks, so old and new systems can coexist until migration is complete.
