# ERD and data dictionary — draft

This is derived directly from `campuspool/sql/migrations/001_schema.sql` and `002_evidence.sql`. It is a documentation aid for the new TypeScript implementation, not evidence that the migrations have been accepted by faculty.

## ERD

```mermaid
erDiagram
  USERS ||--o{ SESSIONS : owns
  USERS ||--o{ VEHICLES : owns
  USERS ||--o{ RIDES : drives
  USERS ||--o{ BOOKINGS : requests
  USERS ||--o{ LEDGER : has
  USERS ||--o{ OUTBOX : emits
  STOPS ||--o{ RIDES : origin
  STOPS ||--o{ RIDES : destination
  VEHICLES ||--o{ RIDES : used_for
  RIDES ||--o{ BOOKINGS : contains
  BOOKINGS ||--o{ LEDGER : records
  RIDES ||--o{ OUTBOX : references
  BOOKINGS ||--o{ OUTBOX : references

  USERS { bigint id PK; varchar name; varchar email UK; varchar role; varchar status; int credits }
  SESSIONS { char token_hash PK; bigint user_id FK; datetime expires_at }
  VEHICLES { bigint id PK; bigint owner_id FK; varchar kind; varchar registration UK; tinyint passenger_capacity; varchar status; bigint reviewed_by FK }
  STOPS { bigint id PK; varchar name UK; decimal lat; decimal lng }
  RIDES { bigint id PK; bigint driver_id FK; bigint vehicle_id FK; bigint origin_stop_id FK; bigint destination_stop_id FK; datetime departure_at; tinyint total_seats; tinyint seats_available; smallint credit_price; varchar status }
  BOOKINGS { bigint id PK; bigint ride_id FK; bigint rider_id FK; varchar status; bigint cancelled_by FK; varchar cancellation_reason }
  LEDGER { bigint id PK; bigint user_id FK; bigint booking_id FK; varchar kind; int amount }
  OUTBOX { char event_id PK; varchar type; bigint actor_id FK; json audience_ids; bigint ride_id FK; bigint booking_id FK; json data; datetime published_at; int attempts }
```

## Dictionary

| Table | Key data and purpose | Integrity rules |
| --- | --- | --- |
| `users` | Identity, role, approval status, synthetic credits | Unique email; role/status checks |
| `sessions` | SHA-256 token hash and expiry | User FK; raw cookie token is never stored |
| `auth_attempts` | Login throttling bucket and expiry | Primary bucket key |
| `stops` | Fixed campus route endpoints and optional coordinates | Unique name |
| `vehicles` | Owner, CAR/BIKE, registration, capacity, review status | Unique registration; BIKE capacity 1; capacity 1–5 |
| `rides` | Driver/vehicle/route/time, seats, synthetic price, lifecycle | Distinct stops; seats 1–5 and available ≤ total; price 1–1000 |
| `bookings` | Rider request/accept/reject/cancel state and provenance | Active rider generated key prevents duplicate active booking |
| `ledger` | Positive one-time HOLD/REFUND entries per booking | Unique `(booking_id, kind)`; append-only in migration 002 |
| `idempotency_records` | Actor/key/payload hashes and prior response | Unique actor/key; prevents repeated domain mutation |
| `outbox` | Transactional event awaiting Mongo projection | Unique event ID; retry attempts and published timestamp |

Migration `002_evidence.sql` adds `driver_ride_summary`, `ride_capacity_report`, supporting indexes, and guards that prevent changing an active ride's core fields or updating/deleting ledger history. Migration execution and integrity output are recorded in the verified disposable database run; the final course screenshot/export still needs to be captured.
