# Database deliverables

Use [Level 3 acceptance](LEVEL3_ACCEPTANCE.md) for the 50-mark rubric and
[four-member scope](FOUR_MEMBER_SCOPE.md) for workstream boundaries and remaining work.

## Application schema

- [Selected-domain ERD](ACTUAL_SCHEMA_ERD.md) distinguishes declared foreign keys from logical associations.
- [Data dictionary](ACTUAL_DATA_DICTIONARY.md), [design notes](ACTUAL_SCHEMA_DESIGN_NOTES.md), and [migration runbook](MIGRATION_RUNBOOK.md) describe the Laravel extension and its external host dependency.
- [Actual analytics](actual-analytics.sql) report on application table/column names. The verifier runs these reports against a **minimal-column fixture**, not a full application database.
- `services/activity-projection` contains the separate SQL-to-Mongo event read model. MySQL remains authoritative for booking and capacity.

## Executable course model

`evidence.sql` creates a small normalized, namespaced (`dbms_*`) model of rides,
bookings, expenses and ledger entries. It installs keys/constraints/indexes,
a view, an expense-allocation function, a booking procedure and a self-booking
trigger. The procedure requires a caller-owned transaction for capacity checks.
Unsigned columns/constraints restrict amounts; the trigger checks ride existence
and self-booking. These are supplementary course objects, not application migrations.

From the repository root:

```sh
sh scripts/verify-dbms-level3.sh
# For the existing Mac verification VM:
MOBILITY_DOCKER_CONTEXT=colima-sprint1-verify sh scripts/verify-dbms-level3.sh
```

The verifier creates disposable MySQL/Mongo containers, without host data mounts
or published ports, and removes its own containers on exit. It tests SQL DML,
joins/subqueries/CTEs, routines, constraints and Mongo creation/read/update/delete,
indexing and aggregation. See `level3/` for the executable walkthrough.
The separate DBMS workflow retains the command output as a CI artifact.

`concurrency.sql` is a manual two-session transaction runbook. A successful
single-session procedure test is not a concurrent-race proof. Historical
references to `scripts/verify-dbms-evidence.sh`, `test-actual-analytics.sh`, and
`test-dbms-concurrency.sh` described scripts absent from this source tree;
the command above replaces those reproducibility claims for this deliverable.

## Evidence boundary

A passing course-model run does not prove full host migration rollback, browser
integration, payment-provider behavior, production authentication or instructor
acceptance. The actual app, analytics fixture and supplementary model are distinct.
Use synthetic records for course evidence and preserve upstream attribution.
