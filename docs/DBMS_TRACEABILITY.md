# DBMS Level 3 traceability

Source: `DBMS Level 3 Project Requirements (1).pdf` (five pages). This table defines planned evidence; it does not establish completed implementation. MySQL is the current relational authority.

| Requirement | Planned CampusPool evidence | Issues |
|---|---|---|
| Meaningful beyond-CRUD problem | Route/time matching, capacity-safe booking and ride/cost analytics | 3.2, 3.5, 4.3, 7.1 |
| Two database paradigms | MySQL transactional state plus MongoDB activity/notification documents | N1, N5 |
| ERD and relational schema | Student, role, vehicle, ride, request, booking, contribution and report entities | N1 |
| DDL, keys and constraints | Versioned migrations with checks and indexes | N1, N2 |
| DML, joins, grouping and subqueries | Ride search, remaining seats, campus utilization and repeat activity queries | 4.2, 5.5, N1 |
| At least four advanced SQL concepts | Transaction, view, stored function, trigger and index demonstrations | N2, 4.3, N6, 7.1 |
| NoSQL or vector concept | MongoDB event/notification aggregation and indexes | N5, 6.1 |
| Next.js web UI through an API | Responsive client and protected routes over documented adapters | N7, 1.1–4.4 |
| Login and two roles | Verified student and administrator roles | 1.3, N3 |
| Database validation | CHECK, FK, UNIQUE, transaction isolation and self-booking prevention | N2 |
| Documentation and demonstration | ERD, data dictionary, query set, architecture, screenshots, tests and contribution records | N8, N9 |

## Database ownership

MySQL owns credentials/session references, vehicles, rides, bookings, capacity, contributions, reports and ratings. MongoDB may store append-only events, notifications and (if approved) chat messages, referencing SQL primary keys. Seat and payment state must remain in MySQL.

## Demonstrations

1. Concurrent last-seat booking: one transaction confirms and the other remains pending or waitlisted.
2. View of active rides with remaining capacity and future departures.
3. Stored function for a documented shared-expense estimate.
4. Trigger or constraints for booking/lifecycle invariants and audit fields.
5. `EXPLAIN ANALYZE` for date, campus and departure-range search.
6. MongoDB aggregation grouped by event type and day.

The focused prototype evidence covers MySQL migrations and booking behavior. The assessed ERD, data dictionary, four advanced SQL demonstrations and MongoDB aggregation remain to be completed and reviewed.

## Course requirements

The DBMS brief specifies an approved two-person team, and both members must contribute to database and application code. That pair is separate from the four-person SE responsibility roster in `SPRINT_PLAN.md`. Confirm the pair and the instructor's position on reuse and originality before submission.
