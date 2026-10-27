-- Minimal disposable schema matching columns consumed by actual-analytics.sql.
CREATE TABLE users (id INT PRIMARY KEY);
CREATE TABLE trips (id INT PRIMARY KEY, user_id INT NOT NULL, trip_date DATETIME NOT NULL, total_seats INT NOT NULL, state VARCHAR(32) NOT NULL, is_passenger BOOLEAN NOT NULL DEFAULT FALSE, deleted_at DATETIME NULL);
CREATE TABLE trip_passengers (id INT PRIMARY KEY, trip_id INT NOT NULL, user_id INT NOT NULL, request_state INT NOT NULL);
CREATE TABLE mobility_pool_publications (trip_id INT PRIMARY KEY, user_id INT, quote_id CHAR(36));
CREATE TABLE mobility_trip_lifecycles (trip_id INT PRIMARY KEY, state VARCHAR(32) NOT NULL);
CREATE TABLE mobility_trip_events (id INT PRIMARY KEY AUTO_INCREMENT, trip_id INT NOT NULL, action VARCHAR(48) NOT NULL, created_at TIMESTAMP NOT NULL);
CREATE TABLE mobility_fare_snapshots (id INT PRIMARY KEY AUTO_INCREMENT, trip_id INT NOT NULL, booking_id INT NOT NULL, currency CHAR(3) NOT NULL, gross_amount BIGINT UNSIGNED NOT NULL);
CREATE TABLE mobility_financial_postings (id INT PRIMARY KEY AUTO_INCREMENT, trip_id INT NOT NULL, booking_id INT NOT NULL, entry_group VARCHAR(120) NOT NULL, account VARCHAR(64) NOT NULL, side VARCHAR(8) NOT NULL, amount BIGINT UNSIGNED NOT NULL, currency CHAR(3) NOT NULL);
CREATE TABLE mobility_route_quotes (id CHAR(36) PRIMARY KEY, college_code VARCHAR(64) NOT NULL, expires_at DATETIME NOT NULL, consumed_trip_id INT NULL);
CREATE TABLE mobility_commute_demo_trips (trip_id INT PRIMARY KEY, vehicle_type VARCHAR(8) NOT NULL, fare_minor INT NOT NULL, is_publication BOOLEAN NOT NULL DEFAULT FALSE, direction VARCHAR(12) NULL);

INSERT INTO users VALUES (1), (2), (3);
INSERT INTO trips VALUES (10, 1, '2099-01-01 09:00:00', 3, 'ready', FALSE, NULL), (11, 1, '2099-01-02 09:00:00', 2, 'ready', FALSE, NULL);
INSERT INTO trip_passengers VALUES (100, 10, 2, 1), (101, 10, 3, 1), (102, 10, 2, 0);
INSERT INTO mobility_pool_publications VALUES (10, 1, '00000000-0000-0000-0000-000000000010');
INSERT INTO mobility_trip_lifecycles VALUES (10, 'planned'), (11, 'planned');
INSERT INTO mobility_trip_events (trip_id, action, created_at) VALUES (10, 'published', '2028-01-01 00:00:00'), (10, 'accepted', '2028-01-01 00:01:00');
INSERT INTO mobility_fare_snapshots (trip_id, booking_id, currency, gross_amount) VALUES (10, 100, 'INR', 1000), (10, 101, 'INR', 700), (10, 102, 'INR', 500);
-- Balanced group, followed by an intentional unbalanced group.
INSERT INTO mobility_financial_postings (trip_id, booking_id, entry_group, account, side, amount, currency) VALUES
 (10, 100, 'capture:100', 'provider_clearing', 'debit', 1000, 'INR'), (10, 100, 'capture:100', 'rider_funds', 'credit', 1000, 'INR'),
 (10, 101, 'capture:101', 'provider_clearing', 'debit', 700, 'INR'), (10, 101, 'capture:101', 'rider_funds', 'credit', 600, 'INR');
-- Booking 102 has a fare snapshot but no posting group: missing case.
INSERT INTO mobility_route_quotes VALUES ('00000000-0000-0000-0000-000000000010', 'CAMPUS', '2037-01-01 00:00:00', 10), ('00000000-0000-0000-0000-000000000011', 'CAMPUS', '2037-01-02 00:00:00', NULL);
INSERT INTO mobility_commute_demo_trips (trip_id, vehicle_type, fare_minor, is_publication, direction) VALUES (11, 'car', 500, TRUE, 'inbound');
