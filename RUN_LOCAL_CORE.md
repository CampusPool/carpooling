# Run the local core carpool app

This runs real Google place selection and map previews with a local OSRM road
router, username/password rider/driver accounts, ride requests/decisions,
notifications, chat and trip lifecycle. Full authentication, OTP, payments,
real vehicle registration and live GPS acceptance remain Sprint 3.

## Prerequisites

- Git, Python 3.9+, Node 24/npm, Docker with Compose v2.
- A local Docker Unix-socket context, for example Linux `default`, Docker
  Desktop `desktop-linux`, or a running Colima context. Docker must have at
  least 4 GiB available; graph building uses up to 3 GiB and two CPUs.
- **Separate Docker context for parallel checkouts:** the local OSRM router uses fixed, labeled container names. If another CampusPool/MobilityPlatform checkout already owns `mobility-road-router-car` in the selected Docker context, startup intentionally refuses to reuse a different graph mount. Use a dedicated Docker/Colima profile for a fresh-clone verification (for example `colima start --profile campuspool-phase1-verify --cpu 3 --memory 5 --disk 20` and `--context colima-campuspool-phase1-verify`). Do **not** delete or repoint someone else's router containers to get past this check.
- The pinned routing image is linux/arm64. An ARM64 Docker host works directly;
  AMD64 requires ARM64 emulation configured in Docker. Startup preflights the
  actual binary and fails clearly before graph work when it cannot execute.
- Internet access on first setup for pinned upstream backend, Composer/npm
  dependencies and Docker images. No provider or map credentials are needed
  for PR CI, which uses explicit test fixtures rather than Google.
- The supplied offline crop in your teammate folder's `assets/` directory.
  This development asset is ODbL data and must **not** be committed to a PR.
  Its identity and attribution are in `assets/source-lock.json` and
  `assets/NOTICE.md`. The original dated regional download is unavailable;
  do not substitute a current extract or skip the checksum.
- Your own Google Maps **browser** key with Maps JavaScript, Places and route
  preview access, restricted appropriately for localhost. This is external
  input, not source code. No server key should be supplied to the browser.

## Private Google configuration

Create `.local/maps-demo/google.json` in your working repository (ignored by
Git), with this structure, replacing the placeholder locally:

```json
{"kind":"google_maps_demo","browser_key":"YOUR_BROWSER_KEY"}
```

Run `chmod 600 .local/maps-demo/google.json`. The helper validates it, copies
it directly into the test-only backend container without printing it, and
restores that container copy after recreation. It is never included in a PR.

## Start

After applying the assigned packages and their prerequisites, from the repo:

```sh
sh scripts/run-local-core.sh \
  --dataset /absolute/path/to/your-teammate-folder/assets/bbox-77.20-12.60-78.00-13.40-complete-ways.osm.pbf \
  --maps-config .local/maps-demo/google.json
```

The default Docker context comes from `docker context show`. To select one,
add `--context YOUR_LOCAL_CONTEXT`. The default frontend is
`http://127.0.0.1:3012/`; change it with `--frontend-port 3013` if occupied.
Use `--project mobility-core-YOURNAME` (lowercase) to keep a separate database
when another checkout already owns the default project. Do not run this
helper against another project's database or recreate the existing 31796 demo.

On first run, it reconstructs the pinned backend, builds the probe image,
verifies the supplied crop, builds the three road graphs, starts the private
routers and migrates a dedicated testing database. Graph preparation can take
several minutes and uses roughly 1.5 GiB of disk. Future runs reuse verified
graphs, the managed database and a project-owned Docker volume for PHP
dependencies. Keeping the large dependency tree inside Docker avoids macOS
shared-filesystem file-handle limits; do not commit or export that cache. It does not seed a fake route or require a
fixture stop catalog: registered accounts can select actual Bengaluru places.

The managed database is retained when you stop the UI with Ctrl-C. Re-run the
same command and project to resume it. Startup refuses an unknown database
volume or an unrelated router container instead of overwriting it. Read
`.local/core-runtime/PROJECT/state.json` for its project/context/volume identity.
To stop background services while keeping data, use
`docker --context CONTEXT stop PROJECT-gateway-1 PROJECT-app-1 PROJECT-mysql-1`.
Do not use `down -v` unless deliberately discarding that isolated test data.
Restart also checks the stored checkout, context, project and database volume
identity before preparing anything. A missing database or PHP dependency
volume is refused; restore the original managed resources or choose a new
project explicitly. A deleted database is never silently treated as a restart.

## Fresh-clone limitations

This project is **not** a two-file standalone prototype. The Laravel host is fetched at its pinned upstream revision, the OSRM street graphs are generated from an independently supplied checksum-locked OSM crop, and a private Google Maps browser key is needed for live provider interaction. A fresh clone with these prerequisites can run the application, but the repository intentionally contains neither the proprietary browser key nor the large ODbL routing dataset.

Google address suggestions may fail if the **Places API (New)** is disabled, billing is missing, a browser-referrer restriction is wrong, or requests are blocked by the network. Check the Google Cloud Console, key restrictions and browser console; do not paste API keys into issues. The map-click fallback works for selecting coordinates when Places suggestions are unavailable. Google Maps failing to load entirely is a separate error and prevents map-click selection.

Use future local times in **Asia/Kolkata**: the app now rejects departures too close to the present and rolls a saved daily commute time forward to tomorrow if that time has already passed today.

## Check and verify

Add `--check` to validate your exact crop and private browser config without
starting Docker, downloading dependencies, or changing the runtime. This is
input validation, not proof of a successful runtime or real-provider journey.

In two separate browser profiles (or a normal and private window), register one driver and one rider. Two tabs in the same browser profile can share and overwrite the same session. Select the
same Google pickup/destination, a future time, and matching date (pickup
tolerance 15 minutes). Publish, find, request, accept, chat, start, pickup,
drop-off and complete. One passenger seat per offer and Bengaluru road bounds
are deliberate local limits. GPS tracking code is retained but deferred.

Automated checks are `npm ci && npm test && npm run typecheck && npm run build`
inside `frontend-next`, and from the root:

```sh
MOBILITY_DOCKER_CONTEXT=YOUR_LOCAL_CONTEXT sh research/experiments/carpoolear/run-smoke.sh mobility
```

That backend command owns a separate disposable test database and fixtures;
it does not reset the running core app. The PR workflow now runs the full
backend suite alongside frontend, activity projection and reconstruction.
