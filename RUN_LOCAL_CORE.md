# Run CampusPool locally — Ola Maps (PR #92)

This is a **synthetic teaching demo**, not a production transport service. The Ola-only launcher does not download the Bengaluru road crop, compile road graphs, start OSRM, or require ARM emulation. Laravel + MySQL still handle authentication, seat inventory, rides, chat, and demonstration credits.

**Status:** This is draft PR #92. The previous isolated LiveCarpool E2E passed with real Ola Places and Directions. The new launcher and other UI paths need a fresh full acceptance run before OSRM can be retired. See [Ola migration status](docs/OLA_MAPS_MIGRATION.md).

## Prerequisites

- Git, Python 3.9+, Node.js 24/npm and Docker with Compose v2.
- Docker available through a **local Unix socket** (Docker Desktop, local Engine or Colima), with at least 4 GiB assigned.
- Internet access for the **pinned external Laravel host**, Composer/npm dependencies and Docker images.
- Your **own Ola Maps credentials** for Web SDK, Places, and Directions. Set provider-side API restrictions, quota limits, billing alerts and allowed web referrers.
- A dedicated test project/database. Never reuse an existing OSRM-backed database with Ola.

## Private Ola configuration

Make an ignored local file at **.local/maps-demo/ola.json** with permissions 600.

~~~sh
mkdir -p .local/maps-demo
chmod 700 .local/maps-demo
~~~

~~~json
{
  "kind": "ola_maps_demo",
  "api_key": "YOUR_PRIVATE_OLA_SERVER_KEY",
  "browser_key": "YOUR_REFERRER_RESTRICTED_OLA_BROWSER_KEY"
}
~~~

~~~sh
chmod 600 .local/maps-demo/ola.json
~~~

The browser key is optional but if omitted it defaults to the server key, which is inappropriate for a public deployment without proper restrictions. The Maps Web SDK necessarily exposes a **browser-visible** key; the server key stays in backend configuration and is **not** put into Next.js public environment variables. Never paste real credentials into Git, screenshots, logs, issue comments, or chat.

## Validate and start

~~~sh
python3 scripts/run-local-core.py --provider ola --check
sh scripts/run-local-core.sh --provider ola \
  --maps-config .local/maps-demo/ola.json \
  --project mobility-core-ola-teacher
~~~

The check does **not** start Docker or contact the API. Startup reconstructs the pinned Carpoolear Laravel backend, applies CampusPool extensions, prepares a **new MySQL project**, launches the application gateway and starts Next.js at **http://127.0.0.1:3012**. No Bengaluru PBF file or OSRM image is needed for the Ola branch.

For a different Docker context, supply **--context YOUR_DOCKER_CONTEXT**. For a busy frontend port, use **--frontend-port 3013**. Use a unique **--project mobility-core-ola-YOURNAME** for each independent checkout. The launcher retains the MySQL volume and on restart verifies checkout, Docker context, project, volume and routing provider identity. Never change a managed database's provider or run destructive Docker cleanup against someone else's stack.

On a proxy-restricted host, configure the optional **MOBILITY_OLA_HTTPS_PROXY=http://host-reachable-from-container:port**. The proxy must be reachable *inside Docker*; 127.0.0.1 within a bridged container is not the Docker host. Simular Box 1 has unusual bridge egress restrictions, so the previous host-network E2E is not by itself a fresh Compose acceptance test.

Use two separate browser profiles (driver and rider). Register synthetic accounts, select Ola pickup and destination, preview a route, publish, find, request, accept, chat, complete and confirm arrival. Refresh and sign in again to verify server-persisted state. A successful homepage is not a whole-journey pass.

## Explicit OSRM/Google rollback (separate database)

Until the Ola migration has its own fresh full acceptance test, keep the existing working Google/OSRM stack and data. To start an **independent rollback project** with the existing checksum-locked road crop, use:

~~~sh
sh scripts/run-local-core.sh --provider osrm \
  --project mobility-core-osrm-rollback \
  --dataset /absolute/path/to/bbox-77.20-12.60-78.00-13.40-complete-ways.osm.pbf \
  --maps-config .local/maps-demo/google.json
~~~

That fallback needs the original ARM64 OSRM image (or working ARM emulation), three prepared road graphs and a mode-600 private Google browser configuration in JSON with kind **google_maps_demo** and key **browser_key**. The separate original demonstration must not be modified or deleted. **Do not use docker compose down -v** on a project with data you want to preserve.

## Repeatable checks

~~~sh
cd frontend-next
npm ci && npm test && npm run typecheck && npm run build
cd ..
python3 -m unittest discover -s scripts/tests -p 'test_run_local_core.py'
python3 scripts/check-teacher-docs.py
MOBILITY_DOCKER_CONTEXT=YOUR_CONTEXT sh research/experiments/carpoolear/run-smoke.sh mobility
~~~

The last command builds a **disposable** MySQL-backed test stack and can be resource-intensive. CI uses fixtures, not a paid provider.

**Known boundaries:** The wallet is synthetic; the external pinned Carpoolear backend remains a first-boot prerequisite ([license and notices](THIRD_PARTY_NOTICES.md)). Android is a GPS tracking companion with **no Google Maps rendering SDK**. The older Laravel **/mobility-pilot/maps** and **/commute** browser pages retain Google-only map integrations and require separate migration or explicit deprecation before retirement. SQL/Mongo analytics, physical-device GPS, real-user security and quota limits require independent acceptance.

**Do not merge [draft PR #92](https://github.com/CampusPool/carpooling/pull/92) without explicit approval.**
