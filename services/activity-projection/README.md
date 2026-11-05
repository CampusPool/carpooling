# SQL → Mongo activity projection

This is an analytics/read model for the authoritative Laravel table
`mobility_trip_events`. MySQL remains the source of truth for lifecycle state.
The service reads only the allow-listed columns (`id`, trip/actor/passenger IDs,
action, version, status, and timestamps). It never selects or copies
`response_body`, `request_fingerprint`, or `idempotency_key`.

Each run scans a `REPEATABLE READ, READ ONLY` MySQL transaction snapshot from ID zero to that
snapshot's maximum ID. There is intentionally no persisted high-water mark:
replaying the run is safe and catches events committed after an earlier run.
Mongo upserts are keyed by the unique `sourceEventId`, so retries do not create
duplicates. Mongo is therefore disposable and rebuildable, while SQL stays
authoritative. The actor, passenger, and trip IDs are still linkable identifiers
from the source SQL system; they are retained only for analytics joins and must
be protected with restricted Mongo credentials and an explicit course/project
retention policy. They are not anonymized, pseudonymized, or claimed to be
non-personal data.

## Collection and source of truth

The default collection is `mobility_activity_events`. Each projected document
contains `source`, `sourceEventId`, `tripId`, `actorId`, nullable `passengerId`,
`action`, `version`, `responseStatus`, `occurredAt`, `projectedAt`,
`sourceTimezone`, and the `privacy` flags defined in `src/projection.mjs`.
`sourceEventId` has a unique index for replay; `(occurredAt, action)` supports
time/action analysis and `(actorId, occurredAt)` supports actor/time lookups.
The `daily` command runs a MongoDB aggregation grouped by Kolkata calendar day
and action, returning event counts and distinct trip counts.

## Private application service

`npm start` runs the application sidecar. It binds `0.0.0.0:${PORT:-8090}`
inside its private container network; do not publish its port to the host or
internet. In addition to the database configuration below, set a private
`MOBILITY_ACTIVITY_SERVICE_KEY` of at least 32 characters. Laravel sends that
key in `X-Mobility-Analytics-Key`; browser requests use the authenticated Laravel
operator API instead. Keep the key and database URLs out of browser bundles.

`POST /daily` accepts only this JSON shape:

```json
{"from":"2026-11-04T00:00:00+05:30","to":"2026-11-05T00:00:00+05:30","trip_ids":[7,8]}
```

The time window is inclusive/exclusive, an integral 1–31 days. Trip IDs must be
unique positive safe integers, at most 5000; an empty list is valid. Laravel
derives those IDs from its authorized college/publication scope. The service
accepts no query operators, user IDs, SQL, or Mongo pipelines. The response is
`{status,last_synced_at,lag_seconds,daily}`, with only day/action/event-count/
distinct-trip-count aggregate rows. Invalid credentials receive 401; invalid
requests receive 400. `/health` is unauthenticated but returns only opaque
`ready`/`unavailable` status, with 200/503 respectively.

The worker begins immediately and replays full SQL snapshots after each
completed run, waiting `SYNC_INTERVAL_SECONDS` (default 60) between runs. A
single run owns projection writes. New startup, any active replay, or a failed
replay returns 503 with `status:unavailable`, an empty `daily` array, and a safe
message. An empty array in this response is **not** a zero-activity report.
Only full success advances the in-memory completion timestamp and snapshot
boundary. Restart requires another full success before reports are served.
Results older than max(120 seconds, three sync intervals) are explicitly
`stale`. Queries also constrain `sourceEventId` to the completed snapshot;
results are discarded if a replay starts while a Mongo query is running.
The app can keep displaying its independent live SQL report when this service
is unavailable.

Mongo uses a strict JSON schema for the allow-listed lifecycle document shape,
including known lifecycle actions, positive safe identifiers and true privacy
flags. An additional `(tripId,occurredAt)` index supports the private report.
The runtime Mongo account needs create/modify collection validation and index
permissions in this dedicated analytics database plus collection read/upsert;
it needs no authority over application SQL. Use a dedicated SQL SELECT-only
reader for `mobility_trip_events`. Existing CLI `sync` and `daily` remain
available; do not run a separate CLI writer concurrently with the service.

