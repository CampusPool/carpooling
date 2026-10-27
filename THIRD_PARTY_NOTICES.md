# Third-party source and provenance

## Carpoolear backend

The MobilityPlatform extension is designed to mount into the upstream `STS-Rosario/carpoolear_backend` Laravel application. The upstream source is not vendored in this repository. A clean checkout is reconstructed locally by `scripts/prepare-carpoolear.sh` at the exact revision below, and the disposable harness can then apply the complete tracked patch stack.

- Source: https://github.com/STS-Rosario/carpoolear_backend
- Pinned revision: `6ba3d8913a8f77e664e848a526f196690a03c1e8`
- License: GNU General Public License, version 3, as provided by the upstream `LICENSE` file
- Local reconstruction: `research/vendor/carpoolear_backend` (ignored)
- Hardened evaluation checkout: `research/vendor/carpoolear_hardened` (ignored)

The repository tracks original extension code under `backend/extensions/carpoolear`, integration patches under `backend/integrations/carpoolear`, and the disposable reconstruction harness under `research/experiments/carpoolear`. The patches are not a replacement for the upstream license. Preserve the upstream copyright and license notices if the upstream source is ever redistributed.

The reconstruction helper verifies the upstream commit before creating a worktree and refuses an unexpected or modified vendor checkout. It applies these patches in order: critical invariants, lifecycle, cohort, routing, recurrence, segments, dispatch, immediate dispatch, support/privacy, private endpoints, driver profile, driver reservations and private scheduled journeys. It does not contact the preserved pilot database.

## Other dependencies

Node package dependencies are declared by the checked-in lockfiles under `frontend-next/` and `services/activity-projection/`. Android build dependencies are declared by `android/`. Review each dependency's license before a public release; this notice does not grant additional rights.
