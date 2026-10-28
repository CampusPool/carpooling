# Issue 23 — request and confirm a seat

This file is the MobilityPlatform contribution for CampusPool issue #23. It maps the existing canonical commute implementation to the issue acceptance criteria and records what remains to be demonstrated.

## Acceptance mapping

| Requirement | Evidence in this baseline | Status |
| --- | --- | --- |
| A rider requests a published ride using current terms | `backend/extensions/carpoolear/tests/MobilityCommuteProductTest.php`, `test_visible_demo_request_accept_wallet_trip_and_delayed_release_use_canonical_rows`; `docs/course-20261027/evidence/browser-journey-20261028.md` | Tested and observed once in an isolated synthetic browser run |
| A rider cannot request their own offer | The commute suite checks use of another user’s quote; this is not a direct self-booking regression | Direct self-booking behavior is not verified by this PR; a dedicated runtime test remains needed |
| Duplicate requests are idempotent and do not create another booking | `MobilityCommuteProductTest.php` repeats the same request with the same idempotency key and checks one notification/booking | Tested for same-key replay; a different-key duplicate policy needs explicit confirmation before claiming broader coverage |
| The host accepts or rejects and the rider sees the resulting state | `MobilityCommuteProductTest.php` covers accept, notification and reject responses; the 28 October browser evidence records request → acceptance | Tested and observed in the earlier synthetic run; the separate Sprint 1 recording does not establish this complete sequence |
| Last-seat acceptance is atomic | `backend/extensions/carpoolear/tests/MobilityPrivateScheduledIntervalsTest.php` and the commute/dispatch concurrency suites cover seat and interval guards | Automated coverage exists, but this handoff does not claim a fresh race run on the public migration checkout |

## Reproduction

From a prepared MobilityPlatform checkout with its disposable Laravel/MySQL environment, run the focused mounted journey and test filters:

```sh
(cd frontend-next && npx vitest run tests/issue-23-booking-interaction.test.jsx --environment jsdom)
./vendor/bin/phpunit --filter MobilityCommuteProductTest
./vendor/bin/phpunit --filter MobilityPrivateScheduledIntervalsTest
```

The PHPUnit commands run from the prepared upstream/integration checkout created by the repository's `scripts/prepare-carpoolear.sh`; this repository does not vendor the upstream framework into the source tree. The former `scripts/verify-commute-product.py` helper is intentionally omitted because it is absent from the migration candidate. Prior browser/backend evidence is local-only and is not a fresh migration-candidate run.

The commands must target a disposable test database. They must not point at the preserved pilot. If the required environment is unavailable, report the exact command and stop; do not substitute mocked output for database evidence.

## Boundaries

The browser evidence uses synthetic actors, saved synthetic routes and non-redeemable demo credits. It does not prove live provider maps, real payments, two-phone operation, production capacity or teacher acceptance. Waitlist fulfilment is tracked separately under issue #24.
