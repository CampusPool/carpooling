<?php
namespace Tests\Feature\Mobility;

use Illuminate\Support\Facades\DB;
use STS\Models\{User,Trip};
use STS\Mobility\Pickup\PathProvider;
use Tests\TestCase;

/**
 * Arjun Sprint 1 regressions for issue #23.  These tests exercise the public
 * commute API and assert durable Passenger/booking-term rows, rather than
 * testing the service implementation through mocks.
 */
final class MobilityBookingCorrectnessTest extends TestCase
{
    protected function beforeRefreshingDatabase(): void
    {
        $name = DB::connection()->getDatabaseName();
        if (! preg_match('/^testing[a-zA-Z0-9_-]*$/', $name)) {
            throw new \RuntimeException('Refusing to refresh non-test database: '.$name);
        }
    }

    protected function setUp(): void
    {
        parent::setUp();
        putenv('MOBILITY_PILOT_UI_ENABLED=true');
        putenv('MOBILITY_COLLEGE_CODE=CAMPUS-BLR');
        foreach (['car', 'bike', 'foot'] as $mode) {
            config(['mobility_routing.'.$mode.'_expected_data_version' => $mode.'|crop_sha256='.str_repeat('a', 64).'|profile_sha256='.str_repeat('b', 64)]);
        }
        app()->bind(PathProvider::class, fn () => new class implements PathProvider {
            public function path(array $points, string $mode, float $timeoutSeconds = 5): array
            {
                $legs = [];
                for ($i = 1; $i < count($points); $i++) {
                    $distance = (int) round(hypot(($points[$i]['lat'] - $points[$i - 1]['lat']) * 111000, ($points[$i]['lng'] - $points[$i - 1]['lng']) * 100000));
                    $legs[] = ['distance_meters' => $distance, 'duration_seconds' => $distance ? (int) ceil($distance / ($mode === 'foot' ? 1.3 : 8)) : 0];
                }
                return ['provider' => 'osrm', 'profile' => 'fixture', 'data_version' => $mode.'|crop_sha256='.str_repeat('a', 64).'|profile_sha256='.str_repeat('b', 64), 'geometry' => array_map(fn ($x) => [$x['lng'], $x['lat']], $points), 'waypoints' => array_map(fn ($x) => ['location' => [$x['lng'], $x['lat']], 'distance_meters' => 0], $points), 'legs' => $legs, 'distance_meters' => array_sum(array_column($legs, 'distance_meters')), 'duration_seconds' => array_sum(array_column($legs, 'duration_seconds'))];
            }
        });
    }

    private function demo(string $role, ?string $scenario = null): User
    {
        $body = ['role' => $role];
        if ($scenario !== null) $body['scenario'] = $scenario;
        return User::findOrFail($this->postJson('/api/mobility/commute/demo-session', $body)->assertOk()->json('user.id'));
    }

    private function prefs(string $role = 'rider'): array
    {
        return ['role' => $role, 'vehicle_preference' => 'both', 'schedule_mode' => 'fixed', 'home' => ['lat' => 12.9716, 'lng' => 77.5946, 'label' => 'Demo home'], 'campus' => ['lat' => 12.9352, 'lng' => 77.62, 'label' => 'Demo campus'], 'outbound_time' => '08:30', 'return_time' => '17:30', 'weekdays' => [1, 2, 3, 4, 5]];
    }

    private function publish(User $driver): int
    {
        $date = now('Asia/Kolkata')->addDay()->toDateString();
        return (int) $this->actingAsApiUser($driver)->postJson('/api/mobility/commute/offers', ['date' => $date, 'direction' => 'outbound', 'vehicle_type' => 'car', 'choice' => 'DIRECT_RIDER_PICKUP'], ['Idempotency-Key' => 'publish-'.uniqid()])->assertOk()->json('data.trip_id');
    }

    private function card(User $rider, int $trip): array
    {
        $cards = $this->actingAsApiUser($rider)->getJson('/api/mobility/commute/rides?direction=outbound&date='.now('Asia/Kolkata')->addDay()->toDateString().'&vehicle_type=car')->assertOk()->json('data');
        $card = collect($cards)->firstWhere('trip_id', $trip);
        $this->assertNotNull($card, 'Published trip must be discoverable');
        return $card;
    }

