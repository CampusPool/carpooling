# Contributing to CampusPool

This is a multi-person SE + DBMS course project with AI-assisted contributions and a third-party Laravel host. The goal is a **reviewable, reproducible** repository—not a large number of PRs.

## Before coding

1. Read [Feature status](docs/FEATURE_STATUS.md) and [Architecture](docs/ARCHITECTURE.md) so you don't implement a second version of an existing API or UI.
2. Create a narrowly scoped branch from **current `main`**, e.g. `feature/manual-timetable-ui`, not from an older migration branch. Keep current uncommitted teammate work intact.
3. Record the relevant issue, owner, behavior change and test plan. Keep realistic boundaries: a backend implementation is not automatically a demonstrated UI feature.
4. Do not commit API keys, passwords, private data, OSM source files, `.local/`, Docker volumes, vendor checkouts, `node_modules/`, build output, or unredacted screenshots.

## Review and quality gates

- Write or update **focused tests** for the changed behavior. Frontend: `cd frontend-next && npm ci && npm test && npm run typecheck && npm run build`.
- Backend: run `sh research/experiments/carpoolear/verify-reconstruction.sh` and the relevant disposable integration suite. Database migrations and routing require isolated Docker/database volumes; never reset someone else's demo database.
- Keep one PR focused on one behavior or cohesive maintenance task. Provide what changed, what passed, what remains unverified, and who performed the review. A green CI badge is not proof that a real browser/provider integration was exercised.
- **Do not merge without teammate review/explicit approval.** GitHub review submissions are useful for accountable PR history. Avoid force-pushing `main` or deleting historical PR branches as part of a feature change.
- If AI helped generate, modify or review code, disclose the assistance and verify both source attribution and your own understanding of the code in the PR. Include human review where available; automated reviewers do not replace accountable student contributions.

## Keep the project understandable

- Prefer adding cohesive components/services with clear ownership rather than extending the large `frontend-next/app/page.tsx` further. Keep the `LiveCarpool` (synthetic demo) and `CanonicalPool` (approved account) boundaries until there is a tested migration plan.
- Do not add another database, routing server, mapping SDK or provider without showing which project requirement it fulfills and its cost/portability impact.
- For routing changes, verify browser address selection, backend road matching, walking/detour constraints, booking and fare consistency. Keep the working provider as fallback until the new one has comparable end-to-end coverage.
- Link any delivered UI and backend work to [Feature status](docs/FEATURE_STATUS.md). Update evidence with the date and commit SHA; do not mark broad Sprint 3 initiatives fully complete based only on backend unit tests.

## Branch cleanup (never automatic)

Run `bash scripts/audit-branches.sh` after fetching all remote refs and reviewing the GitHub PR state. A branch whose tip is contained in `main` is a **candidate**, not permission to delete: check whether it is still used by a teammate, workflow, release or deployment. Divergent branches need individual diff/ownership review and a recovery SHA. See [Branch maintenance](docs/engineering/BRANCH_MAINTENANCE_20261110.md).

## Licensing and external data

The upstream Carpoolear Laravel code is pinned and GPLv3. See [third-party provenance](THIRD_PARTY_NOTICES.md). The team has **not** declared a root license for all original material; decide this explicitly with the actual copyright holders before redistribution. The Bengaluru OSM crop has separate ODbL obligations and is intentionally not in Git. Never add a private third-party API key to a public issue or PR.
