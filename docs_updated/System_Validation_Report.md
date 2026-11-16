# System Validation Report (Part-3 Deliverable 2.b.ii)

- **Project:** CampusPool — Collegiate Carpooling & Multi-Model Mobility Platform
- **Document Type:** Part-3 Deliverable `2.b.ii` — End-to-End System Validation Report
- **Validated Revision:** `main` (`7e82d12`)
- **Validation Date:** 16-11-2026 (`Asia/Kolkata`)
- **Prepared By:** Arjun Srikanth (`PES1UG24AM920`), Nikhil Suhas Joshi (`PES1UG24AM441`), Zayaan Ahmed (`PES1UG24AM457`), NITHESH (`PES1UG24AM443`)
- **System Validation Verdict:** **PASSED (30 / 30 SRS Requirements Verified)**

---

## 1. Executive Summary

This System Validation Report certifies that **CampusPool v2.0** satisfies all **16 Functional Requirements (`CP-F-001`..`CP-F-016`)**, **8 Non-Functional Requirements (`CP-NF-001`..`CP-NF-008`)**, and **6 Security Requirements (`CP-SR-001`..`CP-SR-006`)** defined in [`SRS.md`](./SRS.md), as well as all DBMS Level-3 multi-model evaluation criteria across **MySQL 8.0 (InnoDB)** and **MongoDB 7.0**.

| Validation Dimension | Total Requirements / Checks | Verified Pass | Failed | Compliance Rate |
| :--- | :---: | :---: | :---: | :---: |
| **Functional Requirements (`CP-F-001`..`CP-F-016`)** | 16 | 16 | 0 | **100.0%** |
| **Non-Functional Requirements (`CP-NF-001`..`CP-NF-008`)** | 8 | 8 | 0 | **100.0%** |
| **Security Requirements (`CP-SR-001`..`CP-SR-006`)** | 6 | 6 | 0 | **100.0%** |
| **DBMS Level-3 Verifier (`verify-dbms-level3.sh`)** | 18 | 18 | 0 | **100.0%** |
| **Application Multi-DB Verifier (`verify-dbms-application.sh`)** | 14 | 14 | 0 | **100.0%** |
| **Admin Control Center Smoke (`campuspool-admin-smoke.py`)** | 16 | 16 | 0 | **100.0%** |

---

## 2. Functional Requirements System Validation (`CP-F-001` – `CP-F-016`)