The Dockerfile defaults to Node 24 and supports `--build-arg
NODE_IMAGE=node:20-bookworm` for an already cached supported local image.
No port is published by the Dockerfile. Network operations and aggregate
queries have explicit timeouts; each replay also has a two-minute execution
budget. Failures are retried on the next worker cycle without logging private
driver errors or connection strings.

This collection contains lifecycle events, not a notification inbox or chat
history. Commute booking notifications are currently stored in MySQL in
`mobility_commute_booking_notifications` (user, booking, trip, kind, dedupe key,
read time and timestamps); unread chat counts are computed from the SQL-backed
conversation state. A Mongo notification projection has not been implemented.
Any future notification documents need their own access and retention design;
the current analytics collection must not be presented as a delivery system.
MySQL remains authoritative for notifications, bookings and seat capacity;
the Mongo projection is never used to reserve a seat or decide booking state.

## Configuration and use

Use a dedicated SQL account granted `SELECT` on `mobility_trip_events` only.
All connection parameters are environment variables; nothing is accepted from
the browser or a public API.

```sh
export MOBILITY_ACTIVITY_MYSQL_URL='mysql://readonly_user:password@127.0.0.1:3306/app'
export MOBILITY_ACTIVITY_MYSQL_TIMEZONE='+05:30' # must match the SQL server/app source zone; Z is also supported
export MOBILITY_ACTIVITY_MONGODB_URI='mongodb://127.0.0.1:27017'
export MOBILITY_ACTIVITY_MONGODB_DB='mobility_analytics_dev'
npm install
npm test
npm run sync
npm run daily
```

For a fresh, host-backed SQL/Mongo proof that cannot reach the preserved pilot,
run from this checkout with `MOBILITY_ACTIVITY_ALLOW_DISPOSABLE=1`:

```sh
MOBILITY_ACTIVITY_ALLOW_DISPOSABLE=1 \
MOBILITY_DOCKER_CONTEXT=colima-mobility \
npm run test:disposable
```

The harness creates a unique Compose project, random loopback ports, a
least-privilege SQL reader, and Mongo/MySQL files below
`.local/activity-projection-disposable/<project>/`. It never uses the pilot
database and does not delete the host-backed files when the containers stop,
so a teacher can inspect or remove that one named directory later. The SQL
source is still authoritative in this proof; Mongo is rebuilt by replaying the
allow-listed lifecycle rows. The fixture rows contain deliberately sensitive
values to verify they are omitted, but are not application or pilot records.

To project actual events from an isolated teacher demo, set
`MOBILITY_ACTIVITY_ALLOW_TEACHER_DEMO=1`, provide a project named
`mobility-teacher-demo-<pid>` and a loopback `MOBILITY_TEACHER_DEMO_GATEWAY`,
then run `MOBILITY_ACTIVITY_TEACHER_DEMO_PREPARED=1 npm run test:teacher-demo`.
This mode verifies the named app/mysql/
gateway stack and synthetic `testing` database, reads lifecycle events from
a separately prepared local API workflow, creates a SELECT-only SQL account, and runs
the projector against a dedicated host-backed Mongo container on the same
network. It stores sanitized evidence beneath `.local` and never queries the
pilot or prints credentials. Projection stops if the exercised commute API
does not emit canonical `mobility_trip_events`; it never substitutes fixtures
or inferred activity. When it succeeds, the rows are actual events from the
synthetic teacher stack; accounts, route and credits remain demo-only. To let
the script seed offers and mutate a demo stack, explicitly set
`MOBILITY_ACTIVITY_ALLOW_TEACHER_DEMO_MUTATION=1`; it verifies the gateway
port mapping before making any request.

`npm run daily` emits counts grouped by calendar day in Asia/Kolkata and
action, including unique trip counts. The projection preserves the configured
SQL source timezone in each document; it does not invent an IST conversion.
The service does not mutate SQL. Point
Mongo at a disposable analytics database in development and CI; do not point
the test command at the persistent pilot database.
