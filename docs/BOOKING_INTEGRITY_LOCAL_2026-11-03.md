# Sprint 1 booking integrity verification — 2026-11-03

All work ran in `/Users/arjun/Downloads/carpooling-integrity-audit-20261103`, a separate copy of the integrated checkout. No commits or PRs were created.

## Regression added

`backend/extensions/carpoolear/tests/MobilitySegmentBookingTest.php` now verifies:

- The trip owner cannot call the managed booking service to book their own trip; it returns `MEMBERSHIP_REQUIRED` and creates no passenger row.
- A rider who already has a pending request cannot create a second active booking for that trip; the service returns `null`, with exactly one pending row remaining.

The service already enforced both policies. This closes the explicit test gap without changing runtime code.

## Test evidence

- Disposable MySQL Mobility feature suite: **396 passed, 2 skipped, 3,538 assertions**, 37.55 seconds.
- Documented hardened HTTP journey probe: all checks passed on pinned upstream revision `6ba3d8913a8f77e664e848a526f196690a03c1e8`, using patch SHA256 `027eebddfbf5cb5594cbe43d57a5d2034ed640c058a5bdbf637a0cd68490368d`.
- Concurrency observations: 12/12 concurrent last-seat races persisted exactly one accepted booking; 8/8 duplicate-request races left exactly one active row; 6/6 auto-accept races persisted one accepted and one pending request.
- The probe used actual HTTP requests and durable MySQL on a multi-worker PHP server. Actors and catalog/route data were synthetic; this is sampled local evidence, not production or universal concurrency proof.

Raw detailed HTTP evidence: `research/experiments/carpoolear/raw/journey-latest.json` (`variant: hardened`, `all_checks_passed: true`). The run used a unique disposable Compose project and removed it on completion. The separate user-facing `verify2` stack remained healthy and running.

## Baseline comparison

The initial documented `journey` mode ran the pristine upstream variant and failed the expected legacy invariants, including self-booking and seat oversell/duplicate races. The hardened run passed. The `journey-latest.json` file is overwritten by the later run, so the pristine summary is reported in the session output rather than retained as a second artifact.
