# MobilityPlatform migration and rollback runbook

This document closes the operational gap between the schema diagrams/data
dictionary and the migration source. The canonical DDL is the PHP migration
set under `backend/extensions/carpoolear/migrations/`; the DBMS evidence SQL
under this directory is a disposable teaching fixture and must not be used as
the application schema.

## Scope and prerequisites

The extension is mounted into the pinned Laravel host described in
`research/experiments/carpoolear/README.md`. That host owns the base tables
(`users`, `trips`, `trip_passengers`, `cars`, and `nodes_geo`). Apply the
extension migrations only after the host schema and the extension service
provider/migration path are configured. The extension checkout is not a
self-contained Laravel application.

Use a fresh disposable MySQL database for verification. Never run these
commands against the preserved pilot database, a production database, or a
database containing user data.

## Forward migration check

From the repository root, inspect the source revision. Run Artisan commands
from the configured Laravel host root, where `artisan` exists and the
extension migrations have been registered:

```sh
git rev-parse HEAD
cd /path/to/configured/laravel-host
php artisan migrate:status
```

After taking an environment-approved database backup, run the host's normal
forward migration command:

```sh
php artisan migrate --force
php artisan migrate:status
```

The extension migrations are timestamped from `2026_10_17` through
`2026_10_27`. Two timestamps intentionally contain more than one migration;
the complete filename (not only the timestamp prefix) is the migration name.
Laravel's migration table records the full names and batch, so do not rename
files after they have been applied.

## Reversibility review

Every tracked extension migration currently defines both `up()` and `down()`.
The static check below is safe and does not connect to a database:

```sh
for f in backend/extensions/carpoolear/migrations/*.php; do
  rg -q 'function down\s*\(' "$f" || { echo "missing down(): $f"; exit 1; }
done
```

For a disposable verification database, record the migration status, apply the
full set, then roll back the last batch and reapply it:

```sh
php artisan migrate:status
php artisan migrate --force
php artisan migrate:rollback
php artisan migrate --force
php artisan migrate:status
```

`migrate:rollback` reverses the most recent batch only. Use
`migrate:rollback --step=N` only when the batch history and dependency order
have been reviewed. Do not use `migrate:fresh`, `migrate:reset`, or manual
`DROP TABLE` commands on a shared or preserved database.

## Dependency and rollback notes

- The routing/quote migrations require the host `users`, `trips`, and
  `nodes_geo` tables. Segment, lifecycle, dispatch, recurring, and financial
  migrations add foreign keys among extension tables and should be rolled back
  in reverse migration order.
- Several migrations alter an earlier table (`Schema::table`) and their
  `down()` methods remove those columns, indexes, or foreign keys. Verify the
  target migration batch before rolling back because existing application rows
  may depend on those constraints.
- JSON route, terms, response, and configuration snapshots are persisted
  evidence. A rollback removes the associated tables/columns; export any
  course evidence from the disposable database before rollback if it must be
  retained.
- A successful migration run proves schema installation only. It does not
  prove browser behavior, live routing, provider payments, or course approval.

## Evidence to attach to an issue PR

Record the source revision, `migrate:status` before and after, the disposable
database identifier, forward migration result, rollback/reapply result, and
the relevant focused tests. Redact credentials, connection strings, user rows,
and any precise pilot data. Keep the evidence tied to the exact migration
filenames so a reviewer can reproduce the same schema.
