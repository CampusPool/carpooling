# Ola-only private VPS stage (draft PR #92)

This is a **separate, non-public staging deployment** for a synthetic campus carpool demo. It does not replace the current Google/OSRM service, reuse its MySQL data, or authenticate real students. It is intentionally NOT ready for arbitrary public internet users or real money.

## Components

- **Next.js 24/Next 16**: a production build (`next start`), accessible locally on `127.0.0.1:3040` by default. Browser calls reach Laravel via a private Next.js proxy.
- **PHP 8.5 FPM and Nginx**: the exact pinned Carpoolear upstream source with CampusPool's reviewed patches. Routes, matching and wallet rules stay in Laravel.
- **MySQL**: a private named Docker volume, health checks, database migrations and no published database port.
- **Ola**: HTTPS Directions and Places from backend services. **No OSM dataset, local router or OSRM container.**
- **Optional Caddy profile**: not enabled by the default stage commands. The optional HTTPS profile now has mandatory HTTP Basic authentication in front of the app. Do not enable it without a valid domain, a securely generated unique bcrypt password hash, DNS/TLS, rate limits and provider key restrictions; the default invalid hash deliberately grants no access.

All Compose services have separate internal networks. The only default published port is loopback `3040`. `api` and `mysql` are never published to the host. This staging stack uses a *different* Compose project and database from every existing demo.

## Prepare and run

Prerequisites: a Linux box with Docker Engine + Compose v2, Python 3.9+, Git and internet access for upstream source and container downloads. Allocate sufficient memory and disk for the initial PHP and Next.js image builds. On Simular's nested Docker filesystem, the `vfs` storage driver may be needed; it uses significantly more disk than overlay2. A normal VPS should use its native supported storage driver.

Create an ignored, owner-readable file `.local/maps-demo/ola-vps.json` (mode 600):

```json
{"kind":"ola_maps_demo","api_key":"YOUR_PRIVATE_SERVER_KEY","browser_key":"YOUR_DIFFERENT_RESTRICTED_BROWSER_KEY"}
```

**Important:** The Ola Web SDK key is delivered to authenticated browsers and can be inspected in browser developer tools. It must be a **distinct** key restricted by the Ola provider console to the intended browser origins, with appropriate API restrictions, budget and quota limits. Never provide the unrestricted server-side key as the browser key. The launcher refuses identical keys.

```sh
chmod 600 .local/maps-demo/ola-vps.json
python3 deploy/ola/manage.py init --key-file .local/maps-demo/ola-vps.json --port 3040
python3 deploy/ola/manage.py check
python3 deploy/ola/manage.py up
python3 deploy/ola/manage.py status
# SSH into the box, then visit http://127.0.0.1:3040 locally,
# or use a tightly restricted SSH tunnel; no public HTTP is enabled by default.
```

`init` is one-time: creates three mode-600 private environment files and a state marker in ignored `.local/deploy/ola/`, including generated independent APP_KEY/JWT and MySQL passwords. The actual Ola keys never appear in Git, Dockerfile build args or terminal output. The staging launch **does not** use the test seeder or automatically create demo logins. It runs Laravel with `APP_ENV=local` and `APP_DEBUG=false`, because the existing synthetic local-account API is intentionally disabled in production mode. The Next.js server is still a production build. Never make this synthetic-login stage public without a separate access-control review. Create synthetic accounts through the UI.

For an existing stage where the provider keys need changing, use `python3 deploy/ola/manage.py rotate-key --key-file .local/maps-demo/ola-vps.json`, followed by `up`. This preserves the database and never displays the keys.

To stop without losing the DB: `python3 deploy/ola/manage.py stop`. The script never calls `docker compose down -v`. Back up the MySQL volume separately and rehearse restore *before* depending on it. Do not run PHPUnit inside a serving app container: it can reset the serving schema; use the CI disposable test runner.

For Simular only, its nested Docker bridge may report `No route to host` even with healthy MySQL. On a **new, empty box**, add `--simular-host-network` to the one-time `init` command. This selects an isolated host-network override that binds MySQL to 127.0.0.1:3306, PHP-FPM to 127.0.0.1:9000, API Nginx to 127.0.0.1:8080 and the frontend to the selected 127.0.0.1 port. It is intentionally **not** the default layout and must not be used on an already-running shared VPS. The normal deployment uses three separate Docker networks.

## Cloud-specific networking

If your host requires an HTTP CONNECT proxy for outgoing traffic, set `CAMPUSPOOL_BUILD_PROXY` in the private `compose-vars.env` to a **host-reachable, credential-free** proxy URL for the image build. Set `CAMPUSPOOL_CONTAINER_PROXY` to a **container-reachable** proxy URL for PHP/Next Ola requests. These are different network paths; a container's `127.0.0.1` is *not* the Docker host. Verify connectivity on the actual box and never embed proxy passwords in the file, image or logs.

Simular and free-tier InstaBox environments can pause or limit runtime. Running an app there proves a staged test, **not** continuous public availability. For an actual public demo choose a persistent VPS with stable HTTPS ingress and backup storage, then verify DNS, TLS, access controls, key restrictions, restart/recovery and monitoring. Do not switch on the `public` Compose profile merely because the page loads. A separate gateway password is essential even for synthetic local accounts; the default user/hash placeholders must never grant access.

## Acceptance criteria before promoting a release

1. Both new and existing synthetic driver/rider logins pass; Ola autocomplete, details, route preview, publish/search/match/request/accept and wallet/chat/ride completion work in real browsers.
2. Full backend/DBMS/frontend CI and a separate database E2E pass on the **exact commit** to be released; quoted routes cannot reuse OSRM versions after switching.
3. Stop and restart the whole stack, confirm the same MySQL records and credentials still work, then restore an encrypted backup to an independent empty project.
4. Verify abnormal API behavior (401, 403, 429, 5xx, timeouts) and provider spend controls. Confirm no secret appears in logs, Git or frontend bundles. HTTPS and authenticated access required before making it public.
5. Document what remains synthetic: virtual credits, unverified university enrollment and optional Android GPS. Do not present the stage as a production campus transport service.

See [migration acceptance evidence](../../docs/engineering/OLA_MIGRATION_ACCEPTANCE_20261110.md), [regular local setup](../../RUN_LOCAL_CORE.md), and [third-party GPL notices](../../THIRD_PARTY_NOTICES.md).
