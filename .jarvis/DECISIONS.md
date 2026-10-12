# Decisions

### 2026-10-12 — One platform, two course evaluations (pending instructor approval)
- Context: SE sprint-based delivery and DBMS Level 3 database learning.
- Decision: Develop a shared CampusPool Next.js application with separately documented course deliverables.
- Why: Avoid duplicated app work and enable concrete database feature demonstrations.
- Consequences: Must get instructor agreement and satisfy two distinct grading rubrics.

### 2026-10-12 — Students only (pending SRS reconciliation)
- Decision: Student host/passenger accounts plus authorized administrators; do not implement faculty/employee mode.
- Consequence: Story 5.4 retained for traceability but not planned.

### 2026-10-12 — Proposed SQL + MongoDB architecture
- Decision: PostgreSQL owns transactional accounts/rides/bookings; MongoDB stores notifications/ride events and optional chat.
- Why: Strong integrity requirements for booking and flexible event documents.
- Consequences: Cross-database events must not make MongoDB authoritative for seats.

### 2026-10-12 — Payment modeling
- Decision: Expense-sharing estimates and recorded host acknowledgements, not a commercial gateway.
- Why: Payment integration and university transport policies are unconfirmed.

### 2026-10-12 — Sprint estimate caution
- Decision: Treat 61 + 73 SP as the source baseline, not a proven achievable commitment.
- Why: Unmeasured team velocity and short one-week sprint periods.
