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
