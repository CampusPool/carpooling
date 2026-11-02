# DBMS evidence pack (disposable MySQL)

This is a course/demo evidence pack for the MobilityPlatform domain. It is intentionally namespaced (`dbms_*`) and **does not modify the Laravel application migrations or the pilot schema**. The table shapes are a small, executable projection of the real migrations:

- `trips` and `trip_passengers` are represented by `dbms_rides` and `dbms_bookings`.
- `mobility_trip_lifecycles` is represented by the ride lifecycle/status columns.
- `mobility_fare_snapshots` and `mobility_financial_postings` are represented by expenses and ledger rows.
- `mobility_pickup_points` and route matching are represented by origin/destination stop columns.

The source of truth for the production schema remains `backend/extensions/carpoolear/migrations/`. This pack is evidence of relational design and SQL techniques, not a claim that these objects are currently installed in the product database.

For the application migration order, disposable forward/rollback commands and
the external-host dependency boundary, see
[`MIGRATION_RUNBOOK.md`](MIGRATION_RUNBOOK.md).

`actual-analytics.sql` is separate: it contains read-only reports over the actual Laravel schema (`trips`, `trip_passengers`, and the mobility tables). Those reports were run against a disposable logical clone of the local MySQL schema; they do not install or alter application objects. See `ACTUAL_SCHEMA_STATUS.md` for execution status and limits.

The repeatable automated check is `scripts/test-actual-analytics.sh`. It starts an ephemeral `mysql:8.0` Docker container, loads only the minimal report-column fixture in `actual-analytics-fixture.sql`, and asserts nonempty pool, commute, balanced, unbalanced, and missing-posting rows. It never connects to the pilot database.

## What is demonstrated

`evidence.sql` creates a normalized ride/booking/expense model with primary keys, foreign keys, checks, unique constraints and indexes. It also creates:

1. `dbms_active_rides`: an aggregate view with remaining capacity and accepted fare totals.
2. `dbms_shared_expense_per_rider`: a deterministic stored function for integer minor-unit allocation.
3. `dbms_book_ride`: a stored procedure that locks one ride row and atomically enforces the last-seat rule.
4. `dbms_bookings_before_insert`: a trigger that rejects self-booking and invalid booking amounts.
5. A composite search index and an `EXPLAIN` query for route/date/status filtering.

## Safe verification

Create an empty disposable MySQL database whose name starts with `dbms_evidence_`, then run:

```sh
DBMS_EVIDENCE_ALLOW_DISPOSABLE=1 \
DBMS_EVIDENCE_DATABASE=dbms_evidence_local \
MYSQL_HOST=127.0.0.1 MYSQL_PORT=3306 MYSQL_USER=root \
scripts/verify-dbms-evidence.sh
```

The script refuses any database name outside the `dbms_evidence_*` namespace and refuses to run without the explicit opt-in. It only drops objects prefixed `dbms_` in that database. It never invokes Laravel migrations and never connects to the application database unless the caller deliberately supplies a matching disposable name.

## Concurrency demonstration

`concurrency.sql` is a two-session runbook for the `dbms_book_ride` procedure. With one available seat, exactly one concurrent transaction can commit; the second blocks on `FOR UPDATE`, observes no capacity, and receives `SQLSTATE 45000`. Run it only against the disposable database.

`scripts/test-dbms-concurrency.sh` automates that proof in a fresh ephemeral `mysql:8.0` container. It runs two parallel sessions using riders 3 and 4, asserts one successful booking and one `ride is full` failure, then checks the final accepted count and remaining capacity before cleanup.

## Limitations

This is not production integration, payment processing, Google Maps integration, or proof of a live two-device workflow. It deliberately avoids changing application behavior under time pressure. A later production migration would need a reviewed mapping from these evidence objects to the existing `trips`, `trip_passengers`, and mobility tables.
