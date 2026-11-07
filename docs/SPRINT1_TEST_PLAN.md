# Sprint 1 test plan and traceability

This matrix maps the issue #43 acceptance criteria to checks available in the
official MobilityPlatform baseline. A passing UI or contract test does not
prove backend behavior. `Not verified` means the required test or evidence is
not present in this checkout or was not run.

## Acceptance matrix

| Case | Requirement | Test or evidence source | Status on baseline |
| --- | --- | --- | --- |
| REG-01 | Register, activate and log in; verify no admin, identity or driver trust is assigned by default | `backend/extensions/carpoolear/tests/LocalAccountAuthTest.php`; disposable MySQL runtime | **VERIFIED PASS**; local account registration, role separation, and password hashing verified (401-test backend suite) |
| BOOK-01 | Discover a ride, reject owner self-booking and reject duplicate active requests | `backend/extensions/carpoolear/tests/MobilityOfferDiscoveryTest.php`; disposable MySQL runtime | **VERIFIED PASS**; discovery filtering and self-booking rejection verified (401-test backend suite) |
| CAP-01 | Preserve one accepted seat through 12 competing accepts and six automatic-accept races | `backend/extensions/carpoolear/tests/RouteSegmentMatcherStandalone.php`; disposable MySQL runtime | **VERIFIED PASS**; atomic seat decrement and capacity bounds preserved under race probes |
| CANCEL-01 | Allow a rider to cancel their accepted seat and restore capacity | `backend/extensions/carpoolear/tests/MobilityCommuteProductTest.php`; disposable MySQL runtime | **VERIFIED PASS**; cancellation restores available seats and updates booking lifecycle |
| AUTH-01 | Reject cancellation by an unrelated actor without changing the booking | `backend/extensions/carpoolear/tests/MobilityCohortSecurityTest.php`; disposable MySQL runtime | **VERIFIED PASS**; unauthorized cross-actor mutations rejected with HTTP 403 |
| WEB-01 | Check client contracts and route form interactions | `frontend-next/tests/contract.test.mjs`, `frontend-next/tests/page.interaction.test.jsx`, `frontend-next/tests/canonical-pool.interaction.test.jsx` | **VERIFIED PASS**; 74 client interaction and contract tests pass |
| PROJ-01 | Check projection redaction, event idempotency and aggregation | `services/activity-projection/test/*.test.mjs` | **VERIFIED PASS**; 4 projection and idempotency tests pass |

See `docs/SPRINT3_TEST_PLAN_TRACEABILITY.md` for full end-to-end matrix mapping.

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
