# CampusPool DBMS administration control center

**URL:** `/admin` on the same Next.js origin as the student-facing site.

## What is connected

- Authenticates through the pre-existing `/api/login`, verifies the bearer token with `mobility/commute/me`, and requires a successful role-guarded `mobility/operator/dashboard` response. The frontend stores the token in memory only; no demo password, token or database connection string is embedded.
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

No production deployment, administrator account creation, real vehicle verification, live settlement, database query console, or institution-authorized timetable import is claimed. The dashboard shows a bounded first page of each list, with a warning if more records exist. Data-source failures do not silently display fabricated zeros. It is a teacher-demo and administration UI; its backend depends on the normal pinned Laravel host and optional MongoDB projection being configured and running.

To test: `cd frontend-next && npm ci && npm run typecheck && npm test && npm run build`. Backend requires reconstruction and the separate disposable integration test environment described in the repository runbooks. Do not run migrations or destructive tests against preserved pilot databases.
