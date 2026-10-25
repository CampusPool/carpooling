# Team contribution workflow

**Canonical repository:** [CampusPool/carpooling](https://github.com/CampusPool/carpooling). Its `main` contains the runnable prototype and central CI repairs. The separate [carpooling-workspace](https://github.com/CampusPool/carpooling-workspace) preserves earlier work and task history but is **not** the repository for new submissions.

## Ownership

| Contributor | Sprint 1 issues | Area | Suggested branch |
| --- | --- | --- | --- |
| Arjun | [#23](../issues/23), [#39](../issues/39), [#44](../issues/44) | Booking authorization/concurrency tests, CI, demo evidence | `s1/arjun-booking-release` |
| Nikhil | [#22](../issues/22), [#43](../issues/43) | Ride matching, time-window search tests and Test Plan evidence | `s1/nikhil-matching` |
| Zayaan | [#12](../issues/12), [#21](../issues/21) | Driver details, offer forms, map-unavailable fallback and frontend tests | `s1/zayaan-web-commute` |
| Nithesh | [#24](../issues/24), [#37](../issues/37) | Cancellation, repeat-action idempotency and MySQL integrity | `s1/nithesh-integrity` |

These are **assignments, not claims of completed individual work**. Check your issue for acceptance criteria. Coordinate edits to shared PHP services and migrations.

## For every teammate

```sh
git clone https://github.com/CampusPool/carpooling.git
cd carpooling
git switch main
git pull --ff-only origin main
git switch -c s1/YOUR-BRANCH-NAME
cd prototype
sh reproduction/start-local.sh
python3 reproduction/smoke-booking.py
sh reproduction/stop-local.sh
cd ..
```

If you already have a working branch or uncommitted changes, **preserve them** and integrate latest `main` carefully instead of deleting or resetting your work. Existing PRs should be reviewed before starting another one. The demo is on `http://127.0.0.1:18180/mobility/?demo=campus-route`. Use synthetic users and isolated test data only.

Commit only new work you can explain. Run your focused tests. When an inventoried file changes, update its SHA-256 entry/classification in `prototype/SOURCE_MAP.tsv`, run `python3 scripts/check-package.py --write` from `prototype/` to regenerate the manifest, and run `python3 scripts/check-package.py` to verify integrity. Don't suppress or bypass failing tests.

```sh
git status --short
git add -p
git add path/to/any/new-test-file
git diff --cached --stat
git commit -m "test: describe the behavior verified"
git push -u origin s1/YOUR-BRANCH-NAME
```

Open a PR into **this repository's `main`**. A professional PR states the actual code change, linked issue, relevant test commands/results and limitations. Reviewers should confirm the diff genuinely adds behavior or tests; a passing check on a zero-file PR does not constitute a feature contribution.

**Do not:** push directly to `main`; copy inherited files to claim authorship; add secrets or database dumps; overwrite another teammate's work; merge an empty or failing PR. Retain Carpoolear licensing and provenance. The demo video is separate evidence and must not be marked completed before recording/submission.
