# CampusPool feature status — authoritative review snapshot

**Updated:** 10 November 2026 · **Code baseline:** draft Ola migration PR #92, with separately preserved Google/OSRM rollback

The words **E2E verified**, **backend verified**, **prototype**, and **pending** are not interchangeable:

- **E2E verified:** real headed Chrome with Ola Places and Directions in a separately cloned Laravel/MySQL stack. SQL records and fresh browser login/reload were verified independently. See [Ola evidence](engineering/OLA_MIGRATION_ACCEPTANCE_20261110.md); the earlier [Google/OSRM run](engineering/PHASE1_SIMULAR_PR_OWNED_E2E_20261110.md) is historical evidence.
- **Backend verified:** implemented services/API behavior covered by integration or unit tests; **not necessarily exposed in the student UI**.
- **Prototype/partial:** tracked code exists, but key real-device/provider or user-facing proof is missing.
- **Pending:** no supported claim that this works end to end in the present repository.

## Course-demo flow (driver + rider)

| Capability | Evidence level | Verified boundary |
| --- | --- | --- |
| Separate local rider and driver sign-up/sign-in | **E2E verified** | Synthetic username/password accounts, not university identity |
| Real place autocomplete, route selection, map preview | **E2E verified** | Real Ola Places, routing preview and map; browser key restrictions require provider-console approval |
| Driver creates a dated road-routed offer | **E2E verified** | Bengaluru region; local demonstration; no approved real vehicle needed |
| Rider searches and requests compatible ride | **E2E verified** | Road-based matching, route/time/seat checks; one-passenger demo offer |
| Driver accepts; account state persists after sign-out/in | **E2E verified** | Isolated, disposable MySQL-backed instance |
| Synthetic ₹500 wallet credit and fare hold | **E2E verified** | Demo-only credits; NOT real payment, bank transfer or settlement |
| Two-way trip chat | **E2E verified** | Only scoped trip participants in the tested scenario |
| Driver start → pickup → drop-off → complete | **E2E verified** | UI + backend lifecycle |
| Rider arrival confirmation | **E2E verified** | **Release waiting period and final synthetic receipt not verified** |
| Notification/account activity feed | **Browser and unit coverage** | Synthetic demo interactions, not push notifications or SMS |

The historical Google/OSRM run used copied routing graphs on Simular and belongs to the old baseline. **PR #92** instead passed the Ola-only real-browser journey without OSRM; a separate clean Mac clone built, started and restarted Laravel/MySQL/Next with no Bengaluru crop. See [detailed evidence](engineering/OLA_MIGRATION_ACCEPTANCE_20261110.md).

## Implemented backend / DBMS features (not all student-facing)

| Feature | Level | Important qualification |
| --- | --- | --- |
| SQL schema, constraints, booking transactions, indexes and audit | **Backend verified** | Actual MySQL application integration and isolated CI; consult [DBMS runbook](dbms/README.md) |
| MySQL analytical views, procedure, function and operator report | **Backend verified** | Operator screen exists; no claim of a reviewed production admin account |
| SQL-to-Mongo lifecycle projection, replay and outage isolation | **Backend verified** | Optional analytics service, not required for the basic driver/rider demo |
| Campus pickup catalog and mutually agreed meeting points | **Backend verified** | API and tests; no proof that listed gates are approved by a university |
| Manual recurring-program engine / weekly bitmask timetable | **Backend verified** | API/tests present; **no corresponding timetable editor in the current main Next.js student UI** |
| Reminders and ride-change feed | **Backend verified** | Backend notification logic; no real push/SMS delivery claimed |
| Driver/vehicle onboarding and operator flows | **Partial/user-role dependent** | Separate canonical account path and approval gates; synthetic local demo bypasses real-world licensing |
| Legacy browser UI under `backend/extensions/carpoolear/web/` | **Maintained separately** | Historical/integration surface; NOT the recommended teacher demo |

## Unfinished, deferred, or external work

| Work | Status | Reason |
| --- | --- | --- |
| University identity / student email OTP | **Pending for production** | No university-authorized authentication service or live email guarantee |
| Official timetable import from university portal | **Pending** | Requires institutional permission and authorized integration; manual backend scheduling is distinct |
| Full timetable and pickup-zone student UI | **Pending/partial** | Backend endpoints implemented; connected frontend workflow needs review and demonstration |
| Real payment gateway, receipts, monetary settlement | **Pending** | Wallet and fare are synthetic only |
| Physical device GPS and tracking acceptance | **Pending** | Android prototype and tracking code are not an accepted field test; see [issue #82](https://github.com/CampusPool/carpooling/issues/82) |
| Production deployment, real users and abuse handling | **Pending** | Demo is localhost/disposable; not an operational campus service |
| Hosted routing provider / Ola Maps replacement | **Implemented and synthetic demo verified in draft PR #92** | OSM crop/OSRM no longer compulsory; restricted keys and separate OSRM rollback required |
| Teacher-friendly fresh clone | **Verified with explicit prerequisites** | Pinned external Laravel host, Docker, Node and own restricted Ola credentials required; no OSM crop/OSRM |
| Synthetic wallet release waiting period | **Not browser E2E verified** | Booking hold and arrival confirmation passed; final release/receipt must be tested separately |

## What teachers should read

**Fastest path:** [Project README](../README.md) → [course demo](COURSE_DEMO.md) → [architecture](ARCHITECTURE.md) → [DBMS evidence](dbms/README.md).

**Evidence:** [Cloned-app and new-database browser test](engineering/PHASE1_SIMULAR_PR_OWNED_E2E_20261110.md), [fresh-clone startup](engineering/PHASE1_FRESH_CLONE_VERIFICATION_20261109.md), latest [GitHub Actions runs](https://github.com/CampusPool/carpooling/actions), and [Ola migration acceptance](engineering/OLA_MIGRATION_ACCEPTANCE_20261110.md).

**Issue hygiene:** An open issue indicates work that may be unfinished, partially delivered, or not yet formally closed. Historical sprint documents describe contributor deliverables at a point in time and should not override this matrix. [Open issues](https://github.com/CampusPool/carpooling/issues) need owner confirmation before closure.

**Assessment caution:** Test success does not establish university pickup permission, contribution originality, instructor acceptance, a course-approved team size, or actual payment safety. Verify each independently.
