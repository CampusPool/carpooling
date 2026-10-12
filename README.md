# CampusPool — Student Carpooling and Bikepooling

**SE + DBMS college mini-project**. Student-exclusive campus commuting platform designed to reduce parking pressure through transparent, safer ride sharing among verified students (estimated student population ~4,000). This repository currently contains **planning and workflow assets only**; do not mistake a green planning CI check for a deployed working product.

## Planning and course evidence
- [Product backlog and issue links](docs/PRODUCT_BACKLOG.md) — 7 epics, 28 source user stories, 9 NFR/enablers
- [Sprint plan](docs/SPRINT_PLAN.md) — dry run, Sprint 1 (Oct 19–23), Sprint 2 (Oct 26–30)
- [DBMS Level 3 requirements mapping](docs/DBMS_TRACEABILITY.md)
- [Proposed SRS/SAD/Test Plan deviations](docs/DEVIATIONS.md)
- [GitHub Issues](https://github.com/CampusPool/carpooling/issues)

## Proposed stack (to be implemented)
- Next.js app with protected backend/API endpoints.
- PostgreSQL for transactional students, vehicles, rides, bookings, payments.
- MongoDB for notifications, ride event records and optional chat.
- GitHub Actions for PR checks and release/demo readiness.

## GitHub collaboration
- Work from a linked issue on a feature branch.
- Open PR with screenshots/test results and linked issue.
- Another team member reviews; a repo owner merges after checks pass.
- Do not commit university credentials, real student addresses, personal identifiers or production environment variables.

## Demo milestones
- Sprint 1: one-minute end-to-end working product video by Oct 23.
- Sprint 2: two-minute working product video and completed documentation by Oct 30.

**Outstanding:** synchronize with previously approved SRS, SAD, and Test Plan; confirm actual two-person DBMS team, course reuse approval, and issue owners; create/link a GitHub Projects board.
