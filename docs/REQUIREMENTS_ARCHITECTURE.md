# Requirements and architecture baseline

This document translates the verified SE/DBMS course handouts into a reviewable implementation boundary. The submitted SRS, SAD and Test Plan remain contractual; proposed interpretations below require team/instructor approval where marked.

## Product boundary

CampusPool supports verified students offering or requesting a car/bike ride, matching by campus, route and time, requesting a seat, host approval, cancellation and safety reporting. Faculty/staff and employee mode are outside the current student-only scope. The campus prototype uses synthetic nonredeemable wallet holds/refunds; offline receipt acknowledgement is a separate existing backend path. Neither proves real-money collection or settlement.

## Current prototype map

The private prototype is a Laravel 12 modular backend with MySQL as the authoritative store and an HTML/CSS/JavaScript browser client. Existing integration work is organized under `backend/extensions/carpoolear/` and `backend/integrations/carpoolear/`; the runnable app, migrations, routes, views and tests remain in the private prototype distribution and are not copied into this documentation PR. Google Maps is used for place/map presentation and OSRM for bounded route calculations where configured.

| Capability | Official issue slice | Sprint 1 owner | Existing baseline | Required review outcome |
|---|---|---|---|
| Booking architecture and release coordination | #23, #44 (auth #8/#9/#10/#38 carry to Sprint 2) | `arjunsrikanthh` | Laravel auth/profile middleware, core `CommuteService.php`, release coordination | Do not claim college identity verification; serialize shared service edits |
| Rider/driver interface and pickup UX | #12, #21 (UI support for #22; #42 carries to Sprint 2) | `zayaan-06` | `web/`, `commute.mjs`, `commute-map.mjs`, index/assets | Focused UI fixes, accessibility and screenshots |
| Search, route/time matching and pickup behavior | #22 (#17/#19 route enhancements carry to Sprint 2) | `NikhilJoshi441` | `CommuteMatchingService` and route adapters; working search baseline | Verify matching boundaries and route failures; enhancements carry to Sprint 2 |
| Booking lifecycle, integrity and DBMS preparation | #24, #37, #39, #43 (#36/#40 DBMS carry to Sprint 2) | `NitheshMogaveer777` | Cancellation/lifecycle tests, migrations and MySQL invariants | Atomic seat changes and focused evidence; ERD/MongoDB full work is Sprint 2 |

Assignments are responsibility packages, not claims that the named student authored existing code. `noqtar` and `arjunsrikanthh` are one person for academic contribution counting. User-confirmed team handles are `arjunsrikanthh`, `zayaan-06`, `NikhilJoshi441` and `NitheshMogaveer777`; roles remain provisional until the team confirms them.

## Source-of-truth rules

- MySQL owns students, vehicles, rides, booking requests, bookings, seat capacity, contribution records and lifecycle state. Booking/cancellation must be one SQL transaction.
- MongoDB is a Sprint 2 sidecar for append-only ride events and notifications; it never owns seat capacity or payment state.
- The official 44 GitHub issues and Project remain the backlog authority. This repository contains requirements and execution guidance, not a second tracker.
- A feature is Done only after implementation, focused test evidence, review and a link back to the issue. Existing behavior awaiting a teammate PR is `Ready`/`In review`, not Done.

## Integration order and conflict boundaries

1. Coordinator records an attributed private baseline and manifest.
2. Integrity/migration work lands first; shared `CommuteService.php` edits are serialized by the coordinator.
3. Matching then web/pickup branches integrate against the reviewed service/API contract.
4. Keep migrations, route registration and shared layout changes coordinated; contributors submit focused patches and avoid unrelated formatting.

Sprint 2 may add a Next.js client and API contracts, but it must preserve Laravel/MySQL authority and document any approved migration. No rewrite or application upload is part of PR #45.
