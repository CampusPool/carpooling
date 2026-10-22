# CampusPool

CampusPool is a student-only carpooling and bikepooling project for shared campus commuting. This repository is the official planning and documentation surface for the SE + DBMS submission. The current Sprint 1 baseline is an existing Laravel 12 / MySQL / HTML-CSS-JavaScript prototype; this repository does not claim that a production application is deployed.

## Current baseline

- Existing prototype: Laravel 12 backend, MySQL authority, browser UI, Google Maps and OSRM integrations.
- Official issue tracker: [CampusPool/carpooling](https://github.com/CampusPool/carpooling/issues) (44 existing issues: 7 epics, 28 stories, 9 NFR/enablers). Issues and [Project #2](https://github.com/orgs/CampusPool/projects/2) are authoritative; no duplicate backlog is kept here.
- Staging: [private team workspace](https://github.com/CampusPool/carpooling-workspace). Prototype source remains private until the owner authorizes an attributed upload.
- Proposed Sprint 2 direction: preserve the Laravel/MySQL foundation while adding a Next.js/React/TypeScript client, explicit API contracts, MongoDB event/notification aggregation, and required DBMS demonstrations.

## Documents

- [Requirements and architecture](docs/REQUIREMENTS_ARCHITECTURE.md)
- [Sprint plan and Sprint 1 report](docs/SPRINT_PLAN.md)
- [Prototype distribution manifest](docs/PROTOTYPE_DISTRIBUTION.md)
- [DBMS traceability](docs/DBMS_TRACEABILITY.md)
- [Deviations](docs/DEVIATIONS.md)

## Contribution workflow

Use the existing issue number in a short-lived feature branch, open a focused PR in the private staging repository, and obtain an independent review before integration. Keep original prototype attribution and do not claim prior work as a teammate contribution. Link staging PRs back to the official issue; merge into the official submission only through a separately reviewed integration PR.

Do not commit credentials, private keys, real student addresses, personal identifiers, database dumps or production environment files. Use synthetic fixtures and an isolated test database.

## Checks

The pull-request workflow validates required documentation, local links only. It intentionally does not report application tests until application source and an approved test command are present in this repository.
