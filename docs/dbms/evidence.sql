-- Disposable-only DBMS evidence fixture for MobilityPlatform.
-- The verification wrapper requires DBMS_EVIDENCE_ALLOW_DISPOSABLE=1 and a
-- database named dbms_evidence_* before executing this file.

SET FOREIGN_KEY_CHECKS = 0;
DROP VIEW IF EXISTS dbms_active_rides;
DROP PROCEDURE IF EXISTS dbms_book_ride;
DROP FUNCTION IF EXISTS dbms_shared_expense_per_rider;
DROP TRIGGER IF EXISTS dbms_bookings_before_insert;
DROP TABLE IF EXISTS dbms_ledger_entries;
DROP TABLE IF EXISTS dbms_expenses;
DROP TABLE IF EXISTS dbms_bookings;
DROP TABLE IF EXISTS dbms_rides;
DROP TABLE IF EXISTS dbms_users;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE dbms_users (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  display_name VARCHAR(120) NOT NULL,
  UNIQUE KEY uq_dbms_users_display_name (display_name)
) ENGINE=InnoDB;

CREATE TABLE dbms_rides (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  driver_id BIGINT UNSIGNED NOT NULL,
  travel_date DATE NOT NULL,
  origin_stop VARCHAR(120) NOT NULL,
  destination_stop VARCHAR(120) NOT NULL,
  status ENUM('planned','active','completed','cancelled') NOT NULL DEFAULT 'planned',
  seats_total SMALLINT UNSIGNED NOT NULL,
  fare_minor INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_dbms_rides_seats CHECK (seats_total > 0),
  CONSTRAINT ck_dbms_rides_route CHECK (origin_stop <> destination_stop),
  CONSTRAINT fk_dbms_rides_driver FOREIGN KEY (driver_id) REFERENCES dbms_users(id),
  KEY ix_dbms_rides_search (travel_date, status, origin_stop, destination_stop)
) ENGINE=InnoDB;

CREATE TABLE dbms_bookings (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  ride_id BIGINT UNSIGNED NOT NULL,
  rider_id BIGINT UNSIGNED NOT NULL,
  status ENUM('accepted','cancelled') NOT NULL DEFAULT 'accepted',
  fare_minor INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_dbms_bookings_fare CHECK (fare_minor >= 0),
  CONSTRAINT fk_dbms_bookings_ride FOREIGN KEY (ride_id) REFERENCES dbms_rides(id),
  CONSTRAINT fk_dbms_bookings_rider FOREIGN KEY (rider_id) REFERENCES dbms_users(id),
  UNIQUE KEY uq_dbms_booking_identity (ride_id, rider_id),
  KEY ix_dbms_bookings_ride_status (ride_id, status)
) ENGINE=InnoDB;

CREATE TABLE dbms_expenses (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  ride_id BIGINT UNSIGNED NOT NULL,
  booking_id BIGINT UNSIGNED NULL,
  total_minor INT UNSIGNED NOT NULL,
  participant_count SMALLINT UNSIGNED NOT NULL,
  CONSTRAINT ck_dbms_expenses_participants CHECK (participant_count > 0),
  CONSTRAINT fk_dbms_expenses_ride FOREIGN KEY (ride_id) REFERENCES dbms_rides(id),
  CONSTRAINT fk_dbms_expenses_booking FOREIGN KEY (booking_id) REFERENCES dbms_bookings(id)
) ENGINE=InnoDB;

CREATE TABLE dbms_ledger_entries (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  expense_id BIGINT UNSIGNED NOT NULL,
  account VARCHAR(64) NOT NULL,
  side ENUM('debit','credit') NOT NULL,
  amount_minor INT UNSIGNED NOT NULL,
  CONSTRAINT ck_dbms_ledger_amount CHECK (amount_minor > 0),
  CONSTRAINT fk_dbms_ledger_expense FOREIGN KEY (expense_id) REFERENCES dbms_expenses(id),
  UNIQUE KEY uq_dbms_ledger_posting (expense_id, account, side)
) ENGINE=InnoDB;

DELIMITER //
CREATE TRIGGER dbms_bookings_before_insert
BEFORE INSERT ON dbms_bookings
FOR EACH ROW
BEGIN
  DECLARE ride_driver BIGINT UNSIGNED;
  SELECT driver_id INTO ride_driver FROM dbms_rides WHERE id = NEW.ride_id;
  IF ride_driver IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ride does not exist';
  END IF;
  IF NEW.rider_id = ride_driver THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'driver cannot book own ride';
  END IF;
END//

CREATE FUNCTION dbms_shared_expense_per_rider(p_total_minor INT UNSIGNED, p_participants SMALLINT UNSIGNED)
RETURNS INT DETERMINISTIC
RETURN CASE WHEN p_participants = 0 THEN NULL
            ELSE CEIL(p_total_minor / p_participants) END//

CREATE PROCEDURE dbms_book_ride(IN p_ride_id BIGINT UNSIGNED, IN p_rider_id BIGINT UNSIGNED, IN p_fare_minor INT UNSIGNED)
SQL SECURITY INVOKER
BEGIN
  DECLARE v_seats SMALLINT UNSIGNED;
  DECLARE v_booked BIGINT UNSIGNED;
  SELECT seats_total INTO v_seats FROM dbms_rides
    WHERE id = p_ride_id AND status IN ('planned','active') FOR UPDATE;
  IF v_seats IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ride is unavailable';
  END IF;
  SELECT COUNT(*) INTO v_booked FROM dbms_bookings
    WHERE ride_id = p_ride_id AND status = 'accepted';
  IF v_booked >= v_seats THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ride is full';
  END IF;
  INSERT INTO dbms_bookings (ride_id, rider_id, fare_minor)
    VALUES (p_ride_id, p_rider_id, p_fare_minor);
END//
DELIMITER ;

CREATE OR REPLACE VIEW dbms_active_rides AS
SELECT r.id, r.driver_id, r.travel_date, r.origin_stop, r.destination_stop,
       r.status, r.seats_total,
       r.seats_total - COALESCE(SUM(b.status = 'accepted'), 0) AS remaining_seats,
       COALESCE(SUM(CASE WHEN b.status = 'accepted' THEN b.fare_minor ELSE 0 END), 0) AS accepted_fare_minor
FROM dbms_rides r
LEFT JOIN dbms_bookings b ON b.ride_id = r.id
WHERE r.status IN ('planned','active')
GROUP BY r.id, r.driver_id, r.travel_date, r.origin_stop,
         r.destination_stop, r.status, r.seats_total;

INSERT INTO dbms_users (id, display_name) VALUES
  (1, 'Demo Driver'), (2, 'Demo Rider A'), (3, 'Demo Rider B');
INSERT INTO dbms_rides (id, driver_id, travel_date, origin_stop, destination_stop, status, seats_total, fare_minor)
  VALUES (10, 1, CURRENT_DATE + INTERVAL 1 DAY, 'Campus Gate', 'City Centre', 'active', 2, 7500);
INSERT INTO dbms_bookings (ride_id, rider_id, fare_minor) VALUES (10, 2, 7500);
INSERT INTO dbms_expenses (ride_id, booking_id, total_minor, participant_count) VALUES (10, 1, 15000, 2);
INSERT INTO dbms_ledger_entries (expense_id, account, side, amount_minor) VALUES
  (1, 'rider_receivable', 'debit', 15000), (1, 'driver_payable', 'credit', 15000);
