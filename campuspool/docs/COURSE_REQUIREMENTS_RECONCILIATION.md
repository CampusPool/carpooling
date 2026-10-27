# CampusPool course-requirements reconciliation

Status: working draft for team review. This file maps the locally available DBMS requirements and the SE evidence found in the issue records to the new Next.js implementation. It is not an approval, submission, or originality decision.

## Sources inspected

- DBMS requirements: `evidence/academic-dbmsRequirements.txt` (five extracted pages; source says Level 3 Project Requirements).
- SE evidence: `evidence/acceptance-audit.md`, issue records for #43 and #44, and the implementation contract at `contracts/IMPLEMENTATION.md`.
- The exact submitted SE brief/template was not present as a standalone local source in this checkout. The issue evidence records that the Part-2 brief expects SRS, SAD, STP, genuine member contributions/review, and a one-minute Sprint 1 working-product video. Those remain pending until the team supplies the original/approved artifact.

The implementation and test statuses below refer to the integrated personal solutions checkout, not to the official main branch or this documentation-only PR. Feature PRs #55, #57, #58, and #59 are still open; booking is proposed separately. Verify the combined result after integration.

## DBMS mapping

| Requirement | Planned implementation or evidence location | Current status |
| --- | --- | --- |
| Meaningful non-trivial problem | Campus commute offer, search, booking, approval, cancellation, and activity audit | Implemented in the app and tested; course acceptance pending |
| Two-member team and defined contribution | `docs/ORIGINALITY_AND_OWNERSHIP.md`; Git history/PRs | Ownership declarations are a process aid, not proof of authorship |
| SQL plus NoSQL | MySQL is transactional authority; MongoDB stores idempotent activity/outbox projections (`server/activity.ts`, `server/outbox.ts`) | Implemented; auth and role boundaries exercised in integration/HTTP tests |
| ERD and relational schema | SRS/SAD table descriptions; SQL foundation migrations owned by issue #39 | ERD/data dictionary committed; migrations and schema evidence verified in disposable database |
| DDL and constraints | MySQL tables, FKs, checks, indexes; #37 evidence view/procedure/guards | Implemented; DDL and constraints executed in disposable database |
| DML and meaningful queries | Auth, catalog, rides, bookings, cancellation, dashboard, activity APIs | Implemented; DML/API operations and query evidence exercised by integration/HTTP tests |
| Four SQL advanced concepts | Transactions, indexes, views, stored procedure, triggers/guards (foundation migration 001 plus evidence migration 002) | Implemented; transactions, indexes, views, stored procedure and triggers exercised; course presentation evidence still needed |
| One NoSQL advanced concept | MongoDB unique event upsert, filtered activity projection, aggregation/summary | Implemented; unique upsert, audience filtering and aggregation exercised in MongoDB recovery tests |
| Next.js web interface | Next App Router, route handlers, feature pages | Implemented; production build and HTTP journey verified; screenshots still need to be captured for the final submission |
| API integration and secrets | Node route handlers; `DATABASE_URL`/Mongo configuration via environment; no hard-coded credentials | Implemented with environment configuration; deployment review pending |
| Authentication and two roles | Opaque `cp_session`; RIDER, DRIVER, ADMIN; pending registration and admin approval | Implemented; auth and role boundaries exercised in integration/HTTP tests |
| Validation and integrity | Zod request schemas, same-origin mutation guard, SQL checks/FKs, transactional seat/credit operations | Implemented; checks and race tests passed; final course evidence package remains |
| Documentation and demonstration | This reconciliation, SRS, SAD, STP, RTM/test records, and later actual screenshots/video | Drafts only; no approval/video claim |
| Git/GitHub | Issue-scoped branches and PRs in `handoff.json`; CI is part of #39 | Planned workflow; review/merge not asserted |
| Originality | See `ORIGINALITY_AND_OWNERSHIP.md`; explain design choices and each member's own work | Declaration/evidence process pending |

## Issue interpretation for the new implementation

- **#39** is the full-stack bootstrap: Next.js scaffold, authentication, schema/migrations, shared API/core, and CI. Its support references #8, #9, #10, #36, #38, and closed #22; those references do not claim separate issue completion.
- **#43** is **testing against the approved Test Plan**, not a new search feature. The rebuilt search and the closed #22 matching regression are shared baseline behavior folded into #39. #43 owns test-plan traceability and evidence checks.
- **#37** covers integrity plus MongoDB activity/outbox and database evidence. Issue #40 remains Sprint 2/pending official scope.
- **#24** is explicitly the Sprint 1 cancellation slice. Waitlist/rematching remains Sprint 2.
- **#44** supplies documentation and a recording checklist/draft only; it does not complete all acceptance criteria.

## SE mapping

The available SE evidence supports these deliverables: requirements specification (SRS), architecture/design (SAD), test plan and traceability (STP/RTM), issue-scoped member contributions with review, and a continuous one-minute working-product demonstration. This package supplies drafts and checklists only. It does not assert that the faculty accepted them or that a video was recorded/uploaded.

## Legacy boundary

The archived Laravel/native-JS package is preserved for historical comparison only. Its closed/matching features are not evidence that this Next.js v1 implementation has full parity; fixed stops, no live routing, and other differences must be reviewed against the new contract.

## Known gaps

The final ERD rendering, actual Next.js browser screenshots, approved two-member eligibility, genuine teammate review, instructor-approved SRS/SAD/STP, originality acceptance, and working-product video must be added by the team when available. Do not fill these gaps with synthetic claims.

## Current engineering evidence

At the verified personal-repository commit, the implementation checks passed locally and in GitHub Actions run `40379725305`: typecheck, lint, production build, disposable MySQL/Mongo migration and seed, 23 integration tests, and the 9-case production HTTP journey. The HTTP suite includes twelve final-seat acceptance races and six cancellation/refund races. These are engineering results for this implementation; they do not substitute for instructor approval, genuine teammate review, or the required recorded demonstration.
