# Database deliverables

The application uses MySQL for booking integrity and MongoDB for rebuildable
lifecycle analytics. Its private Operations report connects Next.js to installed
application views, a function, a procedure, transactional audit triggers and
Mongo aggregation. Start with [application analytics](APPLICATION_ANALYTICS.md)
for the user flow, actual schema objects, bounds, privacy and reproduction.

Use [Level 3 acceptance](LEVEL3_ACCEPTANCE.md) for rubric traceability and
[four-member scope](FOUR_MEMBER_SCOPE.md) for contribution evidence and course
acceptance boundaries.

## Application schema and implementation

- [Selected-domain ERD](ACTUAL_SCHEMA_ERD.md) distinguishes declared foreign keys from logical associations.
- [Data dictionary](ACTUAL_DATA_DICTIONARY.md), [design notes](ACTUAL_SCHEMA_DESIGN_NOTES.md) and [migration runbook](MIGRATION_RUNBOOK.md) describe the Laravel extension and its pinned external host dependency.
- [Application analytics](APPLICATION_ANALYTICS.md) documents the operator API and actual `mobility_*` reporting objects installed by the application migration. SQL reports remain available during a Mongo outage.
- [Historical analytics SQL](actual-analytics.sql) uses application table/column names, but its separate [fixture](actual-analytics-fixture.sql) is a minimal-column report fixture. That verification does not replace the new application journey.
- [Activity projection](../../services/activity-projection/README.md) documents the allow-listed SQL-to-Mongo lifecycle read model, replay and credentials. It is separate from SQL notification inbox/chat storage.

The five teammate packages are merged into official main `753853f` through
[PR83](https://github.com/CampusPool/carpooling/pull/83),
[PR84](https://github.com/CampusPool/carpooling/pull/84),
[PR86](https://github.com/CampusPool/carpooling/pull/86),
[PR87](https://github.com/CampusPool/carpooling/pull/87) and
[PR88](https://github.com/CampusPool/carpooling/pull/88). The revised 18 core
issues are complete. Local username/password authentication with persisted
rider/driver roles is part of that core. Full identity/OTP, payments, real
vehicle registration and physical GPS acceptance remain Sprint 3.

[PR85](https://github.com/CampusPool/carpooling/pull/85) delivers application
analytics and its reproducible verifier. Read the PR checks/artifacts for
revision-specific automated evidence. Submission and instructor acceptance
remain separate from implementation and runtime verification.

## Reproduce the application report

From the repository root:

```sh
sh scripts/verify-dbms-application.sh
# Choose an existing isolated Docker VM on macOS when needed:
MOBILITY_DOCKER_CONTEXT=colima-sprint1-verify sh scripts/verify-dbms-application.sh
```

The application verifier checks a separate disposable host-backed SQL/Mongo/API
journey. Its dedicated `application-proof` CI job and sanitized
`dbms-application-log` artifact record the revision and results when run.
See [the runbook](APPLICATION_ANALYTICS.md#reproduction-and-evidence) for
isolation, overrides and evidence boundaries. Preserve pilot databases.

## Supplementary course model

`evidence.sql` creates a normalized, namespaced (`dbms_*`) model of rides,
bookings, expenses and ledger entries. It installs keys/constraints/indexes,
a view, an expense-allocation function, a booking procedure and a self-booking
trigger. The procedure requires a caller-owned transaction for capacity checks.
These objects are separate from installed `mobility_*` application reports and
do not decide application bookings.

```sh
sh scripts/verify-dbms-level3.sh
MOBILITY_DOCKER_CONTEXT=colima-sprint1-verify sh scripts/verify-dbms-level3.sh
```

This verifier creates disposable MySQL/Mongo containers without host data mounts
or published ports and removes its own containers on exit. It checks SQL DML,
joins/subqueries/CTEs, routines, constraints, minimal report fixtures and Mongo
creation/read/update/delete, indexes and aggregation. See `level3/` and
[dated supplementary evidence](level3/VERIFICATION.md). The `supplementary-proof`
CI job retains its own log artifact.

`concurrency.sql` is a manual two-session runbook. A single-session procedure
test does not establish concurrent race safety. Historical references to
`verify-dbms-evidence.sh`, `test-actual-analytics.sh` and
`test-dbms-concurrency.sh` named scripts absent from this source tree; use the
two verifiers above for their respective scopes.

## Evidence boundary

Current requirements permit SQL plus MongoDB and require meaningful application
interaction. They also describe instructor-approved two-member teams. Four
members are the user's working scope; instructor approval of that size remains
unconfirmed. Record actual contribution links, preserve upstream attribution,
disclose AI assistance and obtain human evaluation of originality,
modification/viva and the submitted artifact. CI cannot award marks or establish
those outcomes.
