# CampusPool

**Campus carpooling for students and staff — an SE + DBMS course project.**

CampusPool helps people heading to the same campus share a planned ride. A driver publishes a route and departure time; a rider finds a compatible offer, requests a seat, and follows the booking through pickup and trip completion. The project emphasizes **safe booking transactions, route-aware matching, and reproducible database evidence** rather than production ride-hailing infrastructure.

**Ola Maps migration (draft PR #92):** The Ola-only launcher and the LiveCarpool/CanonicalPool/older Next.js map paths are being migrated and tested. The original Google/OSRM runtime remains an explicit rollback, **not a required Ola-only dependency**. See [migration status and remaining gaps](docs/OLA_MAPS_MIGRATION.md). Do not merge without approval.

> **Demo, not a production transport service.** Test accounts, vehicles, wallets and fares are synthetic. No actual money is moved. University authentication, official timetable import, physical-device GPS and production deployment are **not** claimed to be complete. See [what works and what remains](docs/FEATURE_STATUS.md).

## See it work

The original Google/OSRM journey and an independently cloned Ola Maps LiveCarpool journey have both been exercised on isolated stacks, but **the newer Ola-only startup and all UI paths are not yet fully E2E-certified**. The previous LiveCarpool Ola journey covered account creation → route selection → publish → find → request → accept → demo-wallet hold → chat → pickup → drop-off → complete → rider arrival confirmation. See the [test evidence and its limitations](docs/engineering/PHASE1_SIMULAR_PR_OWNED_E2E_20261110.md).

For an instructor or teammate, follow the **[10-minute teacher demo](docs/COURSE_DEMO.md)** and the **[local setup instructions](RUN_LOCAL_CORE.md)**. The latter contains exact commands and recovery steps.

## What is implemented?

| Student-visible core | DBMS / service features | Still outside the verified demo |
| --- | --- | --- |
| Local rider/driver accounts | Transactional seat requests and lifecycle | University-issued login / OTP delivery |
| Ola Maps and Places in selected Next.js paths (draft PR) | MySQL migrations, constraints, indexes and reports | Real payment gateway and settlement |
| Publish, discover and request seats | Isolated SQL/Mongo application analytics | Physical-phone GPS acceptance |
| Accept, chat, complete and confirm arrival | Backend recurrence, pickup agreements and reminders | Official timetable import / campus approval |
| Synthetic wallet, hold and notifications | CI for frontend, backend and database integration | Ola-only fresh-startup and remaining legacy Laravel map pages still require acceptance |

For exact behavior, backend-only capabilities, restrictions and linked evidence, use the [canonical feature-status matrix](docs/FEATURE_STATUS.md). The table above is deliberately abbreviated.

## Architecture at a glance

~~~text
Next.js web client ── Ola Maps SDK for map tiles + authenticated Places proxy
       │
       ▼
Laravel / pinned Carpoolear backend ── MySQL (bookings, rides, wallet, chat)
       │                       └── optional SQL → MongoDB analytics projection
       ▼
Ola Directions / walking routes (server-side; no mandatory OSRM graph)
~~~

The tracked Laravel extension is installed into an [exact pinned external Carpoolear backend](THIRD_PARTY_NOTICES.md) during startup. It is **not** a standalone Laravel host copied into this repository. The old Google/OSRM path stays available as a separately configured rollback; those services are **not required** for the Ola-only launcher. See [architecture](docs/ARCHITECTURE.md) and [Ola-mode legacy-view redirection and remaining limitations](docs/OLA_MAPS_MIGRATION.md).

## Run locally

A Git clone alone is **not** enough: install Docker with Compose v2, Node.js 24, Python 3.9+, Git, and supply **your own, appropriately restricted Ola credentials**. You do **not** need the Bengaluru road crop or ARM emulation in the Ola mode.

Follow the tested commands, permission requirements, validation, rollback instructions, and current limitations in **[RUN_LOCAL_CORE.md](RUN_LOCAL_CORE.md)**. For example, after creating a mode-600, ignored configuration file:

~~~sh
python3 scripts/run-local-core.py --provider ola --check
sh scripts/run-local-core.sh --provider ola --maps-config .local/maps-demo/ola.json --project mobility-core-ola-teacher
~~~

Open **http://127.0.0.1:3012** and use separate driver/rider browser profiles. This draft branch has not yet passed the complete clean-clone, both-role, all-feature acceptance gate; [PR #92](https://github.com/CampusPool/carpooling/pull/92) must remain unmerged pending explicit approval.

## Test the code without demo secrets

```sh
cd frontend-next
npm ci
npm test
npm run typecheck
npm run build
```

GitHub Actions also reconstructs the pinned Laravel backend, runs disposable mobility integration tests, and checks the SQL/MongoDB application reports. Both workflows passed on the merged Phase 1 commit (`2b782c4`), but **CI alone does not prove the browser or real provider is available**. [See verification evidence](docs/engineering/PHASE1_SIMULAR_PR_OWNED_E2E_20261110.md).

## Repository navigation

| Path | Purpose |
| --- | --- |
| [`frontend-next/`](frontend-next/) | Next.js web UI, components and interaction tests |
| [`backend/extensions/carpoolear/`](backend/extensions/carpoolear/) | Laravel domain logic, API integration and backend tests |
| [`backend/integrations/carpoolear/`](backend/integrations/carpoolear/) | Upstream integration adapters and patches |
| [`services/activity-projection/`](services/activity-projection/) | Optional MongoDB analytics read model |
| [`scripts/`](scripts/) | Local bootstrap, dataset checks and verification |
| [`research/experiments/`](research/experiments/) | Disposable integration harnesses and pinned dependencies |
| [`docs/dbms/`](docs/dbms/) | ERD, data dictionary, transactions, SQL/Mongo operations evidence |
| [`android/`](android/) | Optional tracking prototype, **not** the main runnable demo |
| [`docs/`](docs/) | [Documentation guide](docs/README.md) and sprint evidence |

## Teamwork, attribution and safety

Use [CONTRIBUTING.md](CONTRIBUTING.md) for small PRs, required checks, independent review and branch hygiene. We preserve upstream and teammate attribution, and document AI-assisted contributions transparently. The upstream Laravel application is GPLv3; see [third-party notices](THIRD_PARTY_NOTICES.md). A project-wide source license is **not yet declared**—do not infer that the upstream license automatically grants rights to all original course material.

For assessment, the repository and tests are evidence of implementation, **not** proof of instructor approval or originality. [Current delivery state](docs/FEATURE_STATUS.md) and [teacher demonstration guide](docs/COURSE_DEMO.md) are the starting points.
