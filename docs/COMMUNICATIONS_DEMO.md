# Trip communication demo

Implemented in the canonical Laravel application. Each trip has at most one linked canonical `Conversation`; messages remain canonical `Message` rows. The sidecar tables link the conversation, retain mutation receipts, directed blocks and per-trip read cursors. They do not create another ride or messaging backend.

Only an active, approved cohort participant may use the API: driver plus accepted passengers, or the driver/rider in the canonical dispatch assignment. Pending riders and outsiders are denied. A cancelled scheduled passenger loses chat access. Assigned dispatch participants retain their recovery/history access after cancellation. Completed/cancelled trips reject new messages; safety blocking and unblocking remain available after the trip.

The client displays plain text, keeps at most 200 loaded messages in memory, retrieves pages of 50, and can browse earlier history. Refresh returns to the latest messages. Visible chat polls every five seconds without overlapping requests; the dashboard checks recent unread threads every 15 seconds. Closing chat stops polling; sign-out disposes panels, timers and private state. Network-uncertain sends retain their idempotency key; a successful send permits another intentional identical message.

This is **in-app delivery**, not an operating-system push or background notification guarantee. The unread endpoint inspects at most the 100 most recent linked threads. No message, coordinates or document is sent to an external push provider by this implementation. The cohort boundary disables the legacy conversation API because its arbitrary participant changes and provider notifications would bypass this contract. Existing conversation records are retained.

## Blocking and accepted obligations

Blocks are directed: only the actor who set a block can remove that block. Either direction pauses new messages for the whole trip group. This conservative group behavior is shown in the interface; reports/operator recovery remain available. Blocking does not cancel a ride or change its accepted fare, route, lifecycle, seats or history.

New dispatch assignment and scheduled segment admission check either-direction blocks under the existing sorted user locks. The check uses a current database read, including when a transaction already has an older repeatable-read snapshot. Block mutations acquire the full sorted user set with NOWAIT; a competing eligibility operation returns a retryable conflict rather than creating a lock inversion. Existing accepted trips can still start, complete or cancel.

## API

All responses contain private/no-store headers. Use the existing development JWT.

| Method | Path under `/api/mobility` | Meaning |
| --- | --- | --- |
| GET | `/trips/{trip}/messages` | Latest 50 messages and current participants/send state |
| GET | `/trips/{trip}/messages?before={id}` | Earlier 50, ascending in the response |
| GET | `/trips/{trip}/messages?after={id}` | Next 50 newer messages |
| POST | `/trips/{trip}/messages` | `{text}`, 1–800 characters, required Idempotency-Key |
| POST | `/trips/{trip}/messages/read` | `{through_id}` belonging to this trip; monotonic read cursor |
| POST | `/trips/{trip}/blocks` | `{target_user_id,blocked}`, required Idempotency-Key |
| GET | `/notifications` | Recent unread counts and trip IDs, without message bodies or locations |

Send and block limits have separate authenticated-user buckets. They explicitly resolve the existing JWT guard because throttling may run before the logged middleware. Mutation receipts bind actor, kind, trip and exact payload; changed reuse conflicts. No untrusted HTML is rendered and no location is inserted automatically into messages.

## Verification boundary

The coordinator runs the combined disposable Laravel/MySQL regression and the separate real-road TCP/JWT proof. The real-road proof exercises canonical chat, duplicate sends through two independent HTTP workers held on the same Trip lock, privacy, read receipts, blocks, legacy bypass denial, post-block trip execution and terminal read-only behavior. A separate check deliberately creates an older database read snapshot before another HTTP actor commits a block.

Client state and mounted-DOM tests check cursor advancement, retries, intentional repeated text, bounded state and disposal. Browser access is currently disabled in Work settings, so these checks do not establish visual or real-browser acceptance. Physical phones and background/OS notification delivery remain unverified.
