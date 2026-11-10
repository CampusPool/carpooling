# Ola Maps migration — review workstream (10 November 2026)

This branch introduces **opt-in Ola Maps frontend and backend adapters** without deleting the already verified Google/OSRM demo. The intended permanent choice is Ola Maps for browser maps/places and backend routing, but **this branch is not accepted for production or classroom delivery until a real browser E2E against its own Laravel and MySQL passes**.

## Provider settings and secrets

**Do not commit API credentials.** The owner-provided Ola key is *not* stored anywhere in this branch.

Next.js (build-time provider flag and runtime API proxy):

```sh
# Export these to your shell, CI's secret store or a private ignored file, never to Git.
export NEXT_PUBLIC_MAP_PROVIDER=ola
export OLA_MAPS_ENABLED=1
export OLA_MAPS_API_KEY='YOUR_PRIVATE_OLA_KEY'
# Optional distinct referrer-restricted browser credential if available.
export OLA_MAPS_BROWSER_KEY='YOUR_REFERRER_RESTRICTED_BROWSER_KEY'
export MOBILITY_API_ORIGIN=http://127.0.0.1:18080
npm run build
npm start
```

Laravel API (same private key in server-side environment, **separately**):

```sh
export MOBILITY_ROUTING_PROVIDER=ola
export OLA_MAPS_API_KEY='YOUR_PRIVATE_OLA_KEY'
# Existing pricing, demos, college and database settings still apply.
```

> The Ola Web SDK requires a **browser-visible API key** to download map styles and tiles. It cannot be treated as an unreadable server secret. Use provider dashboard restrictions, budget/quota alerts and a separate key if the provider supports it. The `/api/ola/config` handler requires a valid CampusPool bearer session, but anyone with an authorized browser session can inspect its browser key in developer tools. Do not expose this pilot endpoint on a public website without a dedicated security review.

The Next.js API handlers are intentionally fixed-path, bounded and quota-conscious. They reject users without a valid backend session and restrict each session to 12 autocomplete, 8 Directions and 20 detail/config requests per minute **per process**; all requests have timeouts and no retries. They do not provide a distributed rate limiter or solve provider-side monthly quota management. The provider's direct SDK tile traffic is governed by the Ola account, outside these proxy limits.

## Status table

| Capability | Code implementation | Required independent verification |
| --- | --- | --- |
| Ola Web SDK v2 map style, map clicks and route line | Added as opt-in `OlaMapPanel` | Real Chrome tile load, zoom, pointer interactions and key referrer restrictions |
| Places autocomplete + resolved place detail | Added as `OlaPlaceInput` and authenticated Next proxy | Real browser search and select, CORS/provider response, coordinates |
| Directions preview, decoding/polyline | Added as server proxy and browser decoder | Actual Bengaluru route displayed correctly in browser |
| Laravel car/bike/foot Directions adapters | Added `OlaDirectionsClient`, `OlaRouteProvider`, `OlaPathProvider` | PHP integration CI, real 2-point and 4-point provider routing, walking snaps |
| Provider-specific quote / pickup identity | Added `ola-directions-v1:<mode>` plus provider-aware validation | Full pickup/quote/booking constraints, no cross-provider data reuse |
| Booking, demo wallet, chat, lifecycle | No intentional changes | Must rerun complete two-account browser E2E using a *cloned PR backend + new DB* |
| Remove OSM road crop and OSRM images from startup | **Not done yet** | Only after Ola-only startup and E2E passes |
| Legacy/CanonicalPool Google browser flow | **Not migrated yet** | Audit all account paths before removing Google integration |
| Android / old backend browser prototypes | **Not migrated yet** | Decide whether required for course deliverables |

## Provider response format validated in November 2026

The Ola Directions API returned `status=SUCCESS`, `routes[0].legs[]` with numeric `distance` and `duration`, `start_location` and `end_location`, plus an encoded `overview_polyline` for both simple and via-waypoint trips. It supports `driving`, `walking` and `bike` modes. These claims are bounded to the developer's small live verification (no load testing). Full provider docs: [Directions](https://maps.olakrutrim.com/docs/routing-apis/directions-api) and [SDK v2](https://maps.olakrutrim.com/docs/sdks/web-sdk/latest/setup).

### Important correctness distinction

OSRM's `car|crop_sha256=...|profile_sha256=...` is a *specific graph build identity*. Ola does not expose the same graph build pin. We deliberately use `ola-directions-v1:car|bike|foot` as an **API adapter contract identity**, not a claim that external roads/traffic never change. Existing OSRM bookings must not silently be interpreted as Ola quotes. Fresh-clone tests should use a new disposable database and expire/migrate old quotes before switching providers.

Ola may return different bike paths and ETA than OSRM, and provider geometry differs by a few meters after polyline encoding. Validate nearest-path snaps and 4-point route geometry against pickup guard tolerances before enabling the provider for class demo. A 429 is treated as unavailable and never retried automatically.

## Verification commands

```sh
cd frontend-next && npm ci && npm test && npm run typecheck && npm run build
# Backend: run the repository's full disposable GitHub CI on this branch.
# Then run the complete fresh-clone, two-context Chrome journey against the Ola-enabled API.
```

No remote branches have been removed; no merge authorization is implied. **The original OSRM/Google implementation is preserved until evidence is complete.**
