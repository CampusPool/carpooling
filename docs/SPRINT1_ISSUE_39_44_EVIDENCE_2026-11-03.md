# Core Sprint 1/2 evidence and handoff

Scope revised 3 November 2026: Google place/time selection, road route, separate local rider/driver accounts, publish/find/request/accept/reject/cancel, named notifications, chat and ride start/pickup/drop-off/completion. Live GPS, full identity/OTP, payments and real vehicle registration are Sprint 3.

## Observed integrated acceptance

Two independent local username accounts completed browser ride #4 from Cubbon Park to Indiranagar. Real Google Places suggestions and Google map route preview (7.7 km/about 27 minutes) were observed. The matching backend used pinned local OSRM road graphs, not fixture routes. The rider found/requested the driver's offer; the driver received name, route and time and accepted; both saw acceptance. Chat messages arrived in both directions. Start, pickup, drop-off and completion persisted and removed live actions at terminal state. Native date/time editing and independent tab-session restoration were checked.

Automated final app snapshot: 70 frontend tests, typecheck/build; 401 backend tests, two skipped, 3621 assertions. Isolated private Actions run: https://github.com/arjunsrikanthh/mobility-isolated-ci-20261103/actions/runs/41604833672 . The teammate handoff has additional per-stage runs listed in its CI evidence; those include portable startup and workflow source additions.

## Delivery state

The five handoff packages have one source owner each; shared issues refer to
the same atomic contribution instead of duplicating files. Packages01–04 are
merged through [PR83](https://github.com/CampusPool/carpooling/pull/83),
[PR84](https://github.com/CampusPool/carpooling/pull/84),
[PR86](https://github.com/CampusPool/carpooling/pull/86) and
[PR87](https://github.com/CampusPool/carpooling/pull/87). This setup/CI/evidence
contribution is package05, tracked by #39 and #44. The original dirty local
checkout and its databases are preserved. Original teammate commits and
explicitly attributed AI follow-up changes remain visible in Git history.

PR87 includes a follow-up preserving declined/cancelled booking labels when
the shared trip proceeds with another rider. Its destination run
[41949817854](https://github.com/CampusPool/carpooling/actions/runs/41949817854)
passed frontend74tests, typecheck/build, projection and reconstruction. The
subsequent main run
[41957841648](https://github.com/CampusPool/carpooling/actions/runs/41957841648)
also passed. Original snapshot counts above are historical evidence; use the
package05 PR and main checks for the final integrated source results.

The PR workflow now includes frontend tests/typecheck/build, activity-projection tests, pinned reconstruction and the full disposable backend suite. Tests use explicit fixtures and do not establish physical GPS or live-provider behavior. No credentials are required in CI.

## Deferred acceptance

Browser location provider was unavailable. A simulated public-landmark sample traversed the authenticated tracking API/database and appeared on the accepted rider's Google map; this is not physical GPS evidence. GPS is tracked under #82. Historical course videos, instructor approvals and submissions are distinct Sprint 3 follow-up obligations, not silently certified by this report. See #44 historical scope.

## Reproduce

Use `RUN_LOCAL_CORE.md` and supplied handoff offline crop for real-road local setup; use the supplied `verify.sh` for PR checks. The portable bootstrap was run from a clean source archive in a separate Docker VM with a fresh database and fresh Composer dependency volume. Frontend/maps configuration returned HTTP200; driver/rider registration, real-road coordinate publication/search, named request notification and acceptance passed. Road graphs were reused after hash verification, rather than rebuilt during this check. See the handoff fresh-runtime-result.json for the exact validation boundary. Browser keys and runtime databases must stay outside Git.
