# Sprint 1 test plan and traceability

This matrix maps the issue #43 acceptance criteria to checks available in the
official MobilityPlatform baseline. A passing UI or contract test does not
prove backend behavior. `Not verified` means the required test or evidence is
not present in this checkout or was not run.

## Acceptance matrix

| Case | Requirement | Test or evidence source | Status on baseline |
| --- | --- | --- | --- |
| REG-01 | Register, activate and log in; verify no admin, identity or driver trust is assigned by default | `research/experiments/carpoolear/journey-probe.php`; disposable MySQL runtime required | Not verified; latest run did not start because the Colima VM ran out of disk |
| BOOK-01 | Discover a ride, reject owner self-booking and reject duplicate active requests | `research/experiments/carpoolear/journey-probe.php`; disposable MySQL runtime required | Not verified; latest run did not start because the Colima VM ran out of disk |
| CAP-01 | Preserve one accepted seat through 12 competing accepts and six automatic-accept races | `research/experiments/carpoolear/journey-probe.php`; disposable MySQL runtime required | Not verified; latest run did not start because the Colima VM ran out of disk |
| CANCEL-01 | Allow a rider to cancel their accepted seat and restore capacity | `research/experiments/carpoolear/journey-probe.php`; disposable MySQL runtime required | Not verified; latest run did not start because the Colima VM ran out of disk |
| AUTH-01 | Reject cancellation by an unrelated actor without changing the booking | `research/experiments/carpoolear/journey-probe.php`; disposable MySQL runtime required | Not verified; latest run did not start because the Colima VM ran out of disk |
| WEB-01 | Check client contracts and route form interactions | `frontend-next/tests/contract.test.mjs`, `frontend-next/tests/page.interaction.test.jsx`, `frontend-next/tests/driver.interaction.test.jsx`, `frontend-next/tests/maps-loader.test.mjs` | Automated checks pass; client-side only |
| PROJ-01 | Check projection redaction, event idempotency and aggregation | `services/activity-projection/test/*.test.mjs` | Automated checks pass; projection only |

## Evidence rules

For each runtime case, attach the source revision, exact command, host image or
pinned source revision, isolated database/schema, exit status, test/assertion
counts, and whether provider data is synthetic. Keep credentials, API keys,
and populated demo database contents out of logs. A reconstruction check is
not a runtime test and a UI mock is not backend acceptance evidence.

The earlier 23 October evidence cited in issue #43 is tied to source revision
`faccb66ebb65512cfca41116109609a7120111de`; it is historical evidence and is
not counted as a run on this baseline. See `SPRINT1_TEST_RESULTS.md` for the
checks actually run against this contribution's parent commit.

The `lifecycle` mode runs the HTTP probe, then mounts this repository's
extension and integrations into the pinned backend and runs upstream,
lifecycle and focused financial tests against disposable MySQL. Record both
the pinned backend revision and the tested repository revision. Each run gets
a unique database volume and refuses to reuse an existing one.
