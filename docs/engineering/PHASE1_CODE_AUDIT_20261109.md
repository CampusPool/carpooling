# Phase 1 — repository code and setup audit (9 November 2026)

## Source of truth and scope

- `main`: pinned Laravel backend extension, Next.js frontend, road routing scripts, Mongo activity projection, Android prototype and course evidence.
- The live demo was running from an unpublished local improvement branch, four commits beyond `main`, plus uncommitted work. Do not assume `main` already matches the demonstrated UI.
- Preserve the original live checkout and its database. Work is prepared in a separate Git worktree with a dedicated dependency directory.

## Candidate cleanup — review before deletion

| Candidate | Evidence | Safe disposition |
|---|---|---|
| `frontend-next/app/page.tsx` | Over 2,000 lines; many distinct account/legacy views | Split after stabilization with behavioral regression tests; do not attempt a risky broad rewrite in this PR |
| `LiveCarpool` and `CanonicalPool` | Both imported by the main page, but assigned to different account types | Retain both pending a documented migration contract; **not** proven unused |
| `StudentSignIn.tsx` | No imports outside its own tests found in current source | Keep under deferred student identity work until course requirements/owners approve deletion |
| `backend/extensions/carpoolear/web` | Separate original web screens, tracked backend migration assets and tests | Do not delete without backend route/asset verification |
| `docs/course-20261027/media/sprint-1-mobility-demo.mp4` | ~25.6 MB tracked course video | Keep course evidence; optionally move *future* videos to GitHub Release artifacts without rewriting history |
| Sprint 1/3 evidence docs | Some assertions cite 38/74 tests although active frontend suite has more | Update only with dated, matching test evidence, not wholesale deletion |
| Large historical prototype branches | Eleven divergent refs, ten closed-unmerged PRs | Preserve SHA/PR inventory; prune only after teammate ownership review |

## External dependencies blocking truly one-command, offline cloning

1. The Laravel application is a pinned external GPLv3 upstream repository; the extension in this repo is not a standalone server. Retain license/source attribution.
2. Routing uses the hash-pinned 49,098,156-byte Bengaluru OSM crop (ODbL). This is intentionally not tracked in Git. A teammate must securely obtain the exact crop, verify its checksum, then run the script.
3. Google Maps requires a privately supplied referrer-restricted browser key and enabled services; do not commit keys or present mock maps as real provider success.
4. Docker needs an accessible local Unix socket, sufficient disk/memory, architecture-compatible images, and working image/package repository DNS.
5. The runtime stores synthetic data in separately named Docker volumes. **Never point verification at a preserved pilot database.**

## Phase 1 checks and evidence boundaries

- Browser demonstration from Simular Box 1 completed publish/search/request/accept/chat/demo-wallet/start/board/alight/complete/rider-arrival; the demo credit release waiting period was not completed.
- Frontend suite: 111 tests in 13 files pass after adding IST scheduling and chat-display checks (see current PR CI for reproducible results).
- Fresh `npm ci`, TypeScript typecheck and Next production build pass in the isolated worktree.
- Backend reconstruction scripts pass and 11 local restart-guard Python tests pass.
- Backend Docker testing on the original Simular worktree was blocked by DNS resolution of `deb.debian.org`; however, the GitHub PR checks subsequently passed the **full disposable backend suite** and SQL/Mongo application integration (8/8 checks green on PR #90 before the documentation-only amendment).
- A **fresh clone on the Mac** of PR #90 successfully passed the offline crop and private Maps preflight, started real OSRM car/bike/foot routers in a dedicated Docker context, healthy MySQL, Laravel API, and Next.js frontend. Verified HTTP 200 for `/`, `/api/mobility/local-auth/config` and `/mobility-pilot/maps-config`; HTTP 401 for unauthenticated `/api/mobility/commute/me`. The complete two-account browser journey and provider autocomplete are not yet verified in that clean installation. See `PHASE1_FRESH_CLONE_VERIFICATION_20261109.md`.

## Required review gates before merge

1. Confirm no secrets, raw pilot databases, vendor checkouts or generated build output are staged.
2. Review the backend exception-handling patch separately from UI changes; never swallow genuine provider outages.
3. Pass GitHub Actions frontend, backend and DBMS checks; verify rebuild/recovery on a fresh disposable setup, including provider key and routing crop supplied out of band.
4. Have a teammate follow `RUN_LOCAL_CORE.md` without developer assistance and record reproducible outcomes and prerequisites.
5. Keep remote branch pruning separate from the code PR, using the SHA audit manifest and team approval.
