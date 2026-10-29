# Carpoolear smoke harness

Tracked evaluation harness for source `6ba3d8913a8f77e664e848a526f196690a03c1e8`. Vendor sources, generated `.env` and `raw/` logs are ignored. All credentials are synthetic; the database is disposable. This is not the selected product backend.

From the project root on a machine with the documented Colima/Docker prerequisites:

```sh
mkdir -p research/vendor
git clone https://github.com/STS-Rosario/carpoolear_backend.git research/vendor/carpoolear_backend
git -C research/vendor/carpoolear_backend checkout --detach 6ba3d8913a8f77e664e848a526f196690a03c1e8
colima start --profile mobility
sh research/experiments/carpoolear/run-smoke.sh
```

For an existing checkout, verify its revision before running; do not overwrite unrelated changes. The helper defaults to Docker context `colima-mobility` (override with `MOBILITY_DOCKER_CONTEXT`), generates an ignored synthetic `.env` when absent, and rejects non-testing or non-synthetic provider/routing values without printing them. It mounts the env read-only at `/var/www/.env`. It installs locked Composer dependencies and uses the tracked JPEG-capable Dockerfile in this experiment directory. Build prerequisites and Composer download require outbound network access; app, migrations and MySQL use a separate internal network. The isolated harness publishes no host ports. Health is checked inside the app container over HTTP and includes database status. The earlier baseline used a loopback host port; that configuration predates enforced isolation.

Every invocation gets a unique Docker project and disposable database volume and refuses to reuse an existing volume. The volume name is exported as `MOBILITY_SMOKE_DB_VOLUME`; never change it to point at a persistent service database. A trap removes this experiment's containers, network and volume on success, failure or an ordinary interrupt. Force-killing the process or shutting down Docker can bypass traps; inspect the run-specific project and volume before manual cleanup. The helper waits for health with bounded requests, runs the full suite and returns its exit status.

PHP, Composer and MySQL image references are digest-pinned from the working local baseline. Composer dependencies follow the upstream lockfile. Debian package installation still depends on the configured package repository, so this is not a byte-identical hermetic build. Refresh image/package security deliberately and rerun verification. Historical results are not a substitute for dated current evidence from the focused integrated suite.


## Actual HTTP workflow and invariant probe

```sh
sh research/experiments/carpoolear/run-smoke.sh journey
```

Run from the project root. This overlay configures four PHP development-server workers (`--no-reload`), raises the synthetic test actor's trip-creation limit to100, and explicitly enables the supplied route cache. A generated synthetic catalog row and cached routing/pricing response avoid external providers. Registration, activation, login, vehicle creation, discovery, requests, accepts and cancels go through real HTTP and MySQL. Activation tokens are read from synthetic local accounts; email delivery is not tested. No service mock replaces booking logic.

The probe tests registration trust flags, cancellation authority, twelve competing last-seat accepts and eight duplicate-request races. Report: ignored `raw/journey-latest.json`. A failed invariant returns exit1 while teardown still runs; this is evaluation evidence, not a green backend. The pristine pinned source is expected to fail the reproduced checks. Passing sampled races would not establish universal concurrency safety. Full trip completion, recurrence instances, segment capacity, provider money and operator accounting require separate implementation/verification.

It also runs six automatic-acceptance races: one guest must become accepted and the other must remain pending, with both durable request results returned successfully. Duplicate checks count pending, accepted and waiting-payment rows.

## Current guarded Mobility HTTP suite

```sh
MOBILITY_DOCKER_CONTEXT=your-docker-context sh research/experiments/carpoolear/run-smoke.sh mobility
```

This mode prepares the pinned integration checkout and runs `tests/Feature/Mobility`, including commute-product and waitlist HTTP integration tests, with the cohort guard enabled. The runner creates `testing` and `testing_backup` only inside its uniquely named disposable MySQL project, then passes those database names to Artisan. It does not run the legacy `/api/trips` journey probe, which is rejected by the current trusted-route boundary. The suite's database-name safety assertion verifies Laravel is using a `testing*` database before refreshing it.

## Supported commute HTTP smoke

```sh
sh research/experiments/carpoolear/run-smoke.sh commute
```

This starts the cohort-guarded disposable app and a private synthetic OSRM-shaped routing fixture. A separate PHP CLI process obtains rider and driver demo sessions through HTTP, saves profiles, publishes an offer, discovers it with a quote token, requests the seat, accepts it, and cancels it. The probe checks persisted booking transitions and approved demo memberships. Routing metrics are invented and labeled synthetic; no external route service, real identity, real money, or production backend is involved. The business services and cohort guard remain enabled.

## Synthetic sampled commute acceptance race

```sh
MOBILITY_DOCKER_CONTEXT=your-docker-context sh research/experiments/carpoolear/run-smoke.sh race
```

This disposable-MySQL sample creates one one-seat offer and two pending bookings through the supported commute HTTP API, using distinct synthetic rider actors. It verifies the persisted passenger rows belong to those riders and the same trip, then launches both authenticated accept requests together on separate HTTP connections. A test-only MySQL trigger records and holds the first passenger-state update for one second inside its transaction; the probe requires exactly one trigger firing and at least 0.9 seconds of elapsed sample time before checking one accepted response, one `NOT_SEAT_AVAILABLE` response, and durable states `[1, 0]`. The trigger and observation table are dropped on the success path; any failed run tears down its uniquely named disposable database project. The timing and response are consistent with contention but do not independently prove exact request overlap. This is one synthetic sample, not evidence for every concurrency schedule or production routing environment.

## Candidate hardening, kept separate from pristine source

After the initial clone and dependency setup, prepare this evaluation checkout once from the project root:

```sh
git -C research/vendor/carpoolear_backend worktree add --detach ../carpoolear_hardened 6ba3d8913a8f77e664e848a526f196690a03c1e8
git -C research/vendor/carpoolear_hardened apply --check "$PWD/research/experiments/carpoolear/patches/critical-invariants.patch"
git -C research/vendor/carpoolear_hardened apply "$PWD/research/experiments/carpoolear/patches/critical-invariants.patch"
sh research/experiments/carpoolear/run-smoke.sh hardened
```

An existing hardened checkout must be inspected instead of overwritten. The helper verifies the pinned base and that the patch can be reversed, records its SHA256, runs the same HTTP probe against the patched worktree, then runs focused authentication, social-authentication, passenger/repository and new invariant regressions. Composer dependencies are shared read-only from the pristine checkout; no second dependency installation is needed. Both runs use synthetic data and remove the disposable database afterward.

Earlier local candidate results are historical evaluation context only; rerun the disposable suite before relying on them. The optional `WAITING_PAYMENT -> pay` path is outside the fix. No complete backend adoption, provider money flow or public readiness is claimed.

Upstream: [STS-Rosario/carpoolear_backend](https://github.com/STS-Rosario/carpoolear_backend/tree/6ba3d8913a8f77e664e848a526f196690a03c1e8), whose pinned `LICENSE` is GNU GPL version3. Preserve upstream attribution and assess release obligations before adoption/distribution. A private development repository does not assign a new license to upstream code.

Lifecycle/financial tests explicitly select the upstream PHPUnit array cache/mail/session stores. The HTTP server keeps its file cache for cross-worker behavior. This prevents container application environment from overriding the non-forced PHPUnit defaults and retaining test rate-limit state across repeated runs. A repeated pre-fix run failed ApiAuthTest::test_reset_password; inherited file-cache interference is the suspected cause. It is retained in ignored raw/financial-final-run.log rather than reported as a clean run.
