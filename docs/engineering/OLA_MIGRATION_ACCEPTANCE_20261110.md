# CampusPool PR #92 — Ola Maps migration acceptance evidence

**Date:** 10 November 2026 (IST)
**Scope:** A synthetic SE + DBMS college demonstration, not an actual payment, dispatch, or production carpooling service.
**Branch:** feature/ola-maps-migration-20261110
**PR:** https://github.com/CampusPool/carpooling/pull/92
**Status:** Independently verified as described below. The PR remains **draft, unmerged**; owner approval is required before merging.

## 1. What the Ola mode actually runs

- Next.js renders Ola maps using the Ola Maps Web SDK and calls authenticated same-origin proxy endpoints for Places and Directions.
- CanonicalPool's address picker uses Ola Places and still requires an explicit approved catalog stop. The older Next.js page has an Ola Places/map path, and saved route geometry can be displayed without extra Directions calls.
- Laravel + MySQL retain application-owned accounts, bookings, inventory, synthetic wallet/holds, messages, lifecycle events and database transactions.
- Laravel route and pickup providers select Ola rather than OSRM. Quote publication requires the currently selected provider and its adapter-version identity; cross-provider real quotes are rejected.
- The default Ola-only Compose startup does **not** need an OSM PBF, three OSRM containers, prebuilt graphs or ARM emulation.
- Google-only Laravel browser prototypes are **not rewritten**; the legacy entry URLs redirect to the maintained Next.js UI in Ola mode, and their Google-only scripts/config endpoint return HTTP 410. Their source and separate OSRM rollback remain intact.
- Android is a separate GPS tracking companion; it has no Google Maps rendering SDK and was not changed as part of the map migration.

## 2. Real Ola API checks (small number of requests)

**Real four-point driving route** via OlaDirectionsClient in the isolated Laravel backend:
provider=ola; version=ola-directions-v1:car; three ordered legs; four snapped waypoints; 180 geometry vertices; total 5,356 metres and 1,088 seconds. One request, without retries.

**Real walking route** through the same backend:
provider=ola; profile=foot; version=ola-directions-v1:foot; one leg; two snapped endpoints; 13 geometry vertices; 149 metres and 90 seconds. One request, without retries.

**Real headed-Chrome LiveCarpool journey** against port 3022, the separately cloned Laravel backend at 18087, and isolated MySQL volume ola-pr92-db:
driver and rider registration; real Ola Places selection for both; Directions preview; driver publication; rider matching and seat request; driver acceptance; synthetic ₹500 top-up; ₹60.44 hold; two-way chat; start, pickup, dropoff, completion, rider arrival. All 19 original functional checkpoints passed. The account's completed booking persisted after a page refresh. A combined subsequent fresh-login assertion timed out once; an **independent fresh-browser login and reload run then passed**, with HTTP 200 from login/bookings and persisted completed ride and wallet state. Do not replace these distinct observations with an unqualified claim that the combined script passed.

## 3. SQL evidence (not just UI messages)

Read directly from **ola-pr92-mysql** / **ola-pr92-db**, separate from the old working demo:

| Table/evidence | Confirmed value |
|---|---|
| mobility_local_accounts and users | Driver user ID 96; rider user ID 97 |
| trips + mobility_trip_lifecycles | Trip 178 owned by driver 96, state completed |
| trip_passengers | Trip 178, rider 97, accepted request state 1 |
| mobility_commute_demo_holds | Booking 30, 6,044 minor INR units, held, rider arrival recorded |
| mobility_commute_demo_wallets | Rider 97 remaining 43,956 minor units (₹439.56) |
| messages | Two messages, one by each actor |
| mobility_trip_events | start, board, alight and complete, one each |

The ignored mode-600 report is at /workspace/ola-e2e-pr92-20261110/.local/validation/ola-final-sql-evidence.json. Browser evidence is stored in the same isolated checkout and /tmp/ola-pr92-verified-*. Do not commit session credentials, screenshots or raw HTTP logs.

**Test-isolation incident:** Earlier, an ad-hoc PHPUnit invocation inside the *serving* isolated container emptied its demo tables after a successful browser test. Subsequent tests were run with appropriate separate test schemas/CI disposable projects. A fresh registration was proven to persist; the final trip's SQL records above were checked **after** the final browser journey and have not been reset. **Never run php artisan test inside a serving demo container**. Use the repository's disposable run-smoke.sh test runner or CI.

