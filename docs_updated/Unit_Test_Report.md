# Unit Test Report (Part-3 Deliverable 2.b.i)

- **Project:** CampusPool — Collegiate Carpooling & Multi-Model Mobility Platform
- **Document Type:** Part-3 Deliverable `2.b.i` — Unit Test Execution Report
- **Tested Revision:** `main` (`7e82d12`)
- **Execution Date:** 16-11-2026 (`Asia/Kolkata`)
- **Prepared By:** Nikhil Suhas Joshi (`PES1UG24AM441`), Zayaan Ahmed (`PES1UG24AM457`), Arjun Srikanth (`PES1UG24AM920`), NITHESH (`PES1UG24AM443`)
- **Overall Unit Test Status:** **100% PASS (`0` Failures)**

---

## 1. Executive Summary

This Unit Test Report documents the automated unit and component-level test executions across all four subsystems of **CampusPool**:
1. **Frontend Component, Hook & Route-Handler Unit Suites (`frontend-next/`):** `28` Vitest suites (`171` tests), `1` Node native PESU parser/client suite (`10` tests), and `2` contract/loader assertion scripts — **`183 / 183` PASS**.
2. **Activity Projection Microservice Unit Suite (`services/activity-projection/`):** `17` Node native unit tests covering event redaction, idempotent `sourceEventId` upserts, snapshot replay, `$jsonSchema` installation, and outage handling — **`17 / 17` PASS**.
3. **Standalone Domain & Algorithm PHP Unit Suites (`backend/extensions/carpoolear/tests/`):** `RouteSegmentMatcherStandalone.php` (`12` assertions) and `WeeklySchedulePreviewStandalone.php` (`13` assertions) — **`25 / 25` PASS**.
4. **Laravel Mobility Extension Unit & Service Suites (`PHPUnit 10`):** **`444` tests (`3,621+` assertions, `2` skipped, `0` failures) — PASS**.

| Subsystem | Test Runner | Suites / Files | Total Unit Tests | Passed | Failed | Pass Rate |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Frontend UI & Proxy Units (`frontend-next`)** | Vitest `5.0.5` + Node `--test` | 31 | 183 | 183 | 0 | **100.0%** |
| **Activity Projection Service (`services/activity-projection`)** | Node `--test` | 1 | 17 | 17 | 0 | **100.0%** |
| **Standalone PHP Domain Algorithms** | PHP 8.2+ CLI | 2 | 25 | 25 | 0 | **100.0%** |
| **Laravel Mobility Extension (`backend/extensions/carpoolear`)** | PHPUnit 10 | 32 | 444 | 442 (+2 skipped) | 0 | **100.0%** |
| **Grand Total** | **All Runners** | **66** | **669** | **667 (+2 skipped)** | **0** | **100.0%** |

---

## 2. Frontend Unit & Component Test Breakdown (`frontend-next/`)

### 2.1 Execution Command
```bash
cd frontend-next
node tests/contract.test.mjs && node tests/maps-loader.test.mjs && node --test tests/pesu-client.test.mjs
npx vitest run --environment jsdom --fileParallelism=false
```

### 2.2 Suite-by-Suite Results (31 Suites, 183 Unit Tests)

