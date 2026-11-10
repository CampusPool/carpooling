# CampusPool Next.js client

This is the **student-facing web client** for the CampusPool SE + DBMS project. It is not a standalone application: it requires the pinned Laravel backend, a disposable MySQL database and, for the Ola mode, valid Ola Maps Web SDK/Places/Directions credentials. A local OSRM server and the Bengaluru crop are not required for that mode.

**Use the repository-level [README](../README.md), [teacher demo](../docs/COURSE_DEMO.md) and [local bootstrap](../RUN_LOCAL_CORE.md) for a real end-to-end run.** Those scripts configure the independent Laravel/MySQL API and the selected routing provider. Launching Next.js alone only verifies the UI; it does not create rides without a backend.

## Frontend quality checks

With Node.js 24:

```sh
npm ci
npm test
npm run typecheck
npm run build
```

These checks use test doubles/fixtures and **do not require a private Maps key or real road dataset**. GitHub Actions runs them on PRs and `main`.

## UI entry points

- `app/page.tsx`: session and route/navigation coordination for synthetic and canonical accounts. It remains a large legacy orchestration file; avoid expanding it further.
- `components/LocalAccountLanding.tsx`: signed-out landing screen and synthetic account sign-in controls.
- `components/LiveCarpool.tsx`: **recommended classroom demo** for local rider and driver roles; map search, publishing, matching, bookings and trip lifecycle.
- `components/CanonicalPool.tsx`: separate path for accounts subject to membership, approved pickup and vehicle requirements. Not a drop-in duplicate of LiveCarpool.
- `components/RideConversation.tsx` and `components/LiveAccountActivity.tsx`: scoped chat and synthetic wallet/notifications.
- `components/OperatorAnalytics.tsx`: read-only application database/analytics reports for the operator path.
- `lib/legacy-api.ts` and `lib/legacy-ui-utils.ts`: request/error handling and formatting helpers extracted from the large legacy page with regression tests.

## Running the UI against an existing isolated API

The full root bootstrap is recommended. For UI-only development with a **known disposable** Laravel API already running on loopback:

```sh
MOBILITY_API_ORIGIN=http://127.0.0.1:18086 npm run build
MOBILITY_API_ORIGIN=http://127.0.0.1:18086 npm start -- --hostname 127.0.0.1 --port 3012
```

Use the **actual** API origin/port for your own disposable environment; `18086` was one tested isolated PR backend, **not** a permanent or publicly reachable address. Keep MySQL and upstream host setup separate. Never route a test frontend to the preserved pilot database by accident.

## Verification and limits

An independent Simular run completed the full synthetic rider-and-driver browser journey using a cloned Next.js frontend, a separately prepared Laravel checkout and a fresh MySQL database, with **real Google Places and route preview**. Read [the evidence and OSRM/Docker deviations](../docs/engineering/PHASE1_SIMULAR_PR_OWNED_E2E_20261110.md) before describing this as a production-grade result.

The wallet uses only demo credits. The Ola LiveCarpool E2E passed in an isolated environment, but the new launch path, all older browser views, physical GPS tracking, SSO/OTP, real payments and official timetable import remain **unverified or out of scope**. The complete status matrix is [here](../docs/FEATURE_STATUS.md).
