# SE Mini Project — execution plan and Sprint 1 report

**Status date:** 23 October 2026. The submitted SRS, SAD and Test Plan remain the contractual baseline. The original one-page SE sprint handout and five-page DBMS Level 3 handout were read. The submitted CampusPool SRS/SAD/Test Plan and course-specific approvals remain unavailable.

## Course schedule

The SE handout requires Sprint 1 on 19–23 October (one-minute working-product video uploaded to the repository) and Sprint 2 on 26–30 October (two-minute video, completed documentation and development freeze). Assigned-member PRs, independent owner review, Actions and documented deviations are required. The current milestone prepares these deliverables; the videos and code reviews are still outstanding.

## Sprint 1 scope and interpretation

Sprint 1 is limited to focused reviewable slices of the existing Laravel 12/MySQL browser prototype. The selected issue slices are **#12, #21, #22, #23, #24, #37, #39, #43 and #44**. The original full-issue estimates total **41 story points**; this is an allocation of existing issue scope, not a claim that 41 points remain or that any issue is complete. Full acceptance criteria stay attached to each issue.

The demo path is driver publication → rider search → seat request → driver acceptance → booking/cancellation. Registration/authentication issues **#8, #9, #10 and #38** remain mandatory follow-on work because the current synthetic UI flow does not verify college identity or real authentication. MongoDB issue **#40**, ERD/schema issue **#36**, advanced SQL demonstrations and Next.js work are Sprint 2. Route enhancements **#17 and #19** are Sprint 2; the working search baseline is reviewed under **#22**.

Sprint 1 does not claim a Next.js interface or MongoDB implementation. It requires safe source review, focused changes, isolated verification, genuine PR authorship and evidence. Shared `CommuteService.php` edits are serialized by the coordinator to avoid merge conflicts.

## Four responsibility packages

| Order | Owner / branch | Official issues | Source paths and current baseline | Genuine Sprint 1 work | Verification and dependencies |
|---:|---|---|---|---|---|
| 1 | `arjunsrikanthh` / `s1/arjun-booking-release` | #23, #44 (auth #8/#9/#10/#38 are Sprint 2 carryovers) | `backend/extensions/carpoolear/Mobility/Commute/CommuteService.php`, `CommuteController.php`, `routes/commute.php`; booking lifecycle and release coordination already exist in the private baseline | Improve booking correctness and integration sequencing; document auth/profile gaps without claiming college verification or existing behavior as authored | Isolated booking lifecycle checks; coordinate serialized `CommuteService.php` edits; depends on Nithesh integrity checks |
| 2 | `zayaan-06` / `s1/zayaan-web-commute` | #12, #21 (UI support for #22; #42 carries to Sprint 2) | `backend/extensions/carpoolear/web/{commute.mjs,commute-map.mjs,commute.html,commute.css}`; current UI and map flow exist | Focused rider/driver interface, pickup/map usability, accessibility and evidence capture; preserve API contracts | Run the focused web and commute client checks, capture screenshots; depends on stable route/booking endpoints |
| 3 | `NikhilJoshi441` / `s1/nikhil-matching` | #22 (#17/#19 route enhancements carry to Sprint 2) | `backend/extensions/carpoolear/Mobility/Commute/CommuteMatchingService.php`, `Mobility/Routing/`, `Mobility/Pickup/`; search baseline exists, route enhancements remain incomplete | Review existing search behavior and record bounded route/time follow-ons; no broad rewrite in Sprint 1 | Run route success/failure, time-window and boundary checks; depends on Zayaan’s client contract and coordinator route registration |
| 4 | `NitheshMogaveer777` / `s1/nithesh-integrity` | #24, #37, #39, #43 (#36/#40 DBMS carry to Sprint 2) | `backend/extensions/carpoolear/tests/{MobilityCommuteProductTest.php,MobilityFinancialInvariantsTest.php,MobilityLifecycleTest.php}`, `migrations/`; MySQL is authoritative | Add focused integrity tests/migrations/documentation and prepare DBMS evidence; MongoDB/ERD implementation remains Sprint 2 | Isolated MySQL last-seat/cancellation tests and migration checks; #36/#40 full acceptance carries to Sprint 2; shared service edits serialized |

`arjunsrikanthh` owns architecture, coordination and release integration. `noqtar` is the same person as `arjunsrikanthh` for contribution counting. `NikhilJoshi441` and `NitheshMogaveer777` have the permissions required to contribute. Assignments are responsibility packages, not retroactive authorship claims.

## Integration sequence and PR contract

1. Coordinator records the attributed private baseline and source manifest; no application source is uploaded by PR #45.
2. Nithesh submits integrity/migration/test documentation; Arjun reviews shared `CommuteService.php` changes serially.
3. Nikhil submits matching changes against the reviewed service/API contract.
4. Zayaan updates browser/map behavior against the stable contract and captures evidence.
5. Arjun integrates reviewed slices in the order integrity → matching → web → release/docs, then links each staging PR to the official issue without auto-closing it.