| Req ID | System Capability Validated | Validation Method & Observed System Output | Verdict |
| :--- | :--- | :--- | :---: |
| **CP-F-001** | Student OTP/password & local role/gender registration | Verified via `POST /api/mobility/local-accounts/register` & `/api/mobility/college-auth/*`; creates `users` + `mobility_local_accounts` with normalized `role` and `gender`. | **PASS** |
| **CP-F-002** | OTP invalidation & session token revocation | Re-requesting OTP invalidates prior code (`CollegeEmailOtpSecurityTest`); sign-out revokes bearer token (`HTTP 401` on reuse). | **PASS** |
| **CP-F-003** | Student profile & safety contact management | Updated display name, gender preference, and trusted safety contact email via `StudentProfile.tsx`; verified in `GET /api/mobility/commute/me`. | **PASS** |
| **CP-F-004** | 4-field driver onboarding & 10-car demo catalogue | Submitted vehicle number, type (`car`/`bike`), seats, and license in `DriverOnboarding.tsx`; auto-sets `host_approved = 1` in `mobility_memberships`. | **PASS** |
| **CP-F-005** | Vehicle passenger capacity enforcement | Confirmed `bike` rejects `> 1` seat and `car` rejects `0` or `> 4` seats at both Laravel validation (`HTTP 422`) and MySQL `CHECK (seats_total > 0)` (`SQL Error 3819`). | **PASS** |
| **CP-F-006** | Publish dated & address-based commute offers | Published offers from Banashankari / Whitefield to PES University RR Campus; verified rows in `trips`, `mobility_commute_demo_trips`, and `mobility_trip_lifecycles`. | **PASS** |
| **CP-F-007** | Ola Maps & OSRM route quotes + `<1km` walk limit | Verified route polyline, distance, duration, static map proxy (`/api/ola/static-map`), and `< 1,000 m` combined walking distance enforcement (`300m–340m` match accepted; `>1000m` rejected). | **PASS** |
| **CP-F-008** | Campus pickup-zone & time-window discovery | Verified discovery against campus gates (`PES Main Gate`, `Library Turnaround`, `Metro Footbridge Bay`) within 15-minute departure tolerance. | **PASS** |
| **CP-F-009** | Symmetric same-gender ride matching | Toggled "Same gender rides only" in `LiveCarpool.tsx`; verified `CommuteService.php` enforces `driver.gender === rider.gender` whenever either party enables the flag. | **PASS** |
| **CP-F-010** | Seat booking request & self-booking block | Rider seat request inserts `trip_passengers` (`request_state = 0`); driver attempting to book own ride fails with `HTTP 422` / trigger `SIGNAL SQLSTATE '45000'`. | **PASS** |
| **CP-F-011** | Row-locked (`FOR UPDATE`) atomic seat acceptance | Executed 12 concurrent competing requests on a 1-seat-remaining ride; InnoDB `SELECT ... FOR UPDATE` allowed exactly `1` acceptance and rejected `11` with zero overbooking. | **PASS** |
| **CP-F-012** | Booking cancellation & seat restoration | Cancelled accepted booking (`request_state: 1 -> 3`); verified `available_seats` incremented by `1` in `mobility_operator_ride_facts`. | **PASS** |
| **CP-F-013** | Trip lifecycle progression & demo double-entry ledger | Transitioned trip `planned` → `active` → `completed`; verified balanced `debit` and `credit` postings in `mobility_financial_postings` & `dbms_ledger_entries`. | **PASS** |
| **CP-F-014** | Scoped trip chat, reminders, ratings & safety check | Verified participant-only chat (`RideConversation`), `Asia/Kolkata` reminders, 1–5 star ratings (`RideRating`), and trusted-contact emergency alert (`RideSafety`). | **PASS** |
| **CP-F-015** | Transient PES Academy timetable preview & save | Verified `POST /api/pes-timetable` parses weekly slots into a preview grid without overwriting saved classes until user clicks "Save imported timetable". | **PASS** |
| **CP-F-016** | Dual-DB Operator Analytics & `/admin` Control Center | Verified `/admin` (`AdminConsole.tsx`) and `GET /api/mobility/operator/analytics?days=7|14|31` returning SQL summary, 7-day rolling averages, trigger audit rows, and MongoDB daily counts. | **PASS** |

---

## 3. Non-Functional & Performance System Validation (`CP-NF-001` – `CP-NF-008`)

### 3.1 HTTP Latency & SQL Execution Plan Benchmark (`CP-NF-001`)
Executed via `python3 scripts/benchmark-http.py` against a seeded dataset of **200 published driver offers** and **40 student accounts**:

| Endpoint / Operation | SRS Target (`p90`) | Measured `p50` | Measured `p90` | Measured `p99` | Verdict |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `POST /api/login` (Authentication) | $\le 2,000\text{ ms}$ | `21.1 ms` | **`22.0 ms`** | `24.8 ms` | **PASS (90x faster than target)** |
| `GET /api/mobility/commute/search` (Discovery) | $\le 2,000\text{ ms}$ | `43.9 ms` | **`46.1 ms`** | `51.4 ms` | **PASS (43x faster than target)** |
| MySQL Indexed Search Join (`EXPLAIN ANALYZE`) | $\le 10\text{ ms}$ | `1.12 ms` | **`1.12 ms`** | `1.35 ms` | **PASS (vs. `138.4 ms` unindexed scan)** |

### 3.2 Concurrency, Fault Isolation & Schema Integrity (`CP-NF-002` – `CP-NF-008`)
- **Concurrency (`CP-NF-002`):** Verified 0 overbooked rides (`over_capacity_rides = 0` in `mobility_operator_ride_facts`) across 71-step HTTP hardened journey and 12-worker race harness.
- **Fault Isolation (`CP-NF-003`):** Stopped the `activity-projection` / MongoDB container and called `GET /api/mobility/operator/analytics?days=7`. The endpoint responded in `< 2.1 s` with `HTTP 200 OK`, returning full MySQL summary, 7-day rolling averages, and trigger audit logs while setting `activity.status = "unavailable"`.
- **Idempotency (`CP-NF-004`):** Re-sent identical `Idempotency-Key` booking mutations and re-ran full zero-to-latest SQL-to-MongoDB event replay; `sourceEventId_1` unique index guaranteed zero duplicate documents.
- **Trigger Temporal Precision (`CP-NF-005`):** Inspected `mobility_booking_decision_events.occurred_at`, confirming `DATETIME(6)` UTC microsecond timestamps (e.g., `2026-11-16T06:30:12.441820Z`) written inside the same booking transaction.

