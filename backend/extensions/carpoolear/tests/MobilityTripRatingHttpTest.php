<?php

namespace Tests\Feature\Mobility;

use Illuminate\Support\Facades\DB;
use STS\Models\Passenger;
use STS\Models\Trip;
use STS\Models\User;
use Tests\TestCase;

final class MobilityTripRatingHttpTest extends TestCase
{
    protected function beforeRefreshingDatabase(): void
    {
        $name = DB::connection()->getDatabaseName();
        if (! preg_match('/^testing[a-zA-Z0-9_-]*$/', (string) $name)) {
            throw new \RuntimeException('Refusing to refresh non-test database: '.$name);
        }
    }
    protected function setUp(): void
    {
        parent::setUp();
        putenv('MOBILITY_COHORT_REQUIRED=true');
        putenv('MOBILITY_COLLEGE_CODE=CAMPUS-BLR');
    }

    protected function tearDown(): void
    {
        putenv('MOBILITY_COHORT_REQUIRED');
        putenv('MOBILITY_COLLEGE_CODE');
        parent::tearDown();
    }

    public function test_completed_participants_can_rate_each_other_once(): void
    {
        [$driver, $trip, $rider] = $this->fixture();

        $this->actingAsApiUser($driver)->postJson($this->path($trip), [
            'ratee_id' => $rider->id, 'rating' => 5, 'comment' => 'Safe and punctual.',
        ], ['Idempotency-Key' => 'driver-rider-1'])->assertCreated()->assertJsonPath('data.rating', 5);

        $this->actingAsApiUser($rider)->postJson($this->path($trip), [
            'ratee_id' => $driver->id, 'rating' => 4,
        ], ['Idempotency-Key' => 'rider-driver-1'])->assertCreated()->assertJsonPath('data.rating', 4);

        $this->actingAsApiUser($driver)->postJson($this->path($trip), [
            'ratee_id' => $rider->id, 'rating' => 1,
        ], ['Idempotency-Key' => 'driver-rider-2'])->assertStatus(409)->assertJsonPath('error.code', 'TRIP_RATING_ALREADY_EXISTS');

        $this->actingAsApiUser($driver)->getJson($this->path($trip))
            ->assertOk()->assertJsonCount(2, 'data');
        $this->assertDatabaseCount('mobility_trip_ratings', 2);
    }

    public function test_rating_requires_completed_trip_and_accepted_participant(): void
    {
        [$driver, $trip, $rider] = $this->fixture();
        $outsider = $this->member();

        $this->actingAsApiUser($outsider)->postJson($this->path($trip), [
            'ratee_id' => $driver->id, 'rating' => 5,
        ], ['Idempotency-Key' => 'outsider-1'])->assertStatus(403)->assertJsonPath('error.code', 'TRIP_RATING_FORBIDDEN');

        DB::table('mobility_trip_lifecycles')->where('trip_id', $trip->id)->update(['state' => 'in_progress']);
        $this->actingAsApiUser($outsider)->getJson($this->path($trip))
            ->assertStatus(403)->assertJsonPath('error.code', 'TRIP_RATING_FORBIDDEN');
        $this->actingAsApiUser($rider)->postJson($this->path($trip), [
            'ratee_id' => $driver->id, 'rating' => 5,
        ], ['Idempotency-Key' => 'rider-incomplete-1'])->assertStatus(409)->assertJsonPath('error.code', 'TRIP_NOT_COMPLETED');
        $this->actingAsApiUser($rider)->getJson($this->path($trip))
            ->assertStatus(409)->assertJsonPath('error.code', 'TRIP_NOT_COMPLETED');
    }

    public function test_input_validation_rejects_invalid_rating_and_self_rating(): void
    {
        [$driver, $trip] = $this->fixture();

        $this->actingAsApiUser($driver)->postJson($this->path($trip), [
            'ratee_id' => $driver->id, 'rating' => 6,
        ], ['Idempotency-Key' => 'invalid-1'])->assertStatus(422);
        $this->actingAsApiUser($driver)->postJson($this->path($trip), [
            'ratee_id' => $driver->id, 'rating' => 5,
        ], ['Idempotency-Key' => 'self-1'])->assertStatus(403)->assertJsonPath('error.code', 'TRIP_RATING_FORBIDDEN');
        $this->assertDatabaseCount('mobility_trip_ratings', 0);
    }

    public function test_database_constraints_reject_out_of_range_and_self_rating_even_below_http_layer(): void
    {
        [$driver, $trip] = $this->fixture();
        $values = ['trip_id' => $trip->id, 'rater_id' => $driver->id, 'ratee_id' => $driver->id, 'rating' => 5, 'idempotency_key' => 'db-self', 'request_hash' => str_repeat('a', 64), 'created_at' => now(), 'updated_at' => now()];
        try { DB::table('mobility_trip_ratings')->insert($values); $this->fail('Database accepted a self-rating.'); } catch (\Throwable $e) { $this->assertStringContainsString('trip_rating_distinct_users', $e->getMessage()); }
        $values['ratee_id'] = $this->member()->id; $values['rating'] = 6; $values['idempotency_key'] = 'db-range';
        try { DB::table('mobility_trip_ratings')->insert($values); $this->fail('Database accepted an out-of-range rating.'); } catch (\Throwable $e) { $this->assertStringContainsString('trip_rating_rating_range', $e->getMessage()); }
    }

