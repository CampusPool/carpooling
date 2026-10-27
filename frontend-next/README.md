# Mobility Next.js local client

This is an in-progress Next.js interface for the existing MobilityPlatform Laravel commute API. It uses the existing MySQL backend; it does not replace it. Its current entry is a **synthetic local demonstration**, not production identity or live payment.

## Run locally

Run the client checks in a clean checkout. The client requires a separately prepared disposable Laravel API; this repository does not include or start a preserved pilot database. With Node.js 24:

```sh
cd frontend-next
npm ci
npm test
npm run typecheck
npm run build
npm start -- --hostname 127.0.0.1 --port 3012
```

Open `http://127.0.0.1:3012` after configuring `MOBILITY_API_ORIGIN` for an API that is explicitly disposable and loopback-only. The backend smoke harness intentionally publishes no host port, so it cannot be used as a browser target without a separately reviewed gateway. No provider key is stored here.

The client supports demo rider and driver sessions and calls the commute, participant chat and trip-report APIs through Next.js rewrites. The Google map displays server-supplied driver geometry after a matching result; the path is not live GPS. Searching by a changed route, time, or walking limit asks before saving the updated commute profile. Accounts and funds are synthetic.

## Verification limits

Type checking, build and focused mocked interaction checks have passed. A clean-clone browser journey is not claimed by this migration: the disposable backend harness is internal-network-only and no public or pilot gateway is included. OTP delivery, physical tracking, real payments, and public deployment remain outside the evidence. Follow `docs/course-20261027/DEMO_RUNBOOK.md` for the reproducible backend checks and the exact client-demo blocker.
