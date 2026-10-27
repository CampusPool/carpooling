# OPERATOR_CASH_QUEUE_V1

20 October 2026. Next S6/S7 local slice. Existing cash receipts and provider-attempt records remain canonical; this read-only cross-trip queue creates no case, refund, posting, payout, settlement or dispute resolution.

`GET /api/mobility/operator/cash-disputes?after=0&page_size=50` uses existing logged/active-account middleware and explicit administrator check. Non-admin403 `OPERATOR_FORBIDDEN`; invalid cursor/page-size422. Cursor integer>=0; page size1..100, default50. Order by receipt ID ascending, fetch size+1, return `pagination: {page_size,has_more,next_after}`. `next_after` is last delivered receipt ID only if another row exists. Refresh from0 to discover older receipts newly disputed; a cursor is not a change feed.

Include a cash receipt iff disputed_at is non-null OR a provider attempt exists for the same booking (any status/environment, matching existing payment-view conflict semantics). Use bounded rows and one consistent SQL statement, with correlated existence instead of an unbounded provider-history load. This view reports observed facts only and cannot authorize a financial action.

Response top-level `audience: operator`, `live_provider_dispatch_enabled: false`, `data: [...]`, pagination. Each row contains:
- Integer receipt_id, trip_id, booking_id, rider_id, driver_id.
- Snapshot currency, integer gross_amount and commission_amount, all in currency minor units. No invented driver settlement.
- Boolean rider_acknowledged, driver_acknowledged, has_provider_attempt; nullable disputed_at timestamp as stored.
- `reconciliation_state`: channel_conflict if any provider attempt, otherwise cash_disputed. Both may be present; disputed_at retains the independent fact.
- `cash_state`: disputed if disputed_at, otherwise confirmed if both acknowledgements, otherwise awaiting_confirmation.
- Current canonical booking_state/trip_state, nullable when unavailable. Read-only diagnostic values, not transitions.
- `cash_commission_status: not_settled`; settlement_status is not_verified for channel conflict, otherwise not_applicable_cash.

Do not return emails, phone numbers, coordinates, provider references, raw event payloads, authorization tokens or beneficiary details. Preserve all existing auth/financial protections. No migrations or new authority store.

The same-origin operator screen adds an independent cash-review section with refresh and bounded next-page navigation. Show clear empty/loading/error states, minor-unit INR formatting, participant/trip/booking IDs, acknowledgement/dispute/conflict facts and unresolved commission/settlement. Refresh starts at0, next uses only returned cursor. Render text safely and discard in-flight results after logout/account changes. No fabricated resolve/refund controls. UI visibility alone is not authorization.

Acceptance: non-admin and inactive/anonymous denial; multiple disputed trips, undisputed receipts excluded, conflicting channels included; valid monotonic pagination and bounds; facts/privacy; zero table mutation/money writes from repeated reads; unchanged existing per-trip semantics. MySQL HTTP tests and actual loopback JWT operator/nonoperator reads must pass. Browser/device visual acceptance remains separate.
