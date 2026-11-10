# Architecture and source boundaries

This document explains the **current merged `main`**, not the planned Ola Maps migration or a hypothetical production system.

## Why these parts exist

```text
                          ┌───────────────────────────────┐
                          │ Next.js student web frontend  │
                          │ frontend-next/                │
                          │ Google Maps JS + Places SDK   │
                          └───────────────┬───────────────┘
                                          │ API proxy / authentication token
                                          ▼
                     ┌─────────────────────────────────────────────┐
                     │ Carpoolear Laravel host (external, pinned)  │
                     │ + CampusPool Mobility extension            │
                     │ backend/extensions/carpoolear/Mobility/    │
                     └──────┬────────────────┬─────────────────┬───┘
                            │                │                 │
                            ▼                ▼                 ▼
                     MySQL source      OSRM routers        SQL→Mongo read
                     of truth          car/bike/walk        model (optional)
                     for bookings      OSM road crop       for analytics
                                       externally supplied
```

### The minimum classroom journey

The **Next.js UI, Laravel API, MySQL, Google Places/Maps and road-routing service** are required for the full currently verified classroom journey. Backend matching uses OSRM-generated road geometry to validate pickup feasibility, detours and distance-sensitive demo fares; the Google SDK in the browser **only** provides interactive map/search and visual route preview.

The **Mongo activity projection** is useful DBMS evidence but not the primary booking store. The **Android prototype** is optional; physical tracking acceptance remains pending. The older static/browser screens under `backend/extensions/carpoolear/web/` are separate from the recommended Next.js demo.

### The two supported frontend account paths

- **Synthetic local driver/rider accounts:** `frontend-next/components/LiveCarpool.tsx`, rendered by `frontend-next/app/page.tsx` when the session contains a local `account_role`. This is the **teacher demo path** and has a documented isolated E2E run.
- **Canonical/college/integration accounts:** `frontend-next/components/CanonicalPool.tsx`, rendered for non-local accounts. It has additional membership, approved vehicle and operator constraints. This must **not** be deleted merely because the teacher demo uses LiveCarpool; it does not mean both components are identical.

`frontend-next/app/page.tsx` is still large and coordinates many historical account, chat, moderation and analytics flows. `frontend-next/lib/legacy-api.ts` and `frontend-next/lib/legacy-ui-utils.ts` separate its request and formatting logic; further structural changes must preserve role-specific flows and pass interaction tests. Do not rewrite the whole screen immediately before a review.

## Source ownership and database integrity

The Laravel host is fetched at pinned commit `6ba3d8913a8f77e664e848a526f196690a03c1e8` from [STS-Rosario/carpoolear_backend](https://github.com/STS-Rosario/carpoolear_backend). Our repository tracks the extensions and integration patches; it is **not** a complete standalone copy of that upstream application. The upstream code is GPLv3. See [third-party notices](../THIRD_PARTY_NOTICES.md) before distributing a combined binary/source package.

MySQL is the source of truth for account/offer/booking/payment-demo lifecycles. MongoDB hosts derived, replayable read models; it is **not** a backup or replacement for transaction-safe SQL bookings. Use disposable databases in tests; keep instructor/pilot data separate from CI and browser E2E environments.

The road dataset is a verified, ODbL-sourced Bengaluru crop supplied independently of Git. Its absence is a setup prerequisite, **not a missing committed file**. The current OSRM pin requires ARM64 support; x86 Docker needs emulation. A future provider migration may remove the graph requirement, but must first replace all routing interfaces (including snapped points, walking paths, segment geometry, travel time and route legs) and run the same tests.

## Code map

| Area | Where | Intended responsibility |
| --- | --- | --- |
| UI and client session | `frontend-next/` | Pages, role-specific planning components, Google browser SDK, client tests |
| Domain API | `backend/extensions/carpoolear/Mobility/` | Matching, pickup, recurrence, bookings, payments-demo, safety and communications |
| Host integration | `backend/integrations/carpoolear/` | Laravel app bindings and provider adapters |
| Routing bootstrap | `scripts/mobility-road-router.py` | OSM crop validation, road graph lifecycle, runtime ownership checks |
| Build/run/test setup | `scripts/run-local-core.sh`, `research/experiments/carpoolear/` | External backend reconstruction and isolated integration |
| SQL and Mongo reports | `docs/dbms/`, `services/activity-projection/` | Data dictionary, actual routines, projections and failure isolation |

## Design trade-offs that a reviewer should know

1. **Good:** booking integrity is evaluated on the backend, not trusted to browser-generated distances.
2. **Costly:** separate Docker routing services, a pinned external host and optional Mongo projection increase operating burden for a college project.
3. **Mitigation:** route-provider abstraction and automated regression tests allow gradual replacement without rewriting booking logic.
4. **Boundary:** campus timetables, pickup agreements and reminders have backend tests but are **not fully integrated into the currently demonstrated local student frontend**. See [feature status](FEATURE_STATUS.md).
5. **Next architecture decision:** compare hosted mapping provider terms and response coverage, then implement a **separate adapter PR**. Do not delete local OSRM before a fully independent real-browser and backend match test.

## References for reviewers

- [Feature status](FEATURE_STATUS.md)
- [Course demo](COURSE_DEMO.md)
- [DBMS reports](dbms/README.md)
- [Reproducible local run](../RUN_LOCAL_CORE.md)
- [Actual cloned-stack browser evidence](engineering/PHASE1_SIMULAR_PR_OWNED_E2E_20261110.md)
- [External source and licenses](../THIRD_PARTY_NOTICES.md)
