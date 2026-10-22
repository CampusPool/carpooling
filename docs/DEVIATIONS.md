# Scope decisions and deviations register

Record decisions against the submitted SRS/SAD/Test Plan. **Proposed** does not mean instructor-approved.

| ID | Proposed interpretation/change | Reason and required follow-up |
|---|---|---|
| D-01 | Student-only platform; exclude faculty/staff and employee mode 5.4 | User-confirmed target population; validate against submitted SRS and obtain sign-off |
| D-02 | University timetable initially entered manually; defer direct import 5.2 | Official integration requires permission; document impact on matching |
| D-03 | 4.5 and 7.1 reuse one expense split calculation | Avoid duplicated functionality; preserve distinct user-facing acceptance tests |
| D-04 | Sprint 2 stories 3.3, 6.2 and 6.3 are stretch | Original two-sprint allocation was 134 SP plus unplanned items; current assignment retains full-issue estimates and is not remaining-effort capacity |
| D-05 | Verifying college affiliation does not require handling university passwords | Minimize credential exposure; select authorized domain/verification mechanism |
| D-06 | Offline payment acknowledgement is not payment processing | No gateway provider has been selected; avoid misleading claims |
| D-07 | SQL is source of truth for seat reservations; MongoDB for events/messages | Prevent inconsistencies across database technologies |
| D-08 | MySQL remains the authoritative relational database | The handout permits MySQL or PostgreSQL; this corrects an internal assumption, not an instructor waiver |
| D-09 | Sprint 1 keeps the existing browser/Laravel journey; Next.js and MongoDB carry to Sprint 2 | Deadline-focused slice; does not waive mandatory course requirements |
| D-10 | Sprint 1 demo uses synthetic development authentication | It does not verify college identity; real authentication acceptance remains #8/#9/#10/#38 follow-on work |
| D-11 | Prototype upload, reviewed code PRs and the one-minute video remain outstanding | Preserve attribution and licensing review before any staging or official upload |
| D-12 | Sprint 1 uses focused slices #12, #21, #22, #23, #24, #37, #39, #43 and #44 while retaining each issue's full acceptance criteria | Allocation is not a completion claim or reduced requirement |
| D-13 | Approved DBMS team composition and course reuse/originality acceptance are pending explicit confirmation | Four-person SE responsibility roster must not be represented as the approved two-person DBMS team |

## Approval/evidence log
| Date | Decision | Approved by | Link |
|---|---|---|---|
| 2026-10-12 | Initial planning baseline and GitHub issues prepared | **Pending team/instructor review** | [official GitHub issues](https://github.com/CampusPool/carpooling/issues) |

Add actual approvals/deviations and demo explanations before final review.

## 23 October reconciliation

The original SE sprint handout (one page), DBMS Level 3 requirements (five pages) and the existing SE+DBMS backlog/design document were read. Submitted CampusPool SRS, SAD and Test Plan were not located. The user authorized documentation/issue/workspace preparation and confirmed the four SE handles; this is not instructor approval of any course deviation. Obtain submitted documents, the approved DBMS pair and reuse/originality acceptance before final sign-off. No mandatory requirement has been deleted.
