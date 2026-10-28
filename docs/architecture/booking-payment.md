# Booking & Payment Architecture

## 1. Purpose

This document records the locked Booking and Payment product architecture for
ALUA Academy Management. It is a decision record, not an implementation specification.
Implementation must not add fields, APIs, provider mechanics, or business rules
that are not recorded here or separately approved.

## 2. Domain Boundaries

- Club and Event are completely independent domains.
- Do not create an Event-to-Club relationship.
- Club bookings and Event purchases are separate purchase types.
- An Event purchase never creates Club-review eligibility.

## 3. Club Table Booking

### Club table/package

- `ClubPackage` represents a table/reservation option inside a Club.
- `ClubPackage.capacity` is the maximum guests for that table. A capacity of
  10 means a maximum of 10 guests.
- Package price is fixed for the reservation and is not multiplied by guest
  count.
- There is no `minCapacity` field.
- Do not introduce inventory fields unless separately approved.

### Booking rules

- A user selects a specific Club table, booking date, start time, and end time.
- There is no predefined minimum or maximum booking duration.
- `guestCount` must be at least 1 and must not exceed the selected table's
  capacity.
- Club booking does not collect guest information.
- The same table cannot have overlapping active reservations.
- Different tables in the same Club can be booked simultaneously.
- Availability is per table, not per Club, and is exposed to the calendar UI.
- A pending PayPal checkout creates a temporary hold for the selected table and
  time range. Successful payment converts the hold to a booked reservation.
- A failed, expired, or abandoned payment releases the hold according to the
  payment lifecycle.
- Once a pending order is created, its commercial/package snapshot is locked.
  Later Club Owner changes do not alter that purchase snapshot.

## 4. Event Purchase

- Only active Events with `eventStatus = UPCOMING` are purchasable.
- Do not introduce another purchase cutoff based solely on `startAt` unless
  separately approved.
- Event price is per person.
- The buyer counts as one person.
- An Event purchase is limited to five people total: buyer plus at most four
  friends.
- One Event purchase represents the entire group.

### Event guest data

Buyer information is obtained automatically from the authenticated
`User`/`Profile`. The buyer does not manually re-enter it at checkout, and the
information used by the purchase and ticket is snapshotted.

Each friend requires:

- name;
- phone number;
- gender; and
- age.

Friend image is optional. No additional friend fields are required without
approval.

## 5. Purchase Snapshots

Purchases preserve immutable historical and commercial information. Historical
purchase information must not be reconstructed from mutable current
Club/Event/Package records.

- A Club purchase snapshots the selected table/package information when the
  purchase/order is created.
- An Event purchase snapshots relevant Event information, buyer information
  used by the purchase, and the friend/guest information belonging to the
  purchase when the purchase/order is created.

Snapshots ensure historical accuracy, exact purchase history,
revenue/earnings reporting, commission accounting, refund calculations, and
ticket/PDF stability. Later Club Owner changes to table/package/event details,
including name, price, capacity, description, or related information, do not
change existing purchases.

## 6. Payment & PayPal Marketplace

- PayPal is the only phase-1 payment provider.
- The business domain must allow future payment providers without being
  permanently coupled to PayPal.
- Do not implement Stripe, Apple Pay, or Google Pay in phase 1.

### Seller onboarding

- A Club Owner must complete/connect PayPal seller onboarding before creating a
  Club or Event.
- A Club Owner without the required seller connection cannot create a Club or
  Event.
- Seller onboarding state must be persisted.

### Marketplace distribution

The intended payment flow is buyer payment through PayPal, with PayPal
automatically distributing the ALUA Academy Management platform commission and the Club
Owner seller portion. ALUA Academy Management must not be designed to receive the full
amount and manually pay sellers later.

The marketplace/payment-provider mechanism must directly represent the buyer
payment, seller/payee, and ALUA Academy Management platform fee. For example, a $50
purchase with a 10% commission yields $5 for ALUA Academy Management and $45 for the Club
Owner.

### Payment confirmation

- Use both browser return and verified PayPal webhook processing.
- Browser return supports immediate user experience and payment-status
  handling, but is not final proof of successful payment.
- A verified PayPal webhook is authoritative for final payment confirmation.
- Conceptually: buyer approval → browser return for UX → server-side payment
  confirmation/capture flow → verified webhook/payment verification →
  order/payment becomes `PAID` → fulfillment begins → PDF generation.
- Client/browser state is not authoritative financial state.

## 7. Commission & Financial Records

`ApplicationCharge` provides the configured commission percentage. Every order
snapshots:

- `grossAmount`;
- `commissionRate`;
- `commissionAmount`;
- `sellerEarnings`; and
- `currency`.

