# Free email without consuming a student domain offer

Checked 11 November 2026 IST. The owner chose to keep the existing
`campuspool-preview.arjunsrikanth17.workers.dev` address and reserve all
Student Pack domain benefits for other projects. Do not register a domain.

| Option | Fit for this deployment | Actual boundary |
| --- | --- | --- |
| Nylas provider-owned domain | Candidate for a small pilot | Nylas verified `campuspool-preview.nylas.email` without DNS setup. A Sandbox-scoped key received HTTP 403 from the transactional domain endpoint. A dedicated mailbox can send through the grant endpoint. The free plan caps each mailbox at 20 outbound messages per day. |
| Brevo | Currently blocked | This actual account demands phone verification before creating a sending credential; owner declined phone verification. No key created. |
| Resend | Requires a different prerequisite | Arbitrary recipients need a verified sender domain. The default test sender is not a substitute for production student delivery. |
| Mailjet | Possible individual-sender fallback | Supports email-address verification, but official documentation warns that freemail senders may land in spam or fail delivery. No account created or delivery tested. |
| Gmail SMTP | Possible existing-mailbox fallback | Needs an owner-authorized mailbox plus supported OAuth or an app password; do not assume ordinary account passwords or browser cookies are deployable SMTP credentials. |
| Cloudflare Email Routing | Does not solve this alone | Existing workers.dev hosting supplies no owned email DNS zone. Routing handles incoming mail; arbitrary-recipient sending requires Workers Paid. |

The live test returned HTTP 503 after Nylas rejected the Sandbox credential.
The backend was restored to `local_capture` using private Mailpit. The
mailbox transport is implemented and passed its focused backend tests.
Provisioning and live delivery through a mailbox-scoped key are pending.

For the mailbox pilot, configure `MOBILITY_EMAIL_TRANSPORT=nylas_api`,
`MOBILITY_NYLAS_GRANT_ID` and `MOBILITY_NYLAS_API_KEY` in the private backend
environment. Use a key bound to the dedicated mailbox grant with only
`messages.send`. Nylas chooses the sender address from that grant. The app
logs the accepted message ID and status for delivery investigation.

The provider-owned domain is distinct from owning a registered domain.
Daily limits make it appropriate only for a bounded pilot. Do not create
extra mailboxes/accounts to evade limits. Keep the preview tester-restricted
until real provider acceptance, delivery status, inbox receipt and code
verification have been separately established.

Sources:

- [Nylas transactional sending and free provider domain](https://developer.nylas.com/docs/v3/getting-started/transactional-send/)
- [Nylas pricing](https://www.nylas.com/pricing/)
- [Nylas Agent Account usage limits](https://developer.nylas.com/docs/v3/agent-accounts/send-limits/)
- [Nylas mailbox sending endpoint](https://developer.nylas.com/docs/v3/agent-accounts/supported-endpoints/)
- [Mailjet individual sender verification](https://documentation.mailjet.com/hc/en-us/articles/360042759253-How-to-add-a-sender-address)
- [Cloudflare Email Service](https://developers.cloudflare.com/email-service/)
