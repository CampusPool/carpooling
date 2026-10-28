# MobilityPlatform DBMS report — current working draft

This report is a course-facing engineering draft. It is not a teacher-approved submission and does not claim live payment, pilot deployment or production readiness.

## Problem and data authority

The product connects a dated driver offer to a compatible rider while preserving quoted terms, preventing overselling and recording lifecycle history. Laravel and MySQL are the transactional authority for users, vehicles, offers, bookings, lifecycle and synthetic credit records. A separate MongoDB process projects selected lifecycle events for replay and aggregation; it is downstream and not a booking authority.

## SQL evidence boundaries

Application migrations and feature tests cover constraints, authorization, transactions, locking and lifecycle state. The course package also contains namespaced disposable SQL teaching objects for views, procedures/functions, triggers, indexes and query walkthroughs. Those objects are illustrations and must not be described as installed application schema. Run them only in a fresh disposable database. Actual analytics are read-only and fixture-scoped where stated.

## NoSQL evidence boundaries

The isolated activity projection demonstrates repeatable-read extraction, source-event idempotency, redaction and aggregation. It has not been enabled against the preserved pilot. Actor and trip identifiers remain linkable and require restricted access and a retention decision.

## Recorded evidence and open gates

Automated SQL/Mongo and application checks exist, and one isolated synthetic browser journey recorded publication, search, quote consent, request, acceptance, cancellation, seat restoration and history refresh at revision `47e8ee5`. Maps configuration was unavailable during that earlier journey. The separate Sprint 1 recording in `media/sprint-1-mobility-demo.mp4` shows a later locally configured demo; no screenshot package is included. Instructor approval, genuine review, contribution records, waitlist/rating browser evidence, final SQL walkthrough outputs and course submission remain pending.

Timetable integration is excluded. Email verification, live settlement, physical GPS/two-phone acceptance and OS push are deferred or unverified. Synthetic accounts, credits, holds and receipts are demo records only.
