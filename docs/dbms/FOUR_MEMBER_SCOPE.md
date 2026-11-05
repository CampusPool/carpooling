# Four-member DBMS scope

The user's working team is Arjun, Nithesh, Nikhil and Zayaan. The supplied
current requirements describe two-member teams approved by the course
instructor. Instructor acceptance of four members is unconfirmed; this document
records working responsibilities and evidence, not a course-granted exception.

Each member should explain both application behavior and database decisions.
The workstreams below guide that demonstration. Git history, actual changes,
personally reproduced checks and each student's explanation establish
contribution. The account that submits a PR does not allocate authorship of
every file in it.

| Member | DBMS/application responsibility | Evidence and explanation expected |
|---|---|---|
| Nithesh | Relational design, integrity, Mongo model and DBMS coordination | Explain ERD/cardinalities, keys versus logical references, normalization/snapshots, migration order, installed view/function/procedure/triggers, indexes and replay. Coordinate PR85 without claiming sole authorship of assisted work. |
| Arjun | Transactional backend, authorization and reproducible delivery | Trace stored local roles/ownership through capacity decisions, locks, idempotency and rollback. Explain runtime isolation and SQL authority with optional Mongo reporting. Full identity/OTP and real payments are deferred. |
| Nikhil | Discovery SQL, query analysis and verification | Explain route/date/availability filters, joins/subqueries, recursive dates, rolling averages, preaggregation against fan-out and index/EXPLAIN choices. Reproduce negative cases and distinguish sequential checks from race evidence. |
| Zayaan | Next.js integration and permission-aware UI | Demonstrate independent local rider/driver flows, loading/empty/error/retry states, decisions, notifications/chat and lifecycle actions. Explain operator analytics, scope and stale/unavailable activity. |

## Merged contribution record

These PR states/accounts were checked on 5 November 2026. Packages01–05 are
merged into official main `753853f`. The submitting account is a provenance
reference; inspect original commits and attributed follow-up changes before
assigning personal credit. AI-assisted follow-up work is disclosed separately
from student-authored commits.

| Package | Submitted GitHub account | Actual merged PR and scope |
|---|---|---|
| 01 | [NitheshMogaveer777](https://github.com/NitheshMogaveer777) | [PR83](https://github.com/CampusPool/carpooling/pull/83): account/profile migrations and schema documentation (#37). |
| 02 | [arjunsrikanthh](https://github.com/arjunsrikanthh) | [PR84](https://github.com/CampusPool/carpooling/pull/84): local rider/driver accounts and core booking safeguards (#10). |
| 03 | [NikhilJoshi441](https://github.com/NikhilJoshi441) | [PR86](https://github.com/CampusPool/carpooling/pull/86): discovery integrity and smoke verification. |
| 04 | [zayaan-06](https://github.com/zayaan-06) | [PR87](https://github.com/CampusPool/carpooling/pull/87): integrated ride UI (#42), including attributed follow-up state-label fixes. |
| 05 | [arjunsrikanthh](https://github.com/arjunsrikanthh) | [PR88](https://github.com/CampusPool/carpooling/pull/88): local core setup, backend CI and acceptance documentation. |

[PR85](https://github.com/CampusPool/carpooling/pull/85) was submitted through
`NitheshMogaveer777`. Subsequent Codex-attributed commits integrate actual
application SQL/Mongo/operator analytics. Read its checks and commit history
for delivery evidence; submission through that account does not establish
Nithesh personally wrote or verified all its contents.

## Why the database work is substantial

Bookings require capacity invariants and transactional ownership checks. Quotes
and trip snapshots preserve terms; lifecycle changes emit idempotent versioned
events; users have privacy and authorization boundaries. These relationships
and failure cases go beyond independent entity CRUD.

The Operations report consumes an installed view, utilization function, stored
procedure, recursive date CTE/window average and transactional decision audit.
Mongo aggregates replayed, allow-listed lifecycle events for server-derived
ride scope without becoming a second reservation authority.
[Application analytics](APPLICATION_ANALYTICS.md) maps these features to the
syllabus, their limits and failure behavior.

The separate `dbms_*` model demonstrates course DML and explicit Mongo CRUD in
an inspectable environment. Its size alone does not justify four-member
complexity; it is not the application's booking database.

## Present versus pending

- **Merged core:** five teammate packages, local username/password accounts with stored rider/driver roles, publication/discovery/request/decision/cancellation, named notifications/chat, lifecycle actions and reproducible setup. The revised 18 core issues are complete; closure does not award course marks.
- **Application DBMS integration:** Installed SQL objects, operator endpoint/component and private Mongo reporting have distinct full-backend, frontend and real API/Mongo verification commands. Use PR85 revision-specific checks/artifacts; supplementary fixture checks alone do not establish application behavior.
- **Deferred product work:** full identity/OTP, payments, real vehicle registration and physical GPS acceptance remain Sprint 3. Existing schemas and synthetic credit records do not establish real provider settlement.
- **Course acceptance:** team-size approval, individual contribution, originality/attribution, screenshots/submission, modification/viva and instructor evaluation remain human outcomes. No guaranteed marks or official four-member threshold is claimed.

## Final contribution record

For each member attach actual PR/commit links, files and behavior changed,
checks personally reproduced, demonstration segment and remaining gaps. Preserve
the pinned host's upstream/GPL attribution and disclose AI assistance. A useful
viva traces a browser action through authorization, SQL writes, audit rows and
the report, then explains why a Mongo outage cannot change a booking decision.
