# Scope decisions and deviations

These entries are proposed interpretations against the submitted SRS, SAD and Test Plan. They require team or instructor approval where stated.

| ID | Decision | Follow-up |
|---|---|---|
| D-01 | Student-only platform; faculty/staff and employee mode 5.4 are outside the current scope. | Compare with the submitted SRS and obtain sign-off. |
| D-02 | Enter university timetables manually; defer direct import 5.2. | Document matching impact and integration approval. |
| D-03 | Reuse one expense-split calculation for 4.5 and 7.1. | Preserve separate user-facing acceptance tests. |
| D-04 | Treat Sprint 2 stories 3.3, 6.2 and 6.3 as stretch work. | Retain the original criteria and issue estimates. |
| D-05 | College affiliation verification must not require university passwords. | Select an approved domain or verification method. |
| D-06 | Offline payment acknowledgement is not payment processing. | Document receipt acknowledgement separately from payment processing. |
| D-07 | MySQL owns reservations and lifecycle state; MongoDB stores events and notifications. | Preserve one SQL transaction for booking/cancellation. |
| D-08 | MySQL remains the relational authority. | The handout permits MySQL or PostgreSQL; this is a project choice. |
| D-09 | Sprint 1 uses the Laravel/browser journey; Next.js and MongoDB move to Sprint 2. | Complete the mandatory follow-on requirements. |
| D-10 | Sprint 1 demonstration uses synthetic authentication and data. | Real college authentication remains follow-on work. |
| D-11 | Prototype upload, reviewed code PRs and the one-minute video remain pending. | Complete attribution, licensing and evidence review first. |
| D-12 | Sprint 1 focuses on #12, #21, #22, #23, #24, #37, #39, #43 and #44. | Keep each issue's full acceptance criteria. |
| D-13 | The approved DBMS pair and course reuse/originality position are unconfirmed. | Confirm both before final submission. |

## Review record

The original SE sprint handout, DBMS Level 3 requirements and existing SE/DBMS backlog design were reviewed on 23 October 2026. Submitted CampusPool SRS, SAD and Test Plan files were not located. No mandatory course requirement is removed by this register.