    private function configure(User $user, string $role = 'rider'): void
    {
        $this->actingAsApiUser($user)->putJson('/api/mobility/commute/profile', $this->prefs($role))->assertOk();
    }

    public function test_self_booking_is_rejected_before_a_passenger_or_terms_row_is_created(): void
    {
        $driver = $this->demo('driver');
        $this->configure($driver, 'driver');
        $date = now('Asia/Kolkata')->addDay()->toDateString();
        $prefs = json_decode(DB::table('mobility_commute_profiles')->where('user_id', $driver->id)->value('preferences'), true, 512, JSON_THROW_ON_ERROR);
        $fixture = hash('sha256', json_encode([$driver->id, 'car', $date, 'outbound', $prefs['outbound_time'], $prefs['home'], $prefs['campus']]));
        $trip = Trip::factory()->create(['user_id' => $driver->id, 'trip_date' => $date.' '.$prefs['outbound_time'].':00', 'total_seats' => 1, 'state' => Trip::STATE_READY, 'from_town' => 'Demo home', 'to_town' => 'Demo campus']);
        DB::table('mobility_trip_lifecycles')->insert(['trip_id' => $trip->id, 'state' => 'planned', 'version' => 0, 'created_at' => now(), 'updated_at' => now()]);
        DB::table('mobility_commute_demo_trips')->insert(['trip_id' => $trip->id, 'audience_id' => $driver->id, 'fixture_key' => $fixture, 'vehicle_type' => 'car', 'is_publication' => false, 'direction' => 'outbound', 'fare_minor' => 0, 'base_fare_minor' => 0, 'surcharge_minor' => 0, 'journey' => json_encode(['choice' => 'DIRECT_RIDER_PICKUP', 'driver_origin' => $prefs['home'], 'driver_destination' => $prefs['campus'], 'rider_origin' => $prefs['home'], 'rider_destination' => $prefs['campus'], 'riding' => ['distance_meters' => 0, 'duration_seconds' => 0], 'detour' => ['added_distance_meters' => 0, 'added_duration_seconds' => 0], 'access' => ['total_meters' => 0], 'egress' => ['total_meters' => 0]], JSON_THROW_ON_ERROR), 'created_at' => now(), 'updated_at' => now()]);
        $quote = hash_hmac('sha256', $trip->id.':'.$driver->id.':0:'.$fixture, (string) config('app.key'));
        $this->actingAsApiUser($driver)->postJson('/api/mobility/commute/rides/'.$trip->id.'/request', ['quote_token' => $quote], ['Idempotency-Key' => 'self-booking'])->assertForbidden()->assertJsonPath('error.code', 'RIDER_CANNOT_BE_DRIVER');
        $this->assertSame(0, DB::table('trip_passengers')->where('trip_id', $trip->id)->count());
        $this->assertSame(0, DB::table('mobility_commute_booking_terms')->count());
    }

    public function test_published_ride_rejects_a_valid_driver_scoped_self_booking_quote(): void
    {
        $driver = $this->demo('driver');
        $rider = $this->demo('rider');
        $this->configure($driver, 'driver');
        $this->configure($rider);
        $trip = $this->publish($driver);
        $this->actingAsApiUser($driver)->getJson('/api/mobility/commute/rides?direction=outbound&date='.now('Asia/Kolkata')->addDay()->toDateString().'&vehicle_type=car')->assertOk()->assertJsonCount(0, 'data');
        $card = $this->card($rider, $trip);
        $match = (array) DB::table('mobility_commute_matches')->where('match_key', $card['quote_token'])->first();
        $prefs = json_decode(DB::table('mobility_commute_profiles')->where('user_id', $driver->id)->value('preferences'), true, 512, JSON_THROW_ON_ERROR);
        $match['profile_hash'] = hash('sha256', json_encode([$prefs['home'], $prefs['campus'], $prefs['outbound_time'], $prefs['return_time'], $prefs['max_walk_meters'] ?? 999], JSON_THROW_ON_ERROR));
        $match['match_key'] = hash('sha256', 'self-published-'.$trip);
        $match['rider_id'] = $driver->id;
        $match['expires_at'] = now('UTC')->addMinutes(5);
        DB::table('mobility_commute_matches')->insert($match);
        $this->actingAsApiUser($driver)->postJson('/api/mobility/commute/rides/'.$trip.'/request', ['quote_token' => $match['match_key']], ['Idempotency-Key' => 'self-publication'])->assertForbidden()->assertJsonPath('error.code', 'RIDER_CANNOT_BE_DRIVER');
        $this->assertSame(0, DB::table('trip_passengers')->where('trip_id', $trip)->count());
        $this->assertSame(0, DB::table('mobility_commute_booking_terms')->count());
    }

