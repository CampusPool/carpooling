# Software Architecture Description — CampusPool (draft)

**Status:** Draft for review; no faculty approval is recorded.

## 1. System shape

```text
Next.js App Router UI
        |
        v
Route handlers -> core api/body/auth/idempotency -> feature services
        |                                      |
        v                                      v
 MySQL authority  <- transaction + outbox ->  MongoDB activity projection
        |
        +-- users/sessions/vehicles/stops/rides/bookings/ledger
        +-- SQL constraints, indexes, view, procedure, guarded history
```

The browser calls same-origin route handlers. Route handlers validate input, authenticate the session, authorize the role, execute a feature service, and return `{data: ...}` or `{error: ...}`. The shared core owns response envelopes, mutation-origin checks, session lookup, idempotency, and transactions.

## 2. Components and ownership

| Component | Responsibility | Issue |
| --- | --- | --- |
| Foundation/auth/core | Next scaffold, MySQL pool, session/auth/admin approval, shared types/client and API contract | #39 |
| Vehicle service | Vehicle registration, capacity validation, admin review | #12 |
| Offer service | Approved-driver/vehicle checks, overlap and seat validation, ride publication | #21 |
| Booking service | Quote verification, locking, acceptance/rejection, hold ledger | #23 |
| Cancellation service | Rider/driver authorization, refund/history/capacity transitions | #24 |
| Activity/outbox | SQL outbox, worker retry/upsert, Mongo activity read/sync, database evidence | #37 |
| Shared search baseline | Eligibility filters, inclusive campus time windows, masked public DTO, quote | #39; tested by #43 |
| UI shell/features | Role-aware pages and feature-specific forms/tables | shared UI ownership; coordinate before edits |

## 3. Data design

MySQL tables are snake_case and relationally constrained: `users`, `sessions`, `auth_attempts`, `stops`, `vehicles`, `rides`, `bookings`, `ledger`, `idempotency_records`, and `outbox`. A ride references its driver, vehicle, origin and destination stops. A booking references a ride and rider; active-rider uniqueness, positive ledger amounts, status checks, and foreign keys protect invariants. MongoDB stores event projections keyed by unique `event_id`, with audience filtering and summary aggregation.

## 4. Key sequences

Registration creates a pending user; an admin approval makes the role eligible. Offer publication locks the driver row, validates the approved vehicle and time/seat rules, inserts the ride, and records idempotency. Booking acceptance verifies the signed/quote-bound token, locks the ride and relevant booking rows, decrements one available seat, inserts a hold, and writes an outbox event in one SQL transaction. The worker later upserts the event into MongoDB and marks the outbox row published; retries are safe.

## 5. Decisions and constraints

MySQL remains authoritative because seats, credits, and authorization require atomic transactions. MongoDB is intentionally asynchronous so its outage cannot reverse a committed booking. The fixed-route course model avoids claiming live routing. SQL capacity-decrement triggers are prohibited; the booking/cancellation services own capacity changes. Credentials are environment-only. The archived Laravel/native-JS implementation is behavioral reference, not a parity claim. Actual deployment, performance, threat, and browser evidence are pending.
