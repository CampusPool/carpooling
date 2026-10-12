# SE Mini Project — execution and sprint plan

**Official delivery schedule** from `SE_Mini_Project_Delivereables_Part-2.pdf`:
- **12 October:** GitHub Project linked to repository; FR/NFR backlog, story points, owners, two sprints.
- **12–16 October:** optional dry run and backlog revisions; final changes still possible on 19 October.
- **19–23 October, Sprint 1:** functional product, PRs raised by implementers and reviewed by owners, GitHub Actions checks, **1-minute video uploaded to repo**.
- **26–30 October, Sprint 2:** additional functionality and documentation, **2-minute video uploaded to repo**, then freeze development.

## Sprint 1 — 61 SP (42 functional / 19 enablers)
**Issues:** 1.1, 1.2, 1.3, 2.2, 3.4, 4.1, 4.2, 4.3, 4.4, 6.1, N1, N2, N3, N4, N5.

**End-to-end demonstration:** register student → sign in → add vehicle → create car/bike ride → search date/time window → request seat → host approves → booking confirmed → cancellation restores seat capacity.

**Must have:** Next.js interface and backend, PostgreSQL schema/DDL and transactional booking, MongoDB setup/use case, basic safety profile display, source control workflow.

**Risk gates:** Confirm campus authentication method without collecting actual university credentials; cap two-wheeler at legal passenger occupancy; use an atomic SQL transaction to prevent simultaneous seat overbooking.

## Sprint 2 — 73 SP (59 functional / 14 NFR/enablers)
**Issues:** 2.1, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.5, 4.5, 5.5, 6.2, 6.3, 7.1, 7.2, N6, N7, N8, N9.

**Order:** route/time matching → safety and cost-sharing → administration/analytics → DBMS advanced demonstrations → tests/docs/video.

**Stretch:** defer recurring matching (3.3), chat (6.2), reminders (6.3) first if over capacity.

## Pull request review policy
1. Assignee develops on a branch and opens a PR linking an issue.
2. Another teammate reviews code and validates changes; GitHub Actions runs.
3. PR is merged by an authorized maintainer/owner after checks and review.
4. Capture screenshots, working-video links and deviations before sprint sign-off.

## Definition of done
- Functional behavior meets agreed story acceptance criteria.
- Database constraints/transactions tested with simultaneous competing requests where appropriate.
- No secrets or student PII in repo, logs or synthetic demo fixtures.
- CI passing, PR reviewed, code and documentation aligned.
- Demonstration recorded, course-required evidence retained.

## Scope control
Existing SRS, SAD and Test Plan remain the contractual baseline. Changes from source backlog should be documented in `docs/DEVIATIONS.md`, not silently substituted. Team roles and workload are provisional until confirmed.