---

## 4. Multi-Model DBMS Level-3 System Validation (`MySQL 8.0` + `MongoDB 7.0`)

Executed via `sh scripts/verify-dbms-level3.sh` and `sh scripts/verify-dbms-application.sh`:

| Database Engine | Feature / Object Validated | Verification Check Performed | Result |
| :--- | :--- | :--- | :---: |
| **MySQL 8.0** | 3NF DDL & Referential Integrity | Created `dbms_users`, `dbms_rides`, `dbms_bookings`, `dbms_expenses`, `dbms_ledger_entries` + production `mobility_*` tables with `FOREIGN KEY ... ON DELETE CASCADE / SET NULL`. | **PASS** |
| **MySQL 8.0** | Domain `CHECK` & `UNIQUE` Constraints | Verified `ck_dbms_rides_seats` (`seats_total > 0`), `ck_dbms_rides_route` (`origin <> destination`), and `uq_dbms_booking_identity` reject invalid rows (`Error 3819` / `1062`). | **PASS** |
| **MySQL 8.0** | Preaggregated Relational View | Queried `mobility_operator_ride_facts` & `dbms_active_rides`; confirmed preaggregated passenger subquery prevents join fan-out. | **PASS** |
| **MySQL 8.0** | Deterministic Stored Functions | Verified `mobility_utilization_pct(4, 3) -> 75.00`, `mobility_utilization_pct(0, 0) -> 0.00`, and `dbms_shared_expense_per_rider(15000, 2) -> 7500`. | **PASS** |
| **MySQL 8.0** | Stored Procedures + Recursive CTE + Window Function | Executed `CALL mobility_operator_daily('pes', '2026-11-10', '2026-11-16')` (synthesizes missing dates via `WITH RECURSIVE` and computes 7-day rolling `AVG(rides) OVER (...)`) and `CALL dbms_book_ride(...)`. | **PASS** |
| **MySQL 8.0** | `BEFORE` & `AFTER` Database Triggers | Verified `dbms_bookings_before_insert` blocks driver self-booking (`SQLSTATE 45000`) and `mobility_booking_decision_insert`/`update` populate `mobility_booking_decision_events`. | **PASS** |
| **MongoDB 7.0** | Strict `$jsonSchema` Validation | Attempted inserting document with invalid `action` enum into `activity`; rejected by MongoDB with `MongoServerError: Document failed validation (Code 121)`. | **PASS** |
| **MongoDB 7.0** | Unique & Compound Indexes | Verified `sourceEventId_1` (`unique: true`, rejects duplicates with `Code 11000`), `occurredAt_1_action_1`, and `tripId_1_occurredAt_1`. | **PASS** |
| **MongoDB 7.0** | RUD Operations & 4-Stage Aggregation Pipeline | Verified `insertMany`, `find` with projection/sort, `updateOne` (`$set: { reviewed: true }`), `deleteMany`, and `aggregate([$match, $group, $project, $sort])`. | **PASS** |

---

## 5. Security Validation Summary (`CP-SR-001` – `CP-SR-006`)

- **Authentication & Password Storage (`CP-SR-001`):** Verified `bcrypt` hashing on all student and operator passwords; zero plaintext credentials in DB or logs.
- **RBAC & Participant Isolation (`CP-SR-002`):** Verified 16/16 checks in `campuspool-admin-smoke.py` and `MobilityCohortSecurityTest.php`—anonymous and student-role tokens receive `HTTP 401/403` on all 7 operator feeds and unrelated trip chats.
- **Rate Limiting (`CP-SR-003`):** Verified `AdminLoginThrottle` blocks repeated bad passwords with `HTTP 429`.
- **Private NoSQL Service & Proxy Guards (`CP-SR-004`, `CP-SR-005`, `CP-SR-006`):** Confirmed `X-Mobility-Analytics-Key` enforcement, cross-origin redirect rejection in `pesu-client.mjs`, server-side Ola key isolation, and `Cache-Control: private, no-store, max-age=0` headers.
