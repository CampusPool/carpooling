# MobilityPlatform migration status

This branch replaces the previous CampusPool Next.js course scaffold with the MobilityPlatform source tree while preserving the GitHub repository and its history.

## Source boundary

The tracked MobilityPlatform work in this branch contains the original Laravel extension, Next.js client, activity projection service, Android client prototype, test harnesses and documentation. The upstream Laravel application that the extension mounts into is not copied into this branch. It is available from `STS-Rosario/carpoolear_backend` at the pinned revision recorded by `research/experiments/carpoolear/README.md`.

The upstream source is GPLv3 and has separate attribution and distribution obligations. This branch therefore does not claim to be a self-contained runnable baseline or a completed course submission. Before merging or publishing it, the team must decide whether to include the upstream application with its notices or retain the external pinned dependency and document the setup.

## Excluded local material

The migration deliberately excludes `.jarvis/`, `.local/`, raw reference captures, pilot databases, credentials, ignored dependency directories and generated build output. Those files remain in the private MobilityPlatform workspace.

## Verification boundary

The frontend and activity projection can be checked independently with their own package scripts. The Laravel integration harness requires the pinned upstream checkout and disposable services; it must not be pointed at the preserved pilot database. The product still has documented gaps around real email, real payments, physical tracking, provider configuration, production deployment and course approval.

## Proposed issue split

Issue-specific PRs must be created only after this baseline is accepted. Each PR should contain a genuine, reviewable change against this branch and include the relevant test/evidence command. Existing evidence does not prove that all Sprint 1 acceptance criteria are complete.