Every PR must name exact files, command/exit status, synthetic fixtures and acceptance evidence. Do not modify unrelated formatting, commit secrets, use real addresses, or run destructive tests against a persistent demo database.

## One-minute Sprint 1 demo

1. 0:00–0:12 — Open the synthetic browser client; state that college identity/authentication is not yet verified.
2. 0:12–0:27 — Driver publishes a car/bike ride with campus, pickup, date/time and capacity.
3. 0:27–0:42 — Rider searches the existing matching window and reviews route/pickup details.
4. 0:42–0:53 — Rider requests a seat; driver accepts; show the confirmed booking and remaining capacity.
5. 0:53–1:00 — Cancel and show capacity restoration. State that payment uses synthetic, nonredeemable demo credits and data is synthetic.

The one-minute video and reviewed code PRs remain outstanding until linked evidence is uploaded. Existing prototype behavior without a teammate PR is baseline/Ready, not Done or a teammate contribution.

## Verified baseline evidence and limits

At private prototype revision `faccb66ebb65512cfca41116109609a7120111de` (with dirty/generated upstream evaluation state), the 23 October focused audit recorded **10 `MobilityCommuteProductTest` tests / 208 assertions** with exit 0 against a dedicated `testing_campuspool` schema, plus seven web and seven commute-client checks. This is private-harness evidence; its generated config/Compose override and output are retained by the coordinator and have not been uploaded. Inside that dedicated test container, the backend command was `php vendor/bin/phpunit -c /opt/focused-phpunit.xml tests/Feature/Mobility/MobilityCommuteProductTest.php` with the process and XML database schema explicitly set to the dedicated testing schema. An earlier aggregate lifecycle run recorded 335 passing tests and 2,804 assertions before a safety refusal; it was not an overall green suite and is not used as completion evidence. The synthetic campus UI demo does not prove college identity verification. Re-run changed tests in an isolated schema and attach the exact revision and output to each PR.

## Sprint 2 priorities (26–30 October)

1. Complete mandatory authentication/profile acceptance for #8, #9, #10 and #38 without collecting university passwords.
2. Finish ERD/schema/data dictionary for #36 and demonstrate four advanced SQL concepts against MySQL (transaction/locking, view, stored function, trigger or index).
3. Implement MongoDB event/notification storage and aggregation for #40; it must never own seat or payment state.
4. Complete route enhancements #17/#19, safety/cost sharing, responsive UI and approved test-plan evidence.
5. Add Next.js/API integration only behind stable Laravel/MySQL contracts; preserve the working browser journey.
6. Complete full acceptance follow-ons #43/#44, documentation, review and the two-minute video.

Stretch items remain recurring matching, chat and reminders if the mandatory DBMS/auth work exceeds capacity.

## Review, access and completion rules

Another teammate must review each PR before integration. The private staging repository grants contributor Write access; organization-level ownership can make some accounts effectively Admin. GitHub returned HTTP 403 when branch protection was requested for the private repository, so manual independent review is the active control; do not claim branch rules are enabled.

Done requires the issue acceptance criteria, genuine implementation, focused evidence, independent review and traceability. This documentation workflow validates documentation only; it does not report application tests.

## Reproducible local demonstration and test checklist

Use the existing Mac pilot at `http://127.0.0.1:18080/mobility/?demo=campus-route` in two tabs, selecting **I need a ride** and **I’m driving**. Follow the private baseline's `docs/COMMUTE_PRODUCT_DEMO.md` for restarting retained containers without migration/reseed; a clean teammate installation is still gated on the approved manifest, licenses and setup verification. Select the same future date and compatible saved commute in both tabs. Search only after the driver publishes. Review both walking legs, route, pickup option and exact demo fare before consent. Quotes expire, so repeat search if necessary. Driver accepts; verify the same booking in both histories. Use a separate synthetic booking for cancellation/refund, and record its ID. Never reuse an accepted overlapping booking to fabricate a new result.

After source authorization, JavaScript checks from the baseline root are:

```sh
node --test backend/extensions/carpoolear/web/*test.mjs
node scripts/test-commute-ui.mjs
```

The PHP focused suite requires a separate disposable Compose project, a database named `testing_campuspool`, matching process/XML configuration, and an effective Laravel connection-name check before `RefreshDatabase`. The audited runner uses a temporary `/opt/focused-phpunit.xml`; that file is generated test configuration, not a distributable source dependency. The coordinator has a reproducible isolated runner and must sanitize/supply it with the separately authorized baseline; it is not included in this documentation-only PR. Do not copy a PHPUnit command into the persistent pilot container. Required negative evidence includes self-booking/foreign-driver rejection, stale quote/profile consent, route failure/no match, duplicate request/cancel and last-seat contention; the latter still needs a dedicated competing-request demonstration.

Before submission: attach reviewed source PRs and revision IDs, map all accepted scenarios to issues, record the one-minute video without secrets/real identities, upload it through the authorized submission workflow, and retain every incomplete criterion as a carryover. Four SE members are confirmed; the DBMS handout's approved two-person pair remains to be confirmed separately.
