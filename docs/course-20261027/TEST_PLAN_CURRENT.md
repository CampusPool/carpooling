# MobilityPlatform test plan draft

This draft describes repeatable checks for the migrated repository. Replace `Pending` entries with dated, reviewable evidence before submission.

## Automated checks

- `cd frontend-next && npm ci && npm test && npm run typecheck && npm run build` — client contract, interaction, map-loader and build checks.
- `cd services/activity-projection && npm ci && npm test` — projection redaction, idempotency and aggregation checks.
- `sh research/experiments/carpoolear/verify-reconstruction.sh` — clean upstream checkout and complete patch-stack reconstruction. This does not start the application or mutate a database.
- `sh research/experiments/carpoolear/run-smoke.sh lifecycle` — disposable backend checks after the pinned upstream checkout has been prepared. Do not use a persistent pilot database.

## Manual/course checks

| Check | Expected result | Status |
| --- | --- | --- |
| Rider searches and reviews a quoted offer | Terms and capacity are visible before request | Pending current capture |
| Rider requests; host accepts or rejects | Status changes are visible to the participant | Pending independent review |
| Competing final-seat requests | At most one acceptance commits; loser receives a recoverable error | Automated coverage exists; course evidence pending |
| Cancellation and restored capacity | History is retained and capacity is restored according to policy | Partial |
| SQL plus second-database evidence | Actual commands and outputs are attached | Pending final walkthrough |
| Sprint demonstration video | Continuous working-product video is uploaded | Pending |

Synthetic accounts, credits, routes and provider fixtures must be labelled as synthetic. This plan does not claim real payments, email delivery, GPS behavior or deployment.
