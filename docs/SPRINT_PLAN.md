# SE Mini Project — Sprint plan and Sprint 1 report

**Status date:** 23 October 2026. The submitted SRS, SAD and Test Plan remain the contractual baseline. This document plans work against the private Laravel 12/MySQL/browser baseline.

## Schedule and scope

The SE handout schedules Sprint 1 for 19–23 October with a one-minute working-product video and Sprint 2 for 26–30 October with a two-minute video, completed documentation and development freeze. Sprint 1 uses focused slices of the existing Laravel 12/MySQL browser prototype: **#12, #21, #22, #23, #24, #37, #39, #43 and #44**. Their full acceptance criteria remain attached to the official issues; this plan does not close or rewrite those issues.

The demo path is driver publication → rider search → seat request → driver acceptance → booking/cancellation. Authentication issues **#8, #9, #10 and #38**, ERD/schema **#36**, MongoDB **#40**, advanced SQL and Next.js remain Sprint 2 work. The prototype flow uses synthetic data and does not verify college identity.

## Responsibility packages

Source paths below are relative to the prototype root. The proposed package maps `backend/extensions/carpoolear/` to `campuspool-extension/`.

| Owner / branch | Issues | Paths and Sprint 1 work |
|---|---|---|
| `arjunsrikanthh` / `s1/arjun-booking-release` | #23, #44 | `backend/extensions/carpoolear/Mobility/Commute/{CommuteService.php,CommuteController.php}`, `backend/extensions/carpoolear/routes/commute.php`; booking correctness, integration order and release evidence. Expected PR: booking/release slice. |
| `zayaan-06` / `s1/zayaan-web-commute` | #12, #21 | `backend/extensions/carpoolear/web/{commute.mjs,commute-map.mjs,commute.html,commute.css}`; rider/driver UI, pickup usability, accessibility and screenshots. Expected PR: browser commute slice. |
| `NikhilJoshi441` / `s1/nikhil-matching` | #22 | `backend/extensions/carpoolear/Mobility/Commute/CommuteMatchingService.php`, `backend/extensions/carpoolear/Mobility/{Routing,Pickup}/`; route/time matching and boundary checks. Expected PR: matching and pickup slice. |
| `NitheshMogaveer777` / `s1/nithesh-integrity` | #24, #37, #39, #43 | `backend/extensions/carpoolear/tests/{MobilityCommuteProductTest.php,MobilityLifecycleTest.php,MobilityFinancialInvariantsTest.php}`, `backend/extensions/carpoolear/migrations/`; atomic seat changes, integrity evidence and DBMS preparation. Expected PR: cancellation/integrity/test slice. |

Arjun also uses the `noqtar` account.

## Integration order and review

1. Nithesh establishes cancellation and integrity behavior and records the test/CI contract for #24, #37, #39 and #43.
2. Arjun integrates the booking/release slice for #23 and #44 against that contract.
3. Nikhil adds matching and pickup boundaries for #22 without changing booking authority.
4. Zayaan completes the driver/rider and pickup UI for #12 and #21 against the reviewed behavior.

Each PR must identify its changed files, exact command and result, synthetic fixtures, acceptance evidence and linked official issue. A teammate must review it before integration. These are sequencing constraints, not a commitment to the historical issue-point total.

## One-minute demonstration

Open `http://127.0.0.1:18080/mobility/?demo=campus-route` in separate rider and driver tabs. Select the same future date and compatible commute preferences before publication and search.

1. Open the synthetic browser client and state that college identity is not verified.
2. Publish a car or bike ride with campus, pickup, date/time and capacity.
3. Search and review the route and pickup details.
4. Request a seat, accept it as the driver and show the confirmed booking.
5. Cancel and show capacity restoration; state that the fare uses synthetic, nonredeemable demo credits.

## Sprint 1 completion record

