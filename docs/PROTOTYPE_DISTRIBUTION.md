# Prototype distribution and attribution

The official `main` contains the integrated Laravel 12/MySQL campus-booking baseline from PR #46. The [shared workspace](https://github.com/CampusPool/carpooling-workspace) is a development/reference checkout; individual feature work is submitted as focused PRs to the official repository. Academic reuse approval remains outstanding and is not implied by the merge.

## Package structure

| Area | Contents |
|---|---|
| Laravel backend | Clean export of `STS-Rosario/carpoolear_backend` at `6ba3d8913a8f77e664e848a526f196690a03c1e8`, with required notices |
| `campuspool-extension/` | Campus booking services, routes, browser assets, migrations and focused tests |
| `integration-patches/` | Named changes connecting the extension to the upstream backend |
| `reproduction/`, `scripts/`, `config/` | Isolated setup, verification, synthetic fixtures and configuration examples |
| `MANIFEST.sha256`, `SOURCE_MAP.tsv`, `PROVENANCE.md`, `LICENSES.md` | Exact file hashes, source mapping, modifications and licensing record |

The package retains the upstream backend needed by the extension's service-provider and migration dependencies. Composer dependencies are installed from the lockfile rather than bundled. Integration changes are represented by named patches.

Credentials, real account records, database dumps, dependency directories, local project state, reference-app material, raw captures, backups and unrelated deployment files are excluded.

## Verification

Reproduction must start from the frozen local baseline, install its locked dependencies and use an isolated MySQL database with synthetic accounts. The package verifier checks source hashes, migration/startup behavior, frontend checks, focused campus tests and the real HTTP/MySQL last-seat concurrency probe. Browser startup and provider configuration are documented separately; fixture-backed tests do not establish live routing-provider behavior.

Each contributor PR must identify its baseline revision, linked official issues, changed files, verification commands and results. The existing workspace prototype's verification summary is in [the Sprint 1 report](SPRINT_PLAN.md#verification-results).

## Licensing and provenance

The pinned upstream tree contains GPL-3.0 license text while `composer.json` declares MIT. The extension and combined distribution have no concluded license decision, and individual authorship has not been established. Preserve upstream attribution, notices, revision identifiers and the modified-files list. Record subsequent student contributions separately from the imported baseline.

Before final assessed submission, confirm faculty originality/reuse approval and review combined-distribution licensing and routing-data obligations. The exact manifest, source map, dependency inventory and audit findings form the owner's approval package.
