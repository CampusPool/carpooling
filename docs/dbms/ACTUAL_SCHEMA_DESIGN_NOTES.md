# Schema design, transactions, and four-workstream complexity

## Normalization and deliberate trade-offs

The relational core is principally in 3NF: identities, trips, passengers,
quotes, lifecycle events, postings, and dispatch records are separate rows;
many-to-one references are represented by foreign keys; and repeated business
events use unique idempotency keys rather than overwriting history. The unique
keys on trip/version, provider/event, quote source, program/date, request/driver,
and entry-group/account/side prevent duplicate effects at the database edge.

There are intentional controlled denormalizations:

- `snapshot`, `journey`, route/config/terms snapshots, and response/payload JSON
  preserve the exact decision or external response used at a boundary. This is
  auditability and replay evidence, not a replacement for searchable columns.
- `fare_minor`, route hashes, vehicle fingerprints, quote hashes, and versions
  are copied into downstream rows so a later quote or vehicle change cannot
  silently rewrite booking/financial history.
- The commute-demo wallet, holds, entries, and receipts are a compact synthetic
  surface. Their lack of declared FKs is explicit and requires service-level
  reconciliation; it must not be presented as the same integrity level as the
  lifecycle/financial extension tables.

## ACID and concurrency design

Lifecycle transitions are versioned (`mobility_trip_lifecycles.version` and
`mobility_trip_events.version`) and event idempotency is unique per trip/actor/
key. Booking interval and participant rows have unique constraints that make
duplicate acceptance observable. Financial postings are grouped and keyed so a
balanced posting can be retried safely. Dispatch availability and assignment
rows use unique active request/driver fields to prevent two active allocations.

The application transaction should lock the authoritative trip/booking rows
before checking capacity, insert the participant/interval, and append the
lifecycle event in one commit. A second transaction then waits on the same row
lock and must re-read state before accepting. This is the ACID last-seat
property demonstrated by `docs/dbms/concurrency.sql` and the disposable
concurrency script; it is not a claim that a new lock is installed by this
document.

External payment callbacks follow the same pattern: unique provider event
identity first, then idempotent attempt/posting/outbox changes in a transaction.
The outbox separates committed financial intent from a retryable provider call.
Deadlock retries, isolation level, and lock ordering remain deployment/runtime
concerns and should be documented with the production connection settings.

## NoSQL projection integration status

`services/activity-projection` is the read-model boundary, not a second source
of truth. It reads `mobility_trip_events` from MySQL using an explicit read-only
repeatable-read snapshot, redacts response body/fingerprint/idempotency material,
and upserts a Mongo activity projection with a unique event identity. Replay
from zero and replay after a new event are tested against disposable MySQL and
Mongo services. It is currently an opt-in/isolated service: the pilot/browser
demo does not depend on Mongo for correctness, and the relational tables remain
authoritative.

## Why this justifies four SE workstreams

The complexity is not “four CRUD screens.” It separates four independently
testable engineering workstreams with explicit integration boundaries:

1. **Product/discovery and maps:** commute profiles, route quotes, pickup nodes,
   route snapshots, matching references, fare/route provenance, privacy-safe
   search results, and the Next.js/API contract.
2. **Transactional trip lifecycle:** capacity-safe booking, participant state,
   versioned lifecycle events, cancellation/start/board/alight/complete rules,
   idempotency, and a concurrency proof.
3. **Money and trust:** fare snapshots, wallet/hold/entry demo flow, payment
   attempt/provider inbox, balanced postings, blocks, payout allocation/outbox,
   synthetic-money labeling, and audit/privacy evidence.
4. **Operations and durable scheduling:** recurring programs/occurrences/
   exceptions, dispatch availability/offers/assignments/events, driver/car
   references, admissions, projection replay, and operational test runbooks.

The repository contains migrations for all four areas, but documentation must
keep “schema exists” separate from “feature is integrated and demo-ready.”
Acceptance evidence should name the exact migration, endpoint/test, and whether
the path was exercised in a disposable environment or against the untouched
pilot.

## Verification boundary

The authoritative source for this note is the migration set, not a guessed
live schema. Run `git diff`, migration linting, and the existing disposable
DBMS scripts before submission. Do not connect this evidence job to the pilot
database, insert real user data, or call a live payment provider.