```
commissionAmount = grossAmount × commissionRate / 100
sellerEarnings = grossAmount - rounded commissionAmount
```

Commission uses two decimal places and standard half-up rounding. For example,
a $49.99 gross amount at 10% produces a $5.00 commission and $44.99 seller
earnings. No tax/VAT calculation is introduced at this stage.

`ApplicationCharge.serviceType` must be database-unique. There is exactly one
commission configuration per `EVENT` and `CLUB` service type; financial
configuration uniqueness must not rely on `findFirst()`.

Historical earnings and commission calculations use immutable order/payment
snapshots. Later commission configuration changes do not change existing
orders.

## 8. Club Reviews

- Reviews exist for Clubs only; Events have no reviews.
- A user becomes eligible to review a Club only after that user's Club
  reservation has finished. Payment success alone is insufficient.
- An Event purchase never grants Club-review eligibility.
- One user can submit one review per Club. The existing unique
  `[userId, clubId]` rule remains appropriate.
- Reviews cannot be edited.
- Rating is decimal and must be from 1.0 through 5.0 inclusive.
- Review text is optional.

## 9. Ticket & PDF

- Each successful Club booking or Event purchase produces exactly one PDF
  ticket.
- An Event PDF represents the complete buyer-and-friend group.
- A Club PDF represents the table reservation.
- Tickets are PDF only: no QR code and no check-in/verification flow.
- PDF generation is asynchronous through the worker architecture, generated
  from immutable purchase/order snapshots, retry-safe/idempotent, uploaded to
  existing S3-compatible storage, and persisted with its final location.
- Do not expose PDFs through public permanent URLs.

### Ticket download

The conceptual authenticated endpoint is:

```
GET /api/v1/bookings/:bookingId/ticket
```

It authenticates the user, verifies that the booking/purchase belongs to that
user, verifies the PDF exists, then returns/downloads the PDF.

### Event PDF content

- ALUA Academy Management branding;
- Event name, date, start time, end time, and location;
- purchase/ticket number;
- buyer name, phone, gender, age, and image if available;
- each friend name, phone, gender, age, and image if available;
- total people;
- total paid and currency; and
- purchase date.

### Club PDF content

- ALUA Academy Management branding;
- Club name and location;
- table/package name and table capacity;
- booking date, start time, and end time;
- guest count;
- customer name and phone;
- purchase/reservation number; and
- total paid and currency.

Club PDFs must not show platform commission, seller payout, QR codes, or
check-in information.

## 10. Cancellation & Holds

- A Club table reservation is refundable when cancelled up to six hours before
  its booking start.
- Cancellation within six hours of booking start is non-refundable.
- Pending PayPal checkout holds are released when payment fails, expires, or is
  abandoned according to the payment lifecycle.

## 11. Security & Idempotency

- Financial state is durable in PostgreSQL.
- Webhook idempotency is durable in PostgreSQL. Redis may assist with
  ephemeral state or coordination, but is not the sole durable source of
  webhook idempotency.
- Payment-state transitions are transactional and conditional.
- Repeated or out-of-order webhook events must not duplicate fulfillment.
- PDF generation is retry-safe and idempotent.
- Same-table overlapping booking prevention is enforced transactionally; an
  application-level availability check alone is insufficient.

## 12. Locked Decisions

- Club and Event remain independent purchase domains.
- Club tables use fixed reservation pricing, capacity is a maximum guest count,
  and availability is per table/time range.
- Event purchases are per-person group purchases for buyer plus up to four
  friends.
- Purchases, financial records, buyer/guest data, and ticket data use immutable
  snapshots.
- PayPal marketplace distribution sends the platform fee and seller portion
  directly through PayPal; ALUA Academy Management does not manually pay sellers.
- Verified webhooks, not browser state, finalize payment.
- Commission is order-snapshotted with two-decimal half-up rounding.
- Club reviews require a finished Club reservation; Events have no reviews.
- Successful purchases create one authenticated-download PDF ticket, generated
  asynchronously and stored without a public permanent URL.

## 13. Explicitly Deferred Implementation Details

The following are implementation considerations, not additional locked product
decisions. They must be verified or designed during implementation planning;
they must not be guessed:

- exact PayPal marketplace/partner API mechanics;
- exact PayPal seller-onboarding API/product, fields, and endpoints;
- exact PayPal webhook event mapping and verification implementation;
- exact technical hold-expiration mechanism;
- exact refund and payment-provider API behavior;
- PDF renderer/library;
- exact schema fields, persistence-model names, and API surface beyond the
  conceptual authenticated ticket-download endpoint;
- exact worker queue, job, retry, and storage implementation details; and
- any business rule not explicitly stated in this document.
