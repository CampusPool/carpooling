# Verification — 3 November 2026

Base revision: `bf4ce578431e592696443cda80d647ca1a8f3a17`.

On macOS with the isolated verification Docker context:

```sh
MOBILITY_DOCKER_CONTEXT=colima-sprint1-verify sh scripts/verify-dbms-level3.sh
```

The final complete run exited 0:

- 18 SQL result assertions: joins, nested/correlated queries, recursive CTE,
  stored function, index, view, transactional procedure capacity rejection and
  rollback, and INSERT/SELECT/UPDATE/DELETE.
- Expected FK, CHECK, UNIQUE, self-booking trigger and unavailable-ride procedure
  rejections; seed counts unchanged after rejected writes.
- Six analytics reports matched ten expected synthetic fixture rows, including
  balanced, unbalanced and missing-posting cases.
- Mongo collection/validator/unique index, expected invalid/duplicate write
  rejections, read/update/delete and aggregation assertions passed.
- No verifier containers remained after cleanup. Existing application containers
  and databases were not targets of this run.

Image IDs used (tags are mutable; subsequent CI logs record their own IDs):

- MySQL: `sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b`
- Mongo: `sha256:b9924c330a8bbc5800fe9c69f04a84e221eca7b28fd049a0354147d9908fa142`

The dedicated CI workflow reruns the submitted source and retains its sanitized
verification log. This local record is supplementary model/report-fixture proof;
it does not establish full application schema migration, concurrent race safety,
production authentication, real payments, individual contribution or viva acceptance.
