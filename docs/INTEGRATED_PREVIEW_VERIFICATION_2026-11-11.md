# Integrated preview verification — 11 November 2026

## Release

Primary runtime is InstaBox3 `/workspace/campuspool`, reached through
https://campuspool-preview.arjunsrikanth17.workers.dev/. Ola remains separate.
The server's `.local/one-box/deployed-source-commit.txt` identifies deployed
source; source comparison records tracked-file hashes. The production build
includes PES Academy import, weekly grid/manual editing, inline student
profile completion, avatar settings, direct Google addresses, private booking
updates/read and planned-offer withdrawal. Original timetable importer derives
from PR96; this combined release is reviewed through PR95.

## Automated and provider evidence

- Combined frontend143 Vitest tests /19 files,8 parser/client tests,
  contract/maps checks and TypeScript passed.
- Production Next.js build on InstaBox3 passed and includes the dynamic
  `/api/pes-timetable` route. Initial staged build failed because its dependency
  symlink was outside the Turbopack root; mounting dependencies inside the stage
  resolved it before activation. Existing build and backend sources retained.
- Disposable backend2tests/87assertions passed with mocked routing and with
  actual configured OSRM. Covered approved owned vehicles, signed discovery,
  request/accept/reject/cancel, seat restoration, privacy, chat/read, simulated
  location sessions, outsider denial, terminal restrictions, notification read
  ownership, and owner-only ride withdrawal after vehicle approval revocation.
- Test data used `testing_address_audit` and `testing_address_browser`; no
  production student data or vehicle approvals were changed by these checks.
- PES Academy login page from InstaBox3 returned200 with expected login and
  CSRF fields. Parser/client tests cover bounded streams, login/redirects,
  malformed timetable data and errors. Hosted route tests cover origin,
  authentication, oversized input and non-object JSON. Imports require explicit
  review/overlap selection and save before replacing account timetable data.
- Independent review found a primitive-JSON cleanup error; it was fixed and
  regression-tested. No remaining high-severity blocker found in reviewed code.
- Local reconstruction verification was interrupted by GitHub transport EOF;
  fresh GitHub reconstruction checks passed for integrated code58e9ffa.

## Browser acceptance

Chrome passed the complete two-account journey using the actual deployed
frontend and real Google Places, with API requests privately bridged to the
disposable backend on InstaBox3 port18084: driver publication, rider search and
request, driver acceptance, cross-account message readback, start, pickup,
dropoff and completion visible to both participants.86 API requests recorded
no5xx response. Initial attempts exposed test timing and temporary network
bridge failures; waiting for enabled chat and retrying the bridge resolved them.

Timetable navigation, manual class save/reload,390px layout without page overflow,
and the hosted import route authentication/origin boundary passed. This is
isolated integration evidence; it does not insert synthetic bookings in the real
presentation database or constitute a real two-person production journey.

## Remaining acceptance boundaries

Fresh real-account PES credential import has not been tested in this release.
The login-page check and mocked parser tests do not prove the returned timetable
matches a student's actual classes. Physical-device GPS is unverified; location
API checks used simulated coordinates. Timetable import is on demand and does
not drive matching or book rides. No payment is processed; contributions are
estimates. Address publication supports one rider party and requires reviewed
vehicle onboarding. Import throttling is per process. Host lifecycle/runtime
limits and the mailbox quota/credential expiry still apply. No load test,
full host recovery or off-box backup restore is claimed.
