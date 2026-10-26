-- CampusPool original TypeScript schema. All application timestamps are UTC.
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(10) NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'PENDING',
  credits INT UNSIGNED NOT NULL DEFAULT 1000,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  CONSTRAINT ck_users_role CHECK (role IN ('RIDER','DRIVER','ADMIN')),
  CONSTRAINT ck_users_status CHECK (status IN ('PENDING','APPROVED','SUSPENDED'))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (token_hash),
  KEY idx_sessions_user_expiry (user_id, expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS auth_attempts (
  bucket_key VARCHAR(160) NOT NULL,
  failures SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME(3) NOT NULL,
  PRIMARY KEY (bucket_key),
  KEY idx_auth_attempts_expiry (expires_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stops (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  lat DECIMAL(9,6) NULL,
  lng DECIMAL(9,6) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_stops_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vehicles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  owner_id BIGINT UNSIGNED NOT NULL,
  kind VARCHAR(5) NOT NULL,
  registration VARCHAR(32) NOT NULL,
  model VARCHAR(100) NOT NULL,
  passenger_capacity TINYINT UNSIGNED NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'PENDING',
  reviewed_by BIGINT UNSIGNED NULL,
  review_note VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_vehicles_registration (registration),
  KEY idx_vehicles_owner_status (owner_id, status),
  CONSTRAINT fk_vehicles_owner FOREIGN KEY (owner_id) REFERENCES users(id),
  CONSTRAINT fk_vehicles_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT ck_vehicles_kind CHECK (kind IN ('CAR','BIKE')),
  CONSTRAINT ck_vehicles_status CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  CONSTRAINT ck_vehicles_capacity CHECK (passenger_capacity BETWEEN 1 AND 5 AND (kind <> 'BIKE' OR passenger_capacity = 1))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rides (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  driver_id BIGINT UNSIGNED NOT NULL,
  vehicle_id BIGINT UNSIGNED NOT NULL,
  origin_stop_id BIGINT UNSIGNED NOT NULL,
  destination_stop_id BIGINT UNSIGNED NOT NULL,
  departure_at DATETIME(3) NOT NULL,
  total_seats TINYINT UNSIGNED NOT NULL,
  seats_available TINYINT UNSIGNED NOT NULL,
  credit_price SMALLINT UNSIGNED NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'PUBLISHED',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_rides_driver_status_time (driver_id, status, departure_at),
  KEY idx_rides_route_time (origin_stop_id, destination_stop_id, departure_at, status),
  CONSTRAINT fk_rides_driver FOREIGN KEY (driver_id) REFERENCES users(id),
  CONSTRAINT fk_rides_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
  CONSTRAINT fk_rides_origin FOREIGN KEY (origin_stop_id) REFERENCES stops(id),
  CONSTRAINT fk_rides_destination FOREIGN KEY (destination_stop_id) REFERENCES stops(id),
  CONSTRAINT ck_rides_status CHECK (status IN ('PUBLISHED','CANCELLED','COMPLETED')),
  CONSTRAINT ck_rides_stops CHECK (origin_stop_id <> destination_stop_id),
  CONSTRAINT ck_rides_seats CHECK (total_seats BETWEEN 1 AND 5 AND seats_available <= total_seats),
  CONSTRAINT ck_rides_price CHECK (credit_price BETWEEN 1 AND 1000)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bookings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ride_id BIGINT UNSIGNED NOT NULL,
  rider_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'REQUESTED',
  cancelled_by BIGINT UNSIGNED NULL,
  cancellation_reason VARCHAR(200) NULL,
  active_rider_id BIGINT UNSIGNED GENERATED ALWAYS AS
    (CASE WHEN status IN ('REQUESTED','ACCEPTED') THEN rider_id ELSE NULL END) STORED,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_bookings_active_rider (ride_id, active_rider_id),
  KEY idx_bookings_rider_status (rider_id, status),
  CONSTRAINT fk_bookings_ride FOREIGN KEY (ride_id) REFERENCES rides(id),
  CONSTRAINT fk_bookings_rider FOREIGN KEY (rider_id) REFERENCES users(id),
  CONSTRAINT fk_bookings_canceller FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT ck_bookings_status CHECK (status IN ('REQUESTED','ACCEPTED','REJECTED','CANCELLED'))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ledger (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  booking_id BIGINT UNSIGNED NOT NULL,
  kind VARCHAR(6) NOT NULL,
  amount INT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_ledger_booking_kind (booking_id, kind),
  KEY idx_ledger_user_created (user_id, created_at),
  CONSTRAINT fk_ledger_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_ledger_booking FOREIGN KEY (booking_id) REFERENCES bookings(id),
  CONSTRAINT ck_ledger_kind CHECK (kind IN ('HOLD','REFUND')),
  CONSTRAINT ck_ledger_amount CHECK (amount > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS idempotency_records (
  actor_id BIGINT UNSIGNED NOT NULL,
  key_hash CHAR(64) NOT NULL,
  scope VARCHAR(80) NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  response_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (actor_id, key_hash),
  KEY idx_idempotency_created (created_at),
  CONSTRAINT fk_idempotency_actor FOREIGN KEY (actor_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS outbox (
  event_id CHAR(36) NOT NULL,
  type VARCHAR(100) NOT NULL,
  actor_id BIGINT UNSIGNED NOT NULL,
  audience_ids JSON NOT NULL,
  ride_id BIGINT UNSIGNED NULL,
  booking_id BIGINT UNSIGNED NULL,
  data JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  published_at DATETIME(3) NULL,
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (event_id),
  KEY idx_outbox_pending (published_at, created_at),
  KEY idx_outbox_actor_created (actor_id, created_at),
  CONSTRAINT fk_outbox_actor FOREIGN KEY (actor_id) REFERENCES users(id),
  CONSTRAINT fk_outbox_ride FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE SET NULL,
  CONSTRAINT fk_outbox_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL
) ENGINE=InnoDB;
