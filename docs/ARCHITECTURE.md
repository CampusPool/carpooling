# Architecture and source boundaries

This document explains the draft PR #92 Ola-first synthetic classroom demo. The historical Google/OSRM architecture is retained only as an isolated rollback, not a compulsory runtime.

## Why these parts exist

    Next.js student frontend
       | Ola Maps Web SDK (restricted browser key)
       | authenticated same-origin Places/Directions proxy
       v
    Pinned external Laravel host + CampusPool Mobility extension
       |                  |                          |
       v                  v                          v
    MySQL                Ola Directions              Optional SQL-to-Mongo
    bookings/wallet      car/bike/foot                analytics read model
    chat/lifecycle       route geometry / snapping

### The minimum classroom journey

Next.js, Laravel, MySQL, correctly restricted Ola credentials and network access are required. **The Bengaluru road PBF and three local OSRM servers are not required in Ola mode.** A clean Mac clone built/restarted this stack and retained its MySQL account; a separate Ola-credentialed stack passed the real two-role browser journey. [Acceptance report](engineering/OLA_MIGRATION_ACCEPTANCE_20261110.md).

MongoDB projection is useful DBMS evidence but not the authoritative booking database. The Android GPS companion is optional and has no Google Maps SDK; physical-device acceptance is pending. Older static Laravel browser views remain separate from the recommended Next.js demo; in Ola mode their entrypoints redirect and Google-only scripts return HTTP 410.

### The two supported frontend account paths

- **Synthetic local driver/rider accounts:** `frontend-next/components/LiveCarpool.tsx`, rendered by `frontend-next/app/page.tsx` when the session contains a local `account_role`. This is the **teacher demo path** and has a documented isolated E2E run.
- **Canonical/college/integration accounts:** `frontend-next/components/CanonicalPool.tsx`, rendered for non-local accounts. It has additional membership, approved vehicle and operator constraints. This must **not** be deleted merely because the teacher demo uses LiveCarpool; it does not mean both components are identical.

`frontend-next/app/page.tsx` is still large and coordinates many historical account, chat, moderation and analytics flows. `frontend-next/lib/legacy-api.ts` and `frontend-next/lib/legacy-ui-utils.ts` separate its request and formatting logic; further structural changes must preserve role-specific flows and pass interaction tests. Do not rewrite the whole screen immediately before a review.

## Source ownership and database integrity

The Laravel host is fetched at pinned commit `6ba3d8913a8f77e664e848a526f196690a03c1e8` from [STS-Rosario/carpoolear_backend](https://github.com/STS-Rosario/carpoolear_backend). Our repository tracks the extensions and integration patches; it is **not** a complete standalone copy of that upstream application. The upstream code is GPLv3. See [third-party notices](../THIRD_PARTY_NOTICES.md) before distributing a combined binary/source package.

MySQL is the source of truth for account/offer/booking/payment-demo lifecycles. MongoDB hosts derived, replayable read models; it is **not** a backup or replacement for transaction-safe SQL bookings. Use disposable databases in tests; keep instructor/pilot data separate from CI and browser E2E environments.

For the historical **OSRM rollback only**, the road dataset is an ODbL-sourced, checksum-locked Bengaluru crop outside Git; the old router image may need ARM64 support or emulation. The default Ola path skips crop downloads, graph build and OSRM entirely. Route providers, snapped geometry, multi-stop legs, walking and quote identity have automated tests; real four-point car and walking routes passed separately.

## Code map

| Area | Where | Intended responsibility |
| --- | --- | --- |
| UI and client session | `frontend-next/` | Role-specific UI, Ola browser SDK/Places proxy, session and client tests |
| Domain API | `backend/extensions/carpoolear/Mobility/` | Matching, pickup, recurrence, bookings, payments-demo, safety and communications |
| Host integration | `backend/integrations/carpoolear/` | Laravel app bindings and provider adapters |
| Routing bootstrap | `scripts/mobility-road-router.py` | Optional OSRM rollback graph/ownership commands; not used by Ola startup |
| Build/run/test setup | `scripts/run-local-core.sh`, `research/experiments/carpoolear/` | External backend reconstruction and isolated integration |
| SQL and Mongo reports | `docs/dbms/`, `services/activity-projection/` | Data dictionary, actual routines, projections and failure isolation |

## Design trade-offs that a reviewer should know

1. **Good:** booking integrity is evaluated on the backend, not trusted to browser-generated distances.
2. **Costly:** the pinned external Laravel host and optional Mongo projection still add overhead; Ola mode removes the three local OSRM services.
3. **Mitigation:** route-provider abstraction and automated regression tests allow gradual replacement without rewriting booking logic.
4. **Boundary:** campus timetables, pickup agreements and reminders have backend tests but are **not fully integrated into the currently demonstrated local student frontend**. See [feature status](FEATURE_STATUS.md).
5. **Rollback:** the Ola adapters live in draft PR #92; keep the separate OSRM data/runtime until explicit approval and provider quota/referrer restrictions are confirmed.

## References for reviewers

- [Feature status](FEATURE_STATUS.md)
- [Course demo](COURSE_DEMO.md)
- [DBMS reports](dbms/README.md)
- [Reproducible local run](../RUN_LOCAL_CORE.md)
- [Ola clean startup, SQL and browser evidence](engineering/OLA_MIGRATION_ACCEPTANCE_20261110.md)
- [Historical Google/OSRM browser evidence](engineering/PHASE1_SIMULAR_PR_OWNED_E2E_20261110.md)
- [External source and licenses](../THIRD_PARTY_NOTICES.md)