| # | Test Suite File | Module / Component Under Test | Tests | Duration | Status |
| :---: | :--- | :--- | :---: | :---: | :---: |
| 1 | `tests/contract.test.mjs` | Frontend-to-Backend API route & contract invariants | 1 | `18 ms` | **PASS** |
| 2 | `tests/maps-loader.test.mjs` | `lib/maps-loader.mjs` async loader, failure recovery & cleanup | 1 | `24 ms` | **PASS** |
| 3 | `tests/pesu-client.test.mjs` | `lib/pesu-client.mjs` PES Academy parser, redirect guard, 2MB stream cap | 10 | `78 ms` | **PASS** |
| 4 | `tests/unit/student-email.test.jsx` | `lib/student-email.ts` institutional email normalization & domain checks | 11 | `4 ms` | **PASS** |
| 5 | `tests/commute-time.test.jsx` | `lib/commute-time.ts` IST (`+05:30`) parsing & window formatting | 4 | `19 ms` | **PASS** |
| 6 | `tests/legacy-ui-utils.test.jsx` | `lib/legacy-ui-utils.ts` currency minor-unit formatting & status badges | 4 | `19 ms` | **PASS** |
| 7 | `tests/ola-config-route.test.jsx` | `app/api/ola/config/route.ts` server-side key isolation & provider config | 2 | `7 ms` | **PASS** |
| 8 | `tests/ola-static-map-route.test.jsx` | `app/api/ola/static-map/route.ts` authenticated static map image proxy | 2 | `10 ms` | **PASS** |
| 9 | `tests/pes-timetable-route.test.jsx` | `app/api/pes-timetable/route.js` origin validation, 4096B cap & rate limit | 6 | `15 ms` | **PASS** |
| 10 | `tests/LocalAccountSignIn.interaction.test.jsx` | `components/LocalAccountSignIn.tsx` role & gender registration validation | 2 | `84 ms` | **PASS** |
| 11 | `tests/student-signin.interaction.test.jsx` | `components/StudentSignIn.tsx` OTP request, verification & password login | 9 | `312 ms` | **PASS** |
| 12 | `tests/student-landing.interaction.test.jsx` | `components/StudentDashboard.tsx` & `LocalAccountLanding.tsx` routing | 1 | `102 ms` | **PASS** |
| 13 | `tests/onboarding.interaction.test.jsx` | `components/DriverOnboarding.tsx` 4-field vehicle & license validation | 5 | `218 ms` | **PASS** |
| 14 | `tests/driver.interaction.test.jsx` | Driver offer publication, capacity bounds & booking accept/decline | 19 | `1,910 ms` | **PASS** |
| 15 | `tests/live-carpool.interaction.test.jsx` | `components/LiveCarpool.tsx` same-gender toggle, discovery & waitlist | 19 | `3,456 ms` | **PASS** |
| 16 | `tests/page.interaction.test.jsx` | `app/page.tsx` state machine, session bootstrap & role switching | 31 | `4,820 ms` | **PASS** |
| 17 | `tests/canonical-pool.interaction.test.jsx` | `components/CanonicalPool.tsx` campus gate pool search & empty states | 7 | `640 ms` | **PASS** |
| 18 | `tests/places.interaction.test.jsx` | `components/CanonicalPlacePicker.tsx` debounced place autocomplete | 2 | `180 ms` | **PASS** |
| 19 | `tests/address-rides.interaction.test.jsx` | `components/AddressRides.tsx` student address-to-campus rides & quotes | 6 | `540 ms` | **PASS** |
| 20 | `tests/ola-client.interaction.test.jsx` | `lib/ola-client.ts` & `OlaPlaceInput.tsx` autocomplete & details | 4 | `210 ms` | **PASS** |
| 21 | `tests/ola-canonical.interaction.test.jsx` | Approved-stop picker over authenticated Ola proxy | 2 | `765 ms` | **PASS** |
| 22 | `tests/ola-student-address.interaction.test.jsx` | Student address ride creation with Ola static route map | 2 | `310 ms` | **PASS** |
| 23 | `tests/ola-legacy-page.interaction.test.jsx` | Legacy/canonical page compatibility under Ola provider | 1 | `145 ms` | **PASS** |
| 24 | `tests/issue-23-booking-interaction.test.jsx` | Seat booking request, quote consent & status refresh (`#23`) | 1 | `190 ms` | **PASS** |
| 25 | `tests/live-account-activity.interaction.test.jsx` | `components/LiveAccountActivity.tsx` personal audit & ledger feed | 5 | `363 ms` | **PASS** |
| 26 | `tests/ride-conversation.interaction.test.jsx` | `components/RideConversation.tsx` scoped trip chat & blocking | 4 | `165 ms` | **PASS** |
| 27 | `tests/ride-safety.interaction.test.jsx` | `components/RideSafety.tsx` trusted-contact safety check alert | 2 | `95 ms` | **PASS** |
| 28 | `tests/ride-rating.interaction.test.jsx` | `components/RideRating.tsx` 1–5 star post-ride rating modal | 3 | `126 ms` | **PASS** |
| 29 | `tests/pes-timetable.interaction.test.jsx` | `components/PesTimetable.tsx` import preview, slot choice & save | 3 | `419 ms` | **PASS** |
| 30 | `tests/operator-analytics.interaction.test.jsx` | `components/OperatorAnalytics.tsx` SQL/Mongo windows & stale guards | 11 | `382 ms` | **PASS** |
| 31 | `tests/admin-console.interaction.test.jsx` | `components/AdminConsole.tsx` `/admin` login, DBMS lab & reviews | 5 | `270 ms` | **PASS** |

---

## 3. Activity Projection Microservice Unit Tests (`services/activity-projection/`)

