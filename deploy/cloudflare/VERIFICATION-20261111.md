# Deployment evidence — 11 November 2026 IST

The tester-only HTTPS preview is deployed. Nylas accepted the authorized
PES OTP for sending. PES inbox receipt and sign-in are pending.

## Phase 1: inventory

- Cloudflare account: existing lifecycle Worker/D1 plus the new dedicated
  preview Worker. Existing controller remains unchanged.
- Domains: empty inventory, and owner confirmed no domain ownership.
- Tunnels: empty inventory. No named Tunnel created without an owned zone.
- Existing CLI OAuth allows account/Workers/D1; DNS/Tunnel access is absent.
  Subscription inspection returned 403, so no new billing-plan claim is made.
- All three InstaBoxes were reachable: 4 vCPU, approximately 8 GB RAM each.
  The restricted shell connector reports a different filesystem view and
  cannot administer Docker. Existing SSH/provider administrative access
  verified Docker 29.8.2 on isolated InstaBox 3 (`arj07`).
- Before installation: about 11 GB free on its 16 GB root filesystem;
  after installation: about 4 GB free. No datasets copied.
- Both Cloudflare Tunnel regions accepted TCP 7844. Resend HTTPS 443 and
  Brevo SMTP 587 were reachable. This is connectivity evidence, not provider
  account activation or successful mail delivery.

## Phase 2: isolated application

- Source base: PR #95 branch `feature/pes-email-otp-hosting`, remote HEAD
  initially `f79ea1f6595de8565640e0ebb8f600e4a543b503`.
- Preserved and reviewed uncommitted Resend transport/security-test changes
  from Simular 3; no existing Simular files or databases were overwritten.
- Installed on InstaBox 3 at `/workspace/campuspool`.
- Six Docker Compose services: Next.js, Laravel, MySQL, MongoDB, SQL-to-Mongo
  projection, and private Mailpit. Named volumes, health checks and
  `unless-stopped` restart policies are active.
- MySQL, MongoDB, Laravel, analytics and Mailpit bind to loopback only.
- Corrected missing fresh-host Composer installation in the bootstrap.
- UTC backend configuration made the tracking regression pass; the same
  test failed under the inherited default timezone. No tracking algorithm
  change was made. Updated two old OTP fixtures to use the current digest.

## Phase 3: HTTPS / access boundary

URL: https://campuspool-preview.arjunsrikanth17.workers.dev

Hostname ownership: Cloudflare-owned `workers.dev` subdomain, not an owned
registered domain. Routing: dedicated Worker → provider private HTTPS port
3013 → loopback Next.js. No Mac relay or dependency.

- Public anonymous API: HTTP 401.
- Tester login then homepage: HTTP 200 with normal TLS validation.
- Built-in browser tester form initially returned HTTP 403. Its referrer
  policy suppressed the origin required by the form POST. The deployed
  fix sends the origin for same-site form navigation and keeps the exact
  origin check. Retesting the native form opened the CampusPool homepage.
- Private InstaBox origin without credential: HTTP 401.
- Private InstaBox origin with credential: HTTP 200.
- Only frontend port 3013 is published; tester and origin credentials are
  separate private secrets.
- Named Tunnel/custom-domain acceptance remains pending domain ownership
  and the appropriate Cloudflare grant. No paid plan/purchase was activated.

## Phases 4–5: real email boundary

InstaBox 3 sends through the Nylas HTTPS mailbox API from
`otp@campuspool-preview.nylas.email`. Nylas manages and verified the sender
domain. The server credential is bound to that mailbox with only
`messages.send` and expires on December 11, 2026. Rotate it before expiry to
keep the pilot sending.

| Live email check | Actual result |
| --- | --- |
| Tester HTTPS homepage and OTP config after backend recreation | HTTP 200, `delivery_scope=external_api_configured_unverified` |
| Anonymous OTP config | HTTP 401 |
| Authorized PES OTP requested using the uppercase SRN | HTTP 201, 300-second expiry |
| Nylas mailbox API and dashboard | HTTP 200, message listed in Sent |
| Follow-up OTP through the live browser form | Opened the verification screen with a five-minute timer; backend recorded Nylas acceptance |
| Nylas delivery timeline | HTTP 403 with the send-only key |
| PES inbox receipt and sign-in using the email | Pending tester confirmation |

The dedicated mailbox transport passed 20 focused backend tests and 155
assertions. The earlier Sandbox domain API request returned HTTP 403 and was
rolled back before this mailbox deployment. See [free email
options](FREE-EMAIL-OPTIONS.md) for the provider comparison.

## Phase 6: verification

| Check | Actual result |
| --- | --- |
| OTP/registration/local-account backend suite | 18 passed, 141 assertions, disposable `otp_testing` database |
| Carpool product/ranking suite after fixture/timezone corrections | 19 passed, 346 assertions, separate `testing_commute` database |
| Frontend suite | 129 passed across 16 Vitest files; contract/map checks also exited successfully |
| Activity projection unit suite | 17 passed |
| Worker access/proxy tests | 3 passed |
| Pinned upstream reconstruction | Passed; 14 changed upstream files, no application/database started by reconstruction check |
| Public frontend-to-backend config | HTTP 200 |
| Demo-session disabled | HTTP 404 |
| Anonymous student account | HTTP 401 |
| Synthetic Mailpit OTP request | HTTP 201; 300-second lifetime, 60-second resend cooldown |
| Immediate resend | HTTP 429 |
| Invalid OTP | HTTP 422 |
| Synthetic registration and verification | HTTP 200 |
| Authenticated profile | HTTP 200 |
| OTP replay | HTTP 422 |
| Separate 60-second expiry | Passed boundary test using test clock, without changing default |
| SQL container restart persistence | User/verified identity/challenge counts unchanged: 1 / 1 / 1 |
| Previously issued student session after service restarts | Public HTTPS HTTP 200 |
| All six container health states | Healthy |

The public synthetic journey used Mailpit and generated synthetic student
records. The carpool suite used fixture routing in a disposable database;
it does not prove real road routing, physical GPS, real payments, or a full
multi-user public carpool journey on this host. A full VM reboot, provider
cooldown outage, and backup restore were not tested. InstaBox currently
advertises a 120-minute run limit; the existing controller and provider
cooldowns cannot guarantee uninterrupted service.

Preserved: Simular 1 Google Maps/OSRM demo, Simular 2 Ola staging, Simular 3
private stage, and all existing lifecycle controller schedules and data.
