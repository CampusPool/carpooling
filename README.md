# CampusPool

Campus carpooling and bikepooling project for PES University Software Engineering + DBMS coursework.

**This is the official code and submission repository.** The working Laravel/MySQL prototype is in [`prototype/`](prototype/). The earlier [carpooling-workspace](https://github.com/CampusPool/carpooling-workspace) is a historical development/reference copy; **do not clone it for new Sprint contributions or submit PRs there**.

## What works

The browser-based **synthetic** demonstration covers driver offer publication, rider search, seat request, driver acceptance and cancellation. It runs with test identities and a disposable local database. Live traffic, real payments and student identity verification are not verified production functionality.

The imported foundation includes third-party Carpoolear code; see [provenance](prototype/PROVENANCE.md), [licenses](prototype/LICENSES.md) and the [source map](prototype/SOURCE_MAP.tsv). Imported code is not evidence of four separate student implementations.

## Run the prototype

Requires Git, Docker + Compose, Python 3 and Node.js. First startup downloads containers/dependencies.

```sh
git clone https://github.com/CampusPool/carpooling.git
cd carpooling/prototype
sh reproduction/start-local.sh
# Open http://127.0.0.1:18180/mobility/?demo=campus-route
python3 reproduction/smoke-booking.py
sh reproduction/stop-local.sh
```

Use separate browser sessions for driver and rider when interacting manually. The `18080` URL used in older screenshots is a **different developer-local pilot**, not the fresh-clone service. Neither service collects real payments during this demo.

## Contribute to this repository

1. Read [the team workflow](docs/TEAM_WORKFLOW.md), your assigned [official issue](https://github.com/CampusPool/carpooling/issues) and the [Sprint plan](docs/SPRINT_PLAN.md).
2. Create your own feature branch from the latest **official `main`**. Do not push directly to `main`; do not re-import the prototype.
3. Implement and test your actual contribution, retaining third-party attribution. If inventoried prototype files change, reconcile `SOURCE_MAP.tsv`, regenerate `MANIFEST.sha256` and run `python3 scripts/check-package.py` from `prototype/`.
4. Push the feature branch to this repository and open a short PR **targeting `CampusPool/carpooling:main`**, with the issue number and commands/results. Obtain review and passing CI before merging.

## Testing and documentation

- Automated application checks: [GitHub Actions](https://github.com/CampusPool/carpooling/actions). The application workflow runs package verification plus fresh-clone synthetic booking checks.
- Frontend tests: from `prototype/`, run `node --test tests/frontend/test-commute-ui.mjs tests/frontend/test-commute-map.mjs tests/frontend/test-place-search.mjs`.
- Isolated full verifier: from a **fresh clone**, run `cd prototype && sh reproduction/verify-package.sh` (requires Docker; it uses an isolated disposable test database).
- [Sprint plan](docs/SPRINT_PLAN.md) · [requirements and architecture](docs/REQUIREMENTS_ARCHITECTURE.md) · [DBMS traceability](docs/DBMS_TRACEABILITY.md) · [deviations](docs/DEVIATIONS.md) · [distribution notes](docs/PROTOTYPE_DISTRIBUTION.md).

**Repository status is established by actual commits, PR diffs and CI—not by an issue being closed or a claim in a README.**
