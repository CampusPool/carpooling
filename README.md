# CampusPool

CampusPool is a student carpooling and bikepooling project for campus travel. This is the official SE + DBMS project repository. The executable Laravel 12/MySQL prototype is integrated on official `main`; the shared workspace remains a development/reference checkout. Baseline merge provenance is recorded in [the provenance record](prototype/PROVENANCE.md).

## Current baseline

- Laravel 12 backend, MySQL transactional store and HTML/CSS/JavaScript browser client. The portable demo uses synthetic routing; live Maps/OSRM behavior has not been verified.
- The 44 existing issues and [Project #2](https://github.com/orgs/CampusPool/projects/2) in [CampusPool/carpooling](https://github.com/CampusPool/carpooling/issues) are the backlog authority.
- Development may use the [shared team workspace](https://github.com/CampusPool/carpooling-workspace), but accepted changes land through focused PRs in the official repository.
- Sprint 2 includes a Next.js/React/TypeScript client, API contracts and MongoDB event/notification aggregation while retaining Laravel/MySQL authority.

## Documents

- [Requirements and architecture](docs/REQUIREMENTS_ARCHITECTURE.md)
- [Sprint plan and Sprint 1 report](docs/SPRINT_PLAN.md)
- [Prototype distribution manifest](docs/PROTOTYPE_DISTRIBUTION.md)
- [DBMS traceability](docs/DBMS_TRACEABILITY.md)
- [Deviations](docs/DEVIATIONS.md)
- [Sprint 1 booking evidence](docs/SPRINT1_BOOKING_EVIDENCE.md)

## Run the synthetic prototype

The [portable demo guide](prototype/reproduction/PORTABLE_DEMO.md) covers prerequisites, isolated database initialization and startup. From the repository root:

```sh
sh prototype/reproduction/verify-package.sh
sh prototype/reproduction/start-local.sh
python3 prototype/reproduction/smoke-booking.py
sh prototype/reproduction/stop-local.sh
```

Open `http://127.0.0.1:18180/mobility/?demo=campus-route` after startup. Routes and credits are synthetic. Use a disposable clone for verification; the verifier removes only its own generated runtime and database volume.

## Contribution

Branch from official `main`, use the official issue number in a short-lived branch, and open a focused PR targeting `CampusPool/carpooling:main`. Include changed files, exact commands and results, synthetic fixtures, acceptance evidence and issue links. Request teammate review before merge. Preserve attribution and upstream notices. Keep credentials, keys, personal data, database dumps and production configuration out of Git.

## Checks

The documentation workflow (`documentation` job) checks Markdown and local links. The application workflow (`portable-campus-tests` job) runs package integrity, frontend checks, isolated MySQL application tests and the real HTTP booking concurrency probe on pull requests and pushes to `main`. A PR is ready for review only after both workflows pass.
