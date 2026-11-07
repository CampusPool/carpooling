# Sprint 3 Test Plan and Comprehensive Traceability Matrix

**Issue**: [#43] [N8] Testing against approved test plan  
**Owner**: @NikhilJoshi441  
**Target Milestone**: Sprint 3 Mandatory NFR  
**Course Context**: SE + DBMS Level 3 Deliverable  

---

## 1. Scope & Objective

This document satisfies the acceptance criteria for **Issue #43 (`[N8] Testing against approved test plan`)**, delivering:
1. End-to-end traceability between the approved Software Engineering Test Plan cases and automated verification suites.
2. Verified pass/fail results across registration, booking, seat capacity race safety, cancellation, authorization, and notifications.
3. Explicit documentation of test execution boundaries, environment requirements, and course deviations.

---

## 2. Test Plan Traceability Matrix

| Test ID | Category | Requirement Description | Test Implementation Source | Test Type | Status | Assertions / Counts |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **TC-REG-01** | Registration | Local user registration, role assignment (rider/driver), and password hashing | `backend/extensions/carpoolear/tests/LocalAccountAuthTest.php` | Integration / Unit | **PASS** | 22 assertions |
| **TC-REG-02** | Registration | Duplicate username rejection and role boundary enforcement | `backend/extensions/carpoolear/tests/LocalAccountAuthTest.php` | Integration | **PASS** | 14 assertions |
| **TC-BOOK-01** | Discovery | Search available rides within 15-min tolerance, route quote generation, and self-booking rejection | `backend/extensions/carpoolear/tests/MobilityOfferDiscoveryTest.php` | Functional | **PASS** | 38 assertions |
| **TC-BOOK-02** | Booking | Atomic seat reservation, state transition to `requested`, and passenger creation | `backend/extensions/carpoolear/tests/MobilitySegmentBookingTest.php` | Integration | **PASS** | 51 assertions |
| **TC-CAP-01** | Capacity Race | Concurrent last-seat race safety: preserve seat invariants across 12 competing accepts | `backend/extensions/carpoolear/tests/RouteSegmentMatcherStandalone.php`, `commute-race-0876224` | Concurrency | **PASS** | 12 assertions |
| **TC-CANCEL-01** | Cancellation | Rider cancellation restores seat capacity and transitions booking to `cancelled` | `backend/extensions/carpoolear/tests/MobilityCommuteProductTest.php` | Lifecycle | **PASS** | 46 assertions |
| **TC-AUTH-01** | Security | Reject unauthorized cancellation or ride updates by unrelated actors (HTTP 403) | `backend/extensions/carpoolear/tests/MobilityCohortSecurityTest.php` | Security | **PASS** | 32 assertions |
| **TC-COMM-01** | Communication | Bidirectional participant chat, in-app notifications, and user blocking | `backend/extensions/carpoolear/tests/MobilityTripCommunicationHttpTest.php` | Integration | **PASS** | 28 assertions |
| **TC-PICKUP-01** | Campus Zones | Campus pickup point catalog, intent matching, and preview generation | `backend/extensions/carpoolear/tests/MobilityPickupAgreementTest.php` | Domain | **PASS** | 36 assertions |
| **TC-PERF-01** | Performance | Login and search latency $\le 2.0\text{ s}$ and indexed query execution | `scripts/benchmark-http.py`, `docs/PERFORMANCE_BENCHMARK.md` | Benchmark | **PASS** | p90: 22ms / 46ms |
| **TC-UI-01** | Frontend | Independent rider/driver interaction, place selection, and empty state rendering | `frontend-next/tests/canonical-pool.interaction.test.jsx`, `page.interaction.test.jsx` | Component / E2E | **PASS** | 74 unit tests |
| **TC-PROJ-01** | Projection | Activity projection idempotency, event replay, and Mongo aggregation | `services/activity-projection/test/projection.test.mjs` | Microservice | **PASS** | 4 tests |

---

## 3. Automated Test Execution Evidence

### 1. Full Backend Verification
* **Test Suite**: Integrated Mobility Extension Test Suite (PHPUnit 10 on PHP 8.2)
* **Command**: `MOBILITY_DOCKER_CONTEXT=default ./research/experiments/carpoolear/run-smoke.sh mobility`
* **Summary Results**:
  ```text
  OK (401 tests, 3,621 assertions, 2 skipped)
  ```
* **Coverage Highlights**:
  * Local account registration & role restrictions: 100% passing.
  * Offer publication & quote cryptographic integrity: 100% passing.
  * Concurrent booking race protection: 100% passing.
  * Cancellation & capacity restoration: 100% passing.

### 2. Standalone Domain & Algorithm Verification
* **Command**: `php backend/extensions/carpoolear/tests/RouteSegmentMatcherStandalone.php`
* **Output**: `All 12 route-segment and capacity assertions passed.`

### 3. Frontend Component & Contract Verification
* **Command**: `cd frontend-next && npm test && npm run typecheck && npm run build`
* **Output**:
  ```text
  ✓ tests/contract.test.mjs
  ✓ tests/maps-loader.test.mjs
  ✓ tests/canonical-pool.interaction.test.jsx (74 tests passed)
  ✓ TypeScript typecheck passed
  ✓ Next.js production build completed successfully
  ```

### 4. Activity Projection Verification
* **Command**: `cd services/activity-projection && npm test`
* **Output**: `4 tests passed, 0 failures.`

---

## 4. Test Plan Deviations & Scope Boundaries

In accordance with course governance and the project specification:
1. **Live GPS**: Tested using synthetic road trajectory vectors; physical on-device GPS hardware testing is managed under **#82**.
2. **Payment Settlement**: Tested using synthetic transaction tokens; real banking / payment gateway settlement is deferred.
3. **SMS OTP**: Real telecom SMS delivery is replaced by deterministic local authentication for automated test repeatability.
4. **Google Maps API in CI**: CI workflows utilize local offline road graphs (`bbox-77.20-12.60-78.00-13.40-complete-ways.osm.pbf`) to prevent flakiness and external rate limits.

---

## 5. Sign-Off & Traceability Confirmation

* [x] Unit and integration tests mapped to SE Test Plan cases.
* [x] Actual pass/fail results recorded with reproducible steps.
* [x] Deviations from physical device dependencies explicitly documented.
* [x] Verified in repository CI and checked into version control.
