# CampusPool PES email OTP — isolated staging runbook

**Branch:** feature/pes-email-otp-hosting. **Do not merge automatically.**
**Do not use this branch for public signups until the release gates below pass.**

## Existing code reused

Pinned upstream Laravel host: STS-Rosario/carpoolear_backend at revision
6ba3d8913a8f77e664e848a526f196690a03c1e8 (GPLv3).
The CampusPool extension already implements college-auth request and verify,
student profiles, memberships and a verified-identity table. This branch
hardens that implementation without creating a duplicate backend.

## Security and behavior

- Accept only exact @stu.pes.edu emails after normalization; block suffix,
  Unicode/confusable and plus-tag variants on the backend.
- Cryptographically random six-digit codes, including leading zeros.
  Store HMAC-SHA-256 bound to challenge ID, recipient and secret APP_KEY.
- Default **300-second** expiry. Isolated test-only
  MOBILITY_COLLEGE_TEST_OTP_TTL=60 (APP_ENV=testing) or frozen clock.
  Reject exact expiry boundary. Never print codes in logs.
- Single-use, five wrong attempts per challenge, 60-second resend cooldown,
  database-backed rate limits; resend invalidates all earlier active codes.
- Failed mail delivery invalidates its code. Verification atomically creates
  verified identity, membership, student profile and consumed challenge.
- Public mode (APP_ENV=production or MOBILITY_PUBLIC_STUDENT_ONLY=true)
  disables local synthetic registration and demo sessions. The API boundary
  checks that any bearer-authenticated user has a verified student identity.
- Real driver authorization is not auto-approved by college registration.

**Limitations:** This is passwordless OTP sign-in, not a separate password
registration system. Mailbox possession is not proof of formal university
identity beyond the control of that mailbox. The frontend presently uses
bearer tokens in sessionStorage; session/cookie hardening is required before
unrestricted production launch. GPS and synthetic money are not live features.

## Disposable backend integration tests

On an isolated box with Docker:

    sh scripts/prepare-carpoolear.sh
    sh scripts/verify-college-otp.sh

The test harness creates its own uniquely named Compose project and MySQL
volume, refusing to overwrite an existing experiment .env. It uses fake mail
configuration and no real student mailboxes. Do not run against Box 1/2.

For a nested container host, a locally owned (uncommitted) Compose override
can use host networking *only* with MySQL on 127.0.0.1 and Nginx/browser web
on loopback. Never expose SQL, Mongo, Mailpit or PHP-FPM on public interfaces.

## Outstanding public release gates (not yet complete)

1. PHP/MySQL integration: expiry, replay, attempts, failed transport, concurrent
   verification, migration rollback, and direct REST auth-bypass probes.
2. Full one-box stack: Next.js + Laravel + MySQL + MongoDB projection +
   Mailpit + original OSRM road graph, persistent volumes and backup/restore.
   The actual Bengaluru road graph is NOT stored in this Git repository.
3. Verified real outbound SMTP sender and observed permitted PES inbox receipt.
   Mailpit is only a private testing mailbox.
4. Only after security gates: free temporary HTTPS tunnel and independent
   device validation; map referrer and trusted-proxy restrictions.
5. Full browser rider/driver acceptance on the same deployed SHA, Mongo outage
   replay, account/session security review, restart persistence and cost/uptime.
6. Human review and explicit approval before merging anything into main.

This runbook is not a claim that pending gates passed.
