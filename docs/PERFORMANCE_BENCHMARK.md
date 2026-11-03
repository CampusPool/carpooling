# Local login and search measurements

`scripts/benchmark-http.py` records HTTP latency percentiles for a configurable
login endpoint and authenticated commute-search endpoint. It uses only Python's
standard library, prompts for a synthetic test login (password entry is
hidden), keeps the token in memory, and never prints response bodies or tokens.
It writes only the requested aggregate JSON report.

## Safety and prerequisites

Use a loopback API backed by a disposable database populated only with synthetic
users and rides. Login creates sessions and search stores signed match records;
do not point the harness at a shared, staging, or production database. The
script enforces a loopback HTTP base URL and requires the explicit
`--confirm-disposable` flag. Do not put credentials in shell arguments or commit
benchmark reports containing sensitive deployment details.

The host must provide a functioning test login route and an already configured
synthetic rider with a valid saved commute profile. Search must be able to use
the configured route provider, or the test environment must provide an explicit
fixture routing configuration. A password-based login endpoint is required for
repeated login timings. The current student OTP flow consumes each challenge
once, so this script measures password login only; OTP verification would need a
separate test-only challenge fixture. Endpoint paths are validated as local
paths and HTTP redirects are disabled so credentials and bearer tokens are not
forwarded to another host.

The current `/api/login` middleware allows five attempts per source IP per 15
minutes. The harness defaults to one warmup and four measured samples and
rejects a total above five. Run against a freshly started disposable app with
an unused test cache. Four samples give coarse tail percentiles; they are not a
stable service-level estimate. A broader load study needs an approved test-only
rate-limit setup and a separate runbook.

Example, after preparing a fresh disposable local backend with synthetic data:

```sh
python3 scripts/benchmark-http.py \
  --base-url http://127.0.0.1:18080 \
  --date 2026-11-03 \
  --revision b6c1bddafda9b52e8cb988f48b80fbbeb07f10e1 \
  --dataset '200 published offers, 40 eligible hosts, synthetic Bengaluru routes' \
  --warmup 1 --samples 4 \
  --confirm-disposable \
  --output /tmp/mobility-performance.json
```

The login endpoint defaults to `/api/login` with `email` and `password` fields,
and reads the returned token at `token`. Use `--login-path`,
`--login-user-field`, `--login-password-field`, `--token-path`, or
`--search-path` to match a different local host. The search request uses
`direction`, `date`, `vehicle_type`, and `pickup_choice` query fields. Run with
at least 3 measured samples for a report and preserve the exact source SHA,
seed-data description, database/server version, routing provider/fixture,
cache state and command alongside the JSON. Results are serial local HTTP
latencies; they do not include browser rendering or represent production users.

## Query plan evidence

Capture the query plan against the same disposable MySQL dataset and source
revision after the workload. The candidate scan is in
`backend/extensions/carpoolear/Mobility/Commute/CommuteMatchingService.php`;
the current implementation joins publication metadata, trips and lifecycle,
filters publication/direction/state/future date/readiness/deletion/vehicle,
orders by trip date and id, and limits the scan to 51 rows to report
truncation.

Use MySQL `EXPLAIN ANALYZE` on the equivalent candidate query below, replacing
the date bounds with the exact values from the benchmark run and matching the
actual MySQL version. Save the output with the same evidence bundle. This is a
plan for the candidate scan only; it does not include the per-candidate route
planning, host eligibility, passenger counts, or HTTP serialization.

```sql
EXPLAIN ANALYZE
SELECT m.trip_id, m.vehicle_type, m.direction, t.user_id, t.car_id,
       t.trip_date, t.total_seats
FROM mobility_commute_demo_trips AS m
JOIN trips AS t ON t.id = m.trip_id
JOIN mobility_trip_lifecycles AS l ON l.trip_id = t.id
WHERE m.is_publication = 1
  AND t.user_id <> 123
  AND m.direction = 'outbound'
  AND l.state = 'planned'
  AND t.trip_date > '2026-11-02 12:00:00'
  AND t.deleted_at IS NULL
  AND t.state = 'ready'
  AND t.trip_date BETWEEN '2026-11-03 06:30:00' AND '2026-11-03 08:45:00'
ORDER BY t.trip_date, t.id
LIMIT 51;
```

This example uses the `both` vehicle filter, for which the application adds no
vehicle-type predicate. The date examples are placeholders. Derive the future-time and search-window
bounds from the requested commute time and timezone. Compare indexes using
before/after plans and the same seeded data; retain an index only when measured
query behavior supports it. Do not infer that a database query plan alone
explains total search latency.

## Current evidence

No performance run has been recorded from this checkout. This document defines
the method and does not claim a latency target or result.
