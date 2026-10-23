# Sprint 1 booking evidence

This note records the evidence produced by Arjun's `s1/arjun-booking-release` PR for issues [#23](https://github.com/CampusPool/carpooling/issues/23), [#39](https://github.com/CampusPool/carpooling/issues/39) and [#44](https://github.com/CampusPool/carpooling/issues/44).

## Scope

- `prototype/tests/extension/MobilityBookingCorrectnessTest.php` exercises the public commute API on an isolated MySQL `testing` schema. It covers self-booking prevention, foreign-driver and rider authorization, duplicate request reuse, stale quote rejection, pending/rejected/accepted/cancelled transitions, and seat preservation.
- `prototype/reproduction/booking-concurrency-probe.php` uses two forked HTTP clients against the four-worker PHP server and inspects committed MySQL rows after each one-seat race. It accepts the implementation's documented `COMMUTE_BUSY_RETRY`/`NOT_SEAT_AVAILABLE` loser outcomes and requires exactly one accepted and one pending booking.
- The package verifier also runs manifest integrity, frontend checks, migrations, health, the existing commute suite and Nikhil’s preserved route-matcher checks. The application workflow separately runs the fresh-start synthetic booking journey.

## Commands and results

Local Docker execution on 24 October 2026 passed the following components against MySQL 8.0 and four PHP HTTP workers:

| Check | Actual result |
|---|---|
| Frontend Node suite | 25 passed, 0 failed |
| Existing `TripLiveShareManagerTest.php` | 23 passed, 67 assertions |
| Existing `MobilityCommuteProductTest.php` | 10 passed, 208 assertions |
| New `MobilityBookingCorrectnessTest.php` | 5 passed, 109 assertions |
| Commute concurrency probe | 12/12 overlapping HTTP races passed; one accepted/one pending; loser retry 422 `NOT_SEAT_AVAILABLE` |
| Preserved route matcher standalone suite | 14 assertions passed |
| Source-map path coverage and hashes | All inventoried files verified; test copies identical |

The complete verifier and fresh-clone smoke result will be recorded after the committed snapshot runs. The earlier development run had a shell error after its passing tests because its runner was edited while executing; that run is not counted as a complete verifier success.

```text
python3 prototype/scripts/check-package.py
node --test prototype/tests/frontend/test-commute-ui.mjs prototype/tests/frontend/test-commute-map.mjs prototype/tests/frontend/test-place-search.mjs prototype/campuspool-extension/web/driver-onboarding-ui.test.mjs prototype/campuspool-extension/web/tracking-state.test.mjs
sh prototype/reproduction/verify-package.sh
sh prototype/reproduction/start-local.sh
python3 prototype/reproduction/smoke-booking.py
```

The application (`portable-campus-tests`) and documentation (`documentation`) jobs must run on the actual feature PR. Teammate review remains required before merge.

## Contribution provenance

The branch starts from official merge `140654c1bd14656d9f2e9f6542c9be0fef936792` (PR #46). The booking services, routes, migrations and route matcher are inherited baseline code and are unchanged by this contribution. The new tests, concurrency probe, verifier integration and workflow documentation are the individual contribution. Both test copies follow the existing extension/package layout; only the package copy is executed by PHPUnit.

The refreshed source map also corrects four stale baseline hashes (provenance, matcher test, Compose configuration and verifier) without changing or re-crediting their contents. GPLv3 notices and upstream attribution remain intact. Academic reuse approval is unconfirmed.

## Limits and remaining deliverables

The probe uses synthetic demo actors and fixture routing in disposable MySQL. It does not establish college identity verification, production routing, payment settlement or native-client behavior. The one-minute Sprint 1 demonstration video has **not** been recorded or submitted; issue #44 remains open for that deliverable. This note does not claim that the SRS, SAD or Test Plan were independently reconciled.
