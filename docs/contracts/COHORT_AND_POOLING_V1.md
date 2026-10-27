# Cohort and pooling contract v1

20 October 2026. Implementation contract for S1/S2 of IMPLEMENTATION_STRATEGY.md. Proposed original behavior, not a recovered Hopr server policy. This document defines implementation interfaces; individual endpoints are not available until their code and tests are integrated.

## Authority and rollout

Reuse canonical Carpoolear users, JWT authentication, cars, trips and passenger rows. New tables hold cohort decisions and host/vehicle approvals; never duplicate login, booking, lifecycle or money authorities. Operator authority is the existing explicit `is_admin` role; users cannot request it through public account/profile payloads.

`MOBILITY_COHORT_REQUIRED` defaults to true outside the testing environment and false in testing to preserve legacy synthetic fixtures. Explicit testing cases enable it. A release configuration must require it. `MOBILITY_COLLEGE_CODE` is operator-configured; no school/domain is guessed from prior coursework. Missing configuration while cohort access is required returns 503 `COHORT_NOT_CONFIGURED`; no permissive fallback. Cohort enforcement tests are separate from legacy compatibility tests.

User activation and bans remain authoritative. College membership is an operator-reviewed claim; a verified email alone is not evidence of affiliation. No identity-document images or precise home addresses belong in application free text. Initial application fields are bounded college code and affiliation (`student` or `staff`). Real-world review procedures and account delivery remain separate acceptance dependencies.

## S1: membership and host approval

All endpoints below require active authenticated users; banned users receive 403 `ACCOUNT_RESTRICTED`. Operator endpoints additionally require `is_admin`; no self-review. New errors use `{"error":{"code":"MACHINE_CODE"}}` with optional bounded validation details, without SQL/provider internals.

| Endpoint | Input | Response and rule |
| --- | --- | --- |
| GET /api/mobility/membership/me | none | Own application or null; own host approvals; permitted capabilities; configured college code. No other user's review notes. |
| POST /api/mobility/membership/apply | college_code, affiliation | First valid application is pending/version 1. Exact repeat returns existing state. Changed affiliation requires an explicit resubmission rule; initial implementation rejects conflicting replay with 409. Suspended/rejected applicants cannot reset review through another apply. |
| GET /api/mobility/operator/memberships | bounded page_size, after cursor, optional status | Administrator-only bounded queue; stable cursor; applicant identity necessary for review. |
| POST /api/mobility/operator/memberships/{user}/decision | expected_version, status approved/rejected/suspended, reason | Lock row, check current version, audit actor/previous/new/reason; increment version atomically. Stale version 409. Self-review denied. Approved ↔ suspended/reactivated and pending → approved/rejected explicit; rejection/resubmission not silently reset. |
| POST /api/mobility/host-applications | car_id, vehicle_type bike/car | Approved member applies with own active canonical complete vehicle. Pending record bound to that exact vehicle and type. Exact repeat is idempotent; client cannot grant approval. |
| POST /api/mobility/operator/host-applications/{id}/decision | expected_version, status approved/rejected/suspended, reason | Admin review under row lock; approved membership still required. Do not overwrite upstream identity/driver-verification flags. Host self-review denied. |

Membership and host decisions have append-only audit rows. One membership per user in the configured initial college; host approvals are unique by user and canonical vehicle. Approval references do not imply third-party document verification. Changing/replacing/deactivating a vehicle invalidates its eligibility at use time. A bike is limited to one passenger; car capacity follows the approved vehicle/product policy, never client trust fields.

Capabilities: approved, active, unbanned membership permits new discovery and seat requests. Publishing additionally needs an approved host record for the selected owned active complete vehicle, plus existing upstream qualification rules. Membership approval does not bypass those rules. Suspension immediately prevents new activity; an operator decision must not silently cancel completed/ongoing history or release money.

