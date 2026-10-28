# Relational model

```mermaid
erDiagram
    DBMS_USERS ||--o{ DBMS_RIDES : drives
    DBMS_USERS ||--o{ DBMS_BOOKINGS : makes
    DBMS_RIDES ||--o{ DBMS_BOOKINGS : contains
    DBMS_RIDES ||--o{ DBMS_EXPENSES : records
    DBMS_BOOKINGS ||--o{ DBMS_EXPENSES : allocates
    DBMS_EXPENSES ||--o{ DBMS_LEDGER_ENTRIES : posts

    DBMS_USERS {
        bigint id PK
        string display_name
    }
    DBMS_RIDES {
        bigint id PK
        bigint driver_id FK
        date travel_date
        string status
        int seats_total
        int fare_minor
    }
    DBMS_BOOKINGS {
        bigint id PK
        bigint ride_id FK
        bigint rider_id FK
        string status
        int fare_minor
    }
    DBMS_EXPENSES {
        bigint id PK
        bigint ride_id FK
        bigint booking_id FK
        int total_minor
        int participant_count
    }
    DBMS_LEDGER_ENTRIES {
        bigint id PK
        bigint expense_id FK
        string account
        string side
        int amount_minor
    }
```

The model is intentionally compact for repeatable SQL evidence. Its keys and relationships mirror the production concepts in the Laravel migrations, while the `dbms_` prefix prevents accidental collision with application tables. This first diagram is an isolated executable fixture; its FKs and cardinalities are enforced only inside that disposable schema.

## Actual MobilityPlatform relationship slice

```mermaid
erDiagram
    USERS ||--o{ TRIPS : owns
    TRIPS ||--o{ TRIP_PASSENGERS : has
    TRIPS ||--o| MOBILITY_POOL_PUBLICATIONS : publishes
    TRIPS ||--o| MOBILITY_TRIP_LIFECYCLES : lifecycle
    TRIPS ||--o{ MOBILITY_TRIP_EVENTS : records
    TRIP_PASSENGERS ||--o| MOBILITY_FARE_SNAPSHOTS : priced
    TRIPS ||--o{ MOBILITY_FINANCIAL_POSTINGS : posts
    MOBILITY_ROUTE_QUOTES }o--o| TRIPS : consumed_by

    USERS {
        int id PK
    }
    TRIPS {
        int id PK
        int user_id FK
        datetime trip_date
        string state
        int total_seats
    }
    TRIP_PASSENGERS {
        int id PK
        int trip_id FK
        int user_id FK
        int request_state
    }
    MOBILITY_POOL_PUBLICATIONS {
        int id PK
        int trip_id FK
        uuid quote_id FK
    }
    MOBILITY_TRIP_LIFECYCLES {
        int id PK
        int trip_id FK
        string state
    }
    MOBILITY_TRIP_EVENTS {
        int id PK
        int trip_id FK
        string action
        int version
    }
    MOBILITY_FARE_SNAPSHOTS {
        int id PK
        int trip_id FK
        int booking_id FK
        bigint gross_amount
    }
    MOBILITY_FINANCIAL_POSTINGS {
        int id PK
        int trip_id FK
        int booking_id FK
        bigint amount
    }
    MOBILITY_ROUTE_QUOTES {
        uuid id PK
        int user_id FK
        int consumed_trip_id FK
    }
```

This is a documented relationship slice, not a new migration. Exact base-table definitions come from the host platform; extension FKs and columns are defined in `backend/extensions/carpoolear/migrations/`. Relationships shown for `USERS`, `TRIPS`, and `TRIP_PASSENGERS` are conceptual host-schema links; extension relationships backed by migration FKs are enforced. `consumed_trip_id` is nullable and non-unique, so one route quote can be referenced by zero or more trips at the schema level.
