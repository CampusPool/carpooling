-- Assertions for the supplementary course model, NOT application migrations.
-- Every SELECT emits a named assertion and 1; verify.sh rejects any other value.
SELECT 'seed_counts', (SELECT COUNT(*) FROM dbms_users)=3
  AND (SELECT COUNT(*) FROM dbms_rides)=1 AND (SELECT COUNT(*) FROM dbms_bookings)=1;
SELECT 'join_driver', COUNT(*)=1 AND MIN(u.display_name)='Demo Driver'
  FROM dbms_rides r JOIN dbms_users u ON u.id=r.driver_id;
SELECT 'correlated_exists', COUNT(*)=1 AND MIN(id)=2 FROM dbms_users u
  WHERE EXISTS (SELECT 1 FROM dbms_bookings b WHERE b.rider_id=u.id);
SELECT 'nested_in', COUNT(*)=1 AND MIN(id)=10 FROM dbms_rides
  WHERE id IN (SELECT ride_id FROM dbms_bookings);
WITH RECURSIVE days(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM days WHERE n<7)
  SELECT 'recursive_cte', COUNT(*)=7 AND MIN(n)=1 AND MAX(n)=7 AND SUM(n)=28 FROM days;
SELECT 'function_round_up', dbms_shared_expense_per_rider(15001,2)=7501;
SELECT 'function_zero', dbms_shared_expense_per_rider(15000,0) IS NULL;
SELECT 'view_initial', COUNT(*)=1 AND MIN(remaining_seats)=1 AND MIN(accepted_fare_minor)=7500
  FROM dbms_active_rides WHERE id=10;
SELECT 'search_index', COUNT(*)=4 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)=
  'travel_date,status,origin_stop,destination_stop' FROM information_schema.statistics
  WHERE table_schema=DATABASE() AND table_name='dbms_rides' AND index_name='ix_dbms_rides_search';

-- The caller owns the transaction. Filling the last seat and the rejected
-- second call occur in the SAME session and transaction, then are rolled back.
DELIMITER //
CREATE PROCEDURE dbms_verify_capacity()
BEGIN
  DECLARE rejection_message TEXT DEFAULT '';
  START TRANSACTION;
  CALL dbms_book_ride(10,3,7500);
  SELECT 'procedure_inserts', COUNT(*)=2 FROM dbms_bookings WHERE ride_id=10 AND status='accepted';
  SELECT 'view_full', COUNT(*)=1 AND MIN(remaining_seats)=0 AND MIN(accepted_fare_minor)=15000
    FROM dbms_active_rides WHERE id=10;
  BEGIN
    DECLARE CONTINUE HANDLER FOR SQLSTATE '45000'
      GET DIAGNOSTICS CONDITION 1 rejection_message = MESSAGE_TEXT;
    CALL dbms_book_ride(10,2,7500);
  END;
  SELECT 'procedure_full_rejection', rejection_message='ride is full';
  SELECT 'procedure_rejection_preserves_count', COUNT(*)=2 FROM dbms_bookings WHERE ride_id=10;
  ROLLBACK;
  SELECT 'procedure_rollback', COUNT(*)=1 AND MIN(rider_id)=2 FROM dbms_bookings WHERE ride_id=10;
END//
DELIMITER ;
CALL dbms_verify_capacity();
DROP PROCEDURE dbms_verify_capacity;

START TRANSACTION;
INSERT INTO dbms_users(id,display_name) VALUES(99,'Disposable');
SELECT 'dml_insert', COUNT(*)=1 AND MIN(display_name)='Disposable' FROM dbms_users WHERE id=99;
UPDATE dbms_users SET display_name='Updated' WHERE id=99;
SELECT 'dml_update', COUNT(*)=1 AND MIN(display_name)='Updated' FROM dbms_users WHERE id=99;
DELETE FROM dbms_users WHERE id=99;
SELECT 'dml_delete', COUNT(*)=0 FROM dbms_users WHERE id=99;
ROLLBACK;
SELECT 'final_seed_unchanged', (SELECT COUNT(*) FROM dbms_users)=3
  AND (SELECT COUNT(*) FROM dbms_bookings)=1;
