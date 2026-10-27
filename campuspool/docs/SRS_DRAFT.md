# Software Requirements Specification — CampusPool (draft)

**Status:** Draft for team review. **Version:** 0.1. **Approval:** none recorded. This document describes the new Next.js/TypeScript course implementation contract; it does not claim faculty submission or approval.

## 1. Purpose and scope

CampusPool helps approved campus members publish and find fixed-route rides, request and confirm one seat, cancel bookings or owned offers safely, and inspect auditable activity. The Sprint 1 scope uses synthetic credits and seeded test identities; it does not provide production identity, payment, live routing, or legal verification.

## 2. Users and assumptions

- A newly registered user is `PENDING` until an administrator approves them.
- `RIDER` requests seats; `DRIVER` registers an owned vehicle and publishes offers; `ADMIN` approves users/vehicles and synchronizes activity evidence.
- MySQL is the authoritative transactional database. MongoDB is a projection for activity/outbox events and must not make a successful booking fail.
- Campus fixed-route stops and Asia/Kolkata date/time rules are used; live GPS/Maps routing is out of scope.

## 3. Functional requirements

| ID | Requirement | Priority | Owner area |
| --- | --- | --- | --- |
| FR-01 | Register, log in/out, inspect the current session, and enforce opaque cookie sessions. | Must | #39 |
| FR-02 | Admins list members and approve or suspend them; self-approval is forbidden. | Must | #39 |
| FR-03 | A driver submits a CAR/BIKE with registration, model, and capacity; an admin approves/rejects it. | Must | #12 |
| FR-04 | An approved driver publishes a future fixed-route offer with an approved vehicle, one or more allowed seats up to capacity, and 1–1000 synthetic credits. | Must | #21 |
| FR-05 | The shared baseline provides eligible ride search by stops, inclusive date/time window, and vehicle kind; results mask plates and include a quote token. | Must | #39 baseline; #43 tests |
| FR-06 | A rider submits a quote-bound request; duplicate, self, stale-quote, unauthorized, and unavailable-seat requests are rejected. | Must | #23 |
| FR-07 | An offer owner accepts or rejects a request atomically; acceptance decrements capacity and creates a one-time credit hold. | Must | #23 |
| FR-08 | Authorized rider/driver cancellation preserves history and performs one exact refund/capacity transition. An owner may cancel an offer. | Must | #24 |
| FR-09 | Outbox events are written in the current SQL transaction and projected idempotently into MongoDB; an admin can inspect/sync activity. | Should | #37 |
| FR-10 | Database evidence exposes a driver-ride summary view and capacity report procedure, with guards for protected history. | Should | #37 |
| FR-11 | Every domain mutation requires a same-origin request and idempotency key; successful and error envelopes follow the API contract. | Must | #39 |

## 4. Non-functional requirements

Security: validate strict JSON with Zod; never expose password hashes, session tokens, SQL text, or secrets; use environment variables. Integrity: use transactions, row locks, foreign keys, checks, unique keys, and append-only ledger semantics. Availability: Mongo outage must not roll back a committed SQL booking. Maintainability: feature modules must not import one another's UI modules; shared contracts live in core modules. Usability: provide forms, tables/search, dashboards, and role-appropriate actions in Next.js.

## 5. Traceability and acceptance

FR-01/02/11 map to #39; FR-03 to #12; FR-04 to #21; FR-05 is shared #39 baseline behavior with #43 test-plan traceability; FR-06/07 to #23; FR-08 to #24; FR-09/10 to #37. Test IDs and the reproducible execution record are in `TEST_PLAN_DRAFT.md` and `reports/SPRINT1_VERIFICATION.md`; course approval and final screenshot/video evidence remain pending. Faculty approval, reviewed ownership, and the working-product video remain pending.
