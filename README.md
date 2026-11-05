# CampusPool MobilityPlatform

This repository is the team submission surface for the MobilityPlatform implementation. The previous CampusPool scaffold is retained in Git history; the current branch contains the reviewed migration tree.

The product is a Laravel/MySQL mobility backend extension with a Next.js client, an activity projection service and an Android tracking prototype. It supports synthetic scheduled and on-demand demonstration flows. Real email delivery, provider payments, production deployment, physical GPS acceptance and course approval are not claimed.

## Repository layout

- `backend/` — original MobilityPlatform Laravel extension and integration patches.
- `frontend-next/` — Next.js client for the existing MobilityPlatform API.
- `services/activity-projection/` — SQL-to-Mongo activity projection service and disposable tests.
- `scripts/` — isolated local verification and demonstration helpers.
- `research/experiments/` — sanitized, disposable integration harnesses and pinned dependency metadata.
- `docs/` — product contracts, evidence limits and course-facing documentation.
- `android/` — optional tracking client prototype.

## Run the local carpool app

Follow [RUN_LOCAL_CORE.md](RUN_LOCAL_CORE.md) for Google Places/map setup,
local road routing and separate username/password rider and driver accounts.
The core flow covers publication, search, requests, decisions, notifications,
chat and trip completion. Full identity/OTP, payments, real vehicle
registration and live GPS acceptance remain Sprint 3.

## Backend dependency

The Laravel application that hosts `backend/extensions/carpoolear` is an external pinned dependency. Follow `research/experiments/carpoolear/README.md` to fetch the exact upstream revision into an ignored local checkout. The upstream project is GPLv3; preserve its license and attribution if the source is included in a future release. Do not use a preserved pilot database for tests.

## Client checks

```sh
cd frontend-next
npm ci
npm test
npm run typecheck
npm run build
```

The local core runner configures `MOBILITY_API_ORIGIN` for its dedicated testing
database. Local driver accounts use synthetic vehicles. No real payment or
vehicle verification is implied.

## Status

See [core acceptance and integration evidence](docs/SPRINT1_ISSUE_39_44_EVIDENCE_2026-11-03.md)
and the linked PR checks for delivery status. `MIGRATION_STATUS.md` records the
earlier migration baseline. Local core acceptance and course approval are
separate; formal course submissions remain tracked in Sprint 3.
