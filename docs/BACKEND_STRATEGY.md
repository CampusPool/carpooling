# Mobility backend strategy

Proposal - 17 October 2026. Product ambition: a complete, working, improved Hopr experience with a backend designed for demanding mobility operations. Uber/Rapido are quality and capability benchmarks; their traffic scale is not an achieved or assumed capacity claim. No stack or cloud expenditure is authorized by this document.

> Subsequent user direction: evaluate reusable, independently runnable open-source/licensed mobility backends before selecting a custom implementation. The stack below is a fallback/proposal, not a decision to build everything ourselves. A candidate must pass feature/API fit, recurring carpool and segment-capacity checks, reproducible deployment/tests, maintainability, license fit and operating-cost review. Namma Yatri is a primary-source research lead, not a selected or locally verified base: https://github.com/nammayatri/nammayatri . Managed authentication, database and realtime products can support either approach but do not replace the full mobility domain logic.

## Product model

REA investigation and authorized observation should determine Hopr's external behaviors, client contracts and feature inventory. Backend rules must also be specified independently wherever client evidence is insufficient. Keep observed, inferred, designed and verified behavior distinct. Existing CampusPool course issues do not control scope.

Keep two fulfillment policies separate if both are included in the product:

- Carpooling: a host already has an itinerary; match by departure window, stop order, direction, acceptable detour, vehicle and capacity on each overlapping route segment. Recurring schedules create individually identifiable trip occurrences.
- On-demand ride-hailing: riders request transport now; consider available eligible drivers, pickup ETA and destination constraints; dispatch expiring offers, handle acceptance races, reassignment and cancellation.

Share identity, vehicle, trip, payment, communications and safety capabilities. Preserve separate business policies for cost-sharing versus commercial fares, host acceptance versus dispatch, and scheduled versus immediate fulfillment. Referencing Uber or Rapido does not by itself select on-demand ride-hailing as launch scope.

## Domain ownership

| Domain | Owned behavior and important rules |
| --- | --- |
| Identity and trust | Rider/host/driver accounts, sessions, verification, vehicle eligibility, permissions, administrative audit and account restrictions. |
| Supply and location | Availability sessions, timestamps/sequence numbers, location freshness, current position and dispatch eligibility. An offline driver cannot receive a valid new assignment. |
| Discovery and dispatch | Geospatial candidates, routing/ETA estimates, eligibility filters, ranking explanations, offer expiry and reassignment. A suggestion never guarantees availability at commit time. |
| Fulfillment | Ride requests, itineraries, ordered stops, seat reservations, assignments, trip progress, no-shows and cancellations. This is the authority for active work and capacity. |
| Pricing and money | Versioned quotes, allocation rules, currency/minor units, rounding, provider transactions, refunds, payout eligibility, reconciliation and an auditable ledger. |
| Communications | Participant-authorized chat, delivery/read states, push/SMS, retry and notification preferences. Push receipt is not trip confirmation. |
| Safety and support | Reports, blocking, consented trip sharing, incident records, evidence access and staffed escalation procedures. UI labels must match the actual response service. |
| Operations and growth | Support/admin tools, provider health, fraud signals, referral rules, marketplace metrics and auditable manual interventions. |

## Starting implementation and deployment

Recommended starting topology: an edge/load balancer; stateless API instances serving a modular transactional core; asynchronous workers; and a separately scalable real-time/location gateway. Rider, host/driver and operations clients call authenticated APIs. Modules own their tables and mutations; avoid arbitrary cross-module writes.

Proposed defaults, to validate through a small implementation and team capability check:

- TypeScript with NestJS for the core API and workers if maintainable by the team. Isolate CPU-heavy routing/matching from request handlers. Go is a candidate for a separately measured location/dispatch bottleneck, not a mandatory second language.
- PostgreSQL plus PostGIS for transactional and spatial data. Keep initial writes in one region with managed high availability. Index actual query shapes and benchmark them. No requirement to retain MongoDB from the former course plan.
- Redis for expendable current-location indexes, presence, caching and rate controls when needed. Durable assignment, seat, financial and expiry decisions remain in authoritative storage; Redis loss must not corrupt them.
- A managed durable queue for asynchronous work, with transactional outbox publication, bounded retries, dead-letter handling and idempotent consumers. Delayed work must survive process restart.
- Object storage for appropriately protected documents and incident attachments, using scoped access and explicit retention policies.
- REST/OpenAPI for commands and snapshots; authenticated WebSockets for live events, with push as a supplementary delivery channel. Use typed, versioned event contracts.
- Provider adapters for maps/routing, verification, payments and messaging. Select providers after region, commercial access, pricing and sandbox behavior are known. Stripe documentation below illustrates failure semantics; it is not a provider selection.

Deploy with infrastructure as code, isolated development/staging/production, managed secrets, reproducible builds, compatible database migrations and rollback/roll-forward procedures. Add Kubernetes, Kafka or further service splits only for explicit operational, throughput or team-ownership requirements. A modular core plus separate workers/gateway does not establish a particular traffic capacity; measure it.

## Correctness and failure behavior

### Trip and booking authority

Specify separate state machines for ride request, trip, driver availability, dispatch offer, reservation and payment. Each transition has an actor, precondition, version check, mutation and event. Never infer payment success from a client screen.

