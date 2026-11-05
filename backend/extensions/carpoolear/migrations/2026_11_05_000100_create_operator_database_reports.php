<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('mobility_booking_decision_events', function (Blueprint $table): void {
            $table->id();
            $table->unsignedInteger('trip_id');
            $table->unsignedInteger('booking_id')->nullable();
            $table->string('college_code', 64);
            $table->unsignedTinyInteger('previous_state')->nullable();
            $table->unsignedTinyInteger('next_state');
            // SQL writes UTC explicitly, independently of the app's IST timezone.
            $table->dateTime('occurred_at', 6);
            $table->index(['college_code', 'trip_id', 'id'], 'mobility_decision_scope');
            $table->foreign('trip_id')->references('id')->on('trips')->cascadeOnDelete();
            $table->foreign('booking_id')->references('id')->on('trip_passengers')->nullOnDelete();
        });

        // Laravel migrate:fresh drops tables/views, but MySQL retains routines.
        // The new audit table above must be successfully created first, so an
        // accidental up() against an installed migration preserves existing data.
        DB::unprepared('DROP PROCEDURE IF EXISTS mobility_operator_daily');
        DB::unprepared('DROP VIEW IF EXISTS mobility_operator_ride_facts');
        DB::unprepared('DROP FUNCTION IF EXISTS mobility_utilization_pct');
        DB::unprepared(<<<'MOBILITY_DDL'
CREATE FUNCTION mobility_utilization_pct(offered INT, accepted INT)
RETURNS DECIMAL(9,2) DETERMINISTIC NO SQL SQL SECURITY INVOKER
RETURN CASE WHEN offered > 0 THEN ROUND(100.0 * accepted / offered, 2) ELSE 0 END
MOBILITY_DDL);
        DB::unprepared(<<<'MOBILITY_DDL'
CREATE SQL SECURITY INVOKER VIEW mobility_operator_ride_facts AS
SELECT t.id AS trip_id, t.user_id AS driver_id, cohort_record.college_code,
       t.trip_date AS departure_at, DATE(t.trip_date) AS service_day,
       m.vehicle_type, m.direction, COALESCE(l.state, 'planned') AS state,
       t.total_seats, COALESCE(b.accepted_seats, 0) AS accepted_seats,
       GREATEST(0, t.total_seats - COALESCE(b.accepted_seats, 0)) AS available_seats,
       COALESCE(b.pending_requests, 0) AS pending_requests,
       COALESCE(b.declined_requests, 0) AS declined_requests,
       COALESCE(b.cancelled_requests, 0) AS cancelled_requests,
       mobility_utilization_pct(t.total_seats, COALESCE(b.accepted_seats, 0)) AS utilization_pct,
       (COALESCE(b.accepted_seats, 0) > t.total_seats) AS capacity_alert
FROM trips t
JOIN mobility_commute_demo_trips m ON m.trip_id = t.id AND m.is_publication = 1
JOIN mobility_local_accounts local_owner ON local_owner.user_id = t.user_id AND local_owner.role = 'driver'
JOIN mobility_memberships cohort_record ON cohort_record.user_id = t.user_id
LEFT JOIN mobility_trip_lifecycles l ON l.trip_id = t.id
LEFT JOIN (
    SELECT p.trip_id, SUM(p.request_state = 1) AS accepted_seats,
           SUM(p.request_state = 0) AS pending_requests,
           SUM(p.request_state = 2) AS declined_requests,
           SUM(p.request_state = 3) AS cancelled_requests
    FROM trip_passengers p JOIN trips owner_trip ON owner_trip.id = p.trip_id
    WHERE p.user_id <> owner_trip.user_id
    GROUP BY p.trip_id
) b ON b.trip_id = t.id
MOBILITY_DDL);
        DB::unprepared(<<<'MOBILITY_DDL'
CREATE PROCEDURE mobility_operator_daily(IN p_college VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci, IN p_from DATE, IN p_to DATE)
SQL SECURITY INVOKER READS SQL DATA
BEGIN
    IF p_college IS NULL OR p_college = '' OR p_from IS NULL OR p_to IS NULL
       OR p_from > p_to OR DATEDIFF(p_to, p_from) > 30 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid operator report window';
    END IF;
    WITH RECURSIVE days AS (
        SELECT DATE_SUB(p_from, INTERVAL 6 DAY) AS day
        UNION ALL SELECT DATE_ADD(day, INTERVAL 1 DAY) FROM days WHERE day < p_to
    ), facts AS (
        SELECT service_day AS day, COUNT(*) AS rides,
               SUM(total_seats) AS total_seats, SUM(accepted_seats) AS accepted_seats,
               SUM(pending_requests) AS pending_requests, SUM(cancelled_requests) AS cancelled_requests
        FROM mobility_operator_ride_facts
        WHERE college_code = p_college AND service_day BETWEEN DATE_SUB(p_from, INTERVAL 6 DAY) AND p_to
        GROUP BY service_day
    ), daily AS (
        SELECT days.day, COALESCE(facts.rides, 0) AS rides,
               COALESCE(facts.accepted_seats, 0) AS accepted_seats,
               COALESCE(facts.pending_requests, 0) AS pending_requests,
               COALESCE(facts.cancelled_requests, 0) AS cancelled_requests,
               mobility_utilization_pct(COALESCE(facts.total_seats, 0), COALESCE(facts.accepted_seats, 0)) AS utilization_pct
        FROM days LEFT JOIN facts ON facts.day = days.day
    ), rolling AS (
        SELECT daily.*, ROUND(AVG(rides) OVER (ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW), 2) AS rides_7d_average
        FROM daily
    ) SELECT * FROM rolling WHERE day >= p_from ORDER BY day;
END
MOBILITY_DDL);

        foreach (['insert' => 'NULL', 'update' => 'OLD.request_state'] as $event => $previous) {
            $condition = $event === 'update' ? 'AND NOT (OLD.request_state <=> NEW.request_state)' : '';
            DB::unprepared("CREATE TRIGGER mobility_booking_decision_{$event} AFTER ".strtoupper($event)." ON trip_passengers FOR EACH ROW
BEGIN
    IF NEW.request_state IN (0,1,2,3) {$condition} THEN
        INSERT INTO mobility_booking_decision_events (trip_id, booking_id, college_code, previous_state, next_state, occurred_at)
        SELECT NEW.trip_id, NEW.id, cohort_record.college_code, {$previous}, NEW.request_state, UTC_TIMESTAMP(6)
        FROM trips t
        JOIN mobility_commute_demo_trips m ON m.trip_id = t.id AND m.is_publication = 1
        JOIN mobility_local_accounts local_owner ON local_owner.user_id = t.user_id AND local_owner.role = 'driver'
        JOIN mobility_memberships cohort_record ON cohort_record.user_id = t.user_id
        WHERE t.id = NEW.trip_id AND NEW.user_id <> t.user_id;
    END IF;
END");
        }
    }

    public function down(): void
    {
        DB::unprepared('DROP TRIGGER IF EXISTS mobility_booking_decision_update');
        DB::unprepared('DROP TRIGGER IF EXISTS mobility_booking_decision_insert');
        DB::unprepared('DROP PROCEDURE IF EXISTS mobility_operator_daily');
        DB::unprepared('DROP VIEW IF EXISTS mobility_operator_ride_facts');
        DB::unprepared('DROP FUNCTION IF EXISTS mobility_utilization_pct');
        Schema::dropIfExists('mobility_booking_decision_events');
    }
};
