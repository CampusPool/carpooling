# Private journey contract v2 — implementation in progress

Existing pickup agreements remain pickup-only and never become bookings retroactively. A booking-capable quote must bind both rider endpoints, both walking legs, vehicle leg and complete driver route, exact source revisions and exact demo pricing. Canonical Trip/Passenger, route_quotes, interval inventory and dispatch assignments remain the only respective authorities.

## Routing and walking

Use independently controlled road graphs for server routing; Google map/place/address results remain browser-session content. Do not persist Google place names, formatted addresses, route geometry or raw responses. Store user-selected coordinate endpoints only through the explicit private endpoint contract, with source/expiry. Never insert private endpoints into nodes_geo, global autocomplete or a public route cache. Exact endpoint retention and redaction must be implemented before enabling persistent Google-derived locations.

Compatibility means an ordered portion of the driver's baseline route, with bounded detour distance/time after including both rider pickup and destination. Geometric projection shortlists candidates only. Routed pedestrian paths establish distance; arbitrary nearest points do not establish safe access. Both access and egress, conservative endpoint snap gaps and pedestrian/vehicle handoff gaps count toward the rider's total integer budget (0–999m). No option is bookable when paths are absent, graph versions differ, the budget is exceeded or access acknowledgement is absent. Access remains unverified for physical safety/legal stopping.

Driver explicitly selects DIRECT_RIDER_PICKUP or ON_ROUTE_MEETING_POINT. Recompute complete driver start→pickup→dropoff→driver end outside admission locks; do not reuse pickup-only detour or charge approach distance as the rider leg. Driver and rider bind the exact new itinerary hash. Lower walking preferences apply equally to both choices.

## Pricing and consent

Configurable integer INR-minor demo policy only; explicitly not an agreed production tariff. Base fare derives solely from occupied routed vehicle leg; direct pickup adds a separately displayed positive surcharge paid to the driver. Meeting surcharge is zero. Snapshot policy/version/rate/base/surcharge/total and exact route/source hashes. Client supplies no fare or geometry. Exact rider consent follows driver selection and precedes canonical request/booking. Pickup/destination/route/price changes create a new quote and invalidate affected pending consent. Preserve immutable accepted Passenger/interval/fare/route obligations; never mutate earlier recurring occurrences.

## Canonical integration acceptance

Actor-private endpoints and quote parser precede admission. Scheduled uses OfferService and SegmentBookingService/RouteTerms; on-demand extends DispatchTerms, DispatchService and DispatchCanonicalFactory. Private snapshots cannot be consumed by legacy catalog, recurrence or another source. Provider calls occur before locks. Existing actual lock order is authoritative; admission must not introduce a reverse lock edge to canonical lifecycle/payment paths.

TCP/JWT/database checks must prove exact quote/source/Trip/Passenger/interval/assignment links, atomic last-seat/exclusive driver, retry identity, supersession/revocation/expiry races, rollback, unchanged existing accepted obligations, and no precise private point in unrelated search/catalog/public/live-link output. Browser and Android screen-locked device checks remain distinct.
