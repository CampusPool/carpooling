# CampusPool one-box PRIVATE development deployment

This Docker Compose stage has Next.js, Laravel, MySQL, MongoDB, the
SQL-to-Mongo analytics worker and a local Mailpit SMTP testing inbox.
It is not publicly deployable yet and lacks a real Bengaluru OSRM graph.

On a dedicated Linux host with Docker, Node 24, npm and Python 3,
run: sh deploy/one-box/start-private.sh

On Box 3, the local HTTP proxy and Docker vfs storage driver were
needed because native egress and nested OverlayFS did not work.
Supply BOX3_BUILD_PROXY via the environment when rebuilding there.
The bootstrap generates a private .local/one-box/private.env file at mode 0600
and refuses to replace existing secrets. It runs additive migrations
and grants the analytics reader SELECT on eight event columns only.

Never run this on Box 1 or Box 2. Do not run docker compose down -v
on a persistent stage. Do not publish Mailpit, Mongo, MySQL or analytics
ports. Loopback services use ports 3013, 18083, 3306, 27017, 8090,
8025 and 1025.

Mailpit test delivery, OTP verification/replay denial and local-service
restart preservation were observed. External student mailbox delivery,
public HTTPS, real OSRM roads, real ride E2E, encrypted backup/restore,
session hardening and full security acceptance have NOT passed.
Do not expose real student signups or merge without approval.