The guard must cover legacy discovery and creation/request/accept entry paths as well as new Mobility APIs; adding only a new protected endpoint is insufficient. Audit legacy trip listing/detail, saved user trip lists, publish/edit/new booking/accept/autoaccept, and public location links. Preserve authenticated participant recovery: existing booking cancellation, decline, trip cancellation, lifecycle read/completion/drop-off and own payment records stay accessible under their existing participant/owner authorization. A suspended participant must still be able to exit an existing trip or report/resolve it. Unauthenticated discovery or new booking fails closed when cohort enforcement is active. Public location sharing requires a separately explicit policy and stays denied by default in cohort mode.

Cross-user/cohort isolation is mandatory; operators see only data needed for review and every decision is auditable. Last-seat admission and existing lifecycle guards remain active. Gate checks are not a substitute for transaction-level seat protection or safe all-writer enforcement.

## S2: trusted real route and offer

These APIs are the next contract boundary, not implemented by the S1 membership packet.

1. POST `/api/mobility/routes/quote`: approved member supplies bounded pickup/drop-off selection and vehicle mode. Server validates supported Bengaluru scope, resolves a selected provider or operator-verified catalog, evaluates suitable pickup points and computes trusted distance/duration/price inputs. Return opaque quote ID, immutable normalized points, provider/mode, amount in integer INR minor units, expiry and explicit pricing version. A provider outage fails safely without creating a trip. Synthetic geometry is never labeled real evidence.
2. POST `/api/mobility/pool-offers`: approved host supplies quote_id, owned car_id, future local departure, seats, bounded notes and Idempotency-Key. Validate owner/mode/expiry/approval and upstream qualification; generate canonical trip/route rows atomically with quote use. Reused key and different payload → 409. No client-authoritative distance, encoded geometry, fare, trust flag or route reference.
3. GET `/api/mobility/pool-offers`: approved member filters service date, departure window and route; bounded pagination; only eligible planned dated offers; precise participant details follow booking permissions. One occurrence's capacity is authoritative; weekly masks alone are not dated inventory.
4. Booking request/host accept/reject/rider cancel reuse canonical passenger authority under trip-first locks. Canonical states remain pending 0, accepted 1, rejected 2, cancelled 3 and waiting-payment 4. The unsafe legacy `/pay` promotion stays disabled. Pending-request capacity policy must be explicit before UI claims a seat is reserved.
5. Start/board/alight/complete/cancel delegates current `/api/mobility/trips/{trip}/transitions`, with Idempotency-Key and existing expected invariants. Rider drop-off acknowledgement delegates `/dropoff-confirmation`. Neither is GPS/physical proof.

Provider choice and key access may delay an actual road-routing/device acceptance check. They do not prevent building an adapter, validating failure behavior and synthetic contract tests. Mark those tests synthetic until the real provider/catalog and devices are exercised.

## Critical S1 scenarios

- Anonymous/inactive/banned caller cannot apply, decide or create new trip/booking activity.
- Public registration/profile cannot self-assign admin, membership, driver or identity trust.
- Wrong/unconfigured college fails closed; pending member sees own status but no trip discovery or publication.
- Exact application replay cannot approve or clear suspension/rejection; conflicting replay fails predictably.
- Only an explicit administrator can review; self-review, stale expected version and conflicting parallel decisions fail safely with one accepted version/audit event.
- Approved active member gains discovery/request capability; suspension removes new activity without blocking authorized cancellation and own records.
- Host applies only for their owned active complete vehicle; member approval alone cannot publish; wrong vehicle/type, stale/revoked approval or bike capacity >1 denied.
- Guard covers old canonical HTTP routes, not merely new endpoints. Cohort mode denies public live links by default.
- Existing booking/lifecycle/payment tests remain green with cohort mode disabled in legacy synthetic tests; dedicated cohort-enabled cases verify denied and permitted paths against real MySQL.

## Completion evidence

Record exact source revision plus dirty manifest, migration status, scoped HTTP/MySQL tests, permission/decision race tests, integrated regression and client/device/provider boundaries. S1 local API completion does not establish real affiliation validation, email delivery, road routing or a complete ride service.
