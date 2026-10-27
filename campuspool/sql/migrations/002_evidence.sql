-- Sprint 1 DBMS evidence: view, stored procedure, indexes, and integrity guards.
-- The migration runner supports DELIMITER directives for the compound routines/triggers.
CREATE OR REPLACE VIEW driver_ride_summary AS
SELECT
  r.id AS ride_id,
  r.driver_id,
  u.name AS driver_name,
  r.departure_at,
  r.status,
  r.total_seats,
  r.seats_available,
  (r.total_seats - r.seats_available) AS seats_committed,
  COUNT(CASE WHEN b.status IN ('REQUESTED', 'ACCEPTED') THEN 1 END) AS active_bookings
FROM rides r
JOIN users u ON u.id = r.driver_id
LEFT JOIN bookings b ON b.ride_id = r.id
GROUP BY r.id, r.driver_id, u.name, r.departure_at, r.status,
         r.total_seats, r.seats_available;

CREATE INDEX idx_rides_driver_departure_status
  ON rides (driver_id, departure_at, status);
CREATE INDEX idx_bookings_ride_status
  ON bookings (ride_id, status);
CREATE INDEX idx_outbox_pending_created
  ON outbox (published_at, attempts, created_at);

DROP TRIGGER IF EXISTS rides_consistency_before_insert;
DROP TRIGGER IF EXISTS rides_consistency_before_update;
DROP TRIGGER IF EXISTS bookings_consistency_before_insert;
DROP TRIGGER IF EXISTS bookings_consistency_before_update;
DROP PROCEDURE IF EXISTS ride_capacity_report;
DROP TRIGGER IF EXISTS rides_immutable_after_booking;
DROP TRIGGER IF EXISTS ledger_append_only_update;
DROP TRIGGER IF EXISTS ledger_append_only_delete;
DELIMITER $$
CREATE TRIGGER rides_consistency_before_insert
BEFORE INSERT ON rides
FOR EACH ROW
BEGIN
  DECLARE owner_id BIGINT UNSIGNED;
  DECLARE vehicle_capacity INT;
  SELECT v.owner_id, v.passenger_capacity INTO owner_id, vehicle_capacity
    FROM vehicles v WHERE v.id = NEW.vehicle_id;
  IF owner_id IS NULL OR owner_id <> NEW.driver_id OR NEW.total_seats > vehicle_capacity THEN
    SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO = 1644, MESSAGE_TEXT = 'ride driver, vehicle owner, and capacity must agree';
  END IF;
END$$

CREATE TRIGGER rides_consistency_before_update
BEFORE UPDATE ON rides
FOR EACH ROW
BEGIN
  DECLARE owner_id BIGINT UNSIGNED;
  DECLARE vehicle_capacity INT;
  SELECT v.owner_id, v.passenger_capacity INTO owner_id, vehicle_capacity
    FROM vehicles v WHERE v.id = NEW.vehicle_id;
  IF owner_id IS NULL OR owner_id <> NEW.driver_id OR NEW.total_seats > vehicle_capacity THEN
    SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO = 1644, MESSAGE_TEXT = 'ride driver, vehicle owner, and capacity must agree';
  END IF;
  IF NEW.status = 'CANCELLED' AND EXISTS (
    SELECT 1 FROM bookings b WHERE b.ride_id = OLD.id AND b.status IN ('REQUESTED', 'ACCEPTED')
  ) THEN
    SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO = 1644, MESSAGE_TEXT = 'cancel ride after closing active bookings';
  END IF;
END$$

CREATE TRIGGER bookings_consistency_before_insert
BEFORE INSERT ON bookings
FOR EACH ROW
BEGIN
  DECLARE ride_driver BIGINT UNSIGNED;
  DECLARE ride_status VARCHAR(10);
  SELECT r.driver_id, r.status INTO ride_driver, ride_status FROM rides r WHERE r.id = NEW.ride_id;
  IF ride_driver IS NULL OR NEW.rider_id = ride_driver THEN
    SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO = 1644, MESSAGE_TEXT = 'driver cannot book own ride';
  END IF;
  IF NEW.status IN ('REQUESTED', 'ACCEPTED') AND ride_status <> 'PUBLISHED' THEN
    SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO = 1644, MESSAGE_TEXT = 'active booking requires a published ride';
  END IF;
