# Repository guidance

- Treat tracked source, tests and documentation as authoritative. Do not depend on untracked local state, private workspaces or `.jarvis` files.
- Keep changes focused, reviewable and attributable to the issue being addressed. Do not commit credentials, tokens, databases, screenshots containing personal data or generated vendor checkouts.
- Use disposable synthetic environments for backend checks. Never reset, seed or connect to a preserved pilot database.
- Before changing the backend integration, read `MIGRATION_STATUS.md`, `THIRD_PARTY_NOTICES.md` and `research/experiments/carpoolear/README.md`.
- Preserve the pinned upstream revision and GPLv3 notices. Run the relevant frontend/service tests and `sh research/experiments/carpoolear/verify-reconstruction.sh` when changing integration files.
- Keep local browser demos loopback-only and use `research/experiments/carpoolear/run-demo-local.sh`; do not use port 18080 or live provider credentials.
