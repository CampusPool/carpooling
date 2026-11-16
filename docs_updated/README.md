# CampusPool — Software Engineering & DBMS Final Deliverables (`docs_updated/`)

This folder contains the complete, frozen **Part-1, Part-2, Part-3, and Part-4 Project Deliverables** for **CampusPool** (`PES University — Department of Computer Science & Engineering`), formatted strictly in accordance with the official IEEE templates and evaluation checklist.

---

## Team Roster

| Sl. No. | Student Name | SRN | GitHub Handle | Core Contribution Area |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **Arjun Srikanth** | `PES1UG24AM920` | `@arjunsrikanthh` | Transactional Backend, Row-Level Locking (`FOR UPDATE`), CI/CD, Ola Maps & Student OTP/Safety |
| **2** | **Zayaan Ahmed** | `PES1UG24AM457` | `@zayaan-06` | Next.js 14 Interface, Symmetric Same-Gender Matching, 4-Field Driver Setup & Pedestrian Snapping |
| **3** | **Nikhil Suhas Joshi** | `PES1UG24AM441` | `@NikhilJoshi441` | Geospatial Discovery, `<1km` Pickup Zones, Performance Tuning (`EXPLAIN ANALYZE`) & STP/RTM Traceability |
| **4** | **NITHESH** | `PES1UG24AM443` | `@NitheshMogaveer777` | 3NF MySQL Schema, Views, Stored Functions/Procedures, Triggers, Cancellation & MongoDB 7.0 Projection |

---

## Deliverable Index & Evaluation Checklist Mapping

### Part-1: Requirements & Design Documents
- **[`SRS.md`](./SRS.md) — Software Requirements Specification (IEEE Format)**
  - [x] Standard IEEE format with Revision History, Approvals, and Table of Contents.
  - [x] Contains **16 Functional Requirements (`CP-F-001`..`CP-F-016`)** and **8 Non-Functional Requirements (`CP-NF-001`..`CP-NF-008`)** specified clearly and measurably.
  - [x] Section 5.1 Security includes **4 Security Objectives (`SO-01`..`SO-04`)** and **6 Security Requirements (`CP-SR-001`..`CP-SR-006`)**.
  - [x] Section 7.1 includes **2 UML Use-Case Diagrams** (Core Commute/Booking & Identity/Safety/Operator Governance).
  - [x] Section 8 provides the full **Requirements Traceability Matrix (RTM)**.
- **[`STP_and_Test_Cases.md`](./STP_and_Test_Cases.md) — Software Test Plan & Updated Test Cases (IEEE Format)**
  - [x] Standard IEEE format (Sections 1 through 15).
  - [x] Sections 3, 4, and 5 completely filled; **Section 5.1 dedicated to Security Validation**.
  - [x] Full traceability to `SRS.md` (`CP-F-*`, `CP-NF-*`, `CP-SR-*`).
  - [x] Contains **16 detailed, sprint-updated test cases (`TC-AUTH-01`..`TC-PERF-01`)** covering FRs, NFRs, and SRs.
- **[`SAD.md`](./SAD.md) — Software Architecture & Design Specification (IEEE Format)**
  - [x] Standard IEEE format (Sections 1 through 5).
  - [x] Section 3 includes Component Diagrams, UML Class Diagram, Component Descriptions, CQRS + Layered Architecture Rationale (ADRs), 3NF SQL + MongoDB Schema Matrix, Traceability, and **STRIDE Security Architecture**.
  - [x] Section 4 includes **3 UML Sequence Diagrams**, **6 REST API Interface Specifications**, Error Handling Protocols, and **Documented Sprint Deviations**.

### Part-2: Agile Planning & Repository Setup
- **[`Agile_Backlog_and_Sprint_Plan.md`](./Agile_Backlog_and_Sprint_Plan.md) — Backlog, Story Points, Sprint-1/2/3 Execution & PR Audit**
  - [x] Linked to [GitHub Project #2](https://github.com/orgs/CampusPool/projects/2).
  - [x] `19` Backlog epics/stories derived from SRS FRs/NFRs totaling **`108` Story Points**, assigned across all 4 team members.
  - [x] Sprint-1 (`19–23 Oct`), Sprint-2 (`26–30 Oct`), and Optional Sprint-3 (`2–16 Nov`) execution logs, GitHub Actions CI workflows, PR review records, and **Formal Documentation of Permitted Sprint Deviations**.

### Part-3: Testing & Quality Assurance Reports
- **[`Unit_Test_Report.md`](./Unit_Test_Report.md) — Deliverable `2.b.i`: Unit Test Report**
  - [x] `31` Frontend suites (`183/183` tests passed), `17/17` Activity Projection unit tests passed, `25/25` standalone domain assertions passed, and `444` PHPUnit tests passed (`100%` pass rate).
- **[`System_Validation_Report.md`](./System_Validation_Report.md) — Deliverable `2.b.ii`: System Validation Report**
  - [x] End-to-end validation of all `30` SRS requirements, HTTP latency benchmarks (`p90 = 22.0 ms` login, `46.1 ms` search), `EXPLAIN ANALYZE` (`1.12 ms`), and DBMS Level-3 verifiers (`MySQL 8.0` + `MongoDB 7.0`).
- **[`Code_Coverage_Report.md`](./Code_Coverage_Report.md) — Deliverable `2.b.iii`: Code Coverage Report**
  - [x] V8 native coverage (`100.00%` line coverage on `services/activity-projection`, `98.31%` on `pesu-client.mjs`) and module-by-module coverage across `frontend-next` (`92.4%`) and `backend/extensions/carpoolear` (`91.8%`).
- **[`Branch_Coverage_Report.md`](./Branch_Coverage_Report.md) — Deliverable `2.b.iv`: Branch Coverage Report**
  - [x] V8 branch coverage (`93.12%` on `services/activity-projection`) and True/False decision branch matrix across RBAC, OTP, same-gender matching, `FOR UPDATE` concurrency locks, SQL triggers/procedures, and MongoDB `$jsonSchema` validators (`89.79%` platform aggregate).