## 4. Fresh clone and restart on Mac

Source: a new clone of the PR branch in a dedicated Mac Downloads folder, with a **new** Colima Docker profile named ola-pr92-fresh and project mobility-core-ola-macfresh. This installation used a **synthetic invalid Ola key**, not the user's real provider credential. It tested bootstrap and server/database behavior, not paid maps.

- No Bengaluru PBF existed in the clone.
- The default Ola-only launcher reconstructed the exact pinned upstream Carpoolear host, built its PHP image, installed Composer/npm dependencies, ran **205 database migrations**, and started MySQL, Laravel, gateway and Next.js successfully.
- Next.js responded with HTTP 200 at http://127.0.0.1:3031 and Laravel health reported an operational database.
- The new Docker project had **no OSRM/road service**. Runtime routing provider was ola.
- Ola-mode requests to /mobility and /mobility-pilot returned HTTP 302 to the Next.js UI; Google-only scripts and /mobility-pilot/maps-config returned HTTP 410.
- Synthetic rider registration HTTP 201, login HTTP 200, and independent MySQL user/local-account row checks passed.
- Stopping the launcher preserved MySQL; restarting the same project re-created the application/gateway, retained the named database volume and account row, and allowed login HTTP 200 again. The gateway's randomly allocated internal-to-host port changed, but the launcher correctly updated the Next.js API origin.

The old Simular demonstration on backend port 18082 and its database were neither reset nor altered. The separate Ola live E2E backend on port 18087 and its MySQL volume were retained.

## 5. Automated checks

- Frontend: **124 Vitest tests passed (17 files)**; TypeScript check and Next.js production build passed.
- Python launcher/restart guard suite: **15 tests passed**, also on macOS after fixing resolved-path expectations.
- Targeted Laravel/MySQL: 17 quote/endpoint tests (150 assertions); 44 synthetic fixture, dispatch, multi-stop and recurring tests (605 assertions); 7 Ola adapter tests (40 assertions); and 2 legacy view-route tests (12 assertions) passed.
- GitHub Actions on commit a85f931: all four **MobilityPlatform checks** jobs passed, including **420 passed, 2 skipped, 3,743 assertions** in the full disposable backend run; **DBMS Level 3 integration** passed.
- Android GPS-only companion static checks passed on Mac. Native APK/device testing was not repeated for this migration.
- Ola-only Compose configuration validated with no OSRM dependency; this invariant is added to automated CI via scripts/check-ola-compose.sh.

## 6. Remaining bounded risks and required human action

- The browser-visible Ola Maps SDK key **must** be restricted on Ola's dashboard to the permitted demo origins/domains; keep the server key private. Enable provider-side API/service restrictions, low per-key quotas and billing usage alerts. The exact allowed origins depend on where the teacher will host the demo, so this account-side setup cannot be certified by source-code tests.
- Neither a physical Android location-tracking session nor real payment settlement, real vehicle verification, multi-campus production traffic or emergency services was tested. No cash transactions exist; wallet values are synthetic.
- An independent real four-point route and a real foot route passed. The full browser lifecycle used a normal two-place car journey, **not** an actual four-stop pickup/admission scenario. That combination has strong mocked/database coverage but no dedicated live browser four-stop acceptance.
- Some Ola Web SDK map loads emit a nonfatal provider-style warning about a missing 3d_model source layer. Displayed routes and the booking journey continued to work; this appears outside our application route-integrity logic.
- Simular's Docker bridge could not reach the host-bound external proxy for a new container build. The clean Mac Colima startup succeeded on normal outbound internet. This environmental limitation is not a reason to change working app networking.
- The pinned external Carpoolear repository remains a first-bootstrap network dependency, with license notices preserved; this is explicit rather than a zero-config clone claim. A real server key is required to show maps in the new Mac demo.
- Keep the OSRM rollback **in a separate project/database** and do not delete original road volumes or teammates' work until explicitly authorized. Switching providers in a single database is blocked deliberately.

**Merge decision:** PR #92 is suitable for an owner review of a classroom Ola-first synthetic demo. Do not merge, retire the original demo, or claim production readiness without express owner approval and the remaining external credential restrictions.
