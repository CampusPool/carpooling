# Branch Coverage Report (Part-3 Deliverable 2.b.iv)

- **Project:** CampusPool — Collegiate Carpooling & Multi-Model Mobility Platform
- **Document Type:** Part-3 Deliverable `2.b.iv` — Control-Flow & Decision Branch Coverage Report
- **Measured Revision:** `main` (`7e82d12`)
- **Execution Date:** 16-11-2026 (`Asia/Kolkata`)
- **Prepared By:** Nikhil Suhas Joshi (`PES1UG24AM441`), Arjun Srikanth (`PES1UG24AM920`), Zayaan Ahmed (`PES1UG24AM457`), NITHESH (`PES1UG24AM443`)

---

## 1. Executive Summary

This Branch Coverage Report analyzes decision-point and conditional control-flow coverage (`if / else`, ternary expressions, short-circuit guards, `try / catch` error paths, SQL `IF ... THEN SIGNAL` / `CASE WHEN` branches, and MongoDB `$jsonSchema` validation branches) across **CampusPool v2.0**. Both the **True (Happy Path)** and **False (Guard / Rejection / Fallback Path)** outcomes of critical business, security, and concurrency invariants have been systematically exercised.

| Subsystem / Layer | Total Decision Branches | Covered Branches (True & False) | Branch Coverage (%) | Verification Runner |
| :--- | :---: | :---: | :---: | :--- |
| **Activity Projection Service (`services/activity-projection/src/`)** | 160 | 149 | **93.12%** | Node V8 Coverage (`node --test --experimental-test-coverage`) |
| **SQL Routines & Triggers (`migrations/`, `evidence.sql`)** | 28 | 28 | **100.00%** | `verify-dbms-level3.sh` & `verify-dbms-application.sh` |
| **MongoDB `$jsonSchema` & Index Validators (`mongo.js`)** | 16 | 16 | **100.00%** | `verify-dbms-level3.sh` & `projection.test.mjs` |
| **Frontend Components & Route Proxies (`frontend-next/`)** | 412 | 364 | **88.35%** | Vitest (`28` suites, `171` tests) + Node V8 (`pesu-client.test.mjs`) |
| **Backend Mobility Extension (`backend/extensions/carpoolear/`)** | 530 | 472 | **89.06%** | PHPUnit 10 (`32` suites, `444` tests) + Standalone Suites |
| **Platform Aggregate Branch Coverage** | **1,146** | **1,029** | **89.79%** | **All Automated Runners — PASS** |

---

## 2. Node V8 Branch Coverage Breakdown (`services/activity-projection` & `pesu-client.mjs`)

| Source File | Total Branches | Covered Branches | Branch % | Uncovered Edge Conditions |
| :--- | :---: | :---: | :---: | :--- |
| `services/activity-projection/src/server.mjs` | 40 | 38 | **95.00%** | OS socket `EADDRINUSE` fatal bind branch |
| `services/activity-projection/src/worker.mjs` | 28 | 26 | **92.86%** | Process `SIGTERM` mid-tick race branch |
| `services/activity-projection/src/projection.mjs` | 47 | 43 | **91.49%** | Defensive BSON driver fallback branches |
| `services/activity-projection/src/config.mjs` | 45 | 41 | **91.18%** | Optional env default branches |
| `frontend-next/lib/pesu-client.mjs` | 136 | 101 | **74.26%** | Upstream HTML legacy fallback regex branches |

---

## 3. Critical Decision & Guard Branch Coverage Matrix (True vs. False Paths)

### 3.1 Authentication, OTP & RBAC Security Branches (`CP-F-001`, `CP-SR-001`..`003`)

| Module & Decision Condition | True Branch (Taken & Verified) | False Branch (Taken & Verified) | Test Case Ref |
| :--- | :--- | :--- | :--- |
| **`OperatorAnalyticsController::show` L19:**<br>`if (!$actor \|\| !$actor->is_admin \|\| !$actor->active \|\| $actor->banned \|\| !$college)` | Returns `HTTP 403 OPERATOR_FORBIDDEN` for anonymous, student, inactive, or banned callers. | Proceeds to execute SQL analytics transaction for valid active admin. | `TC-OPER-01`, `TC-SEC-02` |
| **`AdminLoginThrottle`:**<br>`if ($attempts >= $maxAttempts)` | Returns `HTTP 429 LOGIN_RATE_LIMITED` and blocks brute-force password guessing. | Verifies `bcrypt` password hash and issues operator token. | `TC-AUTH-02`, `TC-SEC-03` |
| **`CollegeEmailAuth` OTP Check:**<br>`if ($otp->invalidated_at !== null \|\| $otp->expires_at < now())` | Rejects superseded or expired OTP code (`HTTP 422`). | Marks OTP verified and creates/authenticates student session. | `TC-AUTH-02` |
| **`pesu-client.mjs` Redirect Guard:**<br>`if (redirectUrl.origin !== allowedAcademyOrigin)` | Aborts request immediately before forwarding student credentials. | Follows same-origin redirect and parses timetable grid. | `TC-TIME-01`, `TC-SEC-05` |
| **`pesu-client.mjs` Stream Cap:**<br>`if (receivedBytes > 2 * 1024 * 1024)` | Destroys upstream stream and throws bounded size error. | Completes stream read and extracts class slots. | `TC-TIME-01` |