- Confirm capacity and booking together in a SQL transaction. For pooled multi-stop rides, enforce capacity on every affected route segment.
- On-demand assignment acceptance must atomically ensure the offer is live, the request is unassigned and the driver can take the itinerary. Two workers cannot assign the same exclusive request twice. Pooled riders can share one compatible assigned itinerary.
- Give expiring offers/reservations durable deadlines; recheck deadlines during acceptance. Recover timers after restart. Cancellation racing with acceptance has one valid serialized outcome.
- Store an idempotency key scoped to principal/operation, request fingerprint and result. A replay returns the original result; a reused key with a different payload fails clearly. Document retention.
- Persist the business mutation and an outbox event in the same transaction. Retried publication must not duplicate business effects. External systems require explicit compensating/recovery actions; a SQL transaction does not cover a payment provider.

### Location and reconnection

Treat GPS as a noisy, delayed observation. Track source timestamp, receipt time, sequence, accuracy and freshness. Reject or quarantine impossible/out-of-order updates under a documented policy. Do not offer a stale or disconnected driver as freshly available.

Authorize location subscriptions per trip and participant. On reconnect, clients fetch an authoritative snapshot and then resume versioned events, detecting gaps and duplicates. Persist only the location history needed for defined product/support purposes; do not synchronously append every GPS point to the main booking tables.

### Money

Use a balanced, auditable double-entry ledger for actual funds/obligations, with compensating entries rather than destructive edits. Distinguish quote, authorization, capture, refund, payout and settlement states. Where money moves, reconcile internal records against provider records; manual contribution receipts must remain clearly distinct.

Verify webhook authenticity, deduplicate events, tolerate out-of-order arrival and reconcile pending transactions after outages. Payment success after reservation expiry is a required recovery scenario. A timeout is an unknown outcome until reconciled, not proof that no charge happened.

## Capacity and operating objectives

Write a workload model before claiming scale. Count online drivers, simultaneous trips, search/booking requests per second, GPS update rate, real-time fan-out, data retention, provider quotas and peak/burst distribution. Example sizing input only: 10,000 drivers sending every 5 seconds produce 2,000 incoming location updates per second, before rider updates or outbound fan-out. This is not tested capacity.

Proposed first operating targets, subject to budget, baseline and explicit workload definition:

- 99.9% monthly availability for named critical APIs; define valid requests, measurement point and exclusions. Establish an error budget and operating owner.
- p95 internal booking/acceptance processing below 500 ms and p95 search below 1 second at the agreed load. Record external routing/provider latency and full end-to-end latency separately; do not hide it in exclusions.
- Healthy foreground trip-location updates visible within a proposed p95 of 3 seconds on the defined network/device test profile; visibly stale data on degraded networks. Background and disconnected behavior have separate contracts.
- No oversold segments, incompatible duplicate driver assignments or unbalanced ledger transactions in acceptance/failure tests. These are correctness requirements, not percentile targets.
- Document and test recovery point/time objectives, managed database failover and backup restoration. Choose numerical recovery commitments after infrastructure is selected; backups alone do not prove recoverability.

Instrument traces, structured redacted logs and metrics for booking failures, state-transition failures, dispatch expiries, location age, queue lag, provider errors, financial discrepancies and cost per trip. Alert on user impact. Maintain runbooks and on-call/support ownership before a real-user pilot.

## Validation and delivery

1. Investigate Hopr and build a versioned behavioral/API inventory. In parallel, define invariants, lifecycle models and the workload model. Hidden backend behavior remains an explicit design choice.
2. Deliver an independently running end-to-end journey across clients, backend, database and operations view: account -> offer/request -> match/assignment -> pickup -> trip -> completion/cancellation -> contribution or sandbox financial record. This is an integration milestone within the complete product, not the final scope.
3. Complete the agreed Hopr feature inventory and product improvements, including recurrence, communications, safety, support and financial workflows. Keep provider mocks clearly labeled.
4. Exercise races, deadlocks/retries, duplicated commands, out-of-order events, expired offers, reconnects, provider timeouts, worker crashes, queue backlog and database failover. Specifically kill a worker after committing a booking but before publishing its notification.
5. Test payment success after client timeout, webhook before API response, duplicate refund requests, reservation expiry before payment completion, partial provider outage and reconciliation after restoration.
6. Load-test the declared workload, a burst profile and a sustained soak. Include realistic geographic concentration and popular-route contention rather than uniform random data only. Document bottlenecks, actual results, operating cost and tested limits.
7. Run a controlled geographic pilot with genuine supply, support and incident response; expand by measured reliability, marketplace outcomes and cost. Scale real-time gateways/workers separately, then extract dispatch/location/other modules where evidence justifies it.

National/global multi-region operation needs explicit ownership of trips across regions, partition/failover behavior, financial consistency and geographic data obligations. Do not add active-active transactional writes without a demonstrated requirement and validated consistency model.

## Engineering references

These support selected design principles, not an assertion about Hopr's private implementation or the latest complete architecture of Uber/Rapido.

- [Uber fulfillment rearchitecture, 2021](https://www.uber.com/us/en/blog/fulfillment-platform-rearchitecture/): entity lifecycle modeling, concurrent multi-entity writes, consistency and operational concerns.
- [Uber H3](https://www.uber.com/qa/en/blog/h3/): geospatial indexing for candidate grouping; a grid index does not supply road routing or ETA by itself.
- [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html): row-level coordination and deadlock considerations.
- [PostGIS spatial data and indexing](https://postgis.net/docs/using_postgis_dbmanagement.html): spatial types/indexes for query design.
- [AWS transactional outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html): database/event publication consistency and duplicate delivery handling.
- [Stripe webhook documentation](https://docs.stripe.com/webhooks): signatures, retries, event ordering and duplicate event handling.
