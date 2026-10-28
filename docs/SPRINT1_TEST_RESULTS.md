# Sprint 1 test evidence — issue #43

Run date: 2026-10-28 (Asia/Kolkata)

Source revision under test: `f83179b9618d9fe07c731898406cb2d7e2acf4eb`

Repository: `CampusPool/carpooling`; test harness ran from its isolated issue #43 worktree

Checkout: isolated worktree; tests run from the issue #43 worktree based on that commit

Database: no test database initialized. A disposable Docker volume was created
and removed after MySQL initialization failed; no request, migration or
application test ran.

## Results

| Command | Result | Scope and limit |
| --- | --- | --- |
| `cd frontend-next && npm test` | PASS; 38 Vitest tests, plus Node contract and Maps loader assertion scripts passed | Client and static contract checks; no backend registration or booking requests |
| `cd frontend-next && npm run typecheck` | PASS | TypeScript validation only |
| `cd frontend-next && npm run build` | PASS | Production client build only |
| `cd services/activity-projection && npm test` | PASS; 4 tests, 0 failures | Projection redaction/idempotency/aggregation only |
| `docker --context colima-mobility run --rm --network none --read-only --tmpfs /tmp:rw,noexec,nosuid,size=16m -v "$PWD/backend/extensions/carpoolear:/extension:ro" php:8.5-cli php /extension/tests/RouteSegmentMatcherStandalone.php` | PASS; 12 assertions | Offline matching domain checks from the repository extension |
| Same container command, with `WeeklySchedulePreviewStandalone.php` as the final path | PASS; 13 checks | Offline schedule preview checks; does not exercise HTTP or database integration |
| `sh scripts/check-sprint1-evidence.sh` | PASS | Matrix/evidence presence and credential-like text guard only |
| `sh research/experiments/carpoolear/run-smoke.sh lifecycle` | BLOCKED before application startup; MySQL initialization exited 1 because the Colima VM filesystem returned `No space left on device` | No migration, HTTP probe or PHPUnit test ran. The harness created and removed its unique disposable project and volume. |
| `sh research/experiments/carpoolear/verify-reconstruction.sh` | NOT RUN; network clone previously failed with `fetch-pack: unexpected disconnect while reading sideband packet` | This verifies pinned-source patch reconstruction; it does not start the app or database |

The expanded runtime checks (including ordinary registration defaults and
self-booking rejection) remain **not verified** on this revision. Docker
inspection found that the former hard-coded smoke volume belonged to another
active project; the harness now creates a unique volume per run and checks
for collisions. The existing volume was preserved. Passing client and
projection checks do not close backend acceptance criteria. No course
deliverable, video, instructor approval, or independent review is claimed.

### Hardened HTTP journey follow-up — 28 October 2026

On the pinned upstream host `6ba3d8913a8f77e664e848a526f196690a03c1e8` with the tracked hardened patches and the current extension mounted, `sh research/experiments/carpoolear/run-smoke.sh hardened` completed 71 synthetic HTTP steps against a disposable MySQL database. All 13 recorded checks passed after the hardened upstream integration patch was corrected to reject owner self-booking. These include sampled concurrent last-seat and duplicate-request races, unauthorized cancellation, and automatic acceptance capacity. The focused PHPUnit suite also passed 297 tests and 812 assertions; the full command exited 0. The harness directly promotes a synthetic host's trust after checking registration defaults; this is test setup, not real identity verification. No real routing provider, payment, payout or trip completion was tested. The sampled concurrency runs do not prove all races are safe.
