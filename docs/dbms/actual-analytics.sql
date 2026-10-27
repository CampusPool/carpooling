-- READ-ONLY reports over the actual MobilityPlatform/Laravel schema.
-- These statements do not create, update, delete, or lock application rows.
-- Required host tables are documented beside each report.

-- A. Pool/segment published future offers and canonical accepted passenger count.
-- This report describes the route-quote/pool publication surface, not the
-- commute demo product (reported separately below).
-- Host tables: trips, mobility_pool_publications, mobility_trip_lifecycles,
-- trip_passengers. `total_seats`, `state`, `trip_date`, and request_state are
-- verified by the application queries and migrations in this repository.
SELECT t.id AS trip_id,
       t.user_id AS driver_id,
       t.trip_date,
       t.total_seats,
       COUNT(CASE WHEN p.request_state = 1 THEN 1 END) AS accepted_passengers,
       t.total_seats - COUNT(CASE WHEN p.request_state = 1 THEN 1 END) AS remaining_seats,
       l.state AS lifecycle_state
FROM trips AS t
JOIN mobility_pool_publications AS pub ON pub.trip_id = t.id
LEFT JOIN trip_passengers AS p ON p.trip_id = t.id
LEFT JOIN mobility_trip_lifecycles AS l ON l.trip_id = t.id
WHERE t.deleted_at IS NULL
  AND t.trip_date >= CURRENT_TIMESTAMP
  AND t.state = 'ready'
  AND t.is_passenger = 0
GROUP BY t.id, t.user_id, t.trip_date, t.total_seats, l.state
ORDER BY t.trip_date, t.id;

-- A2. Commute demo published offers (a separate application surface).
-- Host table: mobility_commute_demo_trips, added by
-- 2026_10_22_000150_create_commute_product_tables.php and extended with
-- is_publication/direction by 2026_10_22_000170_add_commute_matching.php.
SELECT m.trip_id, t.user_id AS driver_id, t.trip_date, m.vehicle_type,
       m.direction, m.fare_minor, l.state AS lifecycle_state
FROM mobility_commute_demo_trips AS m
JOIN trips AS t ON t.id = m.trip_id
JOIN mobility_trip_lifecycles AS l ON l.trip_id = t.id
WHERE m.is_publication = 1
  AND l.state = 'planned'
  AND t.state = 'ready'
  AND t.deleted_at IS NULL
  AND t.trip_date >= CURRENT_TIMESTAMP
ORDER BY t.trip_date, m.trip_id;

-- B. Booking-state distribution by trip (useful for admission/cancellation
-- audit; avoids treating pending rows as occupied seats).
SELECT trip_id, request_state, COUNT(*) AS booking_count
FROM trip_passengers
GROUP BY trip_id, request_state
ORDER BY trip_id, request_state;

-- C. Lifecycle audit volume by action and state-changing trip.
-- Host table: mobility_trip_events (migration verified columns trip_id/action).
SELECT trip_id, action, COUNT(*) AS event_count,
       MIN(created_at) AS first_event_at, MAX(created_at) AS last_event_at
FROM mobility_trip_events
GROUP BY trip_id, action
ORDER BY last_event_at DESC, trip_id;

-- D. Fare snapshots versus double-entry posting groups. FinancialService
-- requires SUM(debits) = SUM(credits) per entry_group; comparing gross_amount
-- with the sum of both sides would falsely flag every balanced group.
-- The left join deliberately preserves a fare with no postings and labels it
-- `missing`, while unequal debit/credit totals are `unbalanced`.
-- Host tables/columns are defined in 2026_10_17_000200_create_mobility_financial_tables.php.
SELECT fs.trip_id, fs.booking_id, fs.currency, fs.gross_amount,
       fp.entry_group,
       COALESCE(fp.debit_total, 0) AS debit_total,
       COALESCE(fp.credit_total, 0) AS credit_total,
       COALESCE(fp.debit_total, 0) - COALESCE(fp.credit_total, 0) AS signed_delta,
       CASE WHEN fp.entry_group IS NULL THEN 'missing'
            WHEN fp.debit_total = fp.credit_total THEN 'balanced'
            ELSE 'unbalanced' END AS posting_status
FROM mobility_fare_snapshots AS fs
LEFT JOIN (
  SELECT trip_id, booking_id, entry_group, currency,
         SUM(CASE WHEN side = 'debit' THEN amount ELSE 0 END) AS debit_total,
         SUM(CASE WHEN side = 'credit' THEN amount ELSE 0 END) AS credit_total
  FROM mobility_financial_postings
  GROUP BY trip_id, booking_id, entry_group, currency
) AS fp ON fp.trip_id = fs.trip_id AND fp.booking_id = fs.booking_id
ORDER BY fs.trip_id, fs.booking_id, fp.entry_group;

-- E. Route quote freshness and consumption coverage.
SELECT college_code,
       COUNT(*) AS quote_count,
       SUM(expires_at < CURRENT_TIMESTAMP) AS expired_count,
       SUM(consumed_trip_id IS NOT NULL) AS consumed_count
FROM mobility_route_quotes
GROUP BY college_code
ORDER BY college_code;
