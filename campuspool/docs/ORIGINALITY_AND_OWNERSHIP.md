# Originality and teammate ownership record (draft)

This is a planning and evidence checklist, not a claim that anyone authored work they have not personally reviewed. Each teammate must inspect, run, explain, and review their own PR. Do not impersonate a teammate or reuse another person's credentials.

## Current issue ownership map

| Issue | Owner identity in handoff | Responsibility | Required understanding evidence |
| --- | --- | --- | --- |
| #39 | `arjunsrikanthh` | Full-stack Next.js bootstrap, auth, schema/migrations, shared API/core, CI, and support references | Explain session hashing, role approval, API envelope, migrations, CI, and why referenced #8/#9/#10/#36/#38/#22 work is not separately claimed |
| #12 | `zayaan-06` | Vehicle registration, capacity, admin review | Explain capacity rules, ownership checks, validation, and review flow |
| #21 | `zayaan-06` | Ride offer publication | Explain overlap, seat limits, idempotency, and approved vehicle checks |
| #23 | `arjunsrikanthh` | Booking quote, locking, acceptance and holds | Explain authorization, quote binding, row locks, capacity and ledger invariants |
| #24 | `NitheshMogaveer777` | Cancellation/refund/history | Explain actor authorization, one-time refund, retained history and capacity |
| #37 | `NitheshMogaveer777` | Integrity, activity/outbox/Mongo and SQL evidence | Explain asynchronous projection, unique event upsert, retries, view/procedure/guards, and that #40 remains Sprint 2 |
| #43 | `NikhilJoshi441` | Testing against the approved Test Plan | Explain traceability, test setup, deviations, and the shared search/closed-#22 baseline without claiming a new search implementation |
| #44 | `arjunsrikanthh` | Course docs and traceability | Explain each requirement mapping and identify every unverified gate |

## Evidence to collect per owner

1. Their own branch and PR link, with changed-file scope matching the issue manifest.
2. A short written explanation of the changed functions, schema invariants, failure cases, and tests.
3. A reproducible test command/output tied to a commit SHA; no copied or synthetic result.
4. Review comments/approval from another genuine teammate, where required by the course.
5. A statement identifying reused foundation work and their original additions.

The final originality decision belongs to the team/instructor. These documents and an AI-assisted work packet do not establish originality by themselves.
