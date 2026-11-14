# Ola-only driver/rider real-browser E2E (10 November 2026)

**Result: PASS** — a real, headed Chrome browser completed the complete synthetic `LiveCarpool` journey on Simular Box 1 with **real Ola Maps Web SDK, Ola Places/Details, Ola Directions, Ola Laravel routing adapters and an independently prepared database**. No Google Maps Places/directions mock or local OSRM service was used for this flow.

**Tested code revision:** `3c0046faf28841955c7784f43299a3a85d1ce9be` from draft [PR #92](https://github.com/CampusPool/carpooling/pull/92). **Not tested as a production deployment** and does not establish that legacy/`CanonicalPool`/Android Google integrations can be removed yet.

## Independent setup and scope

- New PR checkout: `/workspace/ola-e2e-pr92-20261110`; pinned external Laravel host at revision `6ba3d8913a8f77e664e848a526f196690a03c1e8`, with the PR's integration patches applied to a **separate** working tree.
- Laravel app: `ola-pr92-app`, bound to `127.0.0.1:18087`, using `MOBILITY_ROUTING_PROVIDER=ola`. Inspection of the live Laravel container confirmed `RouteProvider` resolved to `OlaRouteProvider` and `PathProvider` resolved to `OlaPathProvider`.
- Separate MySQL: `ola-pr92-mysql`, port 3312, persistent test-only volume `ola-pr92-db`; initially contained **zero** application tables. The project migrations created **145** tables, followed by synthetic fixture seeding.
- Cloned production Next.js build at `127.0.0.1:3021`, with `NEXT_PUBLIC_MAP_PROVIDER=ola`, `OLA_MAPS_ENABLED=1`, and `MOBILITY_API_ORIGIN=http://127.0.0.1:18087`. The generated Next.js rewrite points to **18087**, not the preserved old backend on **18082**.
- The only test-owned Docker containers were **Laravel and MySQL**. No test-owned OSRM routing container or road graph dataset was needed for this browser flow. The separate original campus demo and its OSRM services stayed online.
- Real `olamaps-web-sdk@1.4.0`, map tiles/style and autocomplete/places/directions REST endpoints. Chrome was **headed**, with its window shown in the Simular Box 1 live viewer. Separate driver and rider browser contexts isolated sessions.
- Simular's outbound proxy `127.0.0.1:3128` was necessary for external Ola traffic from Chrome and Laravel. This is an environmental networking workaround, **not** a property of Ola Maps.
- The owner-provided Ola key was stored only in ignored local files, mode 0600, and in the running test containers' environment. **No actual API key, JWT, account password or unredacted request URL is in this report.**

## Browser-observed checkpoints

| Step | Outcome |
| --- | --- |
| Driver and rider local account creation | PASS |
| Ola Web SDK map initialization with live style/tiles | PASS (with a nonblocking style-layer console warning; see caveats) |
| Real Ola Places autocomplete and place-details selection, two endpoints, both roles | PASS, HTTP 200 |
| Real Ola Directions preview in both roles | PASS, HTTP 200 |
| Driver publishes matching ride using **Laravel OlaPathProvider** | PASS |
| Rider searches and finds compatible road-routed trip | PASS |
| Rider requests seat | PASS |
| Driver accepts seat request | PASS |
| Rider adds ₹500 synthetic wallet balance | PASS |
| Rider places fare on synthetic wallet hold | PASS (6044 minor INR units, i.e. ₹60.44) |
| Driver sends chat and rider replies; both receive messages | PASS |
| Driver starts ride and marks pickup | PASS |
| Driver marks drop-off and completes ride | PASS |
| Rider confirms arrival | PASS |

**Database reconciliation after completion:** one test-owned `mobility_commute_demo_trips` row, one `mobility_commute_matches` row and one `mobility_commute_demo_holds` row. The hold remained `held`, but its `arrived_at` timestamp and `release_at` schedule were populated. The `mobility_commute_demo_receipts` table had **zero** rows. This is **not** proof that the delayed demo-wallet credit release or final receipt creation is complete.

## Issues discovered and fixed by this real test

1. Initial Google-like place-ID validator incorrectly rejected Ola IDs such as `ola-platform:5000205199247`. Fixed in commit `614c94c`; the real browser subsequently received HTTP 200 from `/api/ola/details`. Regression test added.
2. Laravel `Http::post()` sent an empty JSON payload which the Ola Directions endpoint rejected with HTTP 400. Ola expects query-string POST with **no JSON body**. The fix in `a9b22ea` uses Laravel `send('POST', $url)`; direct real provider test and Laravel normalized-path test both passed.
3. An intermittent 4.5-second external Ola proxy timeout returned HTTP 503 in one browser attempt (no 429 / quota error). Commit `3c0046f` increased the bounded request timeout to 8 seconds **without adding automatic retries**. The subsequent full browser journey passed.

No repeated polling, load testing or intentional quota stress testing was performed. The exact account quota balance was **not** checked. Real browser and service requests still consume API usage, including direct map tile traffic outside the proxy's per-user counter.

## Remaining limitations / merge blockers

- **Only the local synthetic `LiveCarpool` journey** is fully browser-verified against Ola. `CanonicalPool`, legacy backend browser screens and Android prototypes still contain Google-specific paths or are unverified. They must be audited before claiming a single-provider migration.
- The default startup (`scripts/run-local-core.sh`) still expects the Bengaluru OSM crop and OSRM. A **tested Ola-only bootstrap path** must be added before telling new developers they can clone and run without external road assets.
- The underlying PHP host is fetched from an external pinned dependency; even with Ola, Git clone alone does not supply all application prerequisites. Google/OSRM fallback must remain until a supported migration/rollback plan exists.
- Browser console reported a missing provider source layer named `3d_model` and some style image warnings. The workflow and route preview passed, but a focused visual map-style check on supported browsers remains warranted.
- Synthetic demo fare is **not real money**, and the server-enforced delayed release/receipt is **not browser-verified**. Physical device GPS, institutional sign-in and production security have not been validated.
- Ola browser keys are inherently visible in authenticated browser sessions; configure provider-side referrer restrictions and quota/billing alerts before public deployment. This branch is still a **draft PR** and has **not** been merged.

## Evidence retained on Simular Box 1

- Browser script (headed real Chrome): `/tmp/ola-pr92-full-e2e-headed.cjs`
- Final transcript: `/tmp/ola-pr92-full-e2e-headed-attempt4.log`
- Machine-readable outcome: `/tmp/ola-pr92-e2e-outcome` contains `passed`
- Final screenshots: `/tmp/ola-pr92-driver-completed.png` and `/tmp/ola-pr92-rider-completed.png`
- HTTP server and migration logs: `/tmp/ola-pr92-next-8s.log`, `/tmp/ola-pr92-migrate.log`, and the isolated Laravel container logs.

The screenshots are deliberately **not committed to Git** because the test pages may contain account details and synthetic conversation content. If demonstrations are shared externally, first produce sanitized captures with all session tokens, credentials and personal identifiers removed. The original running demo and database remain untouched. **No merge is authorized by this evidence.**
