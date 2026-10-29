# MobilityPlatform SRS — current engineering draft

This is a working draft for the MobilityPlatform course package. It is not teacher-approved and does not claim production readiness. The product covers scheduled and recurring carpooling plus on-demand work in a local synthetic environment. Timetable import, class-schedule integration and timetable-based matching are explicitly excluded.

## Actors and boundaries

Riders, drivers, participants and operators use a Next.js client over a Laravel API. MySQL remains authoritative for identity, vehicles, offers, bookings, lifecycle and synthetic credit records. A downstream MongoDB projection supports activity replay and aggregation. Email verification, live payment settlement, physical GPS/two-phone networking, OS push and public deployment remain deferred or unverified.

## Current functional requirements

| ID | Requirement | Current evidence and limitation |
| --- | --- | --- |
| FR-01 | Authenticate rider/driver sessions | Synthetic local sessions are implemented and tested; real email delivery is unverified. |
| FR-02 | Review driver vehicle/documents | Manual correction and approval paths exist; current browser capture remains open. |
| FR-03 | Publish and search dated offers | Synthetic publication/search and capacity behavior are tested; provider-backed map visuals remain open. |
| FR-04 | Request, accept/reject and cancel | Quote consent, request, acceptance, cancellation and seat restoration are tested; waitlist browser proof remains open. |
| FR-05 | Preserve lifecycle and capacity invariants | Transactional and concurrency checks exist; physical device acceptance remains open. |
| FR-06 | Project selected lifecycle activity to MongoDB | Isolated projection/replay checks exist; the preserved pilot is not enabled. |
| FR-07 | Provide course evidence | Draft SRS, architecture, test plan and traceability exist; the Sprint 1 demo recording is included; screenshots, the Sprint 2 recording, review and approval remain pending. |

Synthetic accounts, routes, credits, holds and receipts must be labelled as demo records. No live money, identity verification or Hopr parity claim follows from this draft.
