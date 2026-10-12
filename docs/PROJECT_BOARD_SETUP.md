# GitHub Projects board — CampusPool SE + DBMS (12 Oct 2026)

## What is already published
- **44 existing Issues:** 7 epics (#1–#7), 28 user stories (#8–#35), 9 NFR/enablers (#36–#44).
- Per-story Fibonacci points, Sprint 1/2 (or not planned), priority, acceptance criteria and provisional GitHub assignee appear in the issues.
- Planning documents: [Product Backlog](PRODUCT_BACKLOG.md), [Sprint Plan](SPRINT_PLAN.md), [DBMS Traceability](DBMS_TRACEABILITY.md).
- GitHub Actions planning checks and PR workflow are in this documentation branch.

## Required board (not yet created via this connector)
Use an **organization-level** GitHub Projects board, title `CampusPool — SE + DBMS 2026`, linked to `CampusPool/carpooling`. It must contain the **existing 44 issues**, not a new/doubled issue list.

**Recommended custom fields**
| Field | Type | Choices |
|---|---|---|
| Workflow Stage | Single select | Backlog, Ready, In Progress, In Review, Done |
| Sprint | Single select | Sprint 1, Sprint 2, Not Planned |
| Story Points | Number | 1, 2, 3, 5, 8, 13 (epics left blank) |
| Priority | Single select | P0, P1, P2 |
| Work Type | Single select | Epic, FR, FR+NFR, NFR, Enabler |

**Assignee** is the built-in GitHub issue property; the issue assignees are provisional and require team confirmation.

**Views**: Product Backlog (table of all items), Sprint 1 (filter `Sprint:Sprint 1`), Sprint 2 (filter `Sprint:Sprint 2`), and Not Planned (filter `Sprint:Not Planned`). Each sprint view can use Board layout with Column field `Workflow Stage`.

The source sprint allocations are **61 SP** for Oct 19–23 and **73 SP** for Oct 26–30. Stories 3.3, 6.2, 6.3 are Sprint 2 stretch. Stories 5.1–5.4 are not scheduled.

## Publishing the board
This ChatGPT GitHub integration currently supports repository Issues, PRs and files, but does not expose organization GitHub Projects administration. An organization owner/project manager can publish with a separate GitHub CLI setup script:
1. Install [GitHub CLI](https://cli.github.com/), authenticate with `gh auth login`, and grant the `project` scope via `gh auth refresh -s project`.
2. Run the **existing-issues-only** `CampusPool_Board_Setup.py` script from the handoff package (`python3 CampusPool_Board_Setup.py --apply`). It is idempotent by project title and issue URL and does not create/duplicate issues.
3. Open the resulting Project. Set the Board view **Column field** to `Workflow Stage`, and create saved sprint/backlog filters as above. Verify all 44 issues and planned story-point totals.
4. If GitHub denies creation in `CampusPool`, an **organization owner** must enable Projects permissions or run the setup. Repository Admin alone does not necessarily grant organization Project creation.

**Definition of Done for setup:** organization Project URL exists; repository linked; 44 issues included; story points and sprint fields populated; both sprint views saved; provisional assignments reviewed. Do not mark the SE backlog requirement fully submitted before this verification.
