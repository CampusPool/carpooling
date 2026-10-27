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

The frontend uses synthetic local identities and non-redeemable demonstration credits. Configure `MOBILITY_API_ORIGIN` only for a disposable local environment.

## Status

Read `MIGRATION_STATUS.md` before opening issue PRs. This migration is a reviewable baseline proposal; it does not by itself complete Sprint 1 or establish teacher acceptance. Issue PRs must be focused, truthful and independently reviewed.
