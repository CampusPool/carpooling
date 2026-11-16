# Software Test Plan (STP) & Updated Test Case Specification

- **Project:** CampusPool — Collegiate Carpooling & Multi-Model Mobility Platform
- **Version:** 2.0 (Sprint-1, Sprint-2 & Sprint-3 Reconciled Test Plan & Cases)
- **Authors:**
  - Nikhil Suhas Joshi (`PES1UG24AM441` — QA & Traceability Lead)
  - Arjun Srikanth (`PES1UG24AM920` — Backend & Concurrency Testing)
  - Zayaan Ahmed (`PES1UG24AM457` — Frontend & Interaction Testing)
  - NITHESH (`PES1UG24AM443` — SQL & MongoDB Verification Testing)
- **Date:** 16-11-2026
- **Status:** Final / Executed & Verified
- **Repository:** [https://github.com/CampusPool/carpooling](https://github.com/CampusPool/carpooling)

---

## 1. Introduction

- **Purpose:** This document defines the comprehensive Software Test Plan (STP) and updated Test Case Specification for **CampusPool v2.0** following the IEEE 829 / ISO/IEC/IEEE 29119 standard. It outlines testing objectives, scope, multi-layer strategy, security validation protocols, test environments, schedule, responsibilities, traceability to `SRS.md` (`v2.0`), and the complete set of **16 updated test cases** reflecting all changes across Sprint 1, Sprint 2, and Sprint 3.
- **Scope:** Testing covers all functional and non-functional modules of CampusPool:
  1. Student email OTP/password authentication and local role/gender account registration.
  2. Streamlined 4-field driver onboarding, 10-car demo catalogue, and capacity bounds (`bike=1`, `car<=4`).
  3. Ride offer publication, Ola Maps & OSRM route quotes, `<1,000 m` walking path validation, campus pickup zones, and symmetric same-gender discovery.
  4. Transactional seat booking, self-booking prevention, `SELECT ... FOR UPDATE` last-seat concurrency protection, and cancellation capacity restoration.
  5. Trip lifecycle progression, participant-scoped chat, post-ride ratings, rider safety check, and transient PES Academy timetable import.
  6. Dual-database Operator Analytics (`/admin`, MySQL views/functions/procedures/triggers, and MongoDB `$jsonSchema` validation + `$group`/`$sum` aggregation).
- **References:**
  - [Software Requirements Specification (`SRS.md`)](./SRS.md)
  - [Software Architecture & Design Specification (`SAD.md`)](./SAD.md)
  - [Agile Backlog & Sprint Execution Plan (`Agile_Backlog_and_Sprint_Plan.md`)](./Agile_Backlog_and_Sprint_Plan.md)
- **Definitions:**
  - **STP:** Software Test Plan | **RTM:** Requirements Traceability Matrix | **UAT:** User Acceptance Testing | **SUT:** System Under Test.

---

## 2. Test Items

1. **Frontend Client & Server Proxy Module (`frontend-next/`):**
   - `app/page.tsx`, `StudentSignIn.tsx`, `LocalAccountSignIn.tsx`, `DriverOnboarding.tsx`, `LiveCarpool.tsx`, `AddressRides.tsx`, `CanonicalPool.tsx`, `PesTimetable.tsx`, `RideConversation.tsx`, `RideSafety.tsx`, `RideRating.tsx`, `AdminConsole.tsx`, `OperatorAnalytics.tsx`.
   - Server-side route handlers: `app/api/ola/*`, `app/api/pes-timetable/route.js`, `lib/pesu-client.mjs`, `lib/ola-server.ts`, `lib/legacy-api.ts`.
2. **Backend Laravel Mobility Extension (`backend/extensions/carpoolear/`):**
   - Identity & Trust controllers/services (`LocalAccountController`, `CollegeEmailAuthController`, `StudentPasswordAuth`, `DriverOnboardingController`, `DemoVehicle`).
   - Commute, Routing & Booking services (`CommuteController`, `CommuteService`, `CommuteMatchingService`, `AddressRideController`, `OlaDirectionsClient`, `OsrmRouteProvider`, `SegmentBookingService`, `PickupController`).
   - Lifecycle, Safety & Operator controllers (`TripLifecycleService`, `TripCommunicationController`, `StudentSafetyController`, `OperatorAnalyticsController`, `OperatorDatabaseHealthController`).
3. **Relational Database Layer (`MySQL 8.0 / InnoDB`):**
   - Migrations (`2026_11_05_000100_create_operator_database_reports.php`, student/OTP/safety/timetable migrations) and course verification fixtures (`docs/dbms/evidence.sql`, `docs/dbms/level3/walkthrough.sql`).
   - Installed SQL objects: `mobility_operator_ride_facts` (view), `mobility_utilization_pct` (function), `mobility_operator_daily` (procedure), `mobility_booking_decision_insert`/`update` (triggers).
4. **NoSQL Activity Projection Microservice (`services/activity-projection/`):**
   - `src/service.mjs`, MongoDB 7.0 `mobility_activity_events` / `activity` collection, `$jsonSchema` validator, unique `sourceEventId_1` index, and `/daily` aggregation pipeline (`docs/dbms/level3/mongo.js`).

---

## 3. Features to be Tested

All features are mapped directly to `SRS.md` requirement IDs:
- **`CP-F-001` & `CP-F-002`:** Student registration, institutional email OTP verification/invalidation, password login, role (`rider`/`driver`) and gender (`male`/`female`/`other`) persistence, and token revocation.
- **`CP-F-003`:** Student profile viewing/updating and trusted safety contact configuration.
- **`CP-F-004` & `CP-F-005`:** 4-field driver onboarding, 10-car demo catalogue selection, and passenger capacity enforcement (`seats_total > 0`, `bike = 1`, `car <= 4`).
- **`CP-F-006`, `CP-F-007` & `CP-F-008`:** Ride offer publication, Ola Maps & OSRM route quote generation, `< 1,000 m` combined walking distance enforcement, and campus pickup-zone discovery.
- **`CP-F-009`:** Symmetric same-gender ride matching (`same_gender_only` toggle for both rider and driver).
- **`CP-F-010`, `CP-F-011` & `CP-F-012`:** Seat booking request, driver self-booking rejection, `SELECT ... FOR UPDATE` concurrent last-seat race safety, and booking cancellation with automatic seat restoration.
- **`CP-F-013` & `CP-F-014`:** Trip lifecycle state transitions (`planned` → `active` → `completed`/`cancelled`), double-entry demo ledger postings, participant-scoped chat, 1–5 star ride ratings, and trusted-contact safety check alerts.
- **`CP-F-015`:** Transient PES Academy timetable import preview, conflict resolution, and explicit MySQL save.
- **`CP-F-016`:** Dual-database Operator Analytics (`/admin`, 7/14/31-day SQL view/procedure/trigger reports + MongoDB `$group`/`$sum` aggregation).
- **`CP-NF-001` – `CP-NF-008`:** Login/search latency (`p90 <= 2,000 ms`), 12-way concurrency safety, MongoDB outage fault isolation, idempotency/replay safety, microsecond trigger audit timestamps, engine-level SQL/NoSQL schema constraints, responsive accessibility, and CI reproducibility.

---

## 4. Features Not to be Tested

- **Live Banking / UPI Payment Gateways:** Excluded by classroom policy; cost-shares use synthetic minor-unit ledger postings (`mobility_financial_postings`, `dbms_ledger_entries`).
- **Physical Telecom SMS Gateways:** Replaced by deterministic local/email OTP verification fixtures (`scripts/verify-college-otp.sh`) for repeatable automated testing.
- **Physical Multi-Phone Hardware GPS Field Trials:** Route geometries and walking distances are verified using deterministic Bengaluru coordinates against Ola Maps and OSRM routing engines (`#82`).
- **Upstream Third-Party Infrastructure Internals:** Internal implementation of external Ola Maps cloud servers or PES Academy upstream servers (tested via contract/proxy boundary mocks and bounded live smoke checks).

---

## 5. Test Approach / Strategy

- **Testing Levels:**
  1. **Unit & Domain Testing:** Component-level tests in Vitest (`frontend-next/tests/*.test.jsx`), Node native test runner (`pesu-client.test.mjs`, `services/activity-projection/test/*.test.mjs`), and standalone PHP domain verifiers (`RouteSegmentMatcherStandalone.php`, `WeeklySchedulePreviewStandalone.php`).
  2. **Integration Testing:** Controller-to-database tests in PHPUnit 10 (`backend/extensions/carpoolear/tests/*Test.php`) and disposable SQL/MongoDB verifiers (`scripts/verify-dbms-level3.sh`, `scripts/verify-dbms-application.sh`).
  3. **System & Concurrency Validation:** Full HTTP lifecycle smoke tests (`run-smoke.sh`), 12-worker concurrent last-seat race tests, and latency benchmarks (`scripts/benchmark-http.py`).
  4. **Acceptance & UI Interaction Testing:** Real-DOM user interaction suites (`@testing-library/react` over `jsdom`) and real-browser E2E smoke runs.
- **Entry Criteria:** Clean repository checkout, dependencies installed (`npm ci` / `composer install`), disposable MySQL 8.0 and MongoDB 7.0 containers healthy.
- **Exit Criteria:** 100% of planned test cases executed, `0` critical/high defects open, all SRS requirements (`CP-F-001`..`CP-F-016`, `CP-NF-001`..`CP-NF-008`, `CP-SR-001`..`CP-SR-006`) verified as `PASS`.

---

### 5.1 Security Validation

Dedicated security testing verifies every control defined in `SRS.md` Section 5.1 and `SAD.md` Section 3.9:
1. **Password Hashing & Secret Redaction (`CP-SR-001`):** Verify that user and operator passwords are stored strictly as `bcrypt` hashes, login responses omit sensitive fields, and `pesu-client.mjs` / `activity-projection` never log or leak credentials even during network exceptions (`pesu-client.test.mjs`, `projection.test.mjs`).
2. **RBAC & Participant Ownership Enforcement (`CP-SR-002`):** Execute unauthenticated (`HTTP 401`) and cross-role/cross-user (`HTTP 403`) probes against `/api/mobility/operator/analytics`, `/api/mobility/operator/dbms/health`, booking cancellation, and trip chat (`MobilityCohortSecurityTest.php`, `MobilityOperatorDatabaseHealthHttpTest.php`).
3. **Brute-Force & OTP Rate-Limiting (`CP-SR-003`):** Trigger repeated failed login and OTP verification attempts to verify `AdminLoginThrottle` (`HTTP 429 LOGIN_RATE_LIMITED`) and automatic invalidation of superseded OTP codes (`CollegeEmailOtpSecurityTest.php`).
4. **Private NoSQL Network, Key Auth & Injection Rejection (`CP-SR-004`):** Probe `services/activity-projection` without `X-Mobility-Analytics-Key` or with malformed/injectable JSON query objects, confirming immediate rejection before querying MongoDB (`projection.test.mjs`).
5. **SSRF, Cross-Origin Redirect & Stream-Size Guards (`CP-SR-005`):** Verify that `pesu-client.mjs` rejects cross-origin redirects before forwarding credentials, enforces the `4,096`-byte request limit, and aborts upstream responses exceeding `2 MB` (`pesu-client.test.mjs`, `pes-timetable-route.test.jsx`).
6. **Cache-Control & Session Isolation (`CP-SR-006`):** Verify `Cache-Control: private, no-store, max-age=0` headers on operator responses and confirm that switching tokens in `OperatorAnalytics.tsx` / `AdminConsole.tsx` clears prior account state (`operator-analytics.interaction.test.jsx`).

---

## 6. Test Environment

- **Hardware / Host OS:** macOS / Linux x86_64 & ARM64 developer workstations and GitHub Actions Ubuntu runners.
- **Containerized Stack:** Docker Compose running MySQL 8.0.36 (`InnoDB`), MongoDB 7.0 (`mongosh`), PHP 8.2 / Laravel 11, Nginx (`:18080`), Node.js 20+, and OSRM (`car`, `bike`, `foot`).
- **Testing Tools:** Vitest `5.0.5`, `@testing-library/react`, Node `--test`, PHPUnit `10`, Python `benchmark-http.py`, and POSIX shell verification harnesses (`verify-dbms-level3.sh`, `verify-dbms-application.sh`).
- **Test Data:** Deterministic synthetic student accounts, 10-car demo vehicle catalogue, 200-offer Bengaluru benchmark dataset, and isolated `dbms_evidence_*` databases.

---

## 7. Test Schedule

| Milestone | Planned Window | Actual Status |
| :--- | :--- | :---: |
| **Phase 1: Initial Test Plan & Baseline Cases** | 12-Oct-2026 – 16-Oct-2026 | Completed |
| **Phase 2: Sprint-1 Execution & Core Booking Tests** | 19-Oct-2026 – 23-Oct-2026 | Completed |
| **Phase 3: Sprint-2 Execution, Same-Gender & DBMS Level-3 Tests** | 26-Oct-2026 – 30-Oct-2026 | Completed |
| **Phase 4: Sprint-3 Test Case Updation (Ola, OTP, Safety, Timetable)** | 02-Nov-2026 – 14-Nov-2026 | Completed |
| **Phase 5: Final Regression, Coverage & Report Generation** | 15-Nov-2026 – 16-Nov-2026 | Completed & Frozen |

---

## 8. Test Deliverables

All test deliverables are checked into the repository under [`docs_updated/`](./):
1. **Software Test Plan & Updated Test Cases (`STP_and_Test_Cases.md`)** — *this document*.
2. **Unit Test Report (`Unit_Test_Report.md`)** — Part-3 Deliverable `2.b.i`.
3. **System Validation Report (`System_Validation_Report.md`)** — Part-3 Deliverable `2.b.ii`.
4. **Code Coverage Report (`Code_Coverage_Report.md`)** — Part-3 Deliverable `2.b.iii`.
5. **Branch Coverage Report (`Branch_Coverage_Report.md`)** — Part-3 Deliverable `2.b.iv`.

---

## 9. Roles and Responsibilities

| Role | Team Member | SRN | Testing Responsibilities |
| :--- | :--- | :--- | :--- |
| **QA & Traceability Lead** | Nikhil Suhas Joshi | `PES1UG24AM441` | STP authorship, RTM alignment, discovery/pickup tests, performance benchmarks (`#41`, `#43`) |
| **Backend & Concurrency Engineer** | Arjun Srikanth | `PES1UG24AM920` | Booking transaction tests, `FOR UPDATE` race harness, Ola & OTP integration tests (`#84`, `#88`, `#100`) |
| **Frontend & Interaction Engineer** | Zayaan Ahmed | `PES1UG24AM457` | Vitest UI interaction suites, same-gender matching, driver onboarding & pedestrian snap tests (`#87`, `#93`) |
| **Database & NoSQL Verification Lead** | NITHESH | `PES1UG24AM443` | MySQL 3NF constraint/trigger/procedure verifiers & MongoDB `$jsonSchema`/RUD/aggregation tests (`#83`, `#85`) |

---

## 10. Risks and Mitigation

| Risk | Mitigation Implemented |
| :--- | :--- |
| **Shared database volume collision during smoke runs** | Harnesses generate unique disposable Compose project/database names (`dbms_evidence_<pid>`) and tear down cleanly. |
| **External map/routing rate limits or flakiness in CI** | Unit/CI suites use deterministic contract mocks and offline road fixtures while live Ola routing is verified in dedicated acceptance suites. |
| **Parallel `jsdom` worker contention in Vitest** | Configured deterministic per-file execution (`--fileParallelism=false`) achieving 28/28 passing suites (`171/171` tests). |

---

## 11. Assumptions & Dependencies

- Docker daemon and Node.js 20+ are available in the execution environment.
- Disposable test databases (`DBMS_EVIDENCE_ALLOW_DISPOSABLE=1`) are used for destructive DDL/rollback assertions so preserved demo environments are never overwritten.

---

## 12. Suspension & Resumption Criteria

- **Suspension Criteria:** Suspend test execution if Docker container startup fails, migration baseline fails to apply, or a blocking defect prevents authentication (`CP-F-001`).
- **Resumption Criteria:** Resume testing once container health checks pass (`mysqladmin ping`, `mongosh --eval "db.runCommand({ ping: 1 })"`) and blocking migration/auth fixes are committed.

---

## 13. Test Case Management, Traceability & Updated Sprint Test Cases

> **Compliance Note:** Below are **16 comprehensive, sprint-updated Test Cases (`TC-AUTH-01` through `TC-CI-01`)** covering all Functional Requirements, Non-Functional Requirements, Security Requirements, and Sprint-1/2/3 updates (exceeding the checklist minimum of 7–10 test cases).

### 13.1 Summary Traceability Matrix (SRS ↔ Test Cases)

| Test Case ID | SRS Req ID(s) | Sprint Origin / Update | Automated Test File(s) | Result |
| :--- | :--- | :--- | :--- | :---: |
| **TC-AUTH-01** | `CP-F-001`, `CP-SR-001` | Sprint 1 (Updated Sprint 2 for Gender) | `LocalAccountAuthTest.php`, `LocalAccountSignIn.interaction.test.jsx` | **PASS** |
| **TC-AUTH-02** | `CP-F-001`, `CP-F-002`, `CP-SR-003` | Sprint 3 (Student Email OTP & Password) | `CollegeEmailAuthRegistrationTest.php`, `CollegeEmailOtpSecurityTest.php`, `student-signin.interaction.test.jsx` | **PASS** |
| **TC-PROF-01** | `CP-F-003` | Sprint 3 (Student Profile & Preferences) | `student-landing.interaction.test.jsx`, `unit/student-email.test.jsx` | **PASS** |
| **TC-DRV-01** | `CP-F-004`, `CP-F-005` | Sprint 1 (Updated Sprint 2 4-Field Setup) | `onboarding.interaction.test.jsx`, `driver.interaction.test.jsx` | **PASS** |
| **TC-PUB-01** | `CP-F-006`, `CP-F-007` | Sprint 1 (Updated Sprint 3 Ola Address Rides) | `MobilityPoolOfferHttpTest.php`, `address-rides.interaction.test.jsx`, `OlaDirectionsClientTest.php` | **PASS** |
| **TC-DISC-01** | `CP-F-007`, `CP-F-008` | Sprint 1 (Updated Sprint 2/3 `<1km` Walk & Zones) | `MobilityOfferDiscoveryTest.php`, `MobilityPickupAgreementTest.php`, `ola-canonical.interaction.test.jsx` | **PASS** |
| **TC-GEND-01** | `CP-F-009` | Sprint 2 (Symmetric Same-Gender Matching) | `live-carpool.interaction.test.jsx`, `MobilityCommuteProductTest.php` | **PASS** |
| **TC-BOOK-01** | `CP-F-010`, `CP-NF-006` | Sprint 1 (Seat Request & Self-Booking Guard) | `MobilitySegmentBookingTest.php`, `issue-23-booking-interaction.test.jsx`, `evidence.sql` | **PASS** |
| **TC-CAP-01** | `CP-F-011`, `CP-NF-002` | Sprint 1/2 (`FOR UPDATE` 12-Way Concurrency Race) | `RouteSegmentMatcherStandalone.php`, `verify-dbms-level3.sh` | **PASS** |
| **TC-CANC-01** | `CP-F-012` | Sprint 1/2 (Cancellation & Seat Restoration) | `MobilityCommuteProductTest.php`, `page.interaction.test.jsx` | **PASS** |
| **TC-LIFE-01** | `CP-F-013`, `CP-NF-006` | Sprint 2 (Lifecycle & Double-Entry Ledger) | `verify-dbms-level3.sh`, `live-account-activity.interaction.test.jsx` | **PASS** |
| **TC-SAFE-01** | `CP-F-014` | Sprint 2/3 (Trip Chat, Ratings & Safety Check) | `MobilityTripCommunicationHttpTest.php`, `ride-conversation.interaction.test.jsx`, `ride-safety.interaction.test.jsx`, `ride-rating.interaction.test.jsx` | **PASS** |
| **TC-TIME-01** | `CP-F-015`, `CP-SR-005` | Sprint 3 (PES Academy Timetable Import & Guards) | `pesu-client.test.mjs`, `pes-timetable-route.test.jsx`, `pes-timetable.interaction.test.jsx`, `MobilityPesTimetableTest.php` | **PASS** |
| **TC-OPER-01** | `CP-F-016`, `CP-NF-005`, `CP-SR-002`, `CP-SR-006` | Sprint 2/3 (SQL View/Proc/Trigger & `/admin` Console) | `operator-analytics.interaction.test.jsx`, `admin-console.interaction.test.jsx`, `MobilityOperatorDatabaseHealthHttpTest.php` | **PASS** |
| **TC-PROJ-01** | `CP-F-016`, `CP-NF-003`, `CP-NF-004`, `CP-SR-004` | Sprint 2 (MongoDB `$jsonSchema`, Replay & Outage Isolation) | `services/activity-projection/test/projection.test.mjs`, `verify-dbms-application.sh` | **PASS** |
| **TC-PERF-01** | `CP-NF-001`, `CP-NF-007`, `CP-NF-008` | Sprint 3 (Latency Benchmark & CI Contract Verification) | `scripts/benchmark-http.py`, `tests/contract.test.mjs`, `tests/maps-loader.test.mjs` | **PASS** |

---

### 13.2 Detailed Updated Test Case Specifications

#### `TC-AUTH-01`: Local Account Registration, Role Assignment & Gender Normalization
- **SRS Ref:** `CP-F-001`, `CP-SR-001` | **Priority:** High
- **Preconditions:** Clean database; user is on `LocalAccountLanding` / `LocalAccountSignIn`.
- **Test Steps:**
  1. Submit registration with `username="zayaan_driver"`, `password="Secret123!"`, `role="driver"`, `gender="male"`.
  2. Attempt duplicate registration with `username="zayaan_driver"`.
  3. Inspect stored database row in `users` and `mobility_local_accounts`.
- **Expected Result:** Step 1 returns `201 Created` with JWT token and persists normalized `gender="male"` and `bcrypt` password hash. Step 2 returns `422 Unprocessable Entity` (`UNIQUE` username constraint).
- **Actual Result & Status:** **PASS** (`LocalAccountAuthTest.php` — 22 assertions; `LocalAccountSignIn.interaction.test.jsx` — 2/2 passed).

#### `TC-AUTH-02`: Institutional Student Email OTP Verification, Invalidation & Rate Limiting
- **SRS Ref:** `CP-F-001`, `CP-F-002`, `CP-SR-003` | **Priority:** High
- **Preconditions:** Student sign-in screen (`StudentSignIn.tsx`) configured for institutional domain.
- **Test Steps:**
  1. Request OTP for `student@pesu.pes.edu`; request a second OTP for the same email.
  2. Attempt verification using the first (superseded) OTP.
  3. Attempt verification using the second (latest) OTP and set student password.
  4. Exceed failed OTP/login attempt threshold.
- **Expected Result:** Step 2 fails (`OTP invalidated`). Step 3 succeeds and establishes an authenticated student session. Step 4 returns `HTTP 429` rate-limit error.
- **Actual Result & Status:** **PASS** (`CollegeEmailOtpSecurityTest.php`, `student-signin.interaction.test.jsx` — 9/9 passed).

#### `TC-PROF-01`: Student Profile & Domain Validation
- **SRS Ref:** `CP-F-003` | **Priority:** Medium
- **Test Steps:** Validate institutional student email formatting (`student-email.test.jsx`), render `StudentProfile.tsx`, and update ride preferences and trusted safety contact email.
- **Expected Result:** Valid PESU emails pass validation; non-institutional domains are rejected; profile updates persist in MySQL.
- **Actual Result & Status:** **PASS** (`unit/student-email.test.jsx` — 11/11 passed; `student-landing.interaction.test.jsx` — 1/1 passed).

#### `TC-DRV-01`: Streamlined 4-Field Driver Onboarding & Capacity Bounds
- **SRS Ref:** `CP-F-004`, `CP-F-005` | **Priority:** High
- **Preconditions:** Authenticated driver account without an approved vehicle.
- **Test Steps:**
  1. Open `DriverOnboarding.tsx` and submit `vehicle_number="KA05MN4570"`, `vehicle_type="car"`, `seat_capacity=3`, `license_number="KA0520240045701"`.
  2. Attempt submission with `vehicle_type="bike"` and `seat_capacity=3` (or `0` seats).
- **Expected Result:** Step 1 creates `cars` record, updates `users.nro_doc`, sets `host_approved=1`, and unlocks ride publication. Step 2 is rejected by validation and `CHECK (seats_total > 0)` constraints.
- **Actual Result & Status:** **PASS** (`onboarding.interaction.test.jsx` — 5/5 passed; `driver.interaction.test.jsx` — 19/19 passed).

#### `TC-PUB-01`: Commute & Ola Address-Ride Publication with Server-Side Static Map
- **SRS Ref:** `CP-F-006`, `CP-F-007`, `CP-SR-005` | **Priority:** High
- **Test Steps:**
  1. Select origin and destination in `AddressRides.tsx` / `LiveCarpool.tsx` using `OlaPlaceInput`.
  2. Fetch route quote and static map via `/api/ola/directions` and `/api/ola/static-map`.
  3. Publish ride offer with `seats_total=3`, `fare_minor=5000`.
- **Expected Result:** Ola route geometry and static map load without exposing `OLA_MAPS_API_KEY` to the browser; offer is persisted in `trips` and `mobility_commute_demo_trips`.
- **Actual Result & Status:** **PASS** (`address-rides.interaction.test.jsx` — 6/6 passed; `ola-static-map-route.test.jsx` — 2/2 passed; `MobilityOlaDirectionsClientTest.php`).

#### `TC-DISC-01`: Geospatial Discovery, Campus Pickup Zones & `< 1,000 m` Walking Limit
- **SRS Ref:** `CP-F-007`, `CP-F-008` | **Priority:** High
- **Test Steps:**
  1. Rider searches for rides to `PES Main Gate` within 15-minute departure window.
  2. Evaluate candidate ride with `340 m` combined walking distance vs. candidate with `1,450 m` walking distance.
- **Expected Result:** Candidate with `340 m` walk is returned with meeting point and walking geometry; candidate exceeding `1,000 m` combined walk is filtered out with clear explanation.
- **Actual Result & Status:** **PASS** (`ola-canonical.interaction.test.jsx` — 2/2 passed; `canonical-pool.interaction.test.jsx` — 7/7 passed; `MobilityPickupAgreementTest.php` — 36 assertions).

#### `TC-GEND-01`: Symmetric Same-Gender Ride Matching Filter
- **SRS Ref:** `CP-F-009` | **Priority:** High
- **Preconditions:** Male driver publishes Ride A (`same_gender_only=true`); Female driver publishes Ride B (`same_gender_only=false`).
- **Test Steps:**
  1. Female rider searches without filter → sees Ride B, does NOT see Ride A (driver restricted Ride A to male).
  2. Male rider enables "Same gender rides only" toggle → sees Ride A, does NOT see Ride B (rider restricted search to male drivers).
- **Expected Result:** Symmetric gender equality (`rider.gender === driver.gender`) is enforced whenever either party activates `same_gender_only`.
- **Actual Result & Status:** **PASS** (`live-carpool.interaction.test.jsx` — 19/19 passed; `CommuteService.php`).

#### `TC-BOOK-01`: Seat Booking Request & Driver Self-Booking Trigger Rejection
- **SRS Ref:** `CP-F-010`, `CP-NF-006` | **Priority:** High
- **Test Steps:**
  1. Rider submits `POST /api/mobility/commute/bookings` for Ride 10.
  2. Driver of Ride 10 attempts to book a seat on their own Ride 10.
- **Expected Result:** Step 1 creates `trip_passengers` (`request_state=0`). Step 2 is rejected by service guard and MySQL trigger `dbms_bookings_before_insert` (`SIGNAL SQLSTATE '45000': driver cannot book own ride`).
- **Actual Result & Status:** **PASS** (`issue-23-booking-interaction.test.jsx` — 1/1 passed; `verify-dbms-level3.sh` — PASS).

#### `TC-CAP-01`: Concurrent Last-Seat Race Condition Protection (`SELECT ... FOR UPDATE`)
- **SRS Ref:** `CP-F-011`, `CP-NF-002` | **Priority:** High
- **Preconditions:** Ride has `seats_total = 2` and `1` seat already accepted (`1` seat remaining).
- **Test Steps:** Dispatch parallel competing seat-acceptance transactions for the final seat.
- **Expected Result:** InnoDB `SELECT ... FOR UPDATE` serializes the lock; exactly `1` booking transitions to `accepted` (`request_state = 1`) and all competing requests fail with `ride is full` / `409 CAPACITY_EXHAUSTED`. `accepted_seats` never exceeds `seats_total`.
- **Actual Result & Status:** **PASS** (`RouteSegmentMatcherStandalone.php` — 12/12 assertions passed; `verify-dbms-level3.sh` — PASS).

#### `TC-CANC-01`: Booking Cancellation & Automatic Seat Restoration
- **SRS Ref:** `CP-F-012` | **Priority:** High
- **Test Steps:**
  1. Unrelated third-party user attempts to cancel Booking 88.
  2. Authorized rider cancels Booking 88 (`request_state = 1 -> 3`).
- **Expected Result:** Step 1 fails with `HTTP 403`. Step 2 transitions `request_state` to `3 (Cancelled)`, fires `mobility_booking_decision_update` trigger, and increments `available_seats` by `1`.
- **Actual Result & Status:** **PASS** (`MobilityCommuteProductTest.php` — 46 assertions; `page.interaction.test.jsx` — 31/31 passed).

#### `TC-LIFE-01`: Trip Lifecycle Progression & Double-Entry Demo Ledger Postings
- **SRS Ref:** `CP-F-013`, `CP-NF-006` | **Priority:** High
- **Test Steps:** Progress trip from `planned` → `active` → `completed` and inspect `mobility_financial_postings` / `dbms_ledger_entries` and `dbms_shared_expense_per_rider(15000, 2)`.
- **Expected Result:** Stored function returns `7500`; balanced `debit` (`15000`) and `credit` (`15000`) entries are recorded; zero or negative amounts are rejected by `CHECK (amount_minor > 0)`.
- **Actual Result & Status:** **PASS** (`live-account-activity.interaction.test.jsx` — 5/5 passed; `verify-dbms-level3.sh` — PASS).

#### `TC-SAFE-01`: Participant-Scoped Chat, Post-Ride Ratings & Trusted-Contact Safety Check
- **SRS Ref:** `CP-F-014`, `CP-SR-002` | **Priority:** Medium
- **Test Steps:**
  1. Exchange messages in `RideConversation.tsx` between driver and accepted rider; test user blocking.
  2. Trigger `RideSafety.tsx` emergency safety check during an active ride.
  3. Submit 5-star rating and feedback in `RideRating.tsx` after trip completion.
- **Expected Result:** Chat messages deliver only to trip participants; safety check dispatches alert to trusted contact; rating persists and updates driver score.
- **Actual Result & Status:** **PASS** (`ride-conversation.interaction.test.jsx` — 4/4; `ride-safety.interaction.test.jsx` — 2/2; `ride-rating.interaction.test.jsx` — 3/3 passed).

#### `TC-TIME-01`: Transient PES Academy Timetable Import, Parser Security & Save
- **SRS Ref:** `CP-F-015`, `CP-SR-005` | **Priority:** Medium
- **Test Steps:**
  1. Test `pesu-client.mjs` with valid single-line scripts, slot alternatives, cross-origin redirects, failed auth, verification challenges, and responses exceeding `2 MB`.
  2. Preview imported slots in `PesTimetable.tsx`, select elective slot alternative, and click "Save imported timetable".
- **Expected Result:** Cross-origin redirects and `> 2 MB` streams abort immediately; credentials never appear in error messages; previewed timetable saves to MySQL only after explicit user confirmation.
- **Actual Result & Status:** **PASS** (`pesu-client.test.mjs` — 10/10; `pes-timetable-route.test.jsx` — 6/6; `pes-timetable.interaction.test.jsx` — 3/3 passed).

#### `TC-OPER-01`: Operator Control Center, SQL View/Procedure/Trigger Audit & RBAC
- **SRS Ref:** `CP-F-016`, `CP-NF-005`, `CP-SR-002`, `CP-SR-006` | **Priority:** High
- **Test Steps:**
  1. Request `/api/mobility/operator/analytics?days=7` as non-admin student (`HTTP 403`).
  2. Authenticate on `/admin` (`AdminConsole.tsx`) and load 7-day and 14-day windows in `OperatorAnalytics.tsx`.
  3. Verify output of `mobility_operator_ride_facts`, `CALL mobility_operator_daily`, and `mobility_booking_decision_events`.
- **Expected Result:** Non-admins receive `403 OPERATOR_FORBIDDEN`. Operator receives preaggregated summary, 7-day rolling averages (with zero-ride days filled by `WITH RECURSIVE`), and microsecond UTC trigger audit entries with `Cache-Control: private, no-store, max-age=0`.
- **Actual Result & Status:** **PASS** (`operator-analytics.interaction.test.jsx` — 11/11; `admin-console.interaction.test.jsx` — 5/5 passed).

#### `TC-PROJ-01`: MongoDB `$jsonSchema` Validation, Idempotent Replay, Aggregation & Outage Isolation
- **SRS Ref:** `CP-F-016`, `CP-NF-003`, `CP-NF-004`, `CP-NF-006`, `CP-SR-004` | **Priority:** High
- **Test Steps:**
  1. Attempt inserting malformed document into MongoDB `activity` collection (rejected with `Code 121`).
  2. Replay identical `sourceEventId` twice (idempotent upsert / `Code 11000` unique index enforcement).
  3. Execute 4-stage `/daily` aggregation pipeline (`$match` → `$group` → `$project` → `$sort`).
  4. Simulate MongoDB outage and verify `OperatorAnalyticsController` returns SQL metrics with `activity.status = "unavailable"`.
- **Expected Result:** All 17 microservice assertions and 18 `verify-dbms-level3.sh` checks pass; SQL analytics remain 100% available during Mongo outage.
- **Actual Result & Status:** **PASS** (`services/activity-projection/test/projection.test.mjs` — 17/17 passed).

#### `TC-PERF-01`: Login & Search Latency Benchmark (`p90 <= 2,000 ms`) & Contract Suite
- **SRS Ref:** `CP-NF-001`, `CP-NF-008` | **Priority:** High
- **Test Steps:** Run `scripts/benchmark-http.py` against 200 published offers and inspect `EXPLAIN ANALYZE` on search query.
- **Expected Result:** `/api/login` `p90 = 22.0 ms` (`<= 2000 ms`), `/api/mobility/commute/search` `p90 = 46.1 ms` (`<= 2000 ms`), SQL indexed join `= 1.12 ms`.
- **Actual Result & Status:** **PASS** (`docs/PERFORMANCE_BENCHMARK.md`, `contract.test.mjs`, `maps-loader.test.mjs` — PASS).

---

## 14. Test Metrics & Reporting

- **Total Automated Test Cases Executed:**
  - **Frontend Unit, Route & Interaction Tests:** `28` Vitest suites (`171` tests) + `10` Node PESU Client tests + `2` Contract/Maps-Loader suites = **`183` frontend checks (100% PASS)**.
  - **Activity Projection (Node.js + MongoDB) Tests:** **`17` tests (100% PASS)**.
  - **Backend PHPUnit & Standalone Domain Tests:** **`444` PHPUnit tests (`3,621+` assertions, 2 skipped)** + **`25` standalone matcher/schedule assertions (100% PASS)**.
  - **DBMS Level-3 SQL & MongoDB Verifiers:** **`18` end-to-end relational & NoSQL assertions (100% PASS)**.
- **Requirement Coverage:** `30 / 30` SRS Requirements (`16` FRs + `8` NFRs + `6` SRs) = **`100%` Requirement Traceability Coverage**.
- **Defect Density:** `0` open critical or high-severity defects at development freeze.

---

## 15. Approvals

| Role | Name | SRN / GitHub Handle | Signature / Date |
| :--- | :--- | :--- | :--- |
| QA Lead | Nikhil Suhas Joshi | `PES1UG24AM441` (`@NikhilJoshi441`) | Signed — 16-11-2026 |
| Dev & Runtime Lead | Arjun Srikanth | `PES1UG24AM920` (`@arjunsrikanthh`) | Signed — 16-11-2026 |
| Frontend Lead | Zayaan Ahmed | `PES1UG24AM457` (`@zayaan-06`) | Signed — 16-11-2026 |
| Database Lead | NITHESH | `PES1UG24AM443` (`@NitheshMogaveer777`) | Signed — 16-11-2026 |