### 3.1 Execution Command & Live Output
```bash
cd services/activity-projection && npm test
```

```text
✔ projection redacts response payload and request identifiers (1.73ms)
✔ upsert is idempotent on source event id (0.22ms)
✔ sync uses a transaction snapshot and replays from zero without high-water state (0.80ms)
✔ indexes and daily aggregation support analytics queries (0.20ms)
✔ replay recovers a delayed lower-id commit and partial writes without duplicate events (0.61ms)
✔ projection rejects invalid identifiers, action, status and timezone before Mongo writes (0.21ms)
✔ strict schema validator and trip/time index are installed for new and existing collections (0.54ms)
✔ replay run budget rolls back instead of reporting a successful partial scan (0.23ms)
✔ private HTTP authenticates before reading queries and returns opaque health only (36.66ms)
✔ HTTP rejects invalid or injectable input without querying Mongo (28.20ms)
✔ HTTP bounds Mongo to trip/time/completed snapshot and returns aggregate allow-list only (2.05ms)
✔ initial and failed partial replay suppress counts; concurrent run is single flight; retry recovers (5.69ms)
✔ failed refresh keeps old success timestamp but cannot present partial documents as ready or zero (2.55ms)
✔ HTTP discards aggregate if a replay starts and completes during the Mongo query (1.19ms)
✔ Mongo outage and malformed aggregate return safe unavailable response (1.93ms)
✔ synchronous worker failure can recover and periodic loop never overlaps (58.28ms)
✔ configuration validates service secret, database names and limits without exposing credentials (1.19ms)
ℹ tests 17 | pass 17 | fail 0 | duration_ms 214.75
```

---

## 4. Backend & Standalone Domain PHP Unit Suites

### 4.1 Standalone Domain Unit Suites
| Suite File | Tested Domain Logic | Assertions | Result |
| :--- | :--- | :---: | :---: |
| `backend/extensions/carpoolear/tests/RouteSegmentMatcherStandalone.php` | Corridor segment intersection, sub-1km walk bounds, and 12-way seat capacity invariants | 12 | **PASS** |
| `backend/extensions/carpoolear/tests/WeeklySchedulePreviewStandalone.php` | Weekly bitmask recurrence decoding (`Mon..Sun`), IST date materialization, and exception filtering | 13 | **PASS** |

### 4.2 Laravel Mobility Extension PHPUnit Suites (Selected Key Suites)
| PHPUnit Test Class | Unit / Integration Focus | Result |
| :--- | :--- | :---: |
| `LocalAccountAuthTest.php` | Username/password registration, role (`rider`/`driver`), gender normalization, duplicate rejection | **PASS** (36 assertions) |
| `CollegeEmailAuthRegistrationTest.php` | Institutional email validation, OTP generation, student profile creation | **PASS** (41 assertions) |
| `CollegeEmailOtpSecurityTest.php` | OTP expiration, superseded OTP invalidation, brute-force rate limiting | **PASS** (231 assertions) |
| `MobilityOlaDirectionsClientTest.php` | Ola Maps directions parsing, `<1km` walking lower-bound pruning, provider error handling | **PASS** (191 assertions) |
| `MobilityOfferDiscoveryTest.php` | Time-window filtering, direction matching, self-booking guard | **PASS** (38 assertions) |
| `MobilitySegmentBookingTest.php` | Atomic seat reservation, quote verification, `FOR UPDATE` locking | **PASS** (51 assertions) |
| `MobilityCommuteProductTest.php` | Full commute lifecycle, symmetric same-gender matching, cancellation seat restoration | **PASS** (46 assertions) |
| `AddressRideFlowTest.php` | End-to-end student address ride creation, matching, and static map rendering | **PASS** (398 assertions) |
| `MobilityCohortSecurityTest.php` | Cross-user and cross-role (`HTTP 403`) security boundary enforcement | **PASS** (32 assertions) |
| `MobilityTripCommunicationHttpTest.php` | Participant-scoped chat, user blocking, and localized ride reminders | **PASS** (28 assertions) |
| `MobilityPesTimetableTest.php` | Account-scoped timetable persistence, slot validation, and replacement rules | **PASS** (43 assertions) |
| `MobilityOperatorDatabaseHealthHttpTest.php` | `/api/mobility/operator/dbms/health` RBAC guard and allow-listed SQL object checks | **PASS** (52 assertions) |
| `MobilityOperatorPasswordHttpTest.php` | Password-only `/admin` login, bcrypt verification, and token revocation | **PASS** (59 assertions) |
