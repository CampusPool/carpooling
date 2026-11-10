# Class Timetable Integration and Recurring Commute Schedules

 > **Current product boundary (10 November 2026):** Manual recurring-program APIs/engine are implemented and backend-tested. The present Next.js local student demo does **not** expose a complete timetable editor, and no institution-authorized official timetable feed is connected. The title describes the intended story, not an approved university integration. See [Feature status](FEATURE_STATUS.md).


**Issue**: [#27] [5.2] Official timetable import  
**Owner**: @NikhilJoshi441  
**Target Milestone**: Sprint 3 Functional Story  
**Course Context**: SE + DBMS Story 5.2  

---

## 1. Scope & Privacy Mandate

> **User Story**: As a student or faculty member, I want to import or configure my semester timetable so that recurring commute rides are scheduled automatically around my classes without having to post daily rides manually.

### Critical Security & Privacy Guardrails
1. **No Password Scraping**: The system **strictly forbids** requesting, scraping, or storing students' university portal passwords.
2. **Approved API Integration Only**: Official timetable synchronization must operate exclusively through university-authorized OAuth2 / SAML APIs with institutional consent.
3. **Mandatory Fallback**: Because university API agreements are outside student control, a complete, robust **manual recurring schedule engine** is provided.

---

## 2. Recurring Schedule Engine Architecture

The recurrence engine is implemented via `STS\Mobility\Recurrence\ProgramReader` and database entities `mobility_recurring_programs` and `mobility_recurring_occurrences`.

### 1. Bitmask Weekly Scheduling
Schedules are modeled using a bitmask integer where each bit represents a day of the week:
* `1` = Monday
* `2` = Tuesday
* `4` = Wednesday
* `8` = Thursday
* `16` = Friday
* `32` = Saturday
* `64` = Sunday

For example, a student attending Monday/Wednesday lab sessions uses schedule mask `1 | 4 = 5`.

### 2. Schedule Program Parameters
* `date_from` and `date_to`: Defines the active semester date range.
* `departure_time`: Time of departure (e.g. `08:00:00` for 08:30 AM class).
* `weekly_schedule`: Day-of-week bitmask.
* `stop_ids`: Array of pickup stop IDs matching the campus route.
* `total_seats` & `max_fare_minor`: Vehicle capacity and seat contribution constraints.

### 3. Occurrence Materialization
The system projects recurring programs into discrete trip instances in `mobility_recurring_occurrences`:
* Each occurrence generates an independent `trip_id` linked to the master `program_id`.
* Available seat counts are tracked per occurrence via `SegmentInventory::available()`.
* Cancellation or modification of one date's occurrence leaves other occurrences in the semester untouched.

---

## 3. API Endpoints

Registered in `routes/mobility.php`:
* `POST /api/mobility/recurring-programs`: Create a new recurring schedule program.
* `GET /api/mobility/recurring-programs/{id}`: Inspect recurring program parameters.
* `GET /api/mobility/recurring-programs/{id}/occurrences`: List materialized class commute dates and booking statuses.

---

## 4. Verification & Automated Test Evidence

Automated test suites in `backend/extensions/carpoolear/tests`:
1. `MobilityRecurringAdmissionTest.php`: Verifies driver and vehicle eligibility before admitting recurring programs.
2. `MobilityRecurringControlTest.php`: Validates schedule pause, resume, and version editing.
3. `MobilityRecurringGenerationTest.php`: Tests generation of discrete occurrences from weekly bitmask rules.
4. `MobilityRecurringProgramsHttpTest.php`: Tests HTTP API for creating, viewing, and querying recurring semester schedules.
5. `MobilityRecurringRecoveryHttpTest.php`: Verifies idempotent recovery and duplicate prevention when generating trips across semester dates.

All recurrence tests pass cleanly as part of the backend test suite.
