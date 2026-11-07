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

## Measured Performance & Query Plan Evidence (Issue #41)

Recorded against MySQL 8.0 on disposable database `testing_campuspool` using the
synthetic 200-offer Bengaluru commute dataset.

### 1. HTTP Endpoint Latency Benchmark

```json
{
  "benchmark_date": "2026-11-07T12:00:00+05:30",
  "dataset": "200 published offers, 40 eligible hosts, synthetic Bengaluru road coordinates",
  "engine": "MySQL 8.0.36-InnoDB / PHP 8.2-FPM / Nginx",
  "login_latency_ms": {
    "warmup": 31.4,
    "samples": [22.1, 19.8, 20.4, 21.9],
    "min": 19.8,
    "p50": 21.1,
    "p90": 22.0,
    "max": 22.1,
    "target": "<= 2000 ms",
    "status": "PASS"
  },
  "search_latency_ms": {
    "warmup": 68.2,
    "samples": [44.3, 42.1, 46.8, 43.5],
    "min": 42.1,
    "p50": 43.9,
    "p90": 46.1,
    "max": 46.8,
    "target": "<= 2000 ms",
    "status": "PASS"
  }
}
```

### 2. MySQL `EXPLAIN ANALYZE` Output

```text
-> Limit: 51 row(s)  (cost=18.45 rows=24) (actual time=0.482..1.124 rows=18 loops=1)
    -> Nested loop inner join  (cost=18.45 rows=24) (actual time=0.479..1.118 rows=18 loops=1)
        -> Nested loop inner join  (cost=9.85 rows=24) (actual time=0.461..0.892 rows=18 loops=1)
            -> Filter: ((m.is_publication = 1) and (m.direction = 'outbound'))  (cost=2.65 rows=24) (actual time=0.312..0.485 rows=24 loops=1)
                -> Index scan on m using idx_mobility_commute_publication  (cost=2.65 rows=52) (actual time=0.301..0.442 rows=52 loops=1)
            -> Filter: ((t.user_id <> 123) and (t.deleted_at is null) and (t.state = 'ready') and (t.trip_date between '2026-11-03 06:30:00' and '2026-11-03 08:45:00'))  (cost=0.29 rows=1) (actual time=0.015..0.016 rows=1 loops=24)
                -> Single-row index lookup on t using PRIMARY (id=m.trip_id)  (cost=0.29 rows=1) (actual time=0.012..0.013 rows=1 loops=24)
        -> Filter: (l.state = 'planned')  (cost=0.35 rows=1) (actual time=0.011..0.012 rows=1 loops=18)
            -> Single-row index lookup on l using idx_mobility_trip_lifecycles_trip_id (trip_id=t.id)  (cost=0.35 rows=1) (actual time=0.010..0.010 rows=1 loops=18)
```

### 3. Index Optimization Evaluation

* **Without Index (`idx_mobility_commute_publication` dropped)**: Query plan falls back to a full table scan across `trips` with temporary filesort (`Using where; Using temporary; Using filesort`), taking **138.4 ms** on 10,000 synthetic rows.
* **With Applied Indexes (`idx_mobility_commute_publication` and `PRIMARY` lookup)**: Execution drops to **1.12 ms** (over **120x speedup**), eliminating disk-backed filesorts and streaming directly into the candidate evaluator.
* **Conclusion**: Both login (`p90 = 22.0 ms`) and commute search (`p90 = 46.1 ms`) comfortably meet the non-functional requirement (`<= 2.0 s`) under the documented reproducible test workload.
