# Phase 1 — PR-owned backend + database browser E2E verification (10 November 2026)

## Outcome

**PASS** for the end-to-end rider/driver campus-commute demo, verified using real Chrome and real Google Maps/Places. This second run fixes an important evidence problem in the earlier Simular test: **the frontend, Laravel backend, and MySQL database under test belong to the cloned PR checkout and its independently initialized project, rather than reusing the existing demo backend/database.**

## Source and environment

- Cloned `CampusPool/carpooling` at code revision `5dbaa06` on Simular Box 1, under `/workspace/phase1-browser-e2e-pr90`. Subsequent PR head `a270d2c` differs solely by the earlier browser-test **documentation** file, not application code.
- Pinned upstream Laravel source `6ba3d8913a8f77e664e848a526f196690a03c1e8`, cloned under `research/vendor/carpoolear_backend`; PR integration patches applied into the *separate* `research/vendor/carpoolear_hardened` worktree.
- Laravel runtime mounted from `/workspace/phase1-browser-e2e-pr90/research/vendor/carpoolear_hardened` in **`mobility-pr90-host-app`**. This was confirmed by inspecting the container mounts.
- New MySQL instance `mobility-pr90-host-mysql`, port **3311**, with new volume **`mobility-core-pr90-e2e-db`**. Before migration the database had zero application tables; the cloned migration sequence created 145 tables and seeded only its own disposable test database.
- Separate Composer dependency volume `mobility-core-pr90-e2e_core-php-vendor`. Cached Composer packages and PHP base image were reused as build dependencies because package repositories were unreachable within Simular Docker. **No runtime code was imported from the old live backend.**
- Cloned production Next.js frontend rebuilt with `MOBILITY_API_ORIGIN=http://127.0.0.1:18086`, then served at **127.0.0.1:3019**. Verified its generated rewrite manifest contains the new backend port **18086** and does **not** contain the old backend port **18082**.
- New Laravel API health at port 18086 returned HTTP 200, local-account config HTTP 200, real Google browser-key config HTTP 200, and unauthenticated protected endpoint HTTP 401.
- Google Maps JavaScript and Places were loaded **for real** through Simular's outbound HTTP proxy. The browser used the ignored `.local/maps-demo/google.json` private config supplied by the new Laravel backend. No Google Maps, autocomplete, or route-preview stub/interception was used in this corrected run. The key was not logged or committed.
- Three separate read-only OSRM car/bike/foot router containers owned by the test on loopback ports 18101–18103, with road graphs copied into the clone and verified using actual Bengaluru route requests. No requests were routed to the previous demo's router containers.

## Browser test results

| Step | Result |
|---|---|
| New driver and rider accounts created in **separate Chrome browser contexts** | PASS |
| Actual Google Places suggestions and place selection for Cubbon Park and Indiranagar | PASS |
| Google route preview, ~7.7 km and ~27 min | PASS |
| Driver published ride with actual server-side route matching | PASS |
| Rider searched and found matching ride | PASS |
| Rider requested seat | PASS |
| Driver accepted request | PASS |
| Sign-in again to independently confirm acceptance persisted for both accounts | PASS |
| Rider added ₹500 synthetic wallet credits | PASS |
| Rider held ₹70.52 demo fare, leaving ₹429.48 available | PASS |
| Two-way private ride chat | PASS |
| Driver started ride | PASS |
| Rider pickup | PASS |
| Rider drop-off | PASS |
| Driver completed ride | PASS |
| Rider confirmed arrival | PASS |

**Not claimed:** physical device GPS sharing, live money, real identity verification, completion of the server-enforced synthetic credit-release waiting period, or a release receipt.

## Environmental deviations / reproducibility caveats

1. **Simular Docker bridge malfunction.** New containers could resolve one another's internal DNS/IPs but could not establish TCP connections; the host bridge showed no attached veth interfaces. To preserve a completely separate backend/database without modifying global Docker network settings, the new test containers used isolated **host-loopback-only ports**. This is an environment-specific workaround, not a production deployment configuration.
2. **OSRM version difference.** The checked-in launcher pins OSRM **26.10.0** for a native ARM64 runtime. The existing independent graph copies were built with **26.11.0**. The attempted 26.10.0 rebuild under x86 ARM emulation failed. Therefore this particular browser test used *separate* OSRM 26.11.0 router containers with matching 26.11.0 graphs, not the exact pinned 26.10.0 engine/graph pair. A different, previously completed clean-clone startup test on a macOS ARM64 Colima context verified the pinned build path; see `PHASE1_FRESH_CLONE_VERIFICATION_20261109.md`.
3. Cached PHP image and Composer packages were reused only as dependency artifacts to avoid inaccessible Debian/Packagist endpoints, with lockfile SHA checked against the pinned upstream. The PHP source, patched Laravel code, and database under test were cloned/new, as described above.
4. The newly initialized backend and DB were **not** the preserved demo backend on 18082 nor its MySQL database. The original containers remain untouched.
5. The browser checked the PR application's code at `5dbaa06`; PR branch later advanced only with a documentation-only evidence commit to `a270d2c`.

## Evidence locations on Simular Box 1

- Test transcripts: `/tmp/pr90-fully-isolated-browser.log` and `/tmp/pr90-fully-isolated-browser-completion.log`
- Browser screenshots: `/tmp/pr90-real-driver-ride-completed.png` and `/tmp/pr90-real-rider-arrived.png`
- Production Next.js build: `/tmp/pr90-clone-next-build.log`
- Backend migration: `/tmp/pr90-host-migrate.log`
- Backend Docker application: `mobility-pr90-host-app`; database: `mobility-pr90-host-mysql`

No screenshots or secrets are committed. **The PR remains unmerged, and this evidence does not authorize a merge.**
