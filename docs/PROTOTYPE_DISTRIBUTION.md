# Private prototype distribution manifest

The prototype is a private Laravel 12/MySQL application. This document defines a review package; it is not an upload authorization. The exact revision, dependency closure and scan results require owner approval.

## Package contents

| Include after review | Purpose | Owner |
|---|---|---|
| Laravel routes, controllers, models, services, views and browser assets | Application runtime | `arjunsrikanthh` |
| Migrations, seeders, focused tests and helpers | Reproducible schema and verification | `NitheshMogaveer777` |
| Map and route adapters | Google Maps/OSRM integration boundaries | `NikhilJoshi441` |
| Setup scripts, contribution docs and required notices | Reproducible local setup | Coordinator |

Exclude `.env` files, keys, tokens, account bundles, dumps, screenshots with personal data, `.jarvis`, reference-app captures, raw logs, backups, caches and unreviewed vendor snapshots. Include third-party code only with its license and notice files.

## Sprint 1 candidate set

The initial package covers the campus commute journey: the relevant Laravel routes/controllers/models/services, `CommuteService.php`, `CommuteMatchingService`, migrations and synthetic seeders, `web/{commute.mjs,commute-map.mjs,commute.html,commute.css,place-search.mjs,trip-chat-ui.mjs}`, focused lifecycle/matching/browser tests, setup documentation and required notices. Shared admission, communications, tracking, dispatch and recurrence modules may be required by the existing service provider; dependency closure must be checked before narrowing the package.

Use relative paths, a pinned revision, patch identities, prerequisites and a synthetic fixture recipe. The proposed manifest records candidate paths and hashes; it is not a validated clean-room bundle.

## Provenance and licensing

The prototype includes project-specific work and modified or reused Carpoolear-derived components. Preserve upstream notices, license files, revision identifiers and a modified-files list. Before publication:

1. record the exact revision and dirty-file manifest;
2. run secret and PII scans;
3. review Carpoolear, dependency and OSRM/OpenStreetMap obligations;
4. obtain team/instructor approval for reuse and originality; and
5. migrate through a reviewed integration PR.

The pinned upstream tree contains GPL-3.0 license text while `composer.json` declares MIT, and the combined project has no recorded root-license decision. Distribution is pending license clarification.

The proposed package must be rebuilt from a pristine pinned source plus reviewed patches; do not copy the dirty vendor tree. Preserve the full migration chain and check duplicate timestamps. Clean-room installation and fixture verification are required before approving an upload.

## Verification

Use an isolated MySQL schema or disposable container with synthetic accounts. Record the revision, command, exit status and evidence for each contributor PR. Provider, device, email and real-money behavior require separate validation.
