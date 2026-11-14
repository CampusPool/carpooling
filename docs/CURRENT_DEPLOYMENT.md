# Integrated student preview

The presentation URL is https://campuspool-preview.arjunsrikanth17.workers.dev/.
Cloudflare Worker is the tester gate and HTTPS proxy. The application runs on
InstaBox 3 in `/workspace/campuspool`: Next.js frontend3013, Laravel18083,
MySQL3306, MongoDB27017, activity projection8090. These listeners are private.
Car/bike/walking OSRM routers run on this same host. Google Maps and Places
are external browser APIs. Real OTP email uses the external Nylas mailbox;
Mailpit remains available for local capture and is not proof of delivery.
The Mac does not need to relay the hosted application.

## One user workflow

Email OTP authenticates a new browser. A remembered browser can restore its
session. Missing name/contact details are completed inline, then the user
opens Rides. Profile and settings are in the corner avatar. Rides supports
Google-selected pickup/destination addresses, search, approved-owned-vehicle
publication, booking requests, accept/decline/cancel before departure,
accepted-trip chat, opt-in location sharing, and ride lifecycle actions.
Updates shows durable private booking events. One rider party is supported
per address publication. Contributions are estimates; no payment is taken.
Driver publication requires reviewed vehicle onboarding.

The timetable integration is an on-demand PES Academy import, review, and
save into the current app account, alongside manual weekly editing. This is
not university SSO, scheduled synchronization, or timetable-driven ride
matching. Academy credentials are transient and never saved by the app.
The university endpoint is undocumented; errors and unresolved overlapping
classes must be shown rather than inferred. See PES_TIMETABLE_PILOT.md for
the exact importer boundary and validation.

## Separate preserved environments

Ola Maps remains on its separate branch/staging environment (PR92, Simular2).
Simular1 teacher demo and the PES timetable pilot are references, with separate
checkouts and databases. Simular3 is an older local-mail-capture login stage.
The Mac presentation frontend on3025 is also a separate older demo. None of
these is a live replica of the integrated student preview. They must not be
used as evidence that a feature is deployed to the preview.

## Release evidence

Record the exact release commit, frontend/backend checks, real routing probes,
browser workflow checks, and remaining live account acceptance in the release
verification document. A running service or passing mocked test is not a
complete multi-user workflow. Physical GPS and fresh real PES credential import
require explicit real-browser acceptance and must be reported separately.

Codex assisted with implementation, integration, verification and documentation.
The Academy importer derives from PR96 / commit2962058; its existing contribution
is preserved and credited rather than represented as a new independent design.
