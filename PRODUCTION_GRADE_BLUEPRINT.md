# Production-Grade Blueprint for PropertySetu

## What your brief implies in production terms

Your requirement (**"Meri website ko full production bana do"**, **"Purana jo bhi bana hai use mat hatana"**, **"Properly working bana do"**, **"Ek OLX se bhi behatar"**) translates to a shift from a static or partially-working site to a **reliable marketplace + services platform** with real users, real uploads, real payments, real moderation, and strong trust/safety.

That “production” bar is not mainly about UI polish; it is mostly about **systems**: authentication, authorisation, data integrity, auditability, abuse controls, operational workflows, and compliance.

A key constraint is preserving whatever is already built. The strongest proven approach for this is an incremental modernisation pattern (often called the *Strangler Fig* approach): keep the existing site working while you progressively route new functionality to new modules/services, so value ships gradually and risk stays contained.

To be “better than a classifieds benchmark”, you do not need to out-copy every feature. You need to win on the things that matter in property:

- **trust**
- **verification**
- **higher-quality listings**
- **privacy-first communication**
- **visit scheduling**
- and your **Property Care** subscription, which is a differentiator that general classifieds typically don’t operationalise end-to-end.

## Architecture that supports Buy/Sell/Rent plus Property Care end-to-end

A production architecture for your scope (marketplace + service operations) is best treated as **four cooperating systems**:

### 1) Public marketplace (Buy/Sell/Rent)
Listings, search, filters, city/locality pages, lead capture (chat/visit request), basic anti-spam.

### 2) User/account system (Buyer/Seller/Agent)
OTP login, role-based dashboards, saved properties, listing management, and verification status.

### 3) Property Care operations system
Service catalogue (monthly check, cleaning, garden care, bill payments, security visit, farmhouse/vadi maintenance), subscription packages, scheduling, staff assignment, service proofs (photos), and closure notes.

### 4) Admin & Trust/Safety console
Listing moderation, verified badge approvals, fraud flags, reports & disputes, payment reconciliation, compliance exports, and audit logs.

Because you want **city-based SEO pages** (for example `/udaipur`, `/jaipur`), the frontend should support a routing model that can generate pages reliably and quickly.

For production hardening, treat the “hero search” as only the top of the funnel; the actual work is done by the backend + database + media storage + moderation tooling.

## Data model and workflows that make the platform “properly working”

A platform like yours becomes stable when the **data model matches real workflows**, not just UI categories.

### Marketplace core entities

#### User
- Roles: buyer/tenant, seller/owner, agent, admin, operations staff.
- State: phone verified, optional identity verification state, abuse flags, subscription state.
- Baseline protections: SMS verification + OTP request rate limiting.

#### Property Listing
- Transaction: buy/sell, rent, lease, mortgage (“girvi”) where applicable.
- Type: house, flat, villa, plot, agricultural land, commercial, warehouse, PG/hostel, farmhouse/vadi.
- Location: city → locality/area → landmark; geo coordinates optional.
- Media: photos (enforce minimum), optional short video, optional floor plan, optional private documents.
- Trust flags: verified-by-admin, owner-verified, featured/boosted, report count.

#### Lead / Enquiry
Track conversion actions:
- chat started
- visit request
- phone reveal request
- WhatsApp click
- email

#### Visit Booking
Calendar slot + status pipeline:
- requested
- accepted
- rejected
- completed
- no-show

Also includes reminders and follow-ups.

#### Review / Rating
If implemented, keep scope controlled:
- property accuracy
- owner behaviour
- agent service

Moderation is mandatory before broad visibility.

### Property Care entities

#### Service Catalogue Item
Examples:
- monthly house check
- cleaning
- garden/vadi maintenance
- security visit
- bill payment handling
- tenant coordination

#### Service Order
Booking + schedule + assigned staff + proof (before/after photos) + completion notes + invoice.

#### Subscription Plan
Monthly packages, renewal, pause/cancel, upgrade/downgrade.

### Sealed-bid module (hidden bidding)

This is a security-critical workflow, not just a UI toggle:

- Bid records are never returned to buyers/sellers.
- Only admin endpoints can access bid details.
- Admin actions: accept/reject/reveal winner.
- Full audit trail for disputes and compliance.

## Trust, verification, privacy, and India compliance constraints

### DPDP readiness as a product requirement

Implement as product capabilities, not just policy pages:

- Purpose-based notice + explicit consent logging.
- Consent withdrawal flow with easy UX.
- Evidence trail for “when/what/how consent was collected”.
- Data minimisation and retention controls.
- Multilingual notices where required.

### Aadhaar verification caution

Do not roll out Aadhaar flows casually. Start with safer trust layers:

- phone OTP verification
- optional PAN-based verification for owners/agents
- manual document review for “Verified by PropertySetu”
- private storage bucket + strict access controls

Only expand to Aadhaar-linked flows with explicit legal/compliance review.

### RERA-aware listing policy

For promoter/new-project style listings, enforce:

- RERA registration details (where applicable)
- listing moderation checks
- clear legal disclaimers

### Secure file-upload controls

Production-grade upload pipeline should enforce:

- extension allowlist
- MIME/type signature validation (don’t trust browser header)
- file size limits
- safe server-side renaming
- role-based upload permissions
- malware scan before publish
- private-by-default storage for sensitive docs

## Payments, featured listings, and subscriptions that reconcile

Monetisation (featured listing fees, agent subscription, property care packages) requires operational integrity:

- webhook-driven payment state updates
- idempotent event handling
- payment ledger tables
- retry-safe status transitions

Without this, you will face recurring “paid but not activated” incidents.

## SEO, performance, and multi-city structure

City pages are correct direction, but must avoid duplicate content traps.

### SEO rules
- Stable crawlable HTML for landing pages.
- Canonical URLs for filtered/search permutations.
- Index only high-intent pages (city/locality/category), not all filter combinations.
- Sitemap discipline.
- Canonical tags rendered server-side.

## Phased delivery roadmap (without deleting old work)

### Phase 1: Foundation
Keep current site functional; add backend skeleton.

Definition of done:
- single source-of-truth database for users/listings
- OTP login with request rate limiting
- role-based access control
- admin audit logs

### Phase 2: Marketplace hardening
- Add Property with minimum photos rule.
- Secure media upload pipeline.
- Chat-first privacy model.
- Reporting + moderation queue.
- Featured placements tied to reconciled payments.

### Phase 3: Property Care operations
- Service catalog + package pricing.
- Booking/scheduling/assignment workflow.
- Service completion proofs.
- Recurring billing + renewals + dunning.

### Phase 4: Advanced trust
- “Verified by PropertySetu” badge workflow.
- Moderated reviews.
- Sealed bids with strict object-level authorisation.

### Phase 5: Compliance hardening
- DPDP-grade consent/notice/withdrawal/retention implementation.
- Identity verification privacy guardrails.
- RERA-aware moderation for relevant inventory.

## Final outcome target

This phased rollout preserves all existing work while turning PropertySetu into a production-grade, trust-led real estate + service operations platform. The roadmap is designed to ship value incrementally, reduce risk, and avoid breaking old modules while new systems are introduced.
