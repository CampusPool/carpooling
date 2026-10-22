# Requirements and architecture baseline

The submitted SRS, SAD and Test Plan remain the contractual baseline. The current implementation boundary is a private Laravel 12 / MySQL / HTML-CSS-JavaScript prototype; the Next.js and MongoDB requirements are planned Sprint 2 work.

## Product boundary

CampusPool supports verified students offering or requesting a car or bike ride, matching by campus, route and time, seat requests, host approval, cancellation and safety reporting. Faculty, staff and employee mode are outside the current student scope. The prototype uses synthetic, nonredeemable wallet holds/refunds; this is not real-money collection or settlement.

## Current prototype map

The private prototype organizes extension work under `backend/extensions/carpoolear/` and `backend/integrations/carpoolear/`. Laravel routes, migrations, views and tests remain in that private source tree.

Paths in the table are relative to `backend/extensions/carpoolear/`.

| Capability | Issue slice | Baseline and review target |
|---|---|---|
| Booking architecture and release coordination | #23, #44; #8/#9/#10/#38 in Sprint 2 | `Mobility/Commute/{CommuteService.php,CommuteController.php}`, `routes/commute.php`; verify booking correctness and integration order. |
| Rider/driver interface and pickup UX | #12, #21; #42 in Sprint 2 | `web/{commute.mjs,commute-map.mjs,commute.html,commute.css}`; verify usability, accessibility and evidence capture. |
| Search, route/time matching and pickup behavior | #22; #17/#19 in Sprint 2 | `Mobility/Commute/CommuteMatchingService.php`, `Mobility/Routing/`, `Mobility/Pickup/`; verify route, time-window and failure boundaries. |
| Booking lifecycle and integrity | #24, #37, #39, #43; #36/#40 in Sprint 2 | `tests/{MobilityCommuteProductTest.php,MobilityLifecycleTest.php,MobilityFinancialInvariantsTest.php}`, `migrations/`; verify atomic seat changes and prepare DBMS evidence. |

## Source of truth

- MySQL owns students, vehicles, rides, booking requests, bookings, capacity, contributions and lifecycle state. Booking and cancellation are single SQL transactions.
- MongoDB is a Sprint 2 sidecar for append-only ride events and notifications. It does not own seat capacity or payment state.
- The 44 official issues and Project #2 are the backlog authority.
- A feature is complete only after implementation, focused evidence, independent review and an issue link.

## Integration boundaries

Integrity and migration changes land before matching and web changes. Coordinate migrations, route registration, shared layouts and `CommuteService.php`; contributors submit focused patches without unrelated formatting.