    public function test_only_the_trip_owner_can_accept_or_reject_and_duplicate_requests_reuse_one_booking(): void
    {
        $driver = $this->demo('driver');
        $rider = $this->demo('rider');
        $stranger = $this->demo('driver', 'campus-route');
        foreach ([[$driver, 'driver'], [$rider, 'rider'], [$stranger, 'driver']] as [$user, $role]) $this->configure($user, $role);
        $trip = $this->publish($driver);
        $card = $this->card($rider, $trip);
        $first = $this->actingAsApiUser($rider)->postJson('/api/mobility/commute/rides/'.$trip.'/request', ['quote_token' => $card['quote_token']], ['Idempotency-Key' => 'request-one'])->assertOk()->json('data.booking_id');
        $second = $this->actingAsApiUser($rider)->postJson('/api/mobility/commute/rides/'.$trip.'/request', ['quote_token' => $card['quote_token']], ['Idempotency-Key' => 'request-two'])->assertOk()->json('data.booking_id');
        $this->assertSame($first, $second);
        $this->assertSame(1, DB::table('trip_passengers')->where('trip_id', $trip)->where('user_id', $rider->id)->count());
        $this->assertSame(1, DB::table('mobility_commute_booking_terms')->where('booking_id', $first)->count());
        $this->actingAsApiUser($rider)->postJson('/api/mobility/commute/rides/'.$trip.'/request', ['quote_token' => substr_replace($card['quote_token'], $card['quote_token'][0] === '0' ? '1' : '0', 0, 1)], ['Idempotency-Key' => 'request-stale'])->assertStatus(409)->assertJsonPath('error.code', 'COMMUTE_QUOTE_CHANGED');
        foreach ([$stranger, $rider] as $user) {
            $this->actingAsApiUser($user)->postJson('/api/mobility/commute/bookings/'.$first.'/accept', [], ['Idempotency-Key' => 'unauthorized-accept-'.$user->id])->assertStatus(403)->assertJsonPath('error.code', $user->id === $stranger->id ? 'TRIP_FORBIDDEN' : 'TRIP_OWNER_REQUIRED');
            $this->actingAsApiUser($user)->postJson('/api/mobility/commute/bookings/'.$first.'/reject', [], ['Idempotency-Key' => 'unauthorized-reject-'.$user->id])->assertStatus(403)->assertJsonPath('error.code', $user->id === $stranger->id ? 'TRIP_FORBIDDEN' : 'TRIP_OWNER_REQUIRED');
        }
        $this->assertDatabaseHas('trip_passengers', ['id' => $first, 'request_state' => 0]);
    }

    public function test_rider_can_cancel_a_pending_request_without_consuming_capacity(): void
    {
        $driver = $this->demo('driver');
        $rider = $this->demo('rider');
        $this->configure($driver, 'driver');
        $this->configure($rider);
        $trip = $this->publish($driver);
        $card = $this->card($rider, $trip);
        $id = $this->actingAsApiUser($rider)->postJson('/api/mobility/commute/rides/'.$trip.'/request', ['quote_token' => $card['quote_token']], ['Idempotency-Key' => 'pending-request'])->assertOk()->json('data.booking_id');
        foreach (['pending-cancel', 'pending-cancel-repeat'] as $key) {
            $this->actingAsApiUser($rider)->postJson('/api/mobility/commute/bookings/'.$id.'/cancel', [], ['Idempotency-Key' => $key])->assertOk()->assertJsonPath('data.request_state', 3);
        }
        $this->actingAsApiUser($rider)->getJson('/api/mobility/commute/bookings')->assertOk()->assertJsonPath('data.0.request_state', 3);
        $this->actingAsApiUser($driver)->getJson('/api/mobility/commute/offers')->assertOk()->assertJsonPath('data.0.seats_available', 1);
        $this->assertDatabaseHas('trip_passengers', ['id' => $id, 'request_state' => 3]);
        $this->assertSame(1, DB::table('trip_passengers')->where('trip_id', $trip)->count());
        $this->assertDatabaseCount('mobility_commute_booking_terms', 1);
        $this->assertDatabaseCount('mobility_commute_demo_holds', 0);
    }

