# Level 3 rubric traceability

The supplied PES University DBMS Aug–Dec 2026 Level 3 sheet assigns 50 marks
across the following 14 components. Allocations below are not awarded scores.
The four-member scope is documented in [FOUR_MEMBER_SCOPE.md](FOUR_MEMBER_SCOPE.md).

| Component | Marks | Repository evidence | Acceptance boundary |
|---|---:|---|---|
| ER diagram | 2 | ACTUAL_SCHEMA_ERD.md; ERD.md | Selected application domain and teaching model are labelled separately. |
| Relational schema, keys, relationships, constraints | 3 | ACTUAL_DATA_DICTIONARY.md; migrations; evidence.sql | Logical references are not claimed as declared FKs. |
| SQL DDL with constraints | 4 | Extension migrations; evidence.sql | Course-model execution does not prove full host migration rollback. |
| NoSQL/vector database creation | 4 | level3/mongo.js; services/activity-projection | Mongo is the chosen NoSQL alternative. No vector feature is claimed. |
| Technology justification | 1 | Rationale below; ACTUAL_SCHEMA_DESIGN_NOTES.md | Explain SQL authority versus Mongo read model. |
| DML operations | 4 | level3/walkthrough.sql | Isolated INSERT/SELECT/UPDATE/DELETE with checks. |
| Nested/correlated/recursive queries and joins | 4 | level3/walkthrough.sql; actual-analytics.sql | CTE seven-day generator is a teaching example; report fixture is minimal. |
| Procedure/function, trigger, CTE | 6 | evidence.sql; level3/walkthrough.sql | Supplemental stored objects are not installed app objects. |
| NoSQL feature, RUD | 7 | level3/mongo.js | Read/update/delete, aggregation and index checks on disposable records; no app CRUD endpoint is implied. |
| Next.js interface | 3 | frontend-next | Final UI package integration and final browser evidence remain required. |
| Backend/API/database integration | 2 | [Backend services](../../backend/extensions/carpoolear/Mobility); [journey test](../../backend/extensions/carpoolear/tests/MobilityCommuteProductTest.php) | Fixture verification is separate from application runtime integration. |
| Authentication, at least two roles, database-backed authorization | 4 | [LocalAccountAuth.php](../../backend/extensions/carpoolear/Mobility/Identity/LocalAccountAuth.php); [CommuteService.php](../../backend/extensions/carpoolear/Mobility/Commute/CommuteService.php); [auth tests](../../backend/extensions/carpoolear/tests/LocalAccountAuthTest.php) | Password hashing and stored rider/driver roles are local/testing-gated functionality. Full authentication remains pending. Role values are application-validated, not restricted by a DB CHECK in the local-account migration. |
| Documentation, Git/GitHub | 2 | This directory; source/PR history | Final docs and reproducible evidence must match submitted revision. |
| Originality, individual contribution, modification/viva | 4 | FOUR_MEMBER_SCOPE.md contribution record instructions; upstream attribution | Requires actual student contributions/explanation; cannot be established by automated tests. |

## Technology rationale

MySQL/InnoDB fits relational booking ownership, atomic lifecycle changes,
foreign keys/uniqueness and row locking. Retaining the existing Laravel host's
MySQL stack avoids a database-platform migration; PostgreSQL could also support
these requirements. JSON snapshots preserve historical terms without replacing
relational integrity for canonical references.

MongoDB fits a derived lifecycle-event read model, unique replay identity,
time/action indexes and aggregation. It is disposable/rebuildable and never
reserves capacity. MySQL remains the transactional authority. Vector retrieval
is unnecessary for the present route/date/availability queries. Next.js provides
the required interface and Laravel owns API persistence/authorization.

## Reproduction and completion

Run `sh scripts/verify-dbms-level3.sh` at the repository root; the dedicated CI
workflow also runs it and retains logs. This verifies course SQL/Mongo objects
and minimal-column report compatibility, not an entire deployed application.

Before final course submission: finish deferred authentication/payment work as
required by final scope, integrate remaining application packages, verify the
actual browser/API journey, collect truthful contribution evidence, and rehearse
live modification/viva. Present the advanced-database model transparently; if
assessment requires those stored objects inside the application schema/UI,
additional integration is needed. Do not infer instructor acceptance from CI.
