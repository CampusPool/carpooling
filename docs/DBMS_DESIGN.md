# Relational schema and data dictionary

This page records the MySQL design used by the official prototype. Laravel migrations under `prototype/database/migrations/` and `prototype/campuspool-extension/migrations/` are the executable DDL source. The extension tables are additive; `trips` and `trip_passengers` remain the authority for offers, bookings and seat capacity.

## ER diagram

```mermaid
erDiagram
    USERS ||--o{ CARS : owns
    USERS ||--o{ TRIPS : drives
    CARS o|--o{ TRIPS : used_by
    TRIPS ||--o{ TRIP_PASSENGERS : receives_requests
    USERS ||--o{ TRIP_PASSENGERS : requests
    TRIPS ||--o| MOBILITY_TRIP_LIFECYCLES : lifecycle
    TRIPS ||--o{ MOBILITY_TRIP_EVENTS : records
    USERS ||--o{ MOBILITY_TRIP_EVENTS : acts
    TRIPS ||--o{ MOBILITY_COMMUTE_MATCHES : offered_for
    USERS ||--o{ MOBILITY_COMMUTE_MATCHES : rider_quote
    MOBILITY_COMMUTE_MATCHES ||--o{ MOBILITY_COMMUTE_BOOKING_TERMS : snapshots
    TRIP_PASSENGERS ||--o| MOBILITY_COMMUTE_BOOKING_TERMS : accepted_terms
    TRIP_PASSENGERS ||--o| MOBILITY_FARE_SNAPSHOTS : fare
    TRIP_PASSENGERS ||--o{ MOBILITY_PAYMENT_ATTEMPTS : payment_attempts

    USERS {
        int id PK
        string name
        string email UK
    }
    CARS {
        int id PK
        int user_id FK
    }
    TRIPS {
        int id PK
        int user_id FK
        int car_id FK
        datetime trip_date
        int total_seats
        int state
    }
    TRIP_PASSENGERS {
        int id PK
        int trip_id FK
        int user_id FK
        int request_state
        int passenger_type
    }
    MOBILITY_TRIP_LIFECYCLES {
        int id PK
        int trip_id FK_UK
        string state
        int version
    }
    MOBILITY_TRIP_EVENTS {
        int id PK
        int trip_id FK
        int actor_id FK
        string action
        string idempotency_key UK
        int version UK
    }
    MOBILITY_COMMUTE_MATCHES {
        string match_key PK
        int trip_id FK
        int rider_id FK
        datetime pickup_at
        datetime expires_at
    }
    MOBILITY_COMMUTE_BOOKING_TERMS {
        int booking_id PK_FK
        string match_key FK
    }
    MOBILITY_FARE_SNAPSHOTS {
        int id PK
        int trip_id FK
        int booking_id FK_UK
        int gross_amount
        int driver_amount
    }
    MOBILITY_PAYMENT_ATTEMPTS {
        int id PK
        int trip_id FK
        int booking_id FK
        string order_reference UK
        string status
    }
```

`MOBILITY_TRIP_EVENTS` is append-only evidence for lifecycle transitions. Its unique `(trip_id, actor_id, idempotency_key)` and `(trip_id, version)` keys make retries and event ordering unambiguous. The diagram omits unrelated inherited Carpoolear tables and some extension tables; it does not claim a new student identity or role model.

## Data dictionary

| Table | Key fields and meaning | Integrity and delete behavior |
| --- | --- | --- |
| `users` | `id` is the account key; `name`, `email` identify a prototype account. | Inherited identity table; user deletion policies are defined by the owning application migrations. |
| `cars` | `id`, `user_id`; one driver may have multiple cars. | Existing FK to `users`; deleted cars are soft-deleted in current migrations. |
| `trips` | `id`, `user_id`, `car_id`, departure/date, `total_seats`, legacy state. | SQL is authoritative for seat capacity. See legacy migrations and `Trip` model for full field set. |
| `trip_passengers` | `id`, `trip_id`, `user_id`, `passenger_type`, `request_state`. A row is retained when cancelled. | Existing FKs to `trips` and `users`; accepted rows reserve seats, cancelled rows do not. |
| `mobility_trip_lifecycles` | One row per trip, current state and monotone `version`. | Unique trip FK; delete restricted so an active lifecycle cannot be orphaned. |
| `mobility_trip_participants` | Trip, booking, user and boarding state snapshot. | Unique `(trip_id, booking_id)` and `(trip_id, user_id)`; references the trip, booking and user with delete restriction. |
| `mobility_trip_events` | Actor, action, idempotency key, request fingerprint, version and saved response. | Unique retry identity and version; trip/user FKs restrict deletion. |
| `mobility_commute_profiles` | One JSON commute preference snapshot per user. | User FK restricts deletion. JSON keeps optional preferences together; it is not booking authority. |
| `mobility_commute_matches` | One expiring route/fare quote keyed by `match_key`, trip, rider and pickup time. | Trip/user FKs; nonnegative fare checks. The quote is validated again when the request is made. |
| `mobility_commute_booking_terms` | One accepted quote key per `booking_id`. | Booking FK and quote FK restrict deletion; booking ID is the primary key. |
| `mobility_commute_demo_wallets` / `mobility_commute_demo_holds` / `mobility_commute_demo_entries` | Nonredeemable test credits, a per-booking hold and audit entries. Amounts are integer minor units. | User/booking FKs; nonnegative balance and hold amount, nonzero ledger entry. These tables are only for the gated synthetic demo. |
| `mobility_fare_snapshots` / `mobility_payment_attempts` | Immutable fare snapshot and provider attempt facts. | Booking/trip FKs restrict deletion; unique booking fare and provider order/reference identities prevent duplicates. |

The new forward migration `2026_10_27_000180_add_commute_integrity_constraints.php` adds explicit foreign keys to commute rows, supporting lookup indexes, and `CHECK` constraints for commute/demo money amounts. All new FKs use `RESTRICT` to retain booking, quote and audit history. Its `down()` removes the same checks, FKs and indexes; prior migrations are left untouched.

## Migration and rollback procedure

1. Start with a fresh clone and disposable MySQL database using `prototype/reproduction/verify-package.sh`; the package migration runner creates the complete schema in timestamp order.
2. Existing installs apply the additive migration with `php artisan migrate --force` during a maintenance window after a backup. It does not rewrite legacy rows or drop any table.
3. To reverse only this migration, run `php artisan migrate:rollback --step=1 --force` only when it is the most recently applied migration and only against the intended isolated database. Otherwise use an explicit reviewed migration rollback plan; do not rollback unrelated production migrations.
4. The full empty-database migration is the migration-order proof. The integrity feature tests assert that an orphan wallet and a negative wallet balance are rejected by MySQL.

Do not run a migration reset against a shared or production database. All course verification uses fresh disposable databases named `testing*`.

