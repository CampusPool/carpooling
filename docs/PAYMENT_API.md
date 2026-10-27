# Payment history and cash receipt API

## Cross-trip operator cash queue

`GET /api/mobility/operator/cash-disputes?after=0&page_size=50` is an explicit active-admin-only read of disputed cash receipts or cash/provider channel conflicts. It returns safe snapshot/acknowledgement facts and current diagnostic states, without provider references or money mutations. Receipt-ID cursor pagination supports1..100rows; refresh from0 finds older receipts newly disputed. See [versioned contract](contracts/OPERATOR_CASH_QUEUE_V1.md) and [local evidence/limits](OPERATOR_CASH_QUEUE_READINESS.md). The same-origin operator screen is coded/static-checked; current visual acceptance remains open. No resolution/refund/settlement action is implied.

All routes use the existing authenticated API and active-account middleware. Amounts are integer INR minor units. No route in this increment initiates a provider charge, transfer, refund or settlement.

## Read payment history

`GET /api/mobility/trips/{trip}/payments?after=0&page_size=50`

- Rider: only their own passenger booking rows, including cancelled history.
- Trip owner: passenger rows for their trip, with quoted/allocated driver amounts and unsettled cash commission information.
- An administrator who is not a participant must use `GET /api/mobility/operator/trips/{trip}/payments`. Only that explicit administrator route includes provider order/payment references and internal blocking reasons. Beneficiary references are never returned by these routes.
- `page_size` is 1–100; `after` is a nonnegative booking-ID cursor. `pagination.next_after` advances to the next page. There is no total wallet balance or cross-page total implied by this response.

Each booking contains its immutable gross quote, provider attempts with explicit test/live environment, collection state, presence of a payment block, rider acknowledgement, optional cash receipt, and driver payout/settlement status. Driver quotes are not earnings already collected. Allocation and outbox entries are not bank credit. `live_provider_dispatch_enabled` remains false.

Provider payout states currently describe stored local records: `not_allocated`, `queued`, `blocked`, or `reconciliation_required`. Provider settlement is `not_verified`. Cash-only bookings instead use `not_applicable_cash` for both payout and settlement; the driver receives cash directly. If both channels appear in an inconsistent record, collection and payout report reconciliation required.

The read transaction takes the same trip lock used by financial/cash writers. Bookings are cursor-paginated and related records are fetched in batches. Provider attempt history is not yet independently paginated; add that bound before exposing repeated checkout creation at scale.

## Record cash acknowledgements

`POST /api/mobility/trips/{trip}/bookings/{booking}/cash-receipts`

Header: `Idempotency-Key: <1–100 printable ASCII characters>`

Body actions:

```json
{"action":"rider_paid"}
```

```json
{"action":"driver_received"}
```

```json
{"action":"dispute"}
```

Actor identity comes from authentication. The booked rider may acknowledge payment, the trip owner may acknowledge receipt, and either may dispute an existing receipt. An unrelated administrator cannot override these identities. A driver cannot supply a rider ID or create both sides of a receipt for a self-booking. Client amount/currency fields do not replace the trusted server fare snapshot.

The first acknowledgement requires an accepted booking and an in-progress boarded/alighted participant, or a completed trip with an alighted participant. A fare snapshot must already exist. Cash is not available when any provider payment attempt exists, including a pending checkout. Conversely a cash receipt blocks provider checkout and provider payout allocation. Switching from an abandoned/failed provider checkout to cash requires a future verified cancellation/reconciliation policy; this API deliberately does not assume the old order cannot later capture.

One party's acknowledgement is `pending`; both parties yield `confirmed`. `disputed` is terminal through this API. The same actor/key/action replays its original response even after later acknowledgement, completion or dispute. Reusing the key with another authorized action conflicts. A different key cannot duplicate an already recorded acknowledgement/dispute. The event history remains intact.

Cash confirmation records two authenticated claims, not physical handover proof. Existing receipt acknowledgements/disputes can be recovered after later lifecycle changes; there is no automatic cash refund or commission collection. Commission remains `not_settled`, and no wallet credit, provider funds, financial posting or payout is created by cash actions.

## Integration boundaries

Fare calculation/approval is still an internal trusted service operation; there is no public price-setting route. The provider capture and beneficiary-verification service methods remain trusted adapter boundaries, not client write APIs. Synthetic signed capture fixtures prove local processing only. Real merchant activation, collection/refund/reversal/settlement adapters, excess/unmatched event recovery, uncertain-command reconciliation, cash commission/refund policies, and explicit pre-trip payment-method selection remain required.
