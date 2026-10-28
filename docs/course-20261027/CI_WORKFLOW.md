# MobilityPlatform CI workflow

The `MobilityPlatform checks` workflow is the baseline CI gate for the two
Node-based surfaces currently reproducible in this repository:

- `frontend-next`: locked dependency install, contract/UI tests, TypeScript
  typechecking and a production build.
- `services/activity-projection`: locked dependency install and projection
  unit tests.

Pull requests and pushes to `main` are covered; documentation-only changes
therefore still receive the same baseline checks. Jobs use read-only repository
permissions, cancel superseded runs on the same ref, and have bounded execution
time. They do not require database services, provider
keys, credentials or a deployed backend.

This is a reproducible static/unit CI gate. It does not claim that the Laravel
backend, MySQL/Mongo disposable integrations, maps provider, physical devices,
or production deployment are covered. Those checks require separate fixtures
and evidence described in the course runbooks.
