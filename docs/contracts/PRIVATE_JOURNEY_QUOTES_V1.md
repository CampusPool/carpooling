# Private full journey quotes v1

`POST /api/mobility/private-quotes` creates a rider-owned, participant-private immutable full journey quote from a confirmed pickup selection and two rider-owned private endpoints. The origin endpoint must exactly match the selection intent origin. The server recomputes the driver start→pickup→dropoff→end route and both walking legs with a combined walking limit below 1 km, and persists the exact fare snapshot in `mobility_route_quotes`.

The driver approves the exact persisted `quote_hash` at `POST /{id}/driver-approve`; only then can the rider consent at `POST /{id}/rider-consent` with `access_acknowledged: true`. Stable idempotency keys replay the same row without rerouting. A new pending preparation supersedes pending proposals; accepted quotes are immutable and require a later canonical action. Declines and revokes retain history.

This contract is quote-only. `booking_enabled` is always `false`; it does not create a trip, seat, dispatch request, payment, catalog node, or canonical booking.
