# Private trip tracking handoff

This packet adds `STS\Mobility\Tracking\TrackingService` and an authenticated route file at `routes/tracking.php`. The service uses the existing `trip_live_shares` row as the only current-location projection. It never returns the legacy share token or a public URL.

## API

All responses are `private, no-store`; every mutating request requires an ASCII `Idempotency-Key` of at most 100 bytes.

* `POST /api/mobility/trips/{trip}/tracking/session`, body `{ "consent": true }`: the driver explicitly starts a fresh UUID session. A location post never grants consent.
* `POST /api/mobility/trips/{trip}/tracking/locations`, body `session_id`, positive `sequence`, `lat`, `lng`, `accuracy_meters` (0–500), and UTC `recorded_at` with milliseconds. A sequence is accepted only once and only for the current session.
* `GET /api/mobility/trips/{trip}/tracking`: owner or an accepted passenger receives a coordinate only when active and no older than 30 seconds. Stale/offline/explicitly stopped state returns `location: null, stale: true`.
* `POST /api/mobility/trips/{trip}/tracking/stop`: driver stops the session and clears precise lat/lng.

The driver must own the trip and be active, unbanned, and pass the existing `CohortPolicy::approved` check (including configured college equality). Readers must satisfy the same membership check; passengers must be accepted `trip_passengers`. Only `planned` and `in_progress` lifecycle trips are readable/writable. Canceled and completed trips return `TRACKING_STOPPED` (410), while an authenticated original driver may still revoke/clear sharing after terminal transition. The service locks the trip first and does not lock dispatch rows or call providers inside a transaction.

## Coordinator migration proposal

On `trip_live_shares`, add nullable `driver_session_id` (UUID/string), `consented_at`, `last_sequence` unsigned integer default 0, and `accuracy_meters` decimal. Keep the current legacy columns (`lat`, `lng`, `recorded_at`, `is_active`, `stopped_at`) and add a unique key on `(trip_id, user_id)` if the legacy table does not already enforce one.

Add `mobility_tracking_receipts`: `id`, `trip_id`, `actor_id`, `kind` (`session|location|stop`), `idempotency_key` (100), `request_fingerprint` (64), `response_body` JSON, timestamps, and a unique key on `(trip_id, actor_id, kind, idempotency_key)`. Foreign keys target `trips` and `users`; retain receipts for replay/audit. The `trip_live_shares` row remains the canonical read model, while receipts provide durable idempotency and reconnect/session fencing.

## Legacy live-share hooks

Coordinator must audit and patch the legacy public live-share controller/model/routes so it cannot expose this row or its token to unauthenticated/public consumers. Required hooks: (1) deny public token reads for mobility-managed trips, (2) require the same owner/accepted-participant authorization and active membership, (3) stop and clear the row on every terminal lifecycle transition (`completed`, `cancelled`) and on explicit tracking stop, and (4) remove precise coordinates from any DTO/cache/log. Legacy links should return a generic 404/410 and must not reveal `driver_session_id` or receipt data.

## Verification

The service is intentionally bounded to validation and DB operations; no provider, Docker, vendor, or live DB mutation was used. Run the repository's focused mobility test command after the coordinator mounts `routes/tracking.php` and applies the migration. PHP execution was unavailable in this worker, so the new HTTP tests are handoff validation rather than a claimed local pass.

Coordinator integration notes: routes are now loaded by MobilityServiceProvider, migration2026_10_21_000200 extends the existing share projection and adds durable receipts. TrackingBoundary denies legacy public-token/start/read paths for tracking-controlled trips even when cohort middleware is disabled, and sets private/no-store headers on tracking/onboarding responses. Inputs reject unknown fields. The legacy recorded_at projection remains second precision; migration2026_10_21_000400 adds sample_recorded_at with millisecond precision. New ingestion stores exact milliseconds, rejects older/equal samples, and keeps distinct same-second samples ordered. Device tests remain pending.
