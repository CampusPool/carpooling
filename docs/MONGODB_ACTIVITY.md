# MongoDB activity and notification model

MySQL remains authoritative for users, trips, bookings, seat capacity and every booking/payment transition. MongoDB is an optional document store for append-only activity events and recipient-specific notifications; a MongoDB write must never confirm a seat or alter a SQL booking. Documents reference SQL IDs as values because a foreign key cannot span databases.

The mongosh setup file [`prototype/database/mongodb/activity-schema.js`](../prototype/database/mongodb/activity-schema.js) creates or tightens JSON Schema validators, creates the indexes below, and runs the daily event aggregation for the last 30 days. It can be run repeatedly:

```sh
mongosh "$MONGODB_URI" --file database/mongodb/activity-schema.js
```

Do not point the script at production until the team has provisioned credentials and backup/retention policies. It defaults to the `campuspool` database and only creates the two named collections.

## Document shapes

`activity_events` is append-only and stores non-authoritative activity facts such as `ride.published`, `booking.cancelled` or `trip.completed`:

```javascript
{
  event_id: "evt_01J...",          // unique producer-generated idempotency key
  event_type: "booking.cancelled",
  occurred_at: ISODate("2026-10-27T08:00:00Z"),
  trip_id: NumberLong(420),         // MySQL trips.id reference
  actor_id: NumberLong(77),         // MySQL users.id reference
  payload: { booking_id: NumberLong(120), reason: "rider_cancelled" }
}
```

`notifications` stores a recipient's inbox projection. `read_at` is `null` until the recipient reads it; `data` may include a SQL `trip_id` and `booking_id` for a link back to the authoritative API.

```javascript
{
  notification_id: "ntf_01J...",
  recipient_id: NumberLong(77),
  kind: "booking.cancelled",
  trip_id: NumberLong(420),
  created_at: ISODate("2026-10-27T08:00:00Z"),
  read_at: null,
  data: { booking_id: NumberLong(120) }
}
```

| Collection | Index | Purpose |
| --- | --- | --- |
| `activity_events` | unique `event_id` | De-duplicate producer retries. |
| `activity_events` | `(trip_id, occurred_at DESC)` | Trip history. |
| `activity_events` | `(event_type, occurred_at DESC)` | Recent event-type reporting and aggregation. |
| `notifications` | unique `notification_id` | De-duplicate notification delivery. |
| `notifications` | `(recipient_id, read_at, created_at DESC)` | Paginated unread/read inbox. |

The setup script's aggregation groups the last 30 days by Asia/Kolkata calendar day and `event_type`, returning event counts and the number of distinct trips. It uses `$match`, `$group`, `$dateTrunc`, `$addToSet`, `$project` and `$sort`; the `event_type, occurred_at` index supports the time-bounded source scan.

This establishes the collection contract and a reproducible mongosh setup/aggregation. The application does not yet dual-write events or notifications to MongoDB, and no production MongoDB credentials or retention policy are configured. See [DBMS design](DBMS_DESIGN.md) for the SQL ERD, data dictionary and migration strategy.
