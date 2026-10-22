# SE Mini Project — Sprint plan and Sprint 1 report

**Status date:** 23 October 2026. The submitted SRS, SAD and Test Plan remain the contractual baseline. The SE and DBMS handouts were reviewed; course approvals and the submitted project documents still require confirmation.

## Schedule and scope

The SE handout schedules Sprint 1 for 19–23 October with a one-minute working-product video and Sprint 2 for 26–30 October with a two-minute video, completed documentation and development freeze. Sprint 1 uses focused slices of the existing Laravel 12/MySQL browser prototype: **#12, #21, #22, #23, #24, #37, #39, #43 and #44**. Their full acceptance criteria remain attached to the official issues.

The demo path is driver publication → rider search → seat request → driver acceptance → booking/cancellation. Authentication issues **#8, #9, #10 and #38**, ERD/schema **#36**, MongoDB **#40**, advanced SQL and Next.js remain Sprint 2 work. The prototype flow uses synthetic data and does not verify college identity.

## Responsibility packages

Source paths are relative to `backend/extensions/carpoolear/`.

| Owner / branch | Issues | Paths and Sprint 1 work |
|---|---|---|
| `arjunsrikanthh` / `s1/arjun-booking-release` | #23, #44 | `Mobility/Commute/{CommuteService.php,CommuteController.php}`, `routes/commute.php`; booking correctness, integration order and release evidence. |
| `zayaan-06` / `s1/zayaan-web-commute` | #12, #21 | `web/{commute.mjs,commute-map.mjs,commute.html,commute.css}`; rider/driver UI, pickup usability, accessibility and screenshots. |
| `NikhilJoshi441` / `s1/nikhil-matching` | #22 | `Mobility/Commute/CommuteMatchingService.php`, `Mobility/Routing/`, `Mobility/Pickup/`; route/time matching and boundary checks. |
| `NitheshMogaveer777` / `s1/nithesh-integrity` | #24, #37, #39, #43 | `tests/{MobilityCommuteProductTest.php,MobilityLifecycleTest.php,MobilityFinancialInvariantsTest.php}`, `migrations/`; atomic seat changes, integrity evidence and DBMS preparation. |

Arjun also uses the `noqtar` account.

## Integration and review

Integrity and migration work lands before matching and web changes. Coordinate shared `CommuteService.php`, migrations, routes and layouts. Each PR must identify files, command and result, synthetic fixtures, acceptance evidence and the linked official issue. A teammate must review it before integration.

## One-minute demonstration

Open `http://127.0.0.1:18080/mobility/?demo=campus-route` in separate rider and driver tabs. Select the same future date and compatible commute preferences before publication and search.

1. Open the synthetic browser client and state that college identity is not verified.
2. Publish a car or bike ride with campus, pickup, date/time and capacity.
3. Search and review the route and pickup details.
4. Request a seat, accept it as the driver and show the confirmed booking.
5. Cancel and show capacity restoration; state that the fare uses synthetic, nonredeemable demo credits.

## Verification evidence

The 23 October focused verification recorded 10 backend tests / 208 assertions and 14 JavaScript checks passing. Test coverage includes publication, search, consent, acceptance, cancellation and wallet transitions. Full regression coverage and last-seat contention testing remain pending.

## Sprint 2 priorities

1. Complete authentication/profile acceptance for #8, #9, #10 and #38 without collecting university passwords.
2. Complete ERD, schema, data dictionary and four advanced SQL demonstrations for #36.
3. Implement MongoDB event/notification storage and aggregation for #40 without moving seat or payment authority out of MySQL.
4. Complete route enhancements #17/#19, safety/cost sharing, responsive UI and test-plan evidence.
5. Add Next.js/API integration behind stable Laravel/MySQL contracts.
6. Complete review, traceability, documentation and the two-minute video.

## Reproducible checks

Run the JavaScript checks from the prototype root:

```sh
node --test backend/extensions/carpoolear/web/*test.mjs
node scripts/test-commute-ui.mjs
```

The PHP focused suite requires a disposable Compose project, a `testing_campuspool` database and matching process/XML configuration. Required negative cases include self-booking, foreign-driver rejection, stale quote/profile consent, route failure/no match, duplicate request/cancel and last-seat contention. Submit reviewed source PRs, revision IDs and the one-minute video through the approved course workflow. The DBMS handout's approved two-person pair remains separate from this four-person SE roster.
