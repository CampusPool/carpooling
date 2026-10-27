# Data dictionary

| Table | Important columns | Integrity rule | Production concept mapped |
|---|---|---|---|
| `dbms_users` | `id`, `display_name` | unique display name | `users` |
| `dbms_rides` | `driver_id`, `travel_date`, `origin_stop`, `destination_stop`, `seats_total`, `status` | driver FK; positive seats; status check | `trips`, `mobility_trip_lifecycles`, route/pickup concepts |
| `dbms_bookings` | `ride_id`, `rider_id`, `status`, `fare_minor` | ride/rider FKs; one active booking per rider/ride; non-negative fare | `trip_passengers`, `mobility_booking_intervals`, fare snapshot |
| `dbms_expenses` | `ride_id`, `booking_id`, `total_minor`, `participant_count` | positive participant count; optional booking FK | `mobility_fare_snapshots` |
| `dbms_ledger_entries` | `expense_id`, `account`, `side`, `amount_minor` | debit/credit check; idempotent account-side key | `mobility_financial_postings` |

The view, function, procedure and trigger are declared in `evidence.sql`; no undocumented object is implied.

## Actual application tables used by the read-only reports

| Table | Verified columns used | Evidence source |
|---|---|---|
| `trips` | `id`, `user_id`, `trip_date`, `total_seats`, `state`, `is_passenger`, `deleted_at` | Mobility controllers/services and host model queries |
| `trip_passengers` | `trip_id`, `user_id`, `request_state`, `passenger_type` | extension tests/services and migration foreign keys |
| `mobility_pool_publications` | `trip_id`, `quote_id`, `user_id` | `2026_10_20_000300_create_mobility_pool_publications.php` |
| `mobility_trip_lifecycles` | `trip_id`, `state` | `2026_10_17_000000_create_mobility_lifecycle_tables.php` |
| `mobility_trip_events` | `trip_id`, `action`, `created_at` | `2026_10_17_000000_create_mobility_lifecycle_tables.php` |
| `mobility_fare_snapshots` | `trip_id`, `booking_id`, `currency`, `gross_amount` | `2026_10_17_000200_create_mobility_financial_tables.php` |
| `mobility_financial_postings` | `trip_id`, `booking_id`, `side`, `amount` | `2026_10_17_000200_create_mobility_financial_tables.php` |
| `mobility_route_quotes` | `college_code`, `expires_at`, `consumed_trip_id` | `2026_10_20_000200_create_mobility_routing_tables.php` |
| `mobility_commute_demo_trips` | `trip_id`, `vehicle_type`, `fare_minor`, `is_publication`, `direction` | `2026_10_22_000150_create_commute_product_tables.php` plus `2026_10_22_000170_add_commute_matching.php` |

`actual-analytics.sql` is the executable read-only report set for this slice. It is not installed as a view or stored procedure.

Financial posting status follows `PaymentService::postBalanced`: an `entry_group` is balanced when total debits equal total credits. A fare with no matching group is reported as `missing`; it is not treated as an unbalanced zero.
