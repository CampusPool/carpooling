# MobilityPlatform Sprint 1 traceability

This is a sanitized course-facing map for the MobilityPlatform migration. It records implementation locations and verification boundaries; it is not instructor approval or a completion declaration.

| Sprint 1 issue | Implementation areas | Evidence state |
| --- | --- | --- |
| #12 Driver and vehicle details | `backend/extensions/carpoolear/Mobility/Trust/DriverOnboardingController.php`, onboarding migrations and client controls | Manual-review behavior has focused tests; complete course capture remains pending |
| #21 Publish a ride offer | `backend/extensions/carpoolear/Mobility/Routing/OfferController.php`, quote and offer migrations | Synthetic publication is implemented; provider and course evidence remain pending |
| #22 Search rides | `backend/extensions/carpoolear/Mobility/Routing/OfferDiscoveryController.php` and route discovery contracts | Bounded discovery is implemented/tested; full current-client demonstration remains pending |
| #23 Request and confirm a seat | `backend/extensions/carpoolear/Mobility/Segments/SegmentBookingService.php`, dispatch services and booking tests | Request/acceptance and race coverage exist; independent review and recording remain pending |
| #24 Cancellation and waitlist | cancellation/lifecycle services, waitlist migration and tests | Cancellation is covered; waitlist acceptance is partial |
| #37 Database integrity | migrations, transaction services and `docs/dbms/` | SQL evidence is separated from application claims; CI verifies pinned-source reconstruction only, while Laravel runtime/database tests remain a separate disposable-stack check |
| #39 PR workflow | `.github/workflows/mobility-platform.yml`, `MIGRATION_STATUS.md` | Client/service CI is defined; Laravel checks require the pinned external backend |
| #43 Test-plan traceability | this file and `docs/dbms/` | This is a draft trace, not an approved plan |
| #44 Documentation/video | this directory and product docs | Draft documentation is included; videos and final submission evidence remain pending |

Feature PRs must be opened only after the migration baseline is reviewed. Backend runtime checks must use the dedicated disposable Compose project/volume and synthetic credentials; never point them at a preserved pilot database. A passing automated check does not establish teacher acceptance, authorship or production readiness.