    public function test_pair_unique_constraint_blocks_a_second_write(): void
    {
        [$driver, $trip, $rider] = $this->fixture();
        $row = ['trip_id' => $trip->id, 'rater_id' => $driver->id, 'ratee_id' => $rider->id, 'rating' => 5, 'idempotency_key' => 'pair-one', 'request_hash' => str_repeat('b', 64), 'created_at' => now(), 'updated_at' => now()];
        DB::table('mobility_trip_ratings')->insert($row);
        try { DB::table('mobility_trip_ratings')->insert(array_replace($row, ['idempotency_key' => 'pair-two'])); $this->fail('Database accepted a duplicate pair.'); } catch (\Throwable $e) { $this->assertStringContainsString('trip_rating_pair_unique', $e->getMessage()); }
    }

    public function test_serialized_same_pair_writes_leave_exactly_one_rating(): void
    {
        [$driver, $trip, $rider] = $this->fixture();
        $first = $this->actingAsApiUser($driver)->postJson($this->path($trip), ['ratee_id' => $rider->id, 'rating' => 5], ['Idempotency-Key' => 'serialized-one']);
        $second = $this->actingAsApiUser($driver)->postJson($this->path($trip), ['ratee_id' => $rider->id, 'rating' => 4], ['Idempotency-Key' => 'serialized-two']);
        $this->assertSame(201, $first->status());
        $this->assertSame(409, $second->status());
        $this->assertSame('TRIP_RATING_ALREADY_EXISTS', $second->json('error.code'));
        $this->assertDatabaseCount('mobility_trip_ratings', 1);
    }

    public function test_same_idempotency_key_replays_and_conflicting_payload_is_rejected(): void
    {
        [$driver, $trip, $rider] = $this->fixture();
        $payload = ['ratee_id' => $rider->id, 'rating' => 5, 'comment' => 'Good ride.'];

        $this->actingAsApiUser($driver)->postJson($this->path($trip), $payload, ['Idempotency-Key' => 'stable-key'])
            ->assertCreated()->assertJsonPath('data.rating', 5);
        $this->actingAsApiUser($driver)->postJson($this->path($trip), $payload, ['Idempotency-Key' => 'stable-key'])
            ->assertOk()->assertJsonPath('data.rating', 5);
        $this->actingAsApiUser($driver)->postJson($this->path($trip), ['ratee_id' => $rider->id, 'rating' => 1], ['Idempotency-Key' => 'stable-key'])
            ->assertStatus(409)->assertJsonPath('error.code', 'IDEMPOTENCY_CONFLICT');
        $this->assertDatabaseCount('mobility_trip_ratings', 1);
    }

    public function test_idempotency_key_is_required_and_reads_are_private(): void
    {
        [$driver, $trip, $rider] = $this->fixture();
        $this->actingAsApiUser($driver)->postJson($this->path($trip), [
            'ratee_id' => $rider->id, 'rating' => 5,
        ])->assertStatus(422)->assertJsonPath('error.code', 'IDEMPOTENCY_KEY_REQUIRED')->tap(function ($response): void {
            $this->assertStringContainsString('no-store', (string) $response->headers->get('Cache-Control'));
        });
        $response = $this->actingAsApiUser($driver)->getJson($this->path($trip))->assertOk();
        $this->assertStringContainsString('no-store', (string) $response->headers->get('Cache-Control'));
    }

    public function test_received_ratings_are_visible_only_after_mutual_submission_and_ids_are_not_exposed(): void
    {
        [$driver, $trip, $rider] = $this->fixture();
        $this->actingAsApiUser($driver)->postJson($this->path($trip), ['ratee_id' => $rider->id, 'rating' => 5], ['Idempotency-Key' => 'mutual-driver'])
            ->assertCreated();

        $this->actingAsApiUser($driver)->getJson($this->path($trip))->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.direction', 'authored')
            ->assertJsonMissingPath('data.0.rater_id')->assertJsonMissingPath('data.0.ratee_id');
        $this->actingAsApiUser($rider)->getJson($this->path($trip))->assertOk()->assertJsonCount(0, 'data');

        $this->actingAsApiUser($rider)->postJson($this->path($trip), ['ratee_id' => $driver->id, 'rating' => 4], ['Idempotency-Key' => 'mutual-rider'])
            ->assertCreated();
        $this->actingAsApiUser($rider)->getJson($this->path($trip))->assertOk()
            ->assertJsonCount(2, 'data')->assertJsonPath('data.0.direction', 'received')->assertJsonPath('data.1.direction', 'authored');
    }

    private function fixture(): array
    {
        $driver = $this->member();
        $trip = Trip::factory()->create(['user_id' => $driver->id]);
        $rider = $this->member();
        Passenger::factory()->create([
            'trip_id' => $trip->id, 'user_id' => $rider->id,
            'passenger_type' => Passenger::TYPE_PASAJERO,
            'request_state' => Passenger::STATE_ACCEPTED,
        ]);
        DB::table('mobility_trip_lifecycles')->insert([
            'trip_id' => $trip->id, 'state' => 'completed', 'version' => 1,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        return [$driver, $trip, $rider];
    }

    private function member(): User
    {
        $user = User::factory()->create(['active' => true, 'banned' => false]);
        DB::table('mobility_memberships')->insert([
            'user_id' => $user->id, 'college_code' => 'CAMPUS-BLR', 'affiliation' => 'student',
            'status' => 'approved', 'version' => 1, 'created_at' => now(), 'updated_at' => now(),
        ]);
        return $user;
    }

    private function path(Trip $trip): string
    {
        return '/api/mobility/trips/'.$trip->id.'/ratings';
    }
}
