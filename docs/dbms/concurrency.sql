-- Run on the disposable dbms_evidence_* database in two mysql sessions.
-- Both sessions must use SET autocommit = 0;.
--
-- Rider 2 is already seeded in evidence.sql. Use two distinct new riders:
-- Before opening the sessions, add rider 4 in the disposable database:
-- INSERT INTO dbms_users (id, display_name) VALUES (4, 'Race Rider B');
-- Session A: CALL dbms_book_ride(10, 3, 7500);  -- then wait before COMMIT
-- Session B: CALL dbms_book_ride(10, 4, 7500);  -- blocks on ride row lock
--
-- After A commits, B resumes and gets SQLSTATE 45000 ('ride is full').
-- ROLLBACK both sessions after observing the result if this is a demo run.
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
SET autocommit = 0;
CALL dbms_book_ride(10, 3, 7500);
-- COMMIT; or ROLLBACK;
