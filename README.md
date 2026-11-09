# CampusPool

**Campus carpooling for students and staff — an SE + DBMS course project.**

CampusPool helps people heading to the same campus share a planned ride. A driver publishes a route and departure time; a rider finds a compatible offer, requests a seat, and follows the booking through pickup and trip completion. The project emphasizes **safe booking transactions, route-aware matching, and reproducible database evidence** rather than production ride-hailing infrastructure.

> **Demo, not a production transport service.** Test accounts, vehicles, wallets and fares are synthetic. No actual money is moved. University authentication, official timetable import, physical-device GPS and production deployment are **not** claimed to be complete. See [what works and what remains](docs/FEATURE_STATUS.md).

## See it work

The isolated driver-and-rider browser journey has been exercised with real Google Places, real map routes, a separate Laravel/MySQL instance, and a cleanly built Next.js frontend. It covered account creation → route selection → publish → find → request → accept → demo-wallet hold → chat → pickup → drop-off → complete → rider arrival confirmation. See the [test evidence and its limitations](docs/engineering/PHASE1_SIMULAR_PR_OWNED_E2E_20261110.md).

For an instructor or teammate, follow the **[10-minute teacher demo](docs/COURSE_DEMO.md)** and the **[local setup instructions](RUN_LOCAL_CORE.md)**. The latter contains exact commands and recovery steps.

## What is implemented?

| Student-visible core | DBMS / service features | Still outside the verified demo |
| --- | --- | --- |
| Local rider/driver accounts | Transactional seat requests and lifecycle | University-issued login / OTP delivery |
| Google Maps & Places selection | MySQL migrations, constraints, indexes and reports | Real payment gateway and settlement |
| Publish, discover and request seats | Isolated SQL/Mongo application analytics | Physical-phone GPS acceptance |
| Accept, chat, complete and confirm arrival | Backend recurrence, pickup agreements and reminders | Official timetable import / campus approval |
| Synthetic wallet, hold and notifications | CI for frontend, backend and database integration | Ola Maps migration (planned; not implemented) |

For exact behavior, backend-only capabilities, restrictions and linked evidence, use the [canonical feature-status matrix](docs/FEATURE_STATUS.md). The table above is deliberately abbreviated.

## Architecture at a glance

```text
Next.js web client ── Google Maps / Places (browser)
       │
       ▼
Laravel / Carpoolear backend extension ── MySQL (source of truth)
       │                          └────── optional SQL → Mongo analytics projection
       ▼
Local OSRM road-routing services ── Bengaluru OpenStreetMap graph (external asset)
```

The backend is **not** a standalone Laravel application checked into this repo. Our tracked extension is installed into an [exact pinned Carpoolear backend](THIRD_PARTY_NOTICES.md), reconstructed by the setup scripts. The routing graph is intentionally external; Google renders maps in the browser, while OSRM currently provides server-side road matching. The planned hosted routing provider replacement has **not** happened yet.

Read the [architecture and code boundaries](docs/ARCHITECTURE.md) before modifying the backend.

## Run locally

**A Git clone alone is not sufficient.** You need:

- Git, Python 3.9+, Node.js 24, Docker with Compose v2 and at least 4 GiB assigned to Docker.
- Internet access to reconstruct the pinned backend and install dependencies.
- The separately supplied, checksum-locked Bengaluru OSM road crop (not in Git; see [dataset provenance](research/experiments/real-routing/source-lock.json)).
- Your own appropriately restricted Google Maps browser key with Maps JavaScript, Places and routing preview enabled. **Never commit this key.**
- ARM64 Docker support; x86/AMD64 machines must support ARM64 emulation for the currently pinned OSRM image.

Save your key to ignored `.local/maps-demo/google.json`:

```json
{"kind":"google_maps_demo","browser_key":"YOUR_BROWSER_KEY"}
```

```sh
chmod 600 .local/maps-demo/google.json
sh scripts/run-local-core.sh \
  --dataset /absolute/path/to/bbox-77.20-12.60-78.00-13.40-complete-ways.osm.pbf \
  --maps-config .local/maps-demo/google.json
```

Open **http://127.0.0.1:3012/** when startup finishes. Use **two separate browser profiles** (or a private window) for driver and rider; tabs in the same profile share the session. The complete [runbook](RUN_LOCAL_CORE.md) covers Docker contexts, database isolation, preflight checks and cleanup. **Never run tests against someone else's existing database.**

> **No campus dataset yet?** You can run isolated automated tests without private Google credentials or the OSM crop, but cannot run the live road-matching demo. The full app is not currently a zero-configuration clone-and-run project.

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
