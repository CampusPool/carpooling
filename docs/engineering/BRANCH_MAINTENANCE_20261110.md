# Remote branch maintenance — review snapshot

**Recorded:** 10 November 2026 · **`origin/main` SHA:** `2b782c48bc3441be7793577997ccfc784d7c357a`

**No branches were deleted or force-pushed while preparing this inventory.** These are Git ancestry facts, not evidence that every old PR was accepted or that the branch name is unused.

There are **44** remote branches including `main`: **31** non-main tips fully contained in `main`, **12** divergent tips, and no strictly-ahead branches. Squash merges can leave branches *divergent* even though their diff is already incorporated.

| Remote branch | Tip (short SHA) | Behind / ahead of `main` | Classification |
| --- | --- | ---: | --- |
| `chore/official-readme-and-agent-cleanup` | `b449c75dfd37` | 88 / 0 | contained |
| `codex/01-schema-issue-37` | `b87e3db4d56e` | 21 / 0 | contained |
| `codex/02-local-core-backend-issue-10` | `ad9ed19f6166` | 19 / 0 | contained |
| `codex/03-discovery-integrity-issue-22` | `edcc839adaad` | 15 / 0 | contained |
| `codex/04-integrated-ride-ui-issue-42` | `0b81ae94218a` | 12 / 0 | contained |
| `codex/05-reproducible-demo-evidence-issue-39` | `58f21f11ec85` | 10 / 0 | contained |
| `codex/commute-race-0876224` | `7e3724246844` | 34 / 0 | contained |
| `codex/dbms-level3-deliverables` | `8e4ece546207` | 4 / 0 | contained |
| `codex/fix-expired-trusted-link-fixture` | `3971bdc20400` | 81 / 0 | contained |
| `codex/issue-12` | `5f133d72d09a` | 84 / 1 | divergent-review |
| `codex/issue-21` | `8f612cb7326c` | 84 / 1 | divergent-review |
| `codex/issue-23` | `ce6fba04b083` | 84 / 1 | divergent-review |
| `codex/issue-24` | `5948fe5cff8e` | 84 / 1 | divergent-review |
| `codex/issue-37` | `5b7dfe269404` | 84 / 1 | divergent-review |
| `codex/issue-39` | `e23704ddbd17` | 85 / 0 | contained |
| `codex/issue-44` | `3fb3fa1ff633` | 84 / 1 | divergent-review |
| `codex/migration-rollback-safe` | `66596eee5da9` | 42 / 0 | contained |
| `codex/mobility-issue-23` | `f04d19889c24` | 78 / 0 | contained |
| `codex/mobility-issue-39` | `4695b05da48b` | 79 / 0 | contained |
| `codex/mobility-issue-44` | `2c1714bbf5b0` | 78 / 0 | contained |
| `codex/mobility-migration-review-20261028` | `2fdf2906a539` | 83 / 0 | contained |
| `codex/nithesh-issue24-waitlist-cancellation` | `154a9ac0d1d6` | 80 / 0 | contained |
| `codex/nithesh-issue36-migration-documentation` | `2c6e468874de` | 26 / 0 | contained |
| `codex/nithesh-issue37-trip-integrity` | `260e3bc1f3a5` | 80 / 0 | contained |
| `codex/nithesh-issue40-daily-aggregation` | `bceebf71d8bd` | 31 / 0 | contained |
| `codex/sprint1-ci-documentation` | `d79f88dae88a` | 23 / 0 | contained |
| `codex/sprint1-commute-http-e7bba84` | `74e6c7cac05c` | 40 / 0 | contained |
| `codex/sprint1-commute-journey` | `2d941e062e0c` | 38 / 0 | contained |
| `codex/sprint1-search-evidence-481e3ca` | `139161b06075` | 46 / 0 | contained |
| `codex/sprint1-vehicle-capacity-481e3ca` | `21816600487a` | 46 / 0 | contained |
| `codex/sprint3-nikhil-delivery` | `1dd9c1f5f124` | 2 / 0 | contained |
| `copilot/fix-portable-campus-tests` | `40b0a949c5d9` | 104 / 0 | contained |
| `copilot/fix-portable-campus-tests-again` | `3e042fbdcc94` | 99 / 2 | divergent-review |
| `docs/se-dbms-backlog-2026-10-12` | `1719003372bc` | 124 / 12 | divergent-review |
| `feature/update-commute-controller` | `ec28f5de9667` | 90 / 3 | divergent-review |
| `fix/ci-main-manifest-ui-contract` | `c13904fb1962` | 91 / 0 | contained |
| `issue-12` | `8526b534fb15` | 79 / 0 | contained |
| `issue-21` | `b23bac1e1f22` | 80 / 0 | contained |
| `issue-43-test-harness` | `e5ac7c524ae5` | 77 / 0 | contained |
| `phase1/demo-stabilization-review-20261109` | `c21e32c170de` | 1 / 4 | divergent-review |
| `s1/arjun-booking-release` | `c240b5819c79` | 108 / 2 | divergent-review |
| `s1/nithesh-integrity` | `759e51f49891` | 84 / 12 | divergent-review |
| `sprint1/attributed-prototype` | `13d9b636a3fb` | 109 / 0 | contained |

## Safe cleanup process

1. Refresh with `bash scripts/audit-branches.sh --refresh` from a **full-history clone**, then record all current tip SHAs. The script is read-only. A shallow clone returns an error instead of misleading branch classifications.
2. Check every proposed deletion with GitHub PR state, open review threads, deployment/automation references and the owning teammate. A **contained** tip is only a *candidate*, not a command to delete it.
3. Review each divergent branch individually. The Phase 1 review branch is divergent after squash merge by design; the older closed-unmerged PR branches also contain unique commits that must not be silently discarded.
4. Retain `main`, any in-progress teammate branch, milestone/demo references, and historical PR links. Consider an archival tag before removing names that contain unique commits, subject to team approval.
5. Only perform remote deletions after owners explicitly approve an exact, timestamped list. **Do not bundle remote branch deletion with the teacher-readiness code PR.**

## Separate cleanup concerns

- The repository currently has **two frontend user paths** (`LiveCarpool` and `CanonicalPool`) with different account requirements; neither is proven redundant. Do not delete files based solely on name similarity.
- The older `backend/extensions/carpoolear/web/` browser UI may be used by integration/prototype tests; preserve it until there is a route/reference and test inventory.
- The Sprint 1 video and dated course evidence should not be removed without teammate/course approval. Future large demo captures belong in Release artifacts or a deliberately documented artifact store, rather than repeatedly enlarging Git history.

For implementation status, see [the feature matrix](../FEATURE_STATUS.md). Historical [Phase 1 ancestry snapshot](PHASE1_BRANCH_AUDIT_20261109.md) predates the squash merge and therefore reports a different divergent count.
