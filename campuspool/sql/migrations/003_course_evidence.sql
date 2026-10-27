-- DBMS evidence: ALTER is kept as a separate, tracked migration so the
-- submitted database work demonstrates CREATE, ALTER and DROP explicitly.
ALTER TABLE rides MODIFY credit_price SMALLINT UNSIGNED NOT NULL DEFAULT 1;
ALTER TABLE outbox MODIFY attempts INT UNSIGNED NOT NULL DEFAULT 0;
