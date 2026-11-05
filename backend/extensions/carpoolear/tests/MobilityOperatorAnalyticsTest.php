<?php

namespace Tests\Feature\Mobility;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use STS\Models\Trip;
use STS\Models\User;
use Tests\TestCase;

final class MobilityOperatorAnalyticsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        putenv('MOBILITY_COLLEGE_CODE=CAMPUS-BLR');
        config(['operator_analytics.url' => null, 'operator_analytics.key' => null]);
    }

    public function test_report_requires_an_active_admin_and_valid_bounded_window(): void
    {
        foreach ([['is_admin' => false], ['is_admin' => true, 'active' => false], ['is_admin' => true, 'banned' => true]] as $flags) {
            $actor = User::factory()->create(array_merge(['active' => true, 'banned' => false], $flags));
            $response = $this->actingAsApiUser($actor)->getJson('/api/mobility/operator/analytics');
            $this->assertContains($response->status(), [401, 403]);
        }
        $this->actingAsApiUser($this->admin());
        foreach (['0', '32', '-1', '1.5', '7x', 'days%5B%5D=7'] as $value) {
            $query = str_starts_with($value, 'days') ? $value : 'days='.$value;
            $this->getJson('/api/mobility/operator/analytics?'.$query)->assertStatus(422);
        }
    }

    public function test_empty_sql_window_contains_calendar_rows_and_explicit_disabled_mongo(): void
    {
        $this->actingAsApiUser($this->admin())->getJson('/api/mobility/operator/analytics?days=7')
            ->assertOk()->assertJsonPath('sql.summary.rides', 0)->assertJsonCount(7, 'sql.daily')
            ->assertJsonPath('sql.daily.0.rides', 0)->assertJsonPath('activity.status', 'disabled');
    }

    public function test_view_procedure_and_audit_preserve_counts_and_filter_scope_without_join_fanout(): void
    {
        $trip = $this->publication();
        $empty = $this->publication();
        $otherCollege = $this->publication('OTHER-COLLEGE');
        $fixture = $this->publication('CAMPUS-BLR', false);
        $booking = $this->booking($trip, 0);
        DB::table('trip_passengers')->where('id', $booking)->update(['request_state' => 1]);
        $this->booking($trip, 0);
        $this->booking($trip, 2);
        $this->booking($trip, 3);
        $this->booking($otherCollege, 1);
        $this->booking($fixture, 1);
        // A historical suspended host is still included in operational reporting.
        DB::table('mobility_memberships')->where('user_id', $trip->user_id)->update(['status' => 'suspended']);

        $response = $this->actingAsApiUser($this->admin())->getJson('/api/mobility/operator/analytics?days=7')->assertOk();
        $response->assertJsonPath('sql.summary.rides', 2)->assertJsonPath('sql.summary.total_seats', 4)
            ->assertJsonPath('sql.summary.accepted_seats', 1)->assertJsonPath('sql.summary.pending_requests', 1)
            ->assertJsonPath('sql.summary.declined_requests', 1)->assertJsonPath('sql.summary.cancelled_requests', 1)
            ->assertJsonPath('sql.summary.over_capacity_rides', 0)->assertJsonCount(2, 'sql.rides')
            ->assertJsonCount(5, 'sql.audit')->assertJsonPath('sql.daily.6.rides', 2)
            ->assertJsonPath('sql.daily.6.rides_7d_average', 0.29);
        $this->assertEqualsCanonicalizing([$trip->id, $empty->id], array_column($response->json('sql.rides'), 'trip_id'));
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        foreach (['driver_id', 'college_code', 'email', 'password', 'response_body', 'request_fingerprint', 'idempotency_key'] as $private) {
            $this->assertStringNotContainsString('"'.$private.'"', $response->getContent());
        }
        $parameter = DB::selectOne("SELECT COLLATION_NAME AS collation_name FROM information_schema.PARAMETERS WHERE SPECIFIC_SCHEMA = DATABASE() AND SPECIFIC_NAME = 'mobility_operator_daily' AND PARAMETER_NAME = 'p_college'");
        $this->assertSame('utf8mb4_unicode_ci', $parameter->collation_name);
        $this->assertEquals(50, DB::selectOne('SELECT mobility_utilization_pct(2,1) AS value')->value);
        $this->assertEquals(200, DB::selectOne('SELECT mobility_utilization_pct(1,2) AS value')->value);
    }

    public function test_decision_trigger_is_transactional_and_same_state_retries_create_no_event(): void
    {
        $trip = $this->publication();
        $id = $this->booking($trip, 0);
        $before = DB::table('mobility_booking_decision_events')->count();
        DB::transaction(function () use ($id): void {
            DB::table('trip_passengers')->where('id', $id)->update(['request_state' => 1]);
            DB::table('trip_passengers')->where('id', $id)->update(['request_state' => 1]);
        });
        $this->assertSame($before + 1, DB::table('mobility_booking_decision_events')->count());
        try {
            DB::transaction(function () use ($id): void {
                DB::table('trip_passengers')->where('id', $id)->update(['request_state' => 3]);
                throw new \RuntimeException('rollback decision');
            });
        } catch (\RuntimeException $error) {
            $this->assertSame('rollback decision', $error->getMessage());
        }
        $this->assertSame(1, (int) DB::table('trip_passengers')->where('id', $id)->value('request_state'));
        $this->assertSame($before + 1, DB::table('mobility_booking_decision_events')->count());
    }

    public function test_mongo_outage_keeps_real_sql_report_available_and_never_reports_zero_as_success(): void
    {
        $this->publication();
        config(['operator_analytics.url' => 'http://activity:8090', 'operator_analytics.key' => str_repeat('k', 32)]);
        Http::fake(['activity:8090/*' => Http::response(['error' => 'internal database details'], 503)]);
        $this->actingAsApiUser($this->admin())->getJson('/api/mobility/operator/analytics')
            ->assertOk()->assertJsonPath('sql.summary.rides', 1)
            ->assertJsonPath('activity.status', 'unavailable')->assertJsonPath('activity.daily', [])
            ->assertDontSee('internal database details');
    }

    public function test_private_aggregate_request_uses_server_scope_and_response_omits_additional_fields(): void
    {
        $trip = $this->publication();
        $this->publication('OTHER-COLLEGE');
        config(['operator_analytics.url' => 'http://activity:8090', 'operator_analytics.key' => str_repeat('k', 32)]);
        Http::fake(['activity:8090/*' => Http::response([
            'status' => 'ready', 'last_synced_at' => now('UTC')->toIso8601String(),
            'actorId' => 12345,
            'daily' => [['day' => now('Asia/Kolkata')->toDateString(), 'action' => 'start', 'eventCount' => 1, 'uniqueTripCount' => 1, 'actorId' => 12345]],
        ])]);
        $this->actingAsApiUser($this->admin())->getJson('/api/mobility/operator/analytics')
            ->assertOk()->assertJsonPath('activity.status', 'ready')->assertJsonPath('activity.daily.0.eventCount', 1)
            ->assertDontSee('actorId');
        Http::assertSent(fn ($request) => $request->url() === 'http://activity:8090/daily'
            && $request->hasHeader('X-Mobility-Analytics-Key', str_repeat('k', 32))
            && $request['trip_ids'] === [$trip->id]);
    }

    public function test_new_database_objects_can_be_removed_and_reapplied_without_changing_booking_rows(): void
    {
        $trip = $this->publication();
        $this->booking($trip, 1);
        $before = DB::table('trip_passengers')->count();
        $extensionRoot = getenv('MOBILITY_EXTENSION_ROOT');
        $this->assertNotFalse($extensionRoot, 'The disposable test harness must configure MOBILITY_EXTENSION_ROOT.');
        $migration = require rtrim($extensionRoot, '/').'/migrations/2026_11_05_000100_create_operator_database_reports.php';
        $migration->down();
        $this->assertSame($before, DB::table('trip_passengers')->count());
        $migration->up();
        $this->actingAsApiUser($this->admin())->getJson('/api/mobility/operator/analytics')
            ->assertOk()->assertJsonPath('sql.summary.accepted_seats', 1);
    }

    private function admin(): User
    {
        return User::factory()->create(['active' => true, 'banned' => false, 'is_admin' => true]);
    }

    private function publication(string $college = 'CAMPUS-BLR', bool $publication = true): Trip
    {
        $driver = User::factory()->create(['active' => true, 'banned' => false]);
        DB::table('mobility_local_accounts')->insert(['user_id' => $driver->id, 'username' => 'report_'.$driver->id, 'role' => 'driver', 'created_at' => now(), 'updated_at' => now()]);
        DB::table('mobility_memberships')->insert(['user_id' => $driver->id, 'college_code' => $college, 'affiliation' => 'student', 'status' => 'approved', 'created_at' => now(), 'updated_at' => now()]);
        $trip = Trip::factory()->create(['user_id' => $driver->id, 'trip_date' => now('Asia/Kolkata')->setTime(10, 0), 'total_seats' => 2]);
        DB::table('mobility_commute_demo_trips')->insert(['trip_id' => $trip->id, 'audience_id' => 0, 'fixture_key' => 'operator-report-'.$trip->id, 'vehicle_type' => 'car', 'direction' => 'outbound', 'is_publication' => $publication, 'fare_minor' => 0, 'base_fare_minor' => 0, 'surcharge_minor' => 0, 'journey' => '{}', 'created_at' => now(), 'updated_at' => now()]);
        DB::table('mobility_trip_lifecycles')->insert(['trip_id' => $trip->id, 'state' => 'planned', 'version' => 0, 'created_at' => now(), 'updated_at' => now()]);
        return $trip;
    }

    private function booking(Trip $trip, int $state): int
    {
        $rider = User::factory()->create();
        return DB::table('trip_passengers')->insertGetId(['trip_id' => $trip->id, 'user_id' => $rider->id, 'request_state' => $state, 'created_at' => now(), 'updated_at' => now()]);
    }
}
