# Phase 1 — Simular real-Google browser journey (9 November 2026)

## Result

**PASS — real Chrome + Google Maps/Places + running Laravel/OSRM backend.** The full synthetic campus-commute journey completed in a Google Chrome browser on Simular Box 1. This is **not** a purely mocked frontend interaction test.

The browser used:
- A separate Git clone of the draft PR #90 branch at commit `5dbaa06`, under `/workspace/phase1-browser-e2e-pr90`.
- A production-mode Next.js server (`next build` and `next start`, port 3016).
- Two independently isolated Chrome browser contexts, one for a driver and one for a rider.
- Real `maps.googleapis.com` JavaScript, Google Places autocomplete and place field resolution, and Google's driving route preview.
- The already-running Simular Laravel demo backend and native road-router service at `127.0.0.1:18082`. **Important:** this browser run did not rebuild the backend from the PR checkout or create a new database. Backend implementation tests are separately covered by GitHub CI; do not conflate these environments.
- Simular's existing outbound HTTP proxy (`127.0.0.1:3128`) for public Google assets, bypassing the proxy for `127.0.0.1` traffic. Direct Chrome networking failed DNS resolution, but proxy routing resolved the issue. This is a test environment constraint, not proof of an invalid Google key.
- A user-supplied browser key in an **ignored, mode-0600 local configuration file**. The browser test supplied that key through the local configuration endpoint interception only; it did **not** stub Maps, autocomplete, place prediction, geocoding, or routing responses. **No key or access token is included in this document or tracked in Git.**

## Verified journey

| Step | Outcome |
|---|---|
| Load production Next frontend in real Chrome | PASS |
| Register driver and rider accounts in separate browser contexts | PASS |
| Real Google Places suggestions and address selection for Cubbon Park and Indiranagar | PASS on both accounts |
| Google route preview | PASS: approximately 7.7 km / 27 minutes |
| Driver publishes 11 Nov 2026, 10:00 IST ride | PASS, synthetic trip #32 |
| Rider searches road-compatible offers | PASS: backend HTTP 200, matching trip visible |
| Rider requests one seat | PASS |
| Driver accepts; sign-in again to confirm server persistence | PASS: both views `Accepted`, no remaining seats |
| Rider adds ₹500 synthetic wallet balance | PASS |
| Rider holds ₹70.52 synthetic fare | PASS; available balance ₹429.48 |
| Driver and rider exchange messages in both directions | PASS |
| Driver starts the trip | PASS |
| Driver marks rider picked up and dropped off | PASS |
| Driver completes ride | PASS |
| Rider confirms arrival | PASS |

**Expected limitation:** demo credits remain held until the server-enforced release interval. No receipt/release was claimed. Browser verification did not test physical-device GPS sharing, real money or identity verification, a production deployment, or a *separately rebuilt PR backend*.

## Observations and follow-ups

1. The initial acceptance success notice could briefly coexist with a stale `Awaiting driver` card immediately after clicking. A fresh sign-in showed the authoritative `Accepted` state on both accounts; review refresh timing as a possible minor UX improvement.
2. An earlier run using **synthetic Google Places substitutes** and arbitrary coordinates failed the rider search with a generic server error. This real-provider run with matched real locations succeeded (HTTP 200). Do not treat the earlier synthetic-data failure as resolved by a code change or assume it cannot recur for other route geometry; investigate unexpected backend 5xx separately.
3. Simular Chrome needed the existing outbound proxy to reach Google, although `curl` already used that proxy. For a real-browser test, verify the browser's own network path instead of concluding that the Google key is invalid.
4. The private key should be constrained in Google Cloud Console to the intended allowed referrers and required Maps/Places APIs. Do not commit it or screenshots containing privileged account data.
5. Full browser lifecycle passed against the **existing** Simular backend, not a newly initialized database. An independent clean-clone service startup and backend integration CI are documented in adjacent evidence files.

## Evidence artifacts on Simular Box 1

- `/tmp/pr90-real-google-smoke.png`
- `/tmp/pr90-real-driver-ride-completed.png`
- `/tmp/pr90-real-rider-arrived.png`

Screenshots contain synthetic test data; they are not committed to the repository. Browser automation was executed with Playwright and system Chrome. Browser configuration requests were supplied locally, with no fake Google Places or map routes.

**Merge status:** This document is evidence for draft PR #90, not authorization to merge. No remote branch pruning or `main` changes were performed.
