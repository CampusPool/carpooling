# Level 3 rubric traceability

The supplied PES University DBMS Aug–Dec 2026 Level 3 sheet allocates 50 marks
across 14 components. These are rubric allocations, not awarded scores.
Current project requirements permit SQL plus NoSQL, require at least four
advanced SQL concepts and one NoSQL/vector concept, and require meaningful
Next.js application interaction. MongoDB is the chosen NoSQL database; vector
retrieval is not required by this problem.

The [UE23CS351A syllabus](https://drive.google.com/file/d/1AYjknCx-McNDuiNprowvOxnj93cQ5KEz/view)
grounds this work: Unit 2 covers aggregation/joins, views, functions/procedures,
triggers, CTEs and window functions; Unit 3 covers query optimization; Unit 4
covers transactions, concurrency, NoSQL and application connectivity.
[Application analytics](APPLICATION_ANALYTICS.md) maps these to installed
objects and the operator's report.

| Component | Marks | Repository evidence | Acceptance boundary |
|---|---:|---|---|
| ER diagram | 2 | [Application ERD](ACTUAL_SCHEMA_ERD.md); [course model](ERD.md) | Selected application domain and supplementary model are labelled separately. |
| Relational schema, keys, relationships, constraints | 3 | [Application dictionary](ACTUAL_DATA_DICTIONARY.md); extension migrations; `evidence.sql` | Logical references are not claimed as declared foreign keys. |
| SQL DDL with constraints | 4 | Extension migrations, including `2026_11_05_000100_create_operator_database_reports.php`; `evidence.sql` | Actual migration rollback/reapply requires disposable host-backed verification; fixture execution is separate. |
| NoSQL/vector database creation | 4 | [Activity projection](../../services/activity-projection/README.md); `level3/mongo.js` | Application Mongo collection validation/indexes and derived lifecycle events are separate from course CRUD records. No vector feature is claimed. |
| Technology justification | 1 | Rationale below; [application design](APPLICATION_ANALYTICS.md); ACTUAL_SCHEMA_DESIGN_NOTES.md | Explain SQL authority and the rebuildable Mongo read model. |
| DML operations | 4 | Publication/request/decision/cancellation API services; application booking-decision audit; `level3/walkthrough.sql` | Application state changes and course INSERT/SELECT/UPDATE/DELETE demonstrations have separate evidence. |
| Nested/correlated/recursive queries and joins | 4 | `mobility_operator_ride_facts`, `mobility_operator_daily`; `actual-analytics.sql`; `level3/walkthrough.sql` | Application joins preaggregate bookings against fan-out; recursive dates and a rolling window feed the real endpoint. Minimal report fixtures remain supplementary. |
| Procedure/function, trigger, CTE | 6 | Application migration: `mobility_utilization_pct`, `mobility_operator_daily`, booking-decision triggers; [controller](../../backend/extensions/carpoolear/Mobility/OperatorAnalyticsController.php) | Installed application objects feed UI/API. Separate `dbms_*` routines remain teaching examples. Audit starts at installation; no historical backfill. |
| NoSQL feature, RUD | 7 | Application lifecycle projection/upsert, Mongo daily aggregation/indexes; `level3/mongo.js` | Projection feeds application analytics. Explicit course read/update/delete examples use disposable records; no public event CRUD endpoint is implied. |
| Next.js interface | 3 | `frontend-next`, including [OperatorAnalytics](../../frontend-next/components/OperatorAnalytics.tsx) | Core teammate UI is merged. New report integration/browser verification is verified separately through PR85. |
| Backend/API/database integration | 2 | [Operator API](../../backend/extensions/carpoolear/Mobility/OperatorAnalyticsController.php); [application tests](../../backend/extensions/carpoolear/tests/MobilityOperatorAnalyticsTest.php); `scripts/verify-dbms-application.sh` | Verify actual host schema/routines/triggers and private Mongo reporting; fixture success is insufficient. New integrated verifier results await coordinator verification. |
| Authentication, at least two roles, database-backed authorization | 4 | [LocalAccountAuth](../../backend/extensions/carpoolear/Mobility/Identity/LocalAccountAuth.php); [CommuteService](../../backend/extensions/carpoolear/Mobility/Commute/CommuteService.php); [auth tests](../../backend/extensions/carpoolear/tests/LocalAccountAuthTest.php) | Local username/password authentication and stored rider/driver roles exist. Analytics additionally requires active, non-banned admin and configured college. Full identity/OTP is deferred. Role values are application-validated, not restricted by a local-account role CHECK. |
| Documentation, Git/GitHub | 2 | This directory; [merged contribution record](FOUR_MEMBER_SCOPE.md#merged-contribution-record); [PR85](https://github.com/CampusPool/carpooling/pull/85) | Final docs, logs and screenshots must identify the submitted revision. |
| Originality, individual contribution, modification/viva | 4 | [Contribution record](FOUR_MEMBER_SCOPE.md); upstream attribution | Requires actual student explanation and human evaluation; a PR account does not establish all authorship. |

## Technology rationale

MySQL/InnoDB supports relational ownership, uniqueness, foreign keys, atomic
lifecycle changes and row locking. The pinned Laravel host already uses MySQL;
retaining it avoids an unrelated platform migration. PostgreSQL could also
support these requirements. Quotes and JSON snapshots preserve historical
terms while canonical ownership remains relational.

MongoDB supports derived lifecycle events, unique replay identity, time/trip
indexes and day/action aggregation. It is rebuildable and never reserves seats
or decides bookings. Mongo outages suppress event counts while SQL reports
remain usable. Vector retrieval adds no necessary behavior to place/date/
availability matching. Next.js supplies the interface; Laravel owns
API authorization, SQL access and the private service call. Browser code
receives no database credentials or raw personal event payloads.

## Reproduction and completion

Run `sh scripts/verify-dbms-application.sh` for the disposable application
SQL/Mongo/API journey and `sh scripts/verify-dbms-level3.sh` for supplementary
course SQL/Mongo objects and minimal report fixtures. CI jobs and artifacts
are distinct. See the [runbook](APPLICATION_ANALYTICS.md) for migration
privileges, bounds and freshness behavior.

As of 5 November 2026, all five teammate packages are merged into main
`753853f`, and the revised 18 core issues are complete. PR85 adds the application advanced-database integration; use its
revision-specific CI artifacts for actual runtime verification. This table maps
requirements and does not award marks. Full identity/OTP, payments, real vehicle registration and
physical GPS remain Sprint 3 scope.

The supplied requirements describe instructor-approved two-member teams.
The user authorized four working members; instructor acceptance of that size
is unconfirmed. Before course submission, attach revision-specific evidence,
record actual individual contribution, preserve upstream attribution, disclose
AI assistance and rehearse modification/viva. Merged PRs and automated checks
do not establish course acceptance.
