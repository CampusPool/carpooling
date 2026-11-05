# Application database analytics

Operations reports published ride capacity, booking decisions and lifecycle
trends for the operator's configured college. Next.js calls Laravel; Laravel
reads installed MySQL objects and requests aggregate event history from a
private Mongo projection service. Booking decisions continue through the
existing transactional MySQL services. Mongo is never a booking dependency.

The application integration is delivered through
[PR85](https://github.com/CampusPool/carpooling/pull/85). Its checks provide
revision-specific execution evidence. This runbook describes the behavior and
reproduction commands; instructor acceptance is a separate assessment.

## Operator flow and scope

An active, non-banned authenticated admin with a configured college opens
Operations and selects the last 7, 14 or 31 days. The public endpoint is:

```text
GET /api/mobility/operator/analytics?days=7
Authorization: Bearer <operator session token>
```

The API accepts an integer from 1 through 31, defaults to 7 and returns an
inclusive Asia/Kolkata calendar window ending today. It sends
`Cache-Control: private, no-store, max-age=0`. Calling the URL directly still
requires authorization; hiding the UI is not the security boundary.

Only `mobility_commute_demo_trips.is_publication = true` rides owned by a local
driver account in the configured college enter the report. Generated fixtures
and other colleges are excluded. Historical rides from suspended owners remain
visible: suspension must not erase past operations. Counts describe local
published ride parties. Current publications offer one seat per ride party;
the report does not measure occupancy along every route segment.

The report shows offered/accepted seats, pending requests, completed rides and
capacity alerts, plus current declined/cancelled request counts. A daily table
shows scheduled rides, utilization and seven-day ride averages. Ride detail is
capped at 100 rows and latest decision audit at 20 rows. Summary/daily totals
cover the selected period independently of these caps. `sql.truncated`
identifies partial detail. Loading, empty, error and retry states are explicit.
Token/window changes and unmount invalidate old responses so one account's
report cannot populate another account's screen.

The selected window filters scheduled ride service dates. Decision rows are
the latest available audit entries for those rides, rather than a separate
count of decisions occurring on each selected day. Lifecycle trends filter
event occurrence times within the window and the same server-derived ride
IDs. These time bases answer different operational questions.

## Installed application SQL objects

The Laravel migration
[`2026_11_05_000100_create_operator_database_reports.php`](../../backend/extensions/carpoolear/migrations/2026_11_05_000100_create_operator_database_reports.php)
installs the following on the actual application schema.

| Object | Application behavior | Course concept |
|---|---|---|
| `mobility_operator_ride_facts` | Joins publications, local driver ownership, college membership and lifecycle state to booking totals preaggregated per ride. Excludes the owner's own passenger row. | View, joins, grouping/aggregation and subqueries; preaggregation prevents seat-count fan-out. |
| `mobility_utilization_pct(offered, accepted)` | Calculates seat utilization with a zero-offered guard. Called by the view and daily report. | Deterministic stored function. |
| `mobility_operator_daily(college, from, to)` | Enforces a 1–31-day interval, generates dates, fills absent days and computes rolling seven-day ride averages. Reads six preceding days for the first displayed average's complete lookback. | Procedure, recursive CTE, outer join, aggregate and window function. |
| `mobility_booking_decision_events` | Stores ride/booking reference, college, previous/new request state and UTC time. Booking deletion can null its reference; trip deletion cascades scoped history. | Relational keys, indexed audit access and transactional persistence. |
| `mobility_booking_decision_insert` / `mobility_booking_decision_update` | Append after scoped non-owner booking insertion or actual request-state change, in the same transaction. | Triggers, rollback and state-change audit. |

Audit labels are `0 Pending`, `1 Accepted`, `2 Declined`, `3 Cancelled`; a null
previous state marks creation. Audit starts when the migration is installed.
There is no historical backfill. It records state changes rather than unique
people and contains no names, coordinates or event payloads. Triggers do not
implement a second capacity/acceptance algorithm.

[`OperatorAnalyticsController`](../../backend/extensions/carpoolear/Mobility/OperatorAnalyticsController.php)
uses the view for summary/ride scope, calls the procedure for daily rows and
reads the audit for scoped history. The utilization function therefore affects
real API output. These installed objects are distinct from `evidence.sql` and
its `dbms_*` teaching routines, which do not govern application bookings.

View/procedure/function use invoker security. Migration rollback removes only
the new triggers, routines, view and audit table; existing booking/lifecycle
tables and services remain. Dropping the audit table discards accumulated
history. Rollback testing belongs in the disposable environment.

## Mongo lifecycle read model and privacy

The [projection service](../../services/activity-projection/README.md) reads
allow-listed columns from canonical `mobility_trip_events`. It excludes
response bodies, request fingerprints and idempotency keys. Unique
`sourceEventId` upserts make replay idempotent; full read-only SQL snapshot
replay from zero catches delayed commits. Collection validation and replay,
time/action and trip/time indexes support the model and aggregation.

Actor/passenger/trip IDs remain linkable internally. This is not anonymous data;
restrict credentials and establish retention. Neither the public report nor
private aggregate endpoint returns actor/passenger IDs, names, chat, route
coordinates or raw event payloads. The public report contains operational
ride/booking references and aggregates. SQL owns bookings, notifications and
chat; Mongo is lifecycle analytics rather than notification delivery.

Node binds on the private container network without a host-published port.
Laravel calls `POST /daily` with `X-Mobility-Analytics-Key`; its secret must
contain at least 32 characters and comes only from server environment
configuration. `/health` exposes opaque readiness. Callers cannot submit SQL/
Mongo query structures or choose a college through this service.

Laravel derives positive integer `trip_ids`; the private service accepts at
most 5,000 unique IDs and an inclusive/exclusive timestamp window spanning
1–31 days. If selected ride scope exceeds 5,000, event analytics is unavailable
rather than displaying partial counts as exact totals. Secrets and database
connection strings never enter browser props or responses.

## Availability and freshness

SQL reports and separately synchronized event history have different
availability. The public response separates `sql` from `activity`.

| Activity status | Meaning and UI behavior |
|---|---|
| `ready` | Completed successful sync supports aggregation. Show actual `last_synced_at` and lag; a genuine empty result may mean no recorded events. |
| `stale` | Event history is older than the freshness target. Label the snapshot and last success; counts may be incomplete. Empty stale history is not proof of zero activity. |
| `unavailable` | Service failure, uncertain sync or excessive scope prevents trustworthy counts. Keep SQL reports, suppress event tables and state that missing activity is not zero activity. |
| `disabled` | Private URL/key is not configured. Keep SQL reports and explicitly mark event counts unavailable. |

Only fully successful replay advances last-success freshness. Failed, partial
or in-progress work must not be labelled ready. The service serializes replays
and uses its completed-snapshot boundary to prevent mixed partial aggregates.
Laravel bounds the private request timeout and returns safe messages. SQL
schema failure is a report error, never an all-zero SQL summary. Missing Mongo
data does not silently become zero activity.

## Reproduction and evidence

From the repository root, use a disposable Docker environment:

```sh
sh scripts/verify-dbms-application.sh
# Optional macOS verification VM:
MOBILITY_DOCKER_CONTEXT=colima-sprint1-verify sh scripts/verify-dbms-application.sh
```

The verifier uses a unique owned Compose project, fresh SQL data and disposable
Mongo storage without host-published ports. Its environment is generated below
`.local/dbms-application/<instance>` without rewriting a preserved demo's
environment or targeting the pilot. Cleanup targets only its own stack.
`MOBILITY_DBMS_COMPOSE_OVERRIDE` accepts an absolute local override for cached
PHP images/vendor dependencies. Never point an override at a preserved database.
Sanitized JSON/log artifacts default to `output/dbms-application-verification/`.

The `application-proof` job in
[`.github/workflows/dbms-level3.yml`](../../.github/workflows/dbms-level3.yml)
uses this verifier and retains `dbms-application-log`. Checks must establish
actual migration installation and authenticated publication/request/accept/
lifecycle/audit behavior; scope, fan-out and bounds; actual SQL-to-
Mongo aggregates; and Mongo outage with SQL reports remaining available. Read
the artifacts for tested revision and actual result. The separate full backend
suite covers rollback/reapply, declined/cancelled audit states and report input
bounds; frontend tests cover report rendering and stale-response protection.

The supplementary verifier remains separate:

```sh
sh scripts/verify-dbms-level3.sh
```

That checks `dbms_*`, explicit course Mongo CRUD and minimal-column report
fixtures through its `supplementary-proof` CI job/artifact. It does not prove
the application runtime. Frontend tests verify rendering, retry and stale-
response protection with contract responses. Browser evidence and human course
acceptance remain separate obligations.

## Migration and runtime privileges

Migration needs reviewed permissions to create/drop the new view, function,
procedure, triggers and audit table/indexes/foreign keys. Use a scoped migration
account. Runtime invoker permissions must permit the required reads and routine
execution; trigger definers must retain the grants needed for scoped inserts.

With binary logging enabled, MySQL may otherwise demand elevated privileges
for stored function/trigger creation. The disposable development verifier
explicitly uses `log_bin_trust_function_creators` for reviewed objects. This is
a development/test flag, not a production change instruction. Production
requires a DBA-reviewed least-privilege migration/definer setup and backup/
rollback plan. Do not grant broad runtime rights or change production server
flags merely to run a course demo.

The projection SQL reader gets `SELECT` on `mobility_trip_events` only. Mongo
credentials are database-scoped for collection reads/writes plus validator/
index administration. Laravel's server-only configuration uses
`MOBILITY_ACTIVITY_SERVICE_URL` and `MOBILITY_ACTIVITY_SERVICE_KEY`; projection
SQL/Mongo connections remain environment variables rather than browser inputs.

## Syllabus and delivery boundary

The [UE23CS351A syllabus](https://drive.google.com/file/d/1AYjknCx-McNDuiNprowvOxnj93cQ5KEz/view)
connects Unit 2 aggregation/joins, views, functions/procedures, triggers, CTEs
and windows to the installed report; Unit 3 query optimization to bounded,
indexed access and preaggregation; and Unit 4 transactions, concurrency, NoSQL
and connectivity to atomic booking/audit writes and rebuildable aggregation.
Current requirements allow SQL plus MongoDB and require meaningful application
interaction. No vector feature is claimed.

Merged core has local username/password authentication and stored rider/driver
roles. Full identity/OTP, real payments/settlement, real vehicle registration
and physical GPS acceptance remain Sprint 3. The [four-member working scope](FOUR_MEMBER_SCOPE.md)
is user-authorized; requirements describe two-member teams and instructor
approval of four members is unconfirmed. Source and CI cannot establish
contribution, originality, viva, submission or instructor acceptance.
