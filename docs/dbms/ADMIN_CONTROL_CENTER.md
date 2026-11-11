# CampusPool DBMS administration control center

**URL:** `/admin` on the same Next.js origin as the student-facing site.

## What is connected

- Authenticates with a password-only `POST /api/mobility/operator/login` against the server-side `MOBILITY_OPERATOR_PASSWORD_HASH` and configured privileged `MOBILITY_OPERATOR_USER_ID`; also requires a successful role-guarded `mobility/operator/dashboard` response. The frontend stores the token in memory only; no demo password, token or database connection string is embedded.
- Operations overview: `/api/mobility/operator/dashboard`, `/api/mobility/operator/analytics?days=7|14|31`; the real MySQL view/procedure/function/trigger reports and optional MongoDB projection provide data.
- Membership review: `operator/memberships` and its version-checked decision endpoint. A written review reason is compulsory.
- Driver/vehicle review: `operator/driver-onboarding` and its version-checked review endpoint. The Laravel checklist and vehicle validation remain authoritative.
- Host registry: `operator/host-applications`. Modern approvals are managed through driver onboarding; a legacy host decision is not exposed in this UI because it can be blocked by the current onboarding model.
- Ride capacity and booking decision audit: `operator/analytics`, with authorized `operator/trips/{id}` detail requests.
- Support reports: `operator/dashboard`, with authorized ticket details, assign-me and resolve endpoints.
- Cash exceptions: the existing **read-only** `operator/cash-disputes` endpoint; no settlement/payment action is offered.
- DBMS lab: new read-only `operator/dbms/health` endpoint reports an allow-listed set of SQL tables and installed SQL objects. Counts for platform-wide tables are intentionally hidden, and college-scoped counts are filtered by the configured college. It cannot run SQL supplied by a browser.

## Security boundaries

The Laravel API enforces authorization on every request; hiding the UI is **not** an access control. The new metadata API rejects non-admin, inactive and banned users and requires a configured college. Direct student requests return 403. It never returns table rows, secrets, arbitrary SQL, personal data, or internal configuration. All state-changing operations remain inside the original backend transaction/audit/version controls.

## Limitations

Administrator access must be provisioned per deployment with a strong unique password hash and active privileged account; no general administrator account creation, real vehicle verification, live settlement, database query console, or institution-authorized timetable import is claimed. The dashboard shows a bounded first page of each list, with a warning if more records exist. Data-source failures do not silently display fabricated zeros. It is a teacher-demo and administration UI; its backend depends on the normal pinned Laravel host and optional MongoDB projection being configured and running.

To test: `cd frontend-next && npm ci && npm run typecheck && npm test && npm run build`. Backend requires reconstruction and the separate disposable integration test environment described in the repository runbooks. Do not run migrations or destructive tests against preserved pilot databases.

## Private InstaBox 3 preview deployment — 11 November 2026

The `/admin` Next.js route and two staff-only Laravel controllers were overlaid onto the existing `/workspace/campuspool` source without replacing the newer student UI, ride, timetable, or email changes. The original operator routes and identity boundary were backed up in `.local/admin-overlay-backup-20261111081738/` alongside the previous Next.js build. MySQL/MongoDB volumes were not recreated or reset. An isolated, active administrator account was provisioned for this private preview only.

Password-only admin sign-in uses `POST /api/mobility/operator/login`. Its high-entropy password is in the InstaBox 3 owner-only file `/workspace/campuspool/.local/one-box/admin-access-password.txt`. Its **bcrypt hash**, not the password, is in `.local/one-box/private.env`; the configured account ID is there too. Do **not** print passwords in CI, share the password file publicly, or commit these private files. To rotate, generate a fresh password + hash on the box, update the protected environment, and recreate **only** the backend container. Existing JWTs must be revoked for full rotation.

The pre-existing Cloudflare Worker tester gate remains in place. On an anonymous browser the public `/admin` URL redirects to `/_tester`; after preview tester authentication, the browser reaches the password-only admin screen. Do not claim public one-password access until the Cloudflare route policy is updated and independently security-tested.

Private-origin smoke runner: `python3 /tmp/campuspool-admin-smoke.py` on InstaBox 3. It verifies homepage, admin screen, student-only login restriction, incorrect/correct password, all operator feeds (including MySQL/MongoDB analytics), sign-out and revoked JWTs, without printing credentials or changing operational records. The first full 16-check run passed on 11 November 2026. Cloudflare Worker anonymous boundary checks returned HTTP 303 for `/admin` and HTTP 401 for unauthenticated APIs. An externally authenticated browser session was not inspected during this deployment.
