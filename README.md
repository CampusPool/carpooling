# CampusPool

CampusPool is a student carpooling and bikepooling project for campus travel. This repository contains the SE and DBMS planning documentation for the current private Laravel 12 / MySQL / browser prototype.

## Current baseline

- Laravel 12 backend, MySQL transactional store, HTML/CSS/JavaScript browser client, Google Maps and OSRM integrations.
- The 44 existing issues and [Project #2](https://github.com/orgs/CampusPool/projects/2) in [CampusPool/carpooling](https://github.com/CampusPool/carpooling/issues) are the backlog authority.
- Development and integration use the [private team workspace](https://github.com/CampusPool/carpooling-workspace).
- Sprint 2 includes a Next.js/React/TypeScript client, API contracts and MongoDB event/notification aggregation while retaining Laravel/MySQL authority.

## Documents

- [Requirements and architecture](docs/REQUIREMENTS_ARCHITECTURE.md)
- [Sprint plan and Sprint 1 report](docs/SPRINT_PLAN.md)
- [Prototype distribution manifest](docs/PROTOTYPE_DISTRIBUTION.md)
- [DBMS traceability](docs/DBMS_TRACEABILITY.md)
- [Deviations](docs/DEVIATIONS.md)

## Contribution

Use the official issue number in a short-lived branch and open a focused PR in the private workspace. Include the files changed, command and result, fixtures, acceptance evidence and any relevant issue link. Preserve attribution and upstream notices. Keep credentials, keys, personal data, database dumps and production configuration out of Git.

## Checks

The pull-request workflow checks required documentation and local Markdown links. It does not run application tests.
