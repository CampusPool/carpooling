# CampusPool tester ingress

The deployed preview is https://campuspool-preview.arjunsrikanth17.workers.dev.
It is a Cloudflare-owned `workers.dev` hostname, not a registered CampusPool
domain. The owner confirmed they have no domain; the account's Domains and
Tunnels inventories were empty on 11 November 2026 (IST).

Request path:

`HTTPS client → dedicated Cloudflare Worker → HTTPS private InstaBox port → Next.js → loopback Laravel`

The Worker requires a high-entropy tester key, then issues an eight-hour
HMAC-signed Secure/HttpOnly/SameSite cookie. Application bearer tokens remain
separate. The student preview redirects anonymous page requests to `/_tester` and returns 401 for anonymous student API requests. The Worker also serves `/admin`, shared Next.js scripts, styles and fonts, and an allowlist of dashboard API routes and methods. Laravel handles administrator sign-in and authorization.
The InstaBox port independently rejects requests without its private token.
The Worker forwards that token only to the configured HTTPS InstaBox origin.
No database, Mailpit, or analytics port is published.

This is a limited private preview. It is not a claim of production readiness,
Cloudflare Access enrollment, verified student-email delivery, or continuous
availability. Shared tester keys provide no per-person identity or MFA. Rotate
the tester key and session secret to revoke access. Workers request limits and
the InstaBox provider's run deadlines/cooldowns remain authoritative.

## Reproduce on an isolated host

Use a fresh checkout of this branch on an unused Linux InstaBox with Docker,
Compose, Python 3, Node/npm, outbound HTTPS, and sufficient free disk. The
observed deployment used about 7 GB additional root-disk storage and left
approximately 4 GB free; budget more for growth. Never run this on the
preserved Simular demos or reuse their volumes/databases.

```sh
sh deploy/one-box/bootstrap-instabox.sh
```

This reconstructs the pinned GPLv3 upstream, installs its locked Composer
dependencies, builds the frontend, applies additive migrations, and starts
six services with named volumes and restart policies. All HTTP/database
listeners bind to loopback. Backend timestamps use UTC; commute schedules
continue to use their explicit Asia/Kolkata timezone.

Only after local verification, publish frontend port 3013 privately:

```sh
umask 077
instabox-port publish 3013 --private --name 'CampusPool tester preview' > private-port.txt
```

Keep this output private: it contains a bearer credential. Install its origin
URL/token plus independent random tester/signing secrets using a private JSON
file with `wrangler secret bulk`, never a tracked config or command literal:

```sh
node --test deploy/cloudflare/worker.test.mjs
npx wrangler@4.158.0 deploy --config deploy/cloudflare/wrangler.toml
npx wrangler@4.158.0 secret bulk /PRIVATE/PATH/secrets.json --config deploy/cloudflare/wrangler.toml
```

Required secret names: `ORIGIN_URL`, `ORIGIN_TOKEN`, `TESTER_PASSWORD`,
`SESSION_SECRET`. A deployment missing them returns 503. Worker observability
is disabled to avoid retaining authentication submissions. Protect local
secret files with directory mode 0700 and file mode 0600.

The existing lifecycle controller is a separate Worker and D1 database; this
deployment does not change its scripts, schedules, credentials, or settings.

## Custom domain / named Tunnel

InstaBox 3 successfully connected to both Cloudflare Tunnel regions on TCP
7844. A named Tunnel/custom hostname was not configured because there is no
owned DNS zone and the existing CLI OAuth grant lacks DNS/Tunnel permissions.
The selected supported alternative is the provider's private HTTPS forwarding
behind a dedicated Worker. It has no Mac dependency.

A proper sender/custom domain requires an owner-approved registration,
DNS control, and registrar contact details. Cloudflare's published ordinary
`.com` price was USD 11.17 for registration and renewal on the audit date;
availability, premium-name prices and checkout taxes must be checked before
purchase. Nothing was purchased or upgraded.

## Outbound OTP email

The tester preview uses the free Nylas mailbox
`otp@campuspool-preview.nylas.email`. Configure `MOBILITY_EMAIL_TRANSPORT=nylas_api`,
`MOBILITY_NYLAS_GRANT_ID`, and `MOBILITY_NYLAS_API_KEY` in the private backend
environment with `MOBILITY_MAILPIT_MODE=false`. Bind the key to the mailbox with
only `messages.send`. Recreate the backend after installing or rotating the key
and verify the OTP config through the tester preview. The current pilot key
expires December 11, 2026. See the [verification record](VERIFICATION-20261111.md)
for the live send result and [free email options](FREE-EMAIL-OPTIONS.md) for
provider limits.

The Resend HTTPS transport was recovered from uncommitted Simular 3 work.
It is explicitly selected with `MOBILITY_EMAIL_TRANSPORT=resend_api` and needs
`MOBILITY_RESEND_API_KEY` plus `MOBILITY_RESEND_FROM`. Missing credentials,
unsafe sender addresses, rejected sends, or absent provider IDs fail closed.
`MOBILITY_RESEND_HTTPS_PROXY` is optional. API acceptance is not inbox delivery.

SMTP remains available through Laravel's `MAIL_HOST`, `MAIL_PORT`,
`MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_ENCRYPTION`, and `MAIL_FROM_ADDRESS`.
Disable `MOBILITY_MAILPIT_MODE` when installing real delivery. Never claim
Mailpit capture as external delivery or use `@stu.pes.edu` as the sender.

Provider comparison checked against official documentation:

| Provider | Free allowance | Requirements / boundary |
| --- | --- | --- |
| Resend | 3,000/month; 100/day | Owned verified sender domain for arbitrary recipients; HTTPS API and SMTP |
| Brevo | 300/day | Approved account and verified sender; documents temporary provider-managed replacement for unverified/free-email sender domains |
| Cloudflare | Verified destination sending on Free | Arbitrary-recipient Email Sending requires Workers Paid; Email Routing alone is insufficient |

Brevo's specific account may additionally require phone verification before
sending. Inspect the actual transactional sending result; access to SMTP
settings does not prove sending is enabled. Do not bypass provider checks.

Sources: [Cloudflare Registrar prices](https://pricing.registrar.cloudflare.com/?q=com),
[Resend pricing](https://resend.com/pricing),
[Brevo free plan](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans),
[Brevo sender requirements](https://help.brevo.com/hc/en-us/articles/14925263522578-Comply-with-Gmail-Yahoo-and-Microsoft-s-requirements-for-email-senders),
[Cloudflare Email Service](https://developers.cloudflare.com/email-service/),
[InstaBox private ports](https://instabox.sh/docs/access/ports.md).
