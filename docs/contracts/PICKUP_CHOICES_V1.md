# Driver pickup choices — V1 design contract

20 October 2026. User requirement; implementation and device acceptance are pending. The suggested2–4public landmarks were test examples. Bengaluru coverage must support rider-selected locations rather than restrict the product to those examples.

## Visible behavior

A driver can choose **Direct pickup** or **Meet along my route**. Direct pickup previews travel to the rider-selected location and the added road distance/time. The on-route choice shows proposed meeting points, pedestrian access distance/time and driver detour. Both car and motorbike remain supported, across scheduled/recurring pooling and on-demand workflows.

A rider's original request can already consent to direct pickup at its exact location/version. A changed meeting point requires the rider to confirm that exact proposal; the driver cannot silently change it. Show the location on the map with pickup-side/access information where known. Present a calculated best candidate as best among evaluated candidates; do not promise a global shortest route without exhaustive evidence. Missing walking/access information leaves the meeting option unavailable rather than substituting a straight-line distance.

## Provider and terms dependencies

The current trusted catalog/quote/segment/dispatch implementation is a foundation, not this feature. Real car/motorbike road graphs now have separate identities. A separate pedestrian graph/provider, versioned road geometry, server-validated rider origin and driver route/location revisions, and candidate access/stopping evidence are still required. Motorbike/car routing and OSRM driving nearest do not prove walkability, legal stopping, safe crossings or current conditions.

Store immutable option previews binding rider origin revision, driver route revision/progress, mode/date, provider/profile/map identities, meeting point, walking metrics, driver detour metrics, expiry and fare terms. Compute external routes before admission transactions; then lock and recheck the exact revisions/eligibility/capacity before confirmation/assignment. Location updates invalidate the affected previews. Keep precise origins restricted to authorized parties; discovery results must not reveal another rider's private origin.

For on-route proposals, generate candidates in the untravelled portion of the driver's route and evaluate pedestrian paths plus mode-specific driver access/detour. Rank eligible candidates by the shortest pedestrian route from the rider, exposing driver detour separately. Rider walking preference and driver detour preference must be explicit inputs or an explicitly approved policy; no operating threshold or detour surcharge has been approved. Retain ties deterministically and show alternatives where metrics trade off. Inaccessible/unreachable, stale, expired or unconfirmed proposals cannot create a booking. OSM access tags supply evidence but cannot certify a real stopping place.

## Canonical integration

Scheduled pooling keeps its canonical dated Trip/Passenger and interval-capacity authority. A direct pickup that changes the host route must produce a new route proposal/version and recalculate affected intervals; it cannot silently rewrite existing accepted passengers' terms or a recurring series. Preserve accepted booking recovery and per-date isolation. A recurring program's new route choices apply only through explicit future terms; published occurrence terms remain immutable.

On-demand keeps its canonical request/offer/assignment uniqueness and DispatchCanonicalFactory authority. Extend its current exact catalog-point matching through confirmed pickup proposals; do not reuse the scheduled segment matcher as a second dispatch authority. Concurrent confirmations, cancellation, expiry and worker retries must converge on at most one canonical assignment. Preserve money/fare snapshots; changed pickup terms cannot silently reprice a booked trip.

## Required proof before completion

Direct and on-route choices for each mode; map/profile mismatch and pedestrian outage; a nearby straight-line point that needs a longer pedestrian route; inaccessible crossing/private road; behind-driver candidate exclusion; deterministic ties and bounds; changed rider/driver route revisions; two-party consent/replay/cancellation/expiry races; unchanged accepted bookings and recurring dates; exact canonical capacity/fare/quote linkage; browser and two-phone reconnect/arrival acceptance. Real provider metrics, software fixtures and physically checked journeys must remain separately labeled.

## Local implementation checkpoint

Separate shortest-distance pedestrian graph, full path provider and private versioned plan/origin/preview API now have local software proof. Direct detour and pedestrian-ranked best among at most4evaluated route candidates are computed for car/bike. Client comparison forms are coded/static-checked. This does not finish the feature: map selection/discovery, live progress, access validation, consent, canonical scheduled/on-demand integration, recurring route edits, browser and physical journeys remain required. Preview `booking_enabled` remains false until those authority changes are implemented and verified.
