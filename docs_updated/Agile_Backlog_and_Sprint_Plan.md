# Agile Backlog, Sprint Execution Plan & PR Governance Report (Part-2 Deliverable)

- **Project:** CampusPool — Collegiate Carpooling & Multi-Model Mobility Platform
- **GitHub Repository:** [https://github.com/CampusPool/carpooling](https://github.com/CampusPool/carpooling)
- **Linked GitHub Project Board:** [CampusPool Project #2](https://github.com/orgs/CampusPool/projects/2)
- **CI/CD Workflows:** [`.github/workflows/mobility-platform.yml`](../.github/workflows/mobility-platform.yml) & [`.github/workflows/dbms-level3.yml`](../.github/workflows/dbms-level3.yml)
- **Development Cycle Status:** **FROZEN** (`16-11-2026`)

---

## 1. Team Roster & Individual Ownership

| Sl. No. | Team Member | SRN | GitHub Handle | Core Agile Role & Assigned Domain |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **Arjun Srikanth** | `PES1UG24AM920` | `@arjunsrikanthh` | **Repo Owner / Backend & Runtime Lead:** Transactional booking engine, `FOR UPDATE` locks, CI/CD, Ola Maps & Student OTP/Safety integration |
| **2** | **Zayaan Ahmed** | `PES1UG24AM457` | `@zayaan-06` | **Frontend & UX Lead:** Next.js 14 workspace, symmetric same-gender ride matching, 4-field driver onboarding, pedestrian route snapping |
| **3** | **Nikhil Suhas Joshi** | `PES1UG24AM441` | `@NikhilJoshi441` | **QA, Discovery & Performance Lead:** Geospatial search, `<1km` pickup zones, performance benchmarking (`EXPLAIN ANALYZE`), STP & RTM traceability |
| **4** | **NITHESH** | `PES1UG24AM443` | `@NitheshMogaveer777` | **Database & NoSQL Lead:** 3NF MySQL schema, triggers, views, recursive-CTE stored procedures, cancellation/waitlist, and MongoDB 7.0 event projection |

---

## 2. Master Product Backlog (FRs, NFRs & Story Points)

All backlog items were derived directly from the Functional Requirements (`CP-F-001`..`CP-F-016`), Non-Functional Requirements (`CP-NF-001`..`CP-NF-008`), and Security Requirements (`CP-SR-001`..`CP-SR-006`) in [`SRS.md`](./SRS.md). Story points were estimated using the modified Fibonacci scale (`2, 3, 5, 8`) on `12-Oct-2026`.

| Backlog ID / Issue | User Story / Engineering Requirement | SRS Req ID(s) | Story Points | Assignee | Target Sprint | Status |
| :--- | :--- | :--- | :---: | :--- | :---: | :---: |
| **#8 / #9** | As a student, I want to register, verify my institutional email via OTP, and sign in with password recovery so only eligible peers join the pool. | `CP-F-001`, `CP-F-002`, `CP-SR-001`, `CP-SR-003` | **5** | Arjun Srikanth & NITHESH | Sprint 1 & Sprint 3 | **DONE** |
| **#11 / #87** | As a student, I want to set my role (`rider`/`driver`), normalized gender, and trusted contact in my profile. | `CP-F-001`, `CP-F-003` | **3** | Zayaan Ahmed & Arjun Srikanth | Sprint 1 & Sprint 2 | **DONE** |
| **#12** | As a driver, I want a streamlined 4-field vehicle/license onboarding modal and demo vehicle catalogue with capacity validation (`bike=1`, `car<=4`). | `CP-F-004`, `CP-F-005` | **5** | Zayaan Ahmed | Sprint 1 & Sprint 2 | **DONE** |
| **#21** | As a driver, I want to publish a dated or address-based commute ride offer with origin, campus gate, departure time, seats, fare, and gender rule. | `CP-F-006` | **8** | Arjun Srikanth & Zayaan Ahmed | Sprint 1 | **DONE** |
| **#17 / #22** | As a rider, I want to search compatible rides by place/gate and departure window with route polylines and ETA quotes. | `CP-F-007`, `CP-F-008` | **8** | Nikhil Suhas Joshi | Sprint 1 | **DONE** |
| **#23** | As a rider/driver, I want to request a seat and accept/decline requests atomically under `SELECT ... FOR UPDATE` row locks without self-booking. | `CP-F-010`, `CP-F-011`, `CP-NF-002` | **8** | Arjun Srikanth | Sprint 1 | **DONE** |
| **#24** | As a participant, I want to cancel a pending or accepted booking and automatically restore available seat capacity. | `CP-F-012` | **5** | NITHESH | Sprint 1 & Sprint 2 | **DONE** |
| **#37** | As a DBA, I want 3NF relational tables with foreign keys, `CHECK` constraints, and composite indexes enforcing transactional integrity. | `CP-NF-002`, `CP-NF-006` | **8** | NITHESH | Sprint 1 | **DONE** |
| **#39 / #44** | As a team, we want GitHub Actions CI workflows and reproducible setup scripts automating PR checks, builds, and smoke tests. | `CP-NF-008` | **5** | Arjun Srikanth | Sprint 1 | **DONE** |
| **PR #87** | As a student rider or driver, I want a symmetric "Same gender rides only" filter so I am matched exclusively with same-gender peers when enabled. | `CP-F-009` | **5** | Zayaan Ahmed | Sprint 2 | **DONE** |
| **#36 / #40** | As an operator, I want a dual-database analytics dashboard powered by MySQL views, functions, recursive-CTE/window procedures, `AFTER` triggers, and MongoDB 7.0 `$group`/`$sum` projections. | `CP-F-016`, `CP-NF-003`, `CP-NF-004`, `CP-NF-005`, `CP-SR-004`, `CP-SR-006` | **8** | NITHESH | Sprint 2 | **DONE** |
| **#25 / #81** | As a driver/rider, I want to progress trips (`planned` → `active` → `completed`) and record double-entry demo cost-share postings. | `CP-F-013` | **5** | Arjun Srikanth & NITHESH | Sprint 2 | **DONE** |
| **#38** | As a security engineer, I want strict RBAC and participant ownership checks blocking unauthorized access (`HTTP 401/403`). | `CP-SR-002` | **5** | Nikhil Suhas Joshi & Arjun Srikanth | Sprint 2 | **DONE** |
| **#42** | As a student, I want a responsive Next.js interface with clear validation, empty states, and accessible form controls. | `CP-NF-007` | **5** | Zayaan Ahmed | Sprint 2 | **DONE** |
| **#26 / #101** | As a rider, I want predefined campus pickup zones and `< 1,000 m` combined walking distance verification using Ola Maps / OSRM foot routing. | `CP-F-007`, `CP-F-008` | **5** | Nikhil Suhas Joshi, Zayaan Ahmed & Arjun Srikanth | Sprint 2 & Sprint 3 | **DONE** |
| **#27 / PR #96** | As a student, I want to import and preview my PES Academy class timetable (or configure weekly bitmask recurrence) before saving to MySQL. | `CP-F-015`, `CP-SR-005` | **5** | Nikhil Suhas Joshi & Arjun Srikanth | Sprint 3 | **DONE** |
| **#31 / #32 / #33** | As a participant, I want scoped in-trip chat, user blocking, and `Asia/Kolkata` localized departure/change reminders. | `CP-F-014` | **5** | Nikhil Suhas Joshi | Sprint 3 | **DONE** |
| **#13 / #15** | As a student, I want post-ride 1–5 star ratings and an in-ride safety check that alerts my trusted contact. | `CP-F-014` | **5** | Arjun Srikanth | Sprint 3 | **DONE** |
| **#41 / #43** | As a QA lead, I want HTTP latency benchmarks (`p90 <= 2s`), `EXPLAIN ANALYZE` query tuning, and complete test-plan traceability reports. | `CP-NF-001`, `CP-NF-008` | **5** | Nikhil Suhas Joshi | Sprint 3 | **DONE** |
| **Total** | **19 Epics / Stories (Covering 16 FRs, 8 NFRs, 6 SRs)** | **All 30 SRS IDs** | **108 SP** | **All 4 Members** | **Sprints 1–3** | **100% Complete** |

---

## 3. Sprint-by-Sprint Execution Summary

### 3.1 Dry Run & Backlog Finalization [`12th Oct – 16th Oct 2026`]
- Created and linked the GitHub Project board ([Project #2](https://github.com/orgs/CampusPool/projects/2)) to `CampusPool/carpooling`.
- Decomposed SRS requirements into GitHub Issues (`#8` through `#44`), assigned Fibonacci story points (`108` total SP), and balanced allocations across all four members (`27 SP` average per member).
- Configured `.github/workflows/mobility-platform.yml` to run automated checks on every PR and push.

### 3.2 Sprint-1 Execution [`19th Oct – 23rd Oct 2026`] — *Core Transactional Carpooling MVP (47 SP)*
- **Objective:** Deliver a working end-to-end relational carpooling vertical slice (Account Auth → Vehicle Onboarding → Offer Publication → Geospatial Search → Atomic Seat Request/Acceptance → Cancellation).
- **Completed Stories:** `#8/#11` (Local Auth), `#12` (Driver/Vehicle Onboarding), `#21` (Offer Publication), `#17/#22` (Route Quotes & Search), `#23` (Row-Locked Seat Booking), `#24` (Cancellation), `#37` (3NF Schema & Constraints), `#39/#44` (CI Workflow & Runbook).
- **Sprint-1 Deliverable Video:** Recorded and committed to repository (`docs/course-20261027/media/sprint-1-mobility-demo.mp4`).

### 3.3 Sprint-2 Execution [`26th Oct – 30th Oct 2026`] — *Multi-Model DBMS Analytics, Same-Gender Safety & UI Polish (36 SP)*
- **Objective:** Integrate the MongoDB 7.0 activity projection service, install MySQL 8.0 analytical views/functions/procedures/triggers, implement symmetric same-gender ride matching and simplified 4-field driver onboarding, and harden pedestrian snapping (`250m`).
- **Completed Stories:** `PR #83/#85` (MySQL Views/Functions/Procedures/Triggers + MongoDB `$jsonSchema` & `/daily` Aggregation), `PR #86` (Discovery & Concurrency Verification), `PR #87` (Same-Gender Matching & 4-Field Driver Setup), `PR #93` (Pedestrian Snapping Tolerance `50m` → `250m`), `#25/#81` (Lifecycle & Demo Ledger), `#38` (Cohort RBAC Security).

### 3.4 Optional Sprint-3 Parallel Activity & Testing [`2nd Nov – 16th Nov 2026`] — *Ola Maps, Student OTP/Safety/Ratings, Timetable & Final QA Reports (25 SP)*
- **Objective:** Complete spillover/enhancement items (Ola Maps routing transition, institutional PES email OTP/password login, PES Academy timetable import preview, post-ride ratings, trusted-contact safety check, `/admin` DBMS Control Center) while executing the full Test Plan and generating all four QA reports.
- **Completed Stories:** `#26/#101` (Campus Pickup Zones & `<1km` Ola Walking Match), `#27/PR #96` (PES Timetable Import & Recurrence), `#31/#32/#33` (Trip Chat & Reminders), `#13/#15` (Ratings & Safety Check), `#41/#43` (Performance Tuning & Test Traceability), `PR #100/#102/#103/#104` (Unified Ola/Student/Admin Integration & Final Documentation Freeze).

---

## 4. Pull Request (PR) Authorship, Review & Merge Audit Log

Every feature branch was raised as a Pull Request by the assigned team member, verified by GitHub Actions CI, and reviewed/merged into `main`:

| PR # | Title / Scope | Author | Reviewer / Merger | Linked Issues / SRS IDs | Status |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **#66** | Test harness & Sprint 1 traceability baseline | `@NikhilJoshi441` (Nikhil) | `@arjunsrikanthh` | `#43`, `CP-NF-008` | Merged |
| **#70** | Driver offer panel & passenger seat capacity validation | `@zayaan-06` (Zayaan) | `@arjunsrikanthh` | `#12`, `#21`, `CP-F-004`, `CP-F-005` | Merged |
| **#72** | Cross-trip relational integrity & rollback-safe migrations | `@NitheshMogaveer777` (NITHESH) | `@arjunsrikanthh` | `#37`, `CP-NF-006` | Merged |
| **#73** | Waitlist & booking cancellation seat restoration | `@NitheshMogaveer777` (NITHESH) | `@arjunsrikanthh` | `#24`, `CP-F-012` | Merged |
| **#83** | Account schema, 3NF constraints & DBMS Level-3 baseline | `@NitheshMogaveer777` (NITHESH) | `@arjunsrikanthh` | `#36`, `#37`, `CP-F-001`, `CP-NF-006` | Merged |
| **#84** | Transactional core backend, `FOR UPDATE` locking & idempotency | `@arjunsrikanthh` (Arjun) | `@NikhilJoshi441` | `#21`, `#23`, `CP-F-010`, `CP-F-011` | Merged |
| **#85** | MySQL views/procedures/triggers & MongoDB 7.0 activity projection | `@NitheshMogaveer777` (NITHESH) | `@arjunsrikanthh` | `#36`, `#40`, `CP-F-016`, `CP-NF-003`..`005` | Merged |
| **#86** | Discovery SQL, route matching & concurrency verification | `@NikhilJoshi441` (Nikhil) | `@arjunsrikanthh` | `#17`, `#22`, `#37`, `CP-F-008`, `CP-NF-002` | Merged |
| **#87** | Next.js integrated ride UI, same-gender matching & 4-field driver setup | `@zayaan-06` (Zayaan) | `@arjunsrikanthh` | `#11`, `#12`, `#42`, `CP-F-004`, `CP-F-009` | Merged |
| **#88** | Runtime automation, GitHub Actions CI & recovery runbooks | `@arjunsrikanthh` (Arjun) | `@zayaan-06` | `#39`, `#44`, `CP-NF-008` | Merged |
| **#89** | Sprint 3 performance tuning (`#41`), test traceability (`#43`), pickup zones (`#26`), recurrence (`#27`) & reminders (`#33`) | `@NikhilJoshi441` (Nikhil) | `@arjunsrikanthh` | `#26`, `#27`, `#33`, `#41`, `#43`, `CP-NF-001` | Merged |
| **#93** | Expand pedestrian snapping tolerance from `50m` to `250m` + unit tests | `@zayaan-06` (Zayaan) | `@arjunsrikanthh` | `#17`, `CP-F-007` | Merged |
| **#96 / #100** | Ola Maps migration, PES Academy timetable preview & `/admin` DBMS Control Center | `@arjunsrikanthh` (Arjun) | `@zayaan-06` | `#27`, `#101`, `CP-F-007`, `CP-F-015`, `CP-F-016` | Merged |
| **#102** | Ola walking pickup options (`<1km` combined walk) & sprint continuity | `@arjunsrikanthh` (Arjun) | `@NikhilJoshi441` | `#101`, `CP-F-007`, `CP-F-008` | Merged |
| **#103** | Verified student password accounts, safety check & ride ratings | `@arjunsrikanthh` (Arjun) | `@zayaan-06` | `#8`, `#9`, `#13`, `#15`, `CP-F-001`..`003`, `CP-F-014` | Merged |
| **#104** | Functional/non-functional requirements & SE demonstration diagrams | `@arjunsrikanthh` (Arjun) | `@zayaan-06` | `#44`, `SRS.md`, `SAD.md` | Merged |

---

## 5. Formal Documentation of Permitted Deviations (For Final Demo & Viva)

Per Part-2 Item `2.i` (*"Deviations from the submitted document should be documented and explained during the final demo"*), the following controlled engineering adaptations were made during Sprints 1–3:

| Area | Original Baseline Assumption | Implemented Sprint Solution | Justification & Impact |
| :--- | :--- | :--- | :--- |
| **1. Map & Routing Provider** | Local OSRM Docker routers + Google Maps browser SDK | **Server-proxied Ola Maps REST API** (`OlaDirectionsClient.php`, `OlaStaticRouteMap.tsx`) with retained OSRM containers as fallback | Eliminated multi-GB OSM PBF download barrier on fresh evaluator clones while keeping `OLA_MAPS_API_KEY` strictly server-side (`CP-SR-005`). |
| **2. Driver Verification Workflow** | Multi-day manual admin document approval queue | **4-field instant demo onboarding** (`DriverOnboarding.tsx`) + **10-entry demo vehicle catalogue** (`DemoVehicle.php`) + `/admin` review console | Enables immediate 2-minute live driver-to-rider demo creation while preserving full database capacity constraints and admin audit controls. |
| **3. University Timetable Integration** | Direct official university REST API | **Bounded transient PES Academy importer** (`POST /api/pes-timetable`) + manual weekly bitmask recurrence (`ProgramReader.php`) | PES University provides no public student timetable API; our transient proxy parses slots for user review before saving to MySQL without storing credentials. |
| **4. Payment & GPS Hardware** | Live payment gateway & two-phone background GPS | **Double-entry synthetic minor-unit ledger** (`mobility_financial_postings`) + deterministic road/walking route geometry (`<1km` walk check) | Enforces 100% of relational accounting (`debit`/`credit`) and geospatial matching invariants deterministically without real-money exposure. |
