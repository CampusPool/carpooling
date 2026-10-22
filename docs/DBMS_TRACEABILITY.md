# DBMS Level 3 — requirement-to-implementation traceability

**Source:** `DBMS Level 3 Project Requirements (1).pdf` (five pages). This is a plan, **not proof of implementation**. The current baseline is Laravel 12/MySQL; earlier PostgreSQL/Next.js assumptions are superseded.

| Instructor requirement | Proposed CampusPool evidence | Linked issue(s) |
|---|---|---|
| Meaningful beyond-CRUD problem | Commute route/time matching, capacity-safe booking, ride and cost analytics | 3.2, 3.5, 4.3, 7.1 |
| Two database paradigms | MySQL authoritative transactional state + MongoDB activity/notification documents | N1, N5 |
| ER diagram / relational schema | Student, role, vehicle, ride, seat request, booking, contribution, report; PKs/FKs/cardinality | N1 |
| SQL DDL CREATE/ALTER/DROP, keys and constraints | Versioned SQL migration scripts with appropriate checks and indexes | N1, N2 |
| SQL DML and JOIN/GROUP BY/HAVING/subqueries | Ride search, seats remaining, utilization by campus, users with repeated ride activity | 4.2, 5.5, N1 |
| ≥4 advanced SQL concepts | Transactions, views, stored functions, triggers and indexing (demonstrate at least four) | N2, 4.3, N6, 7.1 |
| ≥1 NoSQL/vector advanced concept | MongoDB aggregation pipeline over ride events/notifications, plus indexes | N5, 6.1 |
| Mandatory Next.js web UI through backend/API; current Laravel/browser baseline is incomplete for this criterion | Responsive interface, protected routes, DB adapters | N7, 1.1–4.4 |
| Backend login and ≥2 roles | Verified student role and authenticated administrator role | 1.3, N3 |
| Database-level validation | CHECK, FK, UNIQUE, transaction isolation, prevention of self-booking | N2 |
| Docs and demonstration | ERD/schema, data dictionary, DB choices, important queries, architecture, screenshots, tests and team contributions | N8, N9 |

## Proposed database ownership
**MySQL:** authoritative students, hashed platform credentials/session references, vehicles, rides, booking requests, bookings, contribution records, reports and ratings. Ride booking/cancellation **must be atomic in SQL**; do not keep independent seat counts in MongoDB.

**MongoDB:** append-only ride event stream, in-app notification documents, optionally chat messages (stretch). Reference SQL primary keys and document indexes. Demonstrate at least one aggregation such as counts of confirmed rides/notifications by event type and campus.

## Recommended relational invariants
- Uniqueness: normalized verified student email, SRN (as permitted).
- Vehicle type drives allowed seats; bike cannot advertise more than one passenger seat.
- Students cannot book their own rides; confirmed seats cannot exceed capacity.
- Booking status, ride status and payment receipt transitions are controlled.
- Access to sensitive address/route and incident details is minimized and role-checked.

## Sample assessed SQL demonstrations
1. **Transaction:** concurrent booking attempts for the last seat; only one confirms, other remains pending/waitlisted.
2. **View:** active available rides with remaining capacity, future departures and campus.
3. **Stored function:** return estimated passenger contribution using a documented shared-expense formula.
4. **Trigger or constraints:** enforce ride/booking invariants and audit important changes.
5. **Index:** show `EXPLAIN ANALYZE` for date/campus/departure range search.
6. **MongoDB aggregation:** group ride notifications/events by type and day.

## Administrative and originality requirements
Official DBMS brief specifies an approved two-person team; **both members must contribute to database and application code**. The four-person SE responsibility roster in the Sprint plan must not be represented as that approved DBMS pair. Confirm the pair and obtain explicit instructor acceptance for any course reuse/originality position before submission. Use original designs and distinct problem framing rather than copied ride-hailing repositories.

**Current evidence:** MySQL migrations and focused booking tests exist in the private prototype. The assessed ERD, relational schema/data dictionary, DDL/DML demonstrations, four advanced SQL examples and MongoDB aggregation remain incomplete or unverified; source presence and test counts do not satisfy those deliverables.
