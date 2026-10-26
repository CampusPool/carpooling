# CampusPool — Next.js course application

Original Next.js + TypeScript implementation. MySQL owns accounts, rides, booking transactions, credits and the outbox. MongoDB provides a private activity timeline and aggregation. This is a course application with manual approval and synthetic, nonredeemable credits.

## Run locally

Requires Node.js 24, Python 3 for the handoff tools, and Docker Desktop or a running Docker-compatible engine.

```sh
cd campuspool
cp .env.example .env
npm ci
node --input-type=module -e "import{randomBytes}from'node:crypto';console.log(randomBytes(32).toString('hex'))"
# Set SESSION_SECRET in .env to the generated value; choose DEMO_PASSWORD.
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://127.0.0.1:3000. MySQL and Mongo bind only to localhost on 13316 and 13317. Wait for MySQL to finish initialization before migrating. The development Compose service disables binary logging; other servers may require the separate `MIGRATION_DATABASE_URL` for routine/trigger creation. Migrations are not DDL transactions: inspect a failed migration before retrying. Do not point these scripts at an existing application database.

`db:seed` creates only synthetic `.test` accounts: `admin@campuspool.test`, `driver@campuspool.test`, `rider@campuspool.test`, `rider2@campuspool.test`; they share your configured `DEMO_PASSWORD`. It never resets existing passwords, approvals or balances. New UI registrations are pending and start with 1000 synthetic credits; an administrator must approve them from Members. Vehicles also require manual admin review. Approval is not an automated campus identity check. Set `CAMPUS_EMAIL_DOMAIN` if an institution-specific domain is required.

Run `npm run activity:worker` in another terminal to deliver committed outbox events to MongoDB. Admins can also update activity from the Activity page. Mongo downtime leaves SQL operations committed and pending events retryable. Stop with Ctrl-C; `ACTIVITY_WORKER_ONCE=1 npm run activity:worker` runs one batch.

## Check changes

```sh
npm run typecheck
npm run lint
npm test
npm run build
# With isolated services configured and migrations/seed applied:
RUN_CAMPUSPOOL_INTEGRATION=1 npm test -- --exclude tests/http.e2e.test.ts
npm run test:http
```

Plain `npm test` reports skipped database/HTTP cases when services have not been requested. A unit-only run does not prove integration. The issue repository's `scripts/verify-prepared.py` runs the available integration tests in disposable databases; it does not reuse local volumes.

## Product boundary

Routes use fixed campus stops and Asia/Kolkata departure windows. There is no live traffic, Maps/GPS routing, money movement, timetable matching, waitlist/rematching, email delivery or deployment claim. Cars allow 1–5 passenger seats and bikes one; these are configured course limits, not jurisdiction-wide legal capacity claims. A driver cannot publish another active ride within 60 minutes of departure. Cancellation is permitted before departure. The host must accept a request before seats and synthetic credits are reserved.

The shared foundation provides auth, approval, schema, search and CI. Feature PRs add vehicles, offers, bookings, cancellations and SQL/Mongo evidence independently; the full workflow requires their integration. Legacy prototype files remain separate and unchanged in the solutions repository. Draft course documentation and test traceability do not establish instructor approval or a completed video.

For hosted use, set `APP_ORIGIN` to the exact HTTPS origin and provide private database credentials and a fresh secret. Loopback HTTP is allowed for local production-build tests. Never deploy the development seed credentials or unauthenticated development Mongo service publicly.