| Slice | Owner | Implementation PR | Evidence | Status |
|---|---|---|---|---|
| Booking/release (#23, #44) | Arjun | Pending | Covered by focused commute run; implementation PR pending | Partial |
| Driver/rider and pickup UI (#12, #21) | Zayaan | Pending | Browser journey screenshots and frontend harness pass; implementation PR pending | Partial |
| Matching and pickup boundaries (#22) | Nikhil | Pending | Covered by focused commute run; implementation PR pending | Partial |
| Cancellation/integrity/test contract (#24, #37, #39, #43) | Nithesh | Pending | Backend focused run passed; dedicated runtime self-booking test absent | Partial |
| One-minute working-product video | Team | Pending | Pending course submission | Pending |

The focused run is an isolated synthetic suite, not a full repository-suite result. Waitlist behavior is not implemented or evidenced. No implementation PR or video is claimed by this planning PR.

## Verification results

The 23 October verification at prototype revision `faccb66ebb65512cfca41116109609a7120111de` recorded **10 backend tests / 208 assertions** and **25 frontend checks**, all with passing exit status. The backend runner used disposable Docker/Colima infrastructure; the frontend checks covered the commute UI, map, place search, driver onboarding and tracking-state harnesses. The browser journey captured publication, search, request, driver acceptance, booking confirmation, cancellation/history and seat restoration. Google Maps initially rendered the search route, then showed a provider rendering error in detail/home views. This remains a UI/configuration defect; the booking flow continued successfully.

The run did not establish production provider behavior, college authentication or a complete repository suite. Self-booking is represented by static coverage in the focused material; a dedicated runtime self-booking test and simultaneous last-seat race test remain to be added. Raw logs and source hashes are retained with the local verification package; the summary here is linked from [issue #43](https://github.com/CampusPool/carpooling/issues/43).

The recorded commands and result excerpt were:

```text
# Inside the disposable backend container, using testing_campuspool
./vendor/bin/phpunit -c /opt/focused-phpunit.xml --testdox
OK (10 tests, 208 assertions)
EXIT_STATUS=0

# From the prototype root
node --test scripts/test-commute-ui.mjs scripts/test-commute-map.mjs scripts/test-place-search.mjs backend/extensions/carpoolear/web/driver-onboarding-ui.test.mjs backend/extensions/carpoolear/web/tracking-state.test.mjs
ℹ tests 25
ℹ pass 25
ℹ fail 0
EXIT_STATUS=0
```

The backend XML is generated by the isolated harness and sets the same test database as the container process. The proposed distribution must include its reproducible runner/configuration. The browser verification used synthetic trip 176 and booking 59, then retained the cancelled booking and restored the seat; previous bookings were not modified.

## Contributor acceptance and PR scope

| Owner | Existing functionality | Required contribution and acceptance | Verification / expected PR |
|---|---|---|---|
| Arjun | Request, owner acceptance and capacity guards | Add dedicated self-booking, foreign-driver and competing-last-seat regressions. Rejected requests must leave capacity unchanged; only one competing acceptance may succeed. Own shared service/controller/route edits. | Isolated backend suite; PR `test: cover booking authorization and capacity contention` references #23 and #37. Coordinate fixtures with Nithesh. |
| Zayaan | Publish/search/request screens and route detail UI | Add Maps failure handling that preserves readable pickup/fare details; verify car/bike validation, form errors and pending/accepted/cancelled states. | `node --test scripts/test-commute-ui.mjs scripts/test-commute-map.mjs scripts/test-place-search.mjs`; PR `fix: improve commute forms and map failure states` references #12 and #21. |
| Nikhil | Date/direction/vehicle matching, walking consent and route quotes | Add boundary and provider-failure cases. No unpublished, full, incompatible or out-of-window ride may appear; a stale quote or changed profile must be rejected. | Isolated backend search tests plus map/place-search harnesses; PR `test: cover route matching boundaries and failures` references #22. |
| Nithesh | Cancellation, idempotent refund, schema and test isolation | Add post-cancellation history and repeat-cancellation regressions; prove capacity restoration and one refund. Validate migration order on an empty test database. Waitlist implementation remains a Sprint 2 follow-on in #24. | Isolated backend/migration suite; PR `test: verify cancellation history and database integrity` references #24, #37 and #43. Add application CI only with the approved baseline (#39). |

Backend commands must use the package's verified isolated runner and a `testing*` schema. Contributors should add separate focused test files rather than simultaneously rewriting the shared baseline test. Migrations belong to Nithesh; routes and `CommuteService.php` belong to Arjun; matching belongs to Nikhil; browser assets and UI harnesses belong to Zayaan. Cross-module fixes are handed to the file owner and integrated sequentially.

## Video capture and submission

A continuous recording is pending. Capture only the application windows with macOS Shift–Command–5 → Record Selected Portion; stop with Control–Command–Escape. Use 0–15 s for publication, 15–30 s for search/consent/request, 30–45 s for driver acceptance and rider confirmation, and 45–60 s for cancellation/history and restored capacity. Upload the reviewed recording in a separate media PR referencing #44; keep PR #45 documentation-only.

## Sprint 2 delivery order

| Order | Mandatory work | Owner | Dependency |
|---|---|---|---|
| 1 | Secure Laravel contract and student authentication: #8, #9, #10, #38 | Arjun | Approved campus verification and role model |
| 2 | Next.js/TypeScript interface and responsive flow: #42 | Zayaan | Stable API contract from step 1 |
| 3 | ERD, schema/data dictionary and MySQL transaction, view, stored function and index demonstrations: #36, #37, #41 | Nithesh; Nikhil owns indexed search/EXPLAIN | Baseline schema and isolated fixtures |
| 4 | MongoDB event storage, indexes and aggregation: #40 | Nithesh | SQL identifiers/event contract; no second booking authority |
| 5 | End-to-end tests, application CI, DBMS walkthrough and two-minute video: #39, #43, #44 | Whole team; Arjun integrates | Integrated UI/API/data demonstrations |

The eight Sprint 2 assessment-priority issues are #8, #9, #10, #36, #38, #40, #41 and #42. The other 16 Sprint 2 issues are stretch scope after these prerequisites; their acceptance criteria remain in the backlog. Recurrence, chat, reminders, rankings and expanded campus/safety/payment features must not displace mandatory assessment work. Final daily commitments require teammate estimates; the historical 93-point allocation is not a five-day capacity estimate.
