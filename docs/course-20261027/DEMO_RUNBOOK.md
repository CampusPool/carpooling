# MobilityPlatform demonstration runbook

Use a fresh disposable backend environment prepared from the pinned upstream checkout. Never reset, seed or migrate a preserved pilot database for course evidence.

1. Record the commit and environment used. Keep credentials and tokens out of captures.
2. Reconstruct and test the disposable backend from the repository root:
   `sh research/experiments/carpoolear/verify-reconstruction.sh` followed by `sh scripts/prepare-carpoolear.sh` and `sh research/experiments/carpoolear/run-smoke.sh lifecycle`.
3. For a browser-capable disposable stack, run `sh research/experiments/carpoolear/run-demo-local.sh`. Docker assigns a free loopback port; the script prints it, creates a unique Compose project and volume, and tears down its own containers/volume on exit. It never uses port 18080 or a preserved pilot.
4. In a second terminal, start the Next.js client with the printed `MOBILITY_API_ORIGIN`, then show the driver vehicle/onboarding review state and a dated synthetic offer.
5. Show rider search, route/terms review, explicit consent, request and host acceptance/rejection.
6. Show cancellation, history and capacity state. If waitlist, ratings, chat or operator controls are exercised, record them as separate partial scenarios.
7. Capture sanitized screenshots/video only after checking that no tokens, credentials, personal records or precise private locations are visible.

The demonstration uses synthetic identities and non-redeemable credits. It does not prove live maps, physical GPS, real payment settlement, email delivery or production readiness. The one-minute Sprint 1 video and instructor approvals remain submission gates.
