# MobilityPlatform CI workflow

The `MobilityPlatform checks` workflow is the baseline CI gate for the
following surfaces:

- `frontend-next`: locked dependency install, contract/UI tests, TypeScript
  typechecking and a production build.
- `services/activity-projection`: locked dependency install and projection
  unit tests.
- `backend-reconstruction`: checks the pinned upstream source and integration
  patch stack can be reconstructed.

Pull requests and pushes to `main` are covered; documentation-only changes
therefore still receive the same baseline checks. Jobs use read-only repository
permissions, cancel superseded runs on the same ref, and have bounded execution
time. They do not require database services, provider
keys, credentials or a deployed backend.

This is a reproducible static/unit and reconstruction CI gate. Reconstruction
does not start the Laravel backend. The workflow does not cover MySQL/Mongo
disposable integrations, the maps provider, physical devices,
or production deployment are covered. Those checks require separate fixtures
and evidence described in the course runbooks.
