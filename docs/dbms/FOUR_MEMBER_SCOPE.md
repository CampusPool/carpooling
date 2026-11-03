# Four-member DBMS scope

This DBMS project has four members: Arjun, Nithesh, Nikhil and Zayaan.
The four workstreams below are an acceptance plan, not a declaration that each
student has completed that work. Git commits, PRs, execution evidence and each
student's explanation establish actual contribution. Nithesh coordinates the
database deliverable PR; that does not transfer authorship of all project work.

| Member | DBMS-related responsibility | Concrete complexity and evidence expected |
|---|---|---|
| Nithesh | Relational design, integrity and Mongo data model | Explain actual ERD/cardinalities, keys, FK versus logical references, normalization/snapshots, migration order, procedure/function/trigger, SQL and Mongo index choices; run the isolated database verifier and interpret failures. Track #36/#37/#40. |
| Arjun | Transactional backend, authentication and financial persistence | Connect API authorization to stored ownership/roles, capacity and idempotency; explain transaction boundaries and financial invariants. Local test accounts exist; full authentication and payment delivery remain pending. Track #10/#38 and payment issues. |
| Nikhil | Discovery SQL, query analysis and verification | Explain route/date/availability filtering, correlated/nested queries and recursive CTE use, compare index plans using EXPLAIN, verify negative cases and concurrency on isolated data, and distinguish fixture tests from application tests. Track #22/#41/#43. |
| Zayaan | Next.js database integration and permission-aware UI | Demonstrate persisted publication/search/booking flows across independent users, error/empty/loading states, role-restricted actions, notifications/chat visibility and API contracts. Complete pending UI package integration. Track #21/#42. |

## Why the database work is substantial

The actual application is more than independent entity CRUD. Quotes and trip
snapshots preserve agreed terms; bookings and route intervals require capacity
invariants; lifecycle changes create versioned, idempotent events; users have
ownership/privacy boundaries. The Mongo projection is a rebuildable read model
with event identity and replay rules, not a second reservation authority.

Evidence must demonstrate these relationships and failure cases, not merely
count migrations or tables. Students should be able to alter a query, explain a
constraint failure and trace a browser action into persisted rows. The small
`dbms_*` teaching model makes SQL concepts inspectable; its size alone is not
the four-member complexity justification.

## Present versus pending

- Present in source: relational extension migrations, query/transaction services,
  local-account password hashing and stored roles, event projection, test suites,
  and this executable SQL/Mongo course model. Source presence is not proof that
  every feature is operational or every student authored it.
- Pending delivery: full authentication, real payments and other deferred product
  features. Existing payment schemas/tests and synthetic credit records do not
  establish provider integration or real settlement.
- Pending integration: Nikhil03, Zayaan04, then Arjun05; this DBMS PR is separate.
- Pending assessment: actual individual contribution, originality/attribution,
  modification/viva and instructor evaluation. No claim of guaranteed marks or
  an official four-member minimum threshold is made by this document.

## Final contribution record

For each member, record their actual PR/commit links, files and behavior changed,
tests personally reproduced, demonstration segment and remaining gaps. Preserve
upstream host attribution and disclose AI assistance. Do not allocate credit
based only on the GitHub account used to submit a PR.