END$$

CREATE TRIGGER bookings_consistency_before_update
BEFORE UPDATE ON bookings
FOR EACH ROW
BEGIN
  DECLARE ride_driver BIGINT UNSIGNED;
  DECLARE ride_status VARCHAR(10);
  IF NEW.ride_id <> OLD.ride_id OR NEW.rider_id <> OLD.rider_id THEN
    SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO = 1644, MESSAGE_TEXT = 'booking identity is immutable';
  END IF;
  SELECT r.driver_id, r.status INTO ride_driver, ride_status FROM rides r WHERE r.id = NEW.ride_id;
  IF NEW.status IN ('REQUESTED', 'ACCEPTED') AND (NEW.rider_id = ride_driver OR ride_status <> 'PUBLISHED') THEN
    SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO = 1644, MESSAGE_TEXT = 'active booking requires a distinct rider and published ride';
  END IF;
END$$

CREATE PROCEDURE ride_capacity_report(IN p_report_date DATE)
BEGIN
  SELECT
    r.id AS ride_id,
    r.driver_id,
    r.departure_at,
    r.total_seats,
    r.seats_available,
    (r.total_seats - r.seats_available) AS seats_committed,
    CASE WHEN r.seats_available = 0 THEN 'FULL'
         WHEN r.seats_available < r.total_seats THEN 'PARTIAL'
         ELSE 'OPEN' END AS capacity_state
  FROM rides r
  WHERE DATE(r.departure_at) = p_report_date
  ORDER BY r.departure_at, r.id;
END$$

CREATE TRIGGER rides_immutable_after_booking
BEFORE UPDATE ON rides
FOR EACH ROW
BEGIN
  DECLARE owner_id BIGINT UNSIGNED;
  DECLARE vehicle_capacity INT;
  SELECT v.owner_id, v.passenger_capacity INTO owner_id, vehicle_capacity
    FROM vehicles v WHERE v.id = NEW.vehicle_id;
  IF owner_id IS NULL OR owner_id <> NEW.driver_id OR NEW.total_seats > vehicle_capacity THEN
    SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO = 1644, MESSAGE_TEXT = 'ride driver, vehicle owner, and capacity must agree';
  END IF;
  IF NEW.status = 'CANCELLED' AND EXISTS (
    SELECT 1 FROM bookings b WHERE b.ride_id = OLD.id AND b.status IN ('REQUESTED', 'ACCEPTED')
  ) THEN
    SIGNAL SQLSTATE '45000' SET MYSQL_ERRNO = 1644, MESSAGE_TEXT = 'cancel ride after closing active bookings';
  END IF;
  IF EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.ride_id = OLD.id AND b.status IN ('REQUESTED', 'ACCEPTED')
  ) AND (
    NOT (NEW.driver_id <=> OLD.driver_id) OR
    NOT (NEW.vehicle_id <=> OLD.vehicle_id) OR
    NOT (NEW.origin_stop_id <=> OLD.origin_stop_id) OR
    NOT (NEW.destination_stop_id <=> OLD.destination_stop_id) OR
    NOT (NEW.departure_at <=> OLD.departure_at) OR
    NOT (NEW.total_seats <=> OLD.total_seats) OR
    NOT (NEW.credit_price <=> OLD.credit_price)
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'ride is immutable while it has active bookings';
  END IF;
END$$

CREATE TRIGGER ledger_append_only_update
BEFORE UPDATE ON ledger
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ledger is append-only';
END$$

CREATE TRIGGER ledger_append_only_delete
BEFORE DELETE ON ledger
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ledger is append-only';
END$$
DELIMITER ;
