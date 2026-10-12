# Scope decisions and deviations register

Record decisions against the submitted SRS/SAD/Test Plan. **Proposed** does not mean instructor-approved.

| ID | Proposed interpretation/change | Reason and required follow-up |
|---|---|---|
| D-01 | Student-only platform; exclude faculty/staff and employee mode 5.4 | User-confirmed target population; validate against submitted SRS and obtain sign-off |
| D-02 | University timetable initially entered manually; defer direct import 5.2 | Official integration requires permission; document impact on matching |
| D-03 | 4.5 and 7.1 reuse one expense split calculation | Avoid duplicated functionality; preserve distinct user-facing acceptance tests |
| D-04 | Sprint 2 stories 3.3, 6.2 and 6.3 are stretch | Two one-week sprints/134 SP planned; renegotiate scope if required |
| D-05 | Verifying college affiliation does not require handling university passwords | Minimize credential exposure; select authorized domain/verification mechanism |
| D-06 | Offline payment acknowledgement is not payment processing | No gateway provider has been selected; avoid misleading claims |
| D-07 | SQL is source of truth for seat reservations; MongoDB for events/messages | Prevent inconsistencies across database technologies |

## Approval/evidence log
| Date | Decision | Approved by | Link |
|---|---|---|---|
| 2026-10-12 | Initial planning baseline and GitHub issues prepared | **Pending team/instructor review** | docs/PRODUCT_BACKLOG.md |

Add actual approvals/deviations and demo explanations before final review.
