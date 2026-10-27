# Actual-schema SQL status

The statements in `actual-analytics.sql` are read-only reports against the existing Laravel host schema. Their table and column names were checked against the repository's migration files and production query code:

- `trips`, `trip_passengers`, `users`, and `nodes_geo` are host-platform tables referenced by the extension migrations.
- `mobility_pool_publications`, `mobility_trip_lifecycles`, `mobility_trip_events`, `mobility_fare_snapshots`, `mobility_financial_postings`, and `mobility_route_quotes` are created by this repository's migrations.
- `mobility_commute_demo_trips` is a separate commute-demo publication surface and is reported separately from route-quote pool publications.
- `request_state = 1` is the accepted passenger state used throughout the extension tests and services.
- Financial groups use `entry_group` plus `side`; `PaymentService::postBalanced` enforces equal debit and credit totals within a group.

The reports were executed on a disposable clone of the local `carpoolear` MySQL schema on 2026-10-27. The clone was created by a read-only logical dump, the reports were run without DML, and the disposable database was removed afterward. The command/result record is retained in the coordinating task notes; no application database was changed.

These queries are analytics evidence, not new application features. They do not install a production view, trigger, function, or index, and they do not establish that the browser UI consumes these reports.
