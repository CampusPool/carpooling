# Ola Maps migration — review workstream (10 November 2026)

This draft PR now provides a **verified Ola-first synthetic classroom demo** while preserving the old Google/OSRM environment for rollback. The LiveCarpool headed-Chrome journey, real four-point Directions, real walking route, separate MySQL records, a no-OSRM clean Mac startup and restart have been tested. See [the detailed acceptance report](engineering/OLA_MIGRATION_ACCEPTANCE_20261110.md) for exact evidence and remaining limits.

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

## Status table (draft PR #92, 10 November 2026)

| Capability | Verified implementation | Remaining boundary |
| --- | --- | --- |
| Ola Web SDK maps and route previews | Real browser LiveCarpool journey passed; persisted geometries can draw without extra Directions | Provider-style 3D warning and physical-device map UI not independently certified |
| Ola Places and place details | Real driver/rider selection passed; CanonicalPool and older Next.js screen migrated | Browser key origin/referrer restrictions require provider-console action |
| Four-point driving and walking routes | One real four-point car route with 3 legs, 4 snapped points, 180 geometry vertices; one real walking route passed | No complete real four-stop browser booking lifecycle |
| Provider-aware quote and pickup validation | CI and MySQL suite passed; stale cross-provider quotes rejected | Adapter version is not an immutable road-graph identity |
| Booking, wallet, chat and lifecycle | 19 functional browser checkpoints passed; SQL, independent fresh login and reload verified | Final synthetic receipt/release and real payments not E2E certified |
| Startup without road graphs/OSRM | Clean Mac clone built, migrated 205 tables and restarted with preserved DB | Real restricted credentials and ordinary network/Docker still needed for live maps |
| Other frontend paths | CanonicalPool and older Next.js path use Ola; Google-only Laravel assets redirect or return 410 in Ola mode | Historical HTML sources remain for explicit OSRM rollback |
| Android GPS companion | No Google map SDK to migrate; static checks passed | Physical device test outstanding |
| DBMS and activity projection | Full disposable backend and DBMS Level 3 CI passed | Mongo read model optional; not a settlement ledger |

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


## PR #92 implementation update — November 10, 2026

- Ola-only launcher is now the default provider selection. It bypasses dataset hashing, OSRM graph preparation, ARM OSRM image pulls and OSRM Compose services. **Separate OSRM rollback** remains opt-in through the previous image/crop and a different project/database.
- Private mode-600 provider configuration is mandatory. Laravel uses a private ignored runtime environment file; Next.js accesses the authenticated Ola API proxy and only the SDK browser key is exposed. Local Maps proxy rate limits and eight-second provider timeout remain in place. Actual quota and referrer restrictions must be set in the Ola provider console.
- CanonicalPool's address search now uses the authenticated Ola Places proxy when Ola is selected, and still requires choosing an **approved catalog stop** before booking. The older Next.js screen also has an Ola map/Places path; persisted route geometry can be drawn without another Directions call.
- New Laravel guard rejects unexpired OSRM quotes when the active provider is Ola, and rejects the reverse direction. This is tested against a separate MySQL testing schema in the isolated Ola MySQL container. The private endpoint API accepts **ola_place** provenance without storing provider address text.
- Added four-point Ola routing mock to assert ordered legs, geometry, snapped waypoints, one query-string POST, and absence of retries.
- **Previously verified:** 19-point real headed Chrome synthetic LiveCarpool test with a separately cloned backend, database and real Ola APIs. This does not establish acceptance of the new launcher or every legacy UI path.
- **Completed independent acceptance:** no-OSRM clean Compose startup and restart; real four-point car and foot routes; SQL persisted after a two-role browser journey; independent fresh login/refresh; all earlier CI jobs green.
- **Still external or unverified:** physical Android device; provider-console key restrictions, quotas and billing alerts; real payments/production; optional old Laravel HTML map sources are disabled in Ola mode rather than rewritten.
- **Simular-specific blocker:** its Docker bridge could not reach the host-bound outbound proxy; the existing isolated Ola E2E worked in host-network mode. Avoid changing the original demo or weakening Docker network restrictions to hide this issue.

**Release gate:** Keep [PR #92](https://github.com/CampusPool/carpooling/pull/92) a draft. Ola requires no OSRM runtime, but preserve the rollback services and data until the owner explicitly authorizes merge and retirement.


### Legacy Laravel browser routing (additional guard)

In Ola mode, **GET /mobility** and **GET /mobility-pilot** redirect to the maintained Next.js UI at the launcher-selected local port. Requests for their Google-only static map scripts, and the legacy Google browser-key endpoint, return 410 rather than making Google requests. The legacy source files and their original OSRM-mode routes remain untouched for rollback. Two Laravel HTTP regression tests (12 assertions) verified both Ola gating and OSRM restoration. This retires the legacy map execution paths for the Ola default **without claiming those older HTML implementations were ported**.
