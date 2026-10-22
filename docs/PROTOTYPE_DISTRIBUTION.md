# Private prototype distribution manifest

The working prototype is a private Laravel 12/MySQL application. This manifest is a preparation aid for the private staging repository; it does not authorize an upload. The owner must approve the exact source revision after a secret and license scan.

## Package table

| Package | Include in private staging | Purpose | Owner / review |
|---|---|---|---|
| Laravel application source | Yes, after scan | Routes, controllers, models, services, views and browser assets | `arjunsrikanthh` |
| Database migrations and seeders | Yes, synthetic only | Schema, constraints and reproducible demo data | `NitheshMogaveer777` |
| Focused tests and test helpers | Yes | Isolated MySQL/API/UI verification | `NitheshMogaveer777` |
| Map/route adapters | Yes, configuration-free | Google Maps/OSRM integration boundaries | `NikhilJoshi441` |
| Setup scripts and contribution docs | Yes | Reproducible local bootstrap without secrets | Coordinator |
| Private keys, `.env`, JWT/account bundles, dumps, screenshots | No | Credentials, PII and mutable local state | Keep local/ignored |
| `.jarvis/`, REA artifacts, HOPR research, raw logs and backups | No | Internal working state and audit material | Keep outside public/staging source |
| Third-party vendor snapshots/patches | Only with license review | Preserve exact provenance and notices | Coordinator + reviewer |

## Minimal Sprint 1 manifest

The first package targets the campus commute journey. Its source allowlist is a review starting point, not yet an executable minimal bundle: Laravel application routes/controllers/models/services required by the commute and booking journey; `CommuteService.php`; `CommuteMatchingService`; relevant migrations and synthetic seeders; `web/{commute.mjs,commute-map.mjs,commute.html,commute.css,place-search.mjs,trip-chat-ui.mjs}`; focused lifecycle/matching/browser tests; setup/contribution documentation; and required license/notice files. Android directories, APK/build outputs, HOPR/REA research, raw evidence and database backups are excluded. The existing service provider also boots shared admission, communications, tracking, dispatch and recurrence boundaries; those modules cannot simply be deleted while keeping the current bootstrap unchanged. Include required shared runtime source or review an explicit future separation before narrowing the package.

Paths in the private prototype are the authoritative source locations. Do not publish an absolute private host path in issue/README text. The distribution should carry a relative manifest, pinned revision/patch identities, setup prerequisites and a synthetic fixture recipe.

## Provenance and licensing gates

The prototype contains extension work described as project-specific and modified/reused Carpoolear-derived components; independent authorship clearance has not been established. Preserve upstream notices, license files, revision identifiers and a clear modified-files list. Before any public or official-repository migration:

1. record the exact source revision and dirty-file manifest;
2. run secret/PII scans and confirm ignored files are absent;
3. review the upstream Carpoolear license, dependency licenses and any OSRM/OpenStreetMap attribution obligations;
4. obtain instructor/team approval for course reuse and originality claims;
5. migrate only through a reviewed integration PR.

The current audit found a licensing blocker that must be resolved before publication: the pinned upstream `research/vendor/carpoolear_backend/LICENSE` contains GPL-3.0 text while its `composer.json` declares MIT, and there is no single project-root license decision recorded for the combined work. Treat the effective license as unresolved; preserve both notices, obtain an explicit review, and do not publish or claim compatibility until the owner/instructor approves the final licensing position.

No current document claims that these gates are complete. A private staging repository may grant Write to contributors; organization-level ownership can make some accounts effectively Admin. Branch review rules were requested but the GitHub Free/private-repository configuration returned HTTP 403, so manual independent review remains the documented protocol until an owner enables rulesets or the plan changes.

## Safe verification

Use an isolated MySQL schema/container and synthetic accounts. Do not run reset, migration or destructive fixtures against a persistent demo database. Record command, revision, exit status and evidence for each contributor PR. Provider, device, email delivery and real-money behavior remain separate readiness gates.

## Proposed relative file manifest (not an upload)

- Candidate runtime set, pending dependency closure: `backend/extensions/carpoolear/{Mobility,config,migrations,routes,tests,web,tools}`, `backend/extensions/carpoolear/Mobility/MobilityServiceProvider.php`, `backend/integrations/carpoolear/` reviewed patches and notices, `scripts/prepare-carpoolear.sh`, `scripts/apply-carpoolear-patches.py`, selected `scripts/mobility-runtime.sh`/pilot helpers, and focused `scripts/test-commute-ui.mjs`/synthetic verification helpers.
- Reproducibility metadata: pinned upstream revision `6ba3d8913a8f77e664e848a526f196690a03c1e8`, upstream license/notices, `composer.json`/`composer.lock`, reviewed non-secret environment examples, required `research/experiments/carpoolear/{Dockerfile.smoke,compose.*.yml,pilot-nginx.conf,routing-fixture.php}` recipes, `research/experiments/carpoolear/patches/critical-invariants.patch`, migration ordering and synthetic fixture recipe. The coordinator must review exact transitive runtime dependencies before assembly; this directory-level proposal is not yet a validated clean-room bundle.
- Never copy the dirty `research/vendor/carpoolear_hardened/` tree. Reconstruct a pristine pinned source plus reviewed patches only after licensing clarification. A duplicate migration timestamp needs an explicit ordering check.
- Exclude `.env`/keys/tokens, `.git` history containing private artifacts, `.local`, `.jarvis`, `analysis`, `reference`, raw `research` captures, REA tools, Android/build outputs, vendor/node caches, databases/backups, road graphs, runtime logs and unreviewed screenshots. Graphs and mapping services need a separate reproducible/attributed setup.

The current audited test checkout includes generated or dirty vendor/harness state. Passing those tests does not prove the proposed sanitized package can be installed from scratch; clean-room installation and fixture/license review are required before authorizing the exact upload.

The existing bootstrap loads all extension migrations and several shared middleware/routes. The core commute data specifically adds `2026_10_22_000140`, `000150`, `000160` and `000170` migrations on top of shared lifecycle/cohort/routing/segment schema. A four-file migration subset is insufficient on an empty database. The coordinator must preserve the full required migration chain and inspect duplicate timestamps before release.
