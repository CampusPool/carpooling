# Local core ride recording guide

This is a recording guide, not evidence that a new video exists. The real
Google Places/map, local road routing and two-account browser journey was
observed on 3 November 2026. Formal course recordings remain Sprint 3.

## Prepare

1. Follow `RUN_LOCAL_CORE.md` and start `scripts/run-local-core.sh` with the
   supplied offline crop and private Google browser configuration. Keep its
   managed project separate from preserved pilot databases.
2. Open the printed local app in two separately opened tabs. Register a local
   driver and rider using disposable usernames/passwords. Each tab keeps its
   own session; the driver uses a synthetic test vehicle.
3. Choose the same public Bengaluru pickup/destination, matching date and a
   future pickup time within 15 minutes of the driver's departure. Confirm
   that Google shows the selected places and route.
4. Begin continuous recording only after checking for credentials, account
   tokens or private location details. Describe accounts and vehicle as local
   test data; the Google preview and local OSRM road route use real providers.

## Continuous shot

| Step | Show |
|---|---|
| Plan | Driver's selected public places, Google route, date and time. |
| Publish | Driver publishes one passenger seat and sees confirmation. |
| Discover | Separate rider searches the matching places/date/time and finds it. |
| Request | Rider requests a seat; driver sees the named request and route/time. |
| Accept | Driver accepts; rider sees accepted status. |
| Chat | Both accounts send a message and receive the other's text. |
| Lifecycle | Driver starts, marks rider picked up/dropped off and completes; rider sees completed state and closed live actions. |

For a cancellation demonstration, use another future offer, accept its rider
and cancel before departure. Show cancellation and the restored available
seat. Declined/cancelled booking cards retain that decision even if the
driver proceeds with a different rider.

If a transition fails, stop and resolve it before a new recording. Do not
splice separate takes into a purported continuous journey. Review the full
clip for legibility before saving it under `docs/course-20261027/media/` and
recording its date, source revision and tested scenario. Keep existing video
descriptions unchanged until an actual replacement is recorded/reviewed.

## Legacy canonical API fixture

`sh research/experiments/carpoolear/run-demo-local.sh canonical` is a separate
synthetic API smoke helper: it seeds test actors/catalog, publishes, matches,
accepts and cancels through HTTP. Its seeded actors are not username accounts
and cannot sign in through the current browser landing page. Use the local
core runner above for browser demonstrations. The fixture helper owns and
tears down only its disposable database on exit.

## Evidence boundary

No new video is claimed by this guide. Full identity/OTP, payments, real
vehicle registration and physical live GPS are deferred to Sprint 3. Ctrl-C
stops the local core UI while preserving its managed database. Stop only the
services belonging to that project; never reset the preserved pilot.
