# Project agent instructions

Use the `.jarvis/` files as durable project state for substantial work.

- For orchestration or resuming work, start with `.jarvis/RESUME.md` and `.jarvis/STATUS.md`.
- Read `.jarvis/PLAN.md` only when scheduling, dependencies, or acceptance criteria matter.
- Use `.jarvis/PROJECT.md` when scope, users, constraints, or definition of done matter.
- Check `.jarvis/DECISIONS.md` before revisiting an architectural or product decision.
- Reconcile written status with the actual repository and test results; code and observable evidence are authoritative.
- Keep RESUME.md short and update it before a handoff, context reset, or long pause.
- Delegate independent work when useful, but keep one coordinator responsible for integration and verification.
- Prefer bounded reads and fresh worker context over repeatedly loading full history.
