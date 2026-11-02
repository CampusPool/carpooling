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

### Post-merge status — 29 October 2026

Current official main revision: `481e3ca08793e7acd3f1e590a952ce52b560a294`.

| Evidence | Result | Scope and limit |
| --- | --- | --- |
| GitHub Actions run `40810410068` on `481e3ca` | PASS; Next client, activity projection and backend reconstruction jobs | The backend job reconstructs the pinned source/patch stack; it does not boot Laravel or run MySQL integration tests. |
| PR #72 focused migration regression on isolated pinned host | PASS; 1 test / 25 assertions; migration `2026_10_28_000900` rollback and reapply succeeded | Focused cross-trip integrity test only. A broader synthetic smoke attempt stopped at host trip creation (HTTP 403, expected 200); the cause is not established. Full-batch rollback still encounters older migration `2026_10_21_000600`. |
| PR #73 waitlist cancellation | Earlier pinned-host MySQL run PASS; 3 tests / 104 assertions, including requested waitlist cancellation | Recorded before merge. No new integrated Laravel/MySQL run on `481e3ca` is claimed. |
| PR #70 offer panel | Focused client checks and selected offer backend tests passed before merge | The broader backend run previously reported 5 errors and 23 failures, but its raw log was not retained; the cause cannot be identified or attributed to this frontend-scoped PR. |

PRs #70, #72 and #73 are merged, but their linked issues #21, #37 and #24 remain open for unverified acceptance criteria. In particular, these checks do not establish simultaneous last-seat safety on the full current stack, complete cancellation/refund/rematching behavior, legal vehicle passenger-capacity validation, a continuous end-to-end booking journey, approved course test-plan evidence, or instructor approval. Do not treat merge status or CI reconstruction as course acceptance.

### Isolated current-main follow-up

On `481e3ca`, a disposable MySQL/Laravel environment applied the extension migrations and ran the Mobility suite: 380 passed, 2 skipped, 3,377 assertions. The support suite passed 134 tests / 471 assertions. The lifecycle HTTP probe failed at host offer with `MEMBERSHIP_REQUIRED`: the test harness enabled the cohort guard but its legacy synthetic host did not have the required cohort membership. The legacy TripLiveShare suite also returned 403 under this configuration. These results do not establish a passing full HTTP journey. The runner required explicit isolated `testing` and `testing_backup` database names.

A frontend regression checks that a valid search returning no eligible rides presents the empty state; the page interaction suite passed 24 tests including this case. This is partial evidence for #22, not proof that every issue or course acceptance criterion is complete.
