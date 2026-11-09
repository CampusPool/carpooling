# Fresh-clone startup verification — 9 November 2026

## Result

**PASS:** A brand-new checkout of Phase 1 draft PR #90 (commit `35b1082b88c0b63ccd15e192bfdb8c81d6bddbe7`) booted the real, independently initialized backend and frontend on an isolated Apple Silicon Docker/Colima context. No preserved pilot or teammate database was reused.

## Inputs and isolation

- Host: macOS, Node 24, Docker/Colima; clone under `~/Downloads/campuspool-phase1-cleanclone-20261109`.
- Dataset: teammate-supplied 49,098,156-byte pinned Bengaluru OSM crop, validated by `run-local-core.sh --check` against `research/experiments/real-routing/source-lock.json`.
- Google Maps browser key: provided through ignored, mode-600 `.local/maps-demo/google.json`; key **not recorded** in this evidence.
- Project: `mobility-core-phase1-verify-1109`, port 3025, context `colima-campuspool-phase1-verify` (3 CPUs, 5 GiB RAM, 20 GiB virtual disk).
- The original `colima-mobility` context had a historical router container bound to a different checkout path. The local launcher correctly rejected this mismatch rather than modifying that shared container. A *new, dedicated context* resolved the conflict. Do not delete old containers as a workaround.

## Checks observed

| Check | Result |
|---|---|
| Fresh Git clone of PR #90 | PASS; no tracked changes at checkout |
| Exact OSM crop and private Maps config preflight | PASS |
| OSRM car routing, real in-area route, fail-closed out-of-area request | PASS |
| OSRM bike and foot router start | PASS |
| Fresh MySQL Docker service | PASS; healthy |
| Laravel/API gateway and Next.js app started | PASS |
| `GET http://127.0.0.1:3025/` | HTTP 200 |
| `GET /api/mobility/local-auth/config` | HTTP 200; enabled=true |
| `GET /mobility-pilot/maps-config` | HTTP 200; nonempty configured browser key (value not displayed) |
| `GET /api/mobility/commute/me` without bearer token | HTTP 401 (expected) |
| PR #90 GitHub Actions | Eight checks PASS before this documentation update |

## Remaining limitations before final release

This verifies a **fresh-clone boot and live service HTTP endpoints**, not the complete two-account journey on the clean Mac installation, real Google Places suggestion service quotas/restrictions, a live physical-device GPS test, real money or production deployment. The full driver/rider/booking/chat/demo-wallet lifecycle was previously exercised separately in a configured Simular environment; that is distinct evidence. Keep PR #90 unmerged until a human has reviewed the code and accepted these boundaries.

The initial same-context attempt failed safely due the pre-existing globally named router container. The runtime must either use a dedicated Docker context for each separate graph checkout, or receive a separately reviewed container-namespacing change later. Rewriting the router ownership model is out of scope for this stabilization PR.