---

### 3.2 Same-Gender Matching, Vehicle Capacity & Routing Branches (`CP-F-004`..`009`)

| Module & Decision Condition | True Branch (Taken & Verified) | False Branch (Taken & Verified) | Test Case Ref |
| :--- | :--- | :--- | :--- |
| **`CommuteService` Symmetric Gender Filter:**<br>`if ($offer->same_gender_only \|\| $riderFilter->same_gender_only)` | Enforces `$driver->gender === $rider->gender` (`male`↔`male`, `female`↔`female`, `other`↔`other`). | Returns all route-compatible offers regardless of driver gender. | `TC-GEND-01` |
| **`DriverReservationPolicy` Capacity Check:**<br>`if ($type === 'bike' && $seats > 1) \|\| ($seats < 1 \|\| $seats > 4)` | Rejects invalid vehicle capacity with `HTTP 422`. | Persists `cars` record and sets `host_approved = 1`. | `TC-DRV-01` |
| **`OlaDirectionsClient` `< 1,000 m` Walk Check:**<br>`if ($pickupWalkMeters + $dropoffWalkMeters >= 1000)` | Prunes candidate meeting point as unwalkable; explains limit in UI. | Accepts meeting point and returns walking geometry + ETA. | `TC-DISC-01` |
| **`OsrmRouteProvider` Foot Snapping:**<br>`if ($snapDistanceMeters <= 250)` | Snaps pedestrian waypoint across wide Bengaluru arterial roads. | Rejects off-road coordinate (`> 250m`) with recoverable error. | `TC-DISC-01` (PR #93) |

---

### 3.3 Transactional Booking, Concurrency Lock & Cancellation Branches (`CP-F-010`..`012`)

| Module & Decision Condition | True Branch (Taken & Verified) | False Branch (Taken & Verified) | Test Case Ref |
| :--- | :--- | :--- | :--- |
| **Self-Booking Guard (`dbms_bookings_before_insert` & `SegmentBookingService`):**<br>`IF NEW.rider_id = ride_driver THEN` | Aborts insert with `SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'driver cannot book own ride'`. | Allows distinct student rider to create booking. | `TC-BOOK-01` |
| **Row-Locked Capacity Check (`dbms_book_ride` & `CommuteService`):**<br>`IF v_booked >= v_seats THEN` (under `SELECT ... FOR UPDATE`) | Rejects competing concurrent request with `ride is full` / `409 CAPACITY_EXHAUSTED`. | Commits `accepted` booking and decrements `available_seats`. | `TC-CAP-01` |
| **Cancellation Authorization Guard:**<br>`if ($actor->id !== $booking->user_id && $actor->id !== $trip->user_id)` | Rejects third-party cancellation with `HTTP 403`. | Transitions `request_state` to `3 (Cancelled)` and restores seat. | `TC-CANC-01` |

---

### 3.4 SQL Stored Functions, Procedures, Triggers & MongoDB Projection Branches (`CP-F-016`, `CP-NF-003`..`006`)

| Object & Decision Condition | True Branch (Taken & Verified) | False Branch (Taken & Verified) | Test Case Ref |
| :--- | :--- | :--- | :--- |
| **`mobility_utilization_pct(offered, accepted)`:**<br>`CASE WHEN offered > 0 THEN ROUND(100.0 * accepted / offered, 2) ELSE 0 END` | Computes exact percentage (e.g., `offered=4, accepted=3 -> 75.00`). | Safely returns `0.00` when `offered = 0` (prevents division-by-zero). | `TC-OPER-01` |
| **`dbms_shared_expense_per_rider(total, participants)`:**<br>`CASE WHEN p_participants = 0 THEN NULL ELSE CEIL(total / participants) END` | Returns `CEIL` minor-unit share (e.g., `15000 / 2 -> 7500`). | Returns `NULL` when `p_participants = 0`. | `TC-LIFE-01` |
| **`mobility_operator_daily(p_college, p_from, p_to)`:**<br>`IF p_college IS NULL OR p_from > p_to OR DATEDIFF(p_to, p_from) > 30 THEN` | Raises `SIGNAL SQLSTATE '45000' ('Invalid operator report window')`. | Executes `WITH RECURSIVE days` CTE and 7-day `AVG() OVER (...)` window. | `TC-OPER-01` |
| **`mobility_booking_decision_update` Trigger:**<br>`IF NEW.request_state IN (0,1,2,3) AND NOT (OLD.request_state <=> NEW.request_state)` | Appends microsecond UTC transition row to `mobility_booking_decision_events`. | Skips audit insert on no-op updates where `request_state` did not change. | `TC-OPER-01` |
| **`OperatorAnalyticsController::activity()` Timeout / Outage Branch:**<br>`if (!$response->successful() \|\| !in_array($status, ['ready', 'stale']))` | Degrades gracefully to `status: "unavailable"`, preserving SQL analytics. | Returns validated MongoDB daily event & unique trip counts (`status: "ready"`). | `TC-PROJ-01` |
| **MongoDB `$jsonSchema` Validator (`activity` collection):**<br>`required: ["sourceEventId", "action"], enum: [...]` | Accepts valid BSON lifecycle documents (`publish`, `accept`, `cancel`, `complete`). | Rejects invalid types or unknown action strings with `MongoServerError Code 121`. | `TC-PROJ-01` |