    public function test_reject_cancel_and_accept_transitions_preserve_capacity_and_history(): void
    {
        $driver = $this->demo('driver');
        $one = $this->demo('rider');
        $two = $this->demo('rider', 'campus-route');
        foreach ([[$driver, 'driver'], [$one, 'rider'], [$two, 'rider']] as [$user, $role]) $this->configure($user, $role);
        $trip = $this->publish($driver);
        $ids = [];
        foreach ([$one, $two] as $index => $rider) {
            $card = $this->card($rider, $trip);
            $ids[] = $this->actingAsApiUser($rider)->postJson('/api/mobility/commute/rides/'.$trip.'/request', ['quote_token' => $card['quote_token']], ['Idempotency-Key' => 'state-request-'.$index])->assertOk()->json('data.booking_id');
        }
        $this->actingAsApiUser($driver)->postJson('/api/mobility/commute/bookings/'.$ids[0].'/reject', [], ['Idempotency-Key' => 'reject-first'])->assertOk()->assertJsonPath('data.request_state', 2);
        $this->actingAsApiUser($driver)->postJson('/api/mobility/commute/bookings/'.$ids[0].'/reject', [], ['Idempotency-Key' => 'reject-first-repeat'])->assertOk()->assertJsonPath('data.request_state', 2);
        $this->actingAsApiUser($driver)->postJson('/api/mobility/commute/bookings/'.$ids[0].'/accept', [], ['Idempotency-Key' => 'accept-rejected'])->assertStatus(409)->assertJsonPath('error.code', 'BOOKING_STATE_CHANGED');
        $this->actingAsApiUser($driver)->postJson('/api/mobility/commute/bookings/'.$ids[1].'/accept', [], ['Idempotency-Key' => 'accept-second'])->assertOk()->assertJsonPath('data.request_state', 1);
        $this->assertSame(1, DB::table('trip_passengers')->where('trip_id', $trip)->where('request_state', 1)->count());
        $this->actingAsApiUser($driver)->postJson('/api/mobility/commute/bookings/'.$ids[1].'/cancel', [], ['Idempotency-Key' => 'cancel-second'])->assertOk()->assertJsonPath('data.request_state', 3);
        $this->actingAsApiUser($driver)->postJson('/api/mobility/commute/bookings/'.$ids[1].'/cancel', [], ['Idempotency-Key' => 'cancel-second-repeat'])->assertOk()->assertJsonPath('data.request_state', 3);
        $this->assertSame(0, DB::table('trip_passengers')->where('trip_id', $trip)->where('request_state', 1)->count());
        $this->assertSame(1, DB::table('trip_passengers')->where('trip_id', $trip)->where('request_state', 2)->count());
        $this->assertSame(1, DB::table('trip_passengers')->where('trip_id', $trip)->where('request_state', 3)->count());
        foreach ([[$ids[0], 'cancel'], [$ids[1], 'accept'], [$ids[1], 'reject']] as [$id, $action]) {
            $this->actingAsApiUser($driver)->postJson('/api/mobility/commute/bookings/'.$id.'/'.$action, [], ['Idempotency-Key' => 'invalid-'.$id.'-'.$action])->assertStatus(409)->assertJsonPath('error.code', 'BOOKING_STATE_CHANGED');
        }
        $card = $this->card($one, $trip);
        $replacement = $this->actingAsApiUser($one)->postJson('/api/mobility/commute/rides/'.$trip.'/request', ['quote_token' => $card['quote_token']], ['Idempotency-Key' => 'request-after-rejection'])->assertOk()->json('data.booking_id');
        $this->assertNotContains($replacement, $ids);
        $this->actingAsApiUser($driver)->postJson('/api/mobility/commute/bookings/'.$replacement.'/accept', [], ['Idempotency-Key' => 'accept-restored-seat'])->assertOk()->assertJsonPath('data.request_state', 1);
        $this->assertSame(1, DB::table('trip_passengers')->where('trip_id', $trip)->where('request_state', 1)->count());
        $this->assertSame(3, DB::table('trip_passengers')->where('trip_id', $trip)->count());
        $this->assertSame(3, DB::table('mobility_commute_booking_terms')->count());
        $this->assertDatabaseCount('mobility_commute_demo_holds', 0);

    }
}
