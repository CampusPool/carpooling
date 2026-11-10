# Documentation guide

The repository contains historical migration reports and sprint-specific evidence alongside the **current product truth**. Read the materials in this order to avoid confusing a contributor's completion claim with a fully demonstrated feature.

| Read first | Use it for |
| --- | --- |
| [Project overview](../README.md) | Purpose, current stack and basic setup |
| [Feature status](FEATURE_STATUS.md) | Canonical live UI vs backend-only vs pending implementation |
| [Teacher demonstration](COURSE_DEMO.md) | Practical two-browser walkthrough and viva preparation |
| [Architecture](ARCHITECTURE.md) | Why Laravel/MySQL, Google browser maps, OSRM and optional Mongo exist |
| [Actual DBMS work](dbms/README.md) | ERD, schema, SQL routines, transactions and Mongo evidence |
| [Local bootstrap](../RUN_LOCAL_CORE.md) | Exact dependencies and startup commands |
| [Engineering test reports](engineering/) | Dated scoped evidence, including environment limitations |
| [Branch maintenance](engineering/BRANCH_MAINTENANCE_20261110.md) | Recorded branch tips and no-delete review policy |

## Historical material (do not treat as current product status)

- [Migration status](../MIGRATION_STATUS.md) documents the **original migration baseline**, not the current merged application.
- [Sprint 1 evidence](SPRINT1_TEST_RESULTS.md), [Sprint 3 deliverable report](SPRINT3_FINAL_DELIVERY_EVIDENCE.md), and older [course captures](course-20261027/) reflect specific dates, contributors and tested revisions.
- The archived demo video in `course-20261027/media/` predates some current UI changes. Do not substitute that footage for a live demo without explaining its age.
- The implementation status of university email/OTP, timetable import, production payment and GPS is in [Feature status](FEATURE_STATUS.md), even if a historical document's acceptance matrix reports `100%` for a narrower backend task.

**Publication rule:** Documentation should name the exact feature, environment, date, revision and evidence, and should never represent mock or synthetic testing as a production deployment or instructor approval.
