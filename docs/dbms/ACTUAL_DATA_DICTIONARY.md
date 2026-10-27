# Actual-schema data dictionary

This dictionary records the tables and columns that matter to the commute,
matching, booking, lifecycle, recurring, dispatch, and financial workflows.
Names and types are taken from the migrations; a column is not added here just
because an API concept exists. `id()` means Laravel's auto-incrementing
unsigned BIGINT (unless a migration uses another explicit integer helper);
`uuid()` is a UUID primary/key value; `timestamps()` adds
`created_at` and `updated_at`.

## Commute demo, matching, bookings, and terms

| Table | Exact columns (type/role) | Keys and integrity |
|---|---|---|
| `mobility_commute_profiles` | `user_id` unsigned integer PK; `preferences` JSON; timestamps | No FK to `users`; one profile per application user identifier. |
| `mobility_commute_demo_actors` | `user_id` unsigned integer PK; `fixture_key` string; timestamps | `fixture_key` unique; no FK. |
| `mobility_commute_demo_trips` | `trip_id` unsigned integer PK; `audience_id` unsigned integer; `fixture_key` string(64); `vehicle_type` string(8); `fare_minor`, `base_fare_minor`, `surcharge_minor` integer; `journey` JSON; timestamps; later `is_publication` boolean indexed and `direction` string(12) nullable | `fixture_key` unique; no FK to `trips`, users, or audience. |
| `mobility_commute_demo_wallets` | `user_id` unsigned integer PK; `available_minor` big integer default 0; timestamps | No FK; synthetic wallet projection. |
| `mobility_commute_demo_holds` | `booking_id` unsigned integer PK; `rider_id`, `driver_id` unsigned integer; `amount_minor` integer; `state` string(16) default `held`; `arrived_at`, `release_at` timestamps nullable; timestamps | No FK; booking/user identifiers are logical associations. |
| `mobility_commute_demo_entries` | `id`; `user_id` unsigned integer; `kind` string(24); `amount_minor` big integer; `booking_id` unsigned integer nullable; timestamps | No FK; append-style wallet ledger rows. |
| `mobility_commute_receipts` | `id`; `user_id` unsigned integer; `key_hash`, `request_hash` string(64); `response` JSON; timestamps | unique(`user_id`,`key_hash`); idempotency receipt, no FK. |
| `mobility_commute_matches` | `match_key` string(64) PK; `trip_id`, `rider_id` unsigned integer indexed; `profile_hash` string(64); `journey` JSON; `fare_minor`, `base_fare_minor`, `surcharge_minor` integer; `pickup_at` datetime; `expires_at` timestamp; timestamps | No FK; `match_key` is the service-level quote/match boundary. |
| `mobility_commute_booking_terms` | `booking_id` unsigned integer PK; `match_key` string(64) indexed; timestamps | No FK; snapshots the selected match key for a booking. |

## Core route, lifecycle, and booking evidence

| Table | Exact columns | Declared FK(s) |
|---|---|---|
| `mobility_pickup_points` | `id`; `college_code` string(64); `canonical_node_id` unsigned integer; `version` unsigned integer; `name` string(160); `lat`, `lng` decimal(10,7); `vehicle_modes` JSON; `active` boolean; `verified_at` timestamp nullable; `synthetic_only` boolean; timestamps | `canonical_node_id → nodes_geo.id`; indexes support college/active and node/version. |
| `mobility_route_quotes` | `id` UUID PK; nullable `parent_quote_id` UUID; `user_id` unsigned integer; `college_code` string(64); `snapshot` JSON; `expires_at` timestamp; nullable `consumed_trip_id` unsigned integer; nullable unique `dispatch_request_id` UUID; timestamps | `user_id → users.id`; `consumed_trip_id → trips.id` null-on-delete; `parent_quote_id → mobility_route_quotes.id`; later `dispatch_request_id → mobility_dispatch_requests.id`. |
| `mobility_trip_lifecycles` | `id`; unique `trip_id` unsigned integer; `state` string(32) default `planned`; `version` unsigned integer default 0; timestamps | `trip_id → trips.id` restrict-on-delete. |
| `mobility_trip_participants` | `id`; `trip_id`, `booking_id`, `user_id` unsigned integers; `state` string(32) default `accepted`; timestamps | FKs to `trips.id`, `trip_passengers.id`, `users.id`; unique trip/booking and trip/user. |
| `mobility_trip_events` | `id`; `trip_id`, `actor_id` unsigned integer; `action` string(32); nullable `passenger_id`; `idempotency_key` string(100); `request_fingerprint` string(64); `version` unsigned integer; `response_status` unsigned small integer; `response_body` JSON; timestamps | FKs to `trips.id`, `users.id` for actor and passenger; unique trip/actor/key and trip/version. |
| `mobility_match_references` | `id` UUID PK; `user_id`, `trip_id` unsigned integer; `quote_id` UUID; `from_index`, `till_index` unsigned tiny integers; `fare_minor` unsigned big integer; `route_hash`, `vehicle_fingerprint` char(64); `expires_at`; nullable `booking_id`; nullable `request_key_hash` char(64); nullable `response_body` JSON; timestamps | FKs to users, trips, route quotes, and nullable trip passenger booking. unique user/request-key; trip/user indexes. |
| `mobility_booking_intervals` | `booking_id` unsigned integer PK; `trip_id` unsigned integer; `quote_id` UUID; `from_index`, `till_index` unsigned tiny integers; `fare_minor` unsigned big integer; `route_hash` char(64); nullable `match_reference_id` UUID; timestamps | FKs to trip_passengers, trips, route quotes, and match references. |

