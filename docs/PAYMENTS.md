# Payment and driver earnings contract

## Product requirement

User answer, 17 October 2026: the rider pays, funds are retained initially, and the driver receives them after the ride is complete and the rider reaches the destination. Wallets and UPI app handoff were suggested as possible interfaces, not fixed architecture choices. This is our required outcome; Hopr's exact runtime payment flow remains unverified.

Model a provider-backed marketplace collection and delayed driver settlement. A rider can open a UPI app to authorize payment while our app displays payment history and pending driver earnings. A balance display does not establish a transferable or reloadable wallet. General wallet top-ups, peer transfers and cash-out are outside the current decision and require a separate provider/product assessment.

Proposed booking flow: accepted booking → payment pending → provider-confirmed payment → ride → confirmed drop-off/completion → release eligible → provider transfer/settlement pending → paid out. Payment timing relative to request/acceptance and pickup is still a product decision; the engineering default to evaluate is payment after acceptance and before pickup. Quotes must come from the server in INR minor units, with explicit fare, commission, fees, taxes, refund allocation and expiry. Exact amounts/policies are not decided.

## Separate facts and states

| Record | Meaning | Authority |
| --- | --- | --- |
| Booking | Seat/assignment and cancellation state | Our existing trip/booking backend |
| Payment | Requested, pending, captured, failed or refunded amount | Provider-verified events/API responses, reconciled into our records |
| Driver earnings | Pending, release eligible, transfer pending or settled obligation | Append-only financial postings derived from bookings/provider facts |
| Completion evidence | Trip completion plus this passenger's confirmed drop-off | Authenticated rider confirmation or an approved auditable fallback |
| Dispute/refund | Blocks, refund requests, provider results and reversals | Financial workflow plus authorized operator decisions |

Never treat UPI app return, a client success flag, screenshot, driver claim, or submitted transaction reference as proof of collection. Verify provider identity, environment, order/payment mapping, amount, currency and captured status. An authorization or checkout signature alone must not be presented as captured funds. Payment capture, provider transfer, release of a settlement hold and arrival in the driver's bank account are separate events.

## Release conditions

Evaluate per paid booking, even when a carpool trip has multiple passengers. The current first implementation should require the trip to be completed and this passenger to have alighted; do not accidentally pay every booking when one passenger reaches a stop. Earlier per-passenger release on an ongoing multi-stop trip is a future explicit policy decision.

A release command needs all of the following in the same consistent decision:

- The booking maps to a provider-confirmed collection for its server-approved amount/currency.
- Trip completion and passenger drop-off evidence exist. The owner-controlled `alight` and `complete` events alone are insufficient. The new rider-authenticated drop-off acknowledgement supplies a separate participant statement; no physical/GPS proof or offline/operator fallback is claimed.
- No cancellation, refund pending/completed, dispute, operator block or inconsistent reconciliation result prevents release.
- The beneficiary is verified and the selected provider/account configuration supports the required delayed settlement.
- Unrefunded, unreversed and unallocated funds cover the obligation; commission/fees/taxes are explicitly accounted for.
- The payout allocation and command are unique; retrying cannot allocate or pay twice.

Lock trip/booking financial records in a documented order. Persist eligibility and an outbox command atomically; make external provider calls outside database locks. A timeout leaves an unknown/pending result that must be fetched/reconciled before another monetary instruction. Use provider idempotency where available; otherwise resolve uncertain outcomes through provider references and reconciliation. A database idempotency key alone cannot make an external charge or transfer exactly once.

Do not show “paid out” until the appropriate provider result confirms it. Release eligibility is not a promise of immediate bank credit. An asynchronous worker must recheck applicable refund/dispute blocks before sending a queued command; concurrent cancellation/refund and release need one serialized allocation policy.

## Provider investigation, not provider selection

Official documentation checked 17 October 2026:

- [Razorpay Route settlement controls](https://razorpay.com/docs/payments/route/schedule-settlement/) describe per-transfer settlement holds and schedules. Releasing a hold can remain subject to the account settlement schedule. Its documented VPA account flow settles at transfer creation and does not use these schedule settings. Do not assume a pre-created VPA transfer can safely remain held until completion; validate account type and actual sandbox behavior before selecting a flow.
- [Route APIs](https://razorpay.com/docs/payments/route/apis) provide transfer, hold modification, refund/reversal and reconciliation endpoints. A captured payment, transfer and final settlement remain different objects. Confirm availability and behavior on our approved merchant account.
- [Razorpay webhook validation](https://razorpay.com/docs/webhooks/validate-test/) requires signature validation on the raw body; duplicate and out-of-order delivery are expected. Persist authenticated event identity and payload digest, reject conflicting duplicates, and reconcile missing/uncertain states. Keep test/live namespaces separate.
- [Cashfree Easy Split API overview](https://www.cashfree.com/docs/api-reference/payments/latest/split/easy-split-overview) is an alternative marketplace collection/vendor settlement candidate. Delayed settlement fit and account eligibility still need a dedicated test; this page alone does not establish our desired hold/release behavior.

Choose between provider-approved delayed transfer creation and a supported held-settlement flow only after testing the exact account/product configuration. Do not call this our own escrow or assume we may operate a general stored-value wallet. No merchant account, product activation, credentials, pricing agreement, live charge or payout is established.

## Cash

Cash goes directly between rider and driver. The authenticated cash-receipt API now records separate rider/driver claims, two-party confirmation and terminal dispute history; a cash claim cannot create provider funds, a payout allocation or a synthetic wallet credit. Platform commission/dues on cash rides need an explicit collection policy; cash acknowledgement does not settle them. See [API contract](PAYMENT_API.md). Cash refunds require a separate confirmed handling process.

## Current increment and next implementation slice

The same backend/database now has immutable INR fare snapshots, order-bound payment attempts, capture event deduplication, balanced postings, blocking records, matching rider confirmations and a guarded payout allocation/outbox. A raw-body HMAC verifier handles the documented Razorpay captured UPI envelope. All provider facts and beneficiary records used in tests are synthetic; no provider sandbox/live outcome or dispatch is established. See [implementation scope](../backend/extensions/carpoolear/Mobility/Payments/README.md).

Continue with authenticated provider adapters, durable handling of unmatched/excess events, actual collection, refund/reversal postings, dispatch-time block checks, uncertain-command reconciliation and settlement outcomes. Keep one authoritative booking/financial backend. Before provider callbacks are enabled, prove these missing paths; the current outbox alone is not a financial integration. Sandbox tests follow account access; real enablement is separate.

Acceptance evidence must include:

1. Forged callback, wrong order/amount/currency, test/live mismatch and UPI return cannot mark a booking paid.
2. Duplicate/out-of-order capture events and worker retries create one balanced posting/allocation; unknown events are retained for reconciliation.
3. Driver-only completion, missing drop-off proof, active dispute and pending refund all block release.
4. Concurrent completion, refund and release preserve the allocation total and produce no duplicate transfer.
5. Cancelled/expired booking with a late successful payment enters a refund/reconciliation path without restoring capacity implicitly.
6. Provider timeout after accepting a command is reconciled without blind resubmission; failed or reversed settlement updates earnings correctly.
7. Multi-passenger allocation and partial refunds conserve money; cash cannot enter the provider release path.
8. Sandbox collection → confirmed ride/drop-off → release → final settlement/refund is reconciled against provider records before live enablement.

Outstanding human/provider decisions: eligible merchant/operator account, activation status, cancellation/no-show/refund rules, fee allocation, completion fallback and settlement expectations. These do not block local engineering. Live enablement depends on their resolution and verified account behavior.
