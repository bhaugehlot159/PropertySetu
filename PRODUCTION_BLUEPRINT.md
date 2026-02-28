# Production-Grade Blueprint for PropertySetu

## What your brief implies in production terms

Your requirement (“**Meri website ko full production bana do**”, “**Purana jo bhi bana hai use mat hatana**”, “**Properly working bana do**”, “**Ek olex se bhi behatar**”) translates to a shift from a static or partially-working site to a **reliable marketplace + services platform** with real users, real uploads, real payments, real moderation, and strong trust/safety. That “production” bar is not mainly about UI polish; it is mostly about **systems**: authentication, authorisation, data integrity, auditability, abuse controls, operational workflows, and compliance.

A key constraint is preserving whatever is already built. The strongest proven approach for this is an incremental modernisation pattern (often called the *Strangler Fig* approach): keep the existing site working while you progressively route new functionality to new modules/services, so value ships gradually and risk stays contained.

To be “better than a classifieds benchmark”, you do not need to out-copy every feature. You need to win on the things that matter in property: **trust, verification, higher-quality listings, privacy-first communication, visit scheduling, and your “Property Care” subscription**, which is a differentiator that general classifieds typically don’t operationalise end-to-end.

## Architecture that supports Buy/Sell/Rent plus Property Care end-to-end

A production architecture for your scope (marketplace + service operations) is best treated as **four cooperating systems**:

### Public marketplace (Buy/Sell/Rent)
Listings, search, filters, city/locality pages, lead capture (chat/visit request), basic anti-spam.

### User/account system (Buyer/Seller/Agent)
OTP login, role-based dashboards, saved properties, listing management, and verification status.

### Property Care operations system
Service catalogue (monthly check, cleaning, garden care, bill payments, security visit, farmhouse/vadi maintenance), subscription packages, scheduling, staff assignment, service proofs (photos), and closure notes.

### Admin & Trust/Safety console
Listing moderation, verified badge approvals, fraud flags, reports & disputes, payment reconciliation, compliance exports, and audit logs.

Because you want **city-based SEO pages** (for example `/udaipur`, `/jaipur`), the frontend should support a routing model that can generate pages reliably and quickly. If you are using a React-based stack, server-side rendering or static generation are both valid depending on the page type.

For production hardening, you should treat the “hero search” as only the top of the funnel; the actual work is done by the backend + database + media storage + moderation tooling.

## Data model and workflows that make the platform “properly working”

A platform like yours becomes stable when the **data model matches real workflows**, not just UI categories. Below is the minimum set of entities and how they relate.

### Marketplace core entities

#### User
Roles: buyer/tenant, seller/owner, agent, admin, operations staff.
State: phone verified, optional identity verification state, abuse flags, subscription state.

#### Property Listing
Transaction: buy/sell, rent, lease, mortgage (“girvi”) where applicable.
Type: house, flat, villa, plot, agricultural land, commercial, warehouse, PG/hostel, farmhouse/vadi.
Location: city → locality/area → landmark; geo coordinates optional.
Media: photos (enforce minimum), optional short video, optional floor plan, optional documents (private).
Trust flags: verified-by-admin, owner-verified, featured/boosted, report count.

#### Lead / Enquiry
Tracks the action that matters: chat started, visit request, phone reveal request, WhatsApp click, email. The point is to measure demand and prevent spam.

#### Visit Booking
Calendar slot, status (requested/accepted/rejected/completed/no-show), reminders, and follow-ups.

#### Review / Rating
If you implement reviews, keep them scoped: property accuracy, owner behaviour, agent service. Don’t make everything public by default; moderation is essential.

### Property Care entities

#### Service Catalogue Item
Monthly house check, cleaning, garden/vadi maintenance, security visit, bill payment handling, tenant coordination.

#### Service Order
Booking + schedule + assigned staff + proof (before/after photos) + completion notes + invoice.

#### Subscription Plan
Monthly packages, renewal, pause/cancel, upgrade/downgrade. For recurring revenue, your recurring billing needs a payment system designed for subscriptions.

### Sealed-bid module (your “hidden bidding” idea)

This is not just a UI toggle. A sealed-bid flow requires:
- **Bid records** are never returned to buyers/sellers; only admin endpoints can access them.
- Admin actions: accept/reject/reveal winner.
- A full audit trail so disputes can be resolved.

This design is mainly an **authorisation** problem; if object-level authorisation is weak, attackers can guess IDs and access others’ bids.

## Trust, verification, privacy, and India compliance constraints you must design around

This section is crucial because “Verified Listings” and “Owner Verification” are a major “OLX-se-better” lever—but implementation must be lawful and safe.

### DPDP compliance becomes a product requirement, not a legal afterthought