## Recurring, dispatch, and admission domains

| Table | Exact columns | Declared FK(s) / constraints |
|---|---|---|
| `mobility_recurring_programs` | UUID `id`; `user_id`, `car_id` unsigned integers; unique `source_quote_id` UUID; `route_snapshot` JSON; `weekly_schedule` unsigned small integer; `departure_time` string(5); `date_from`, `date_to` dates; `total_seats` unsigned small integer; `vehicle_type` string(8); `max_fare_minor` unsigned big integer; `pricing_version` string(64); `description` string(600); `state` string(16); `version` unsigned integer; nullable `generated_through`, `last_generation_code`; `create_key_hash`, `request_hash` char(64); timestamps | user→users, car→cars, source quote→route quotes; unique user/create key; state index. |
| `mobility_recurring_occurrences` | `id`; UUID `program_id`; `service_date`; unique `trip_id` unsigned integer; unique `quote_id` UUID; `program_version` unsigned integer; `config_snapshot` JSON; timestamps | program→programs cascade; trip→trips cascade; quote→route quotes restrict; unique program/date. |
| `mobility_recurring_exceptions` | `id`; UUID `program_id`; `service_date`; `action` string(16); `reason` string(500); `actor_id` unsigned integer; timestamps | program→programs cascade; actor→users restrict; unique program/date. |
| `mobility_recurring_actions` | `id`; UUID `program_id`; `actor_id`; `key_hash`, `request_hash` char(64); `action`; `previous_version`, `version`; nullable reason; nullable `before_snapshot`, `after_snapshot` JSON; `response_status`; `response_body` JSON; timestamps | program/actor FKs; unique program/actor/key. |
| `mobility_dispatch_requests` | UUID `id`; `rider_id`; unique `quote_id` UUID; `quote_hash`, `key_hash`, `request_hash` char(64); `vehicle_type`; `pickup_point_id` unsigned big integer; `state`; `attempt`; `expires_at`, nullable `next_attempt_at`; nullable `current_assignment_id` UUID; nullable unique `active_rider_id`; timestamps | rider→users; quote→route quotes; pickup→pickup points; current assignment→dispatch assignments; active rider→users. |
| `mobility_dispatch_availability` | PK `driver_id`; `car_id`; vehicle/fingerprint; `pickup_point_id` unsigned big integer; `online`; `last_seen_at`, `fresh_until`; nullable unique `active_request_id`; nullable `last_offered_at`; `version`; timestamps | driver→users; car→cars; pickup→pickup points; active request→dispatch requests. |
| `mobility_dispatch_offers` | UUID `id`; `request_id`; `driver_id`, `car_id`; `vehicle_fingerprint`; `attempt`; `state`; `expires_at`; timestamps | request→requests; driver→users; car→cars; unique request/driver. |
| `mobility_dispatch_assignments` | UUID `id`; `request_id`; unique `offer_id`; `quote_id`; `quote_hash`; driver/rider; unique `trip_id`, unique `booking_id`; `fare_minor`; nullable unique active request/driver; timestamps | FKs to request, offer, quote, users, trips, trip passengers, request, users. |
| `mobility_dispatch_events` | big-increment `id`; nullable request/driver/offer IDs; `action` string(48); unique `event_key` string(191); `payload` JSON; `created_at` | Nullable FKs to request, users, offers; request/id index. |

## Financial tables

`mobility_fare_snapshots` has `trip_id`, unique `booking_id`, `currency` char(3),
and unsigned big-integer `gross_amount`, `commission_amount`,
`driver_amount`. `mobility_payment_attempts` has trip/booking IDs, provider and
environment, order/payment references, unsigned big-integer `amount`, currency,
status, and nullable `captured_at`; provider/environment/order and payment
the provider/environment/order reference is unique, and the
provider/environment/payment reference is also declared unique. Because
`payment_reference` is nullable, MySQL permits multiple NULL values in that
composite unique key; uniqueness is effective once a provider supplies a
non-NULL reference. `mobility_provider_events` is an idempotent external
event inbox: provider, environment, event_id, event_type, payload_hash, and
timestamps, with unique provider/environment/event.

`mobility_financial_postings` stores trip/booking IDs, `entry_group`, `account`,
`side`, unsigned big-integer `amount`, currency, and timestamps; the
entry-group/account/side tuple is unique. `mobility_payment_blocks` stores
trip/booking, reason, active flag, timestamps, with unique booking/reason.
`mobility_payout_allocations` stores trip, unique booking, payment-attempt,
driver, unsigned amount, beneficiary reference, status, timestamps. Its
`payment_attempt_id`, trip, booking, and driver are declared FKs.
`mobility_payout_outbox` stores unique allocation, unique idempotency key, and
status. `mobility_payment_beneficiaries` stores user, provider/environment,
beneficiary reference, status, hold capability, optional verification time, and
timestamps; user/provider/environment is unique.

## Units, privacy, and evidence boundaries

`*_minor`, `fare_minor`, and financial unsigned `amount` values are integer
minor currency units; no floating-point arithmetic is implied. `lat`/`lng` are
decimal degrees at seven fractional places. `from_index`/`till_index` are
unsigned route-stop indexes, not meters. Hashes/fingerprints are fixed-width
hex-like values by contract; they are not reversible encryption. JSON snapshots
may contain route and response evidence, so production logging/export must
apply the same redaction policy as the activity projection service.

This document distinguishes migration-defined shape from runtime behavior. It
does not claim every migration is used by the browser demo, that payment
providers are live, or that all recurring/dispatch/financial paths are
integrated end-to-end.