India’s Digital Personal Data Protection law requires notice and consent disciplines that directly affect your UX.

**Practical impact on your build:** you need a clean Privacy Policy, consent records, data retention rules, and a breach-response workflow as part of production readiness—not “later”.

### Aadhaar-based verification is highly constrained

If you plan “Owner Aadhaar verification”, you must not implement it casually.

**Production recommendation:** For a property marketplace, start with:
- phone OTP verification,
- optional PAN-based verification for agents/owners (without making it mandatory for simple browsing),
- manual document review for “Verified by PropertySetu” badge (store documents in a private bucket with strict access controls),
and only consider Aadhaar-based flows if you have a fully compliant, legally reviewed approach.

### Real estate advertising may intersect with RERA obligations

If you list **promoter projects** (new launches, marketed projects), India’s RERA law includes provisions about registration and advertisement.

**Practical impact:** For “new project” style listings, you may need fields like RERA registration number and clear disclaimers, plus moderation rules.

### File uploads are a major security surface, not a simple feature

Your roadmap includes minimum photos, video upload, floor plans, and document uploads (private).

This means production-grade uploads require:
- a storage strategy,
- malware scanning,
- metadata checks (image/video duration/encoding),
- and access control enforcement.

## Payments, featured listings, and subscriptions that actually reconcile

Your monetisation plan (featured listing fees, agent subscription, property care packages) is feasible, but only if billing is event-driven and reconciled.

### Subscriptions need mandate-capable recurring payments + webhooks

A subscription is not “save card once and charge monthly” in the naive sense. It requires the payment provider’s recurring rails, mandate flows, and reliable event notifications.

**Production implication:** If you do not implement webhooks + idempotent processing + ledger tables, you will constantly face “paid but not activated” issues.

### Media storage for uploads should avoid pushing big files through your backend

To keep the site fast and avoid bandwidth blow-ups, use direct-to-storage uploads with tight controls:
- pre-signed URLs for object storage, or
- signed uploads to a media management provider.

## SEO, performance, and multi-city structure without duplicate-content traps

Your SEO idea (city pages like `/udaipur`, `/jaipur`) is directionally correct for a local-first marketplace, but it only works if search engines can crawl stable HTML, understand canonical URLs, and not drown in duplicate variants.

On a property site, duplicates happen easily because of filter combinations (price range, BHK, furnished, locality). Your production SEO rules should include:
- canonicalising filtered “search result” pages to a clean base route when appropriate,
- indexing only high-intent landing pages (city → locality → category) rather than every filter permutation,
- and ensuring SSR/SSG outputs include canonical tags in the HTML source.

## A phased delivery roadmap that preserves the existing site

Because you said “do not remove the old work”, the roadmap should be designed as a gradual expansion where each phase produces a working slice.

### Foundation phase: keep the current UI, add a real backend skeleton

Use the Strangler Fig approach: your existing site remains the default; new endpoints and pages are introduced behind stable routes, gradually taking over ownership of critical flows.

**Definition of done for this phase**
- A single source of truth database for users and listings.
- OTP-based login with rate limiting.
- Role-based access boundaries (seller can only edit their listings; admin can moderate).
- Audit logs for admin actions (verification approvals, takedowns, bid reveals).

### Marketplace phase: listings that create trust and reduce spam

**Deliverables**
- Add Property flow with enforced minimum photo count and secure upload pipeline.
- “Chat-first” privacy model (in-app messaging first; phone reveal optional).
- Report listing workflow and moderation queue.
- Featured/boosted placements tied to reconciled payments.

### Property Care phase: operationalise the differentiator, not just a page

**Deliverables**
- Service catalog + pricing + subscription packages.
- Booking, scheduling, assignment, and completion proof (geo/time-stamped photos).
- Recurring billing with subscription webhooks, renewal and dunning logic.

### Advanced trust phase: verification, reviews, sealed bids

**Deliverables**
- “Verified by PropertySetu” badge workflow (admin approvals, document storage private-by-default).
- Review system with moderation and anti-defamation controls.
- Sealed-bid system implemented with strict object-level authorisation (admin-only bid visibility).

### Compliance hardening phase: DPDP-first operations

Before marketing scale-up, implement:
- consent + notice logging, withdrawal handling, and retention rules aligned to DPDP requirements,
- a privacy-by-design approach to identity verification,
- RERA-aware moderation policies for promoter/project listings where relevant.

This phased approach is the most reliable way to meet your core constraint (“don’t remove old work”) while still reaching an actually production-grade system where the missing modules (dashboard, uploads, verification, featured listings, subscriptions, legal pages, and later AI) become real, testable, and operable parts of the product.
