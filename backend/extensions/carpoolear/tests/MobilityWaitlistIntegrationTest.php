<?php

namespace Tests\Feature\Mobility;

use Illuminate\Support\Facades\DB;
use STS\Mobility\Journeys\JourneyPlanner;
use STS\Mobility\Pickup\PathProvider;
use STS\Models\User;
use Tests\TestCase;

final class MobilityWaitlistIntegrationTest extends TestCase
{
    protected function beforeRefreshingDatabase(): void
    {
        if (! preg_match('/^testing[a-zA-Z0-9_-]*$/', DB::connection()->getDatabaseName())) {
            throw new \RuntimeException('Refusing to refresh a non-test database.');
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
                    $distance = (int) round(hypot(
                        ($points[$i]['lat'] - $points[$i - 1]['lat']) * 111000,
                        ($points[$i]['lng'] - $points[$i - 1]['lng']) * 100000
                    ));
                    $legs[] = ['distance_meters' => $distance, 'duration_seconds' => $distance ? (int) ceil($distance / 8) : 0];
                }
                return [
                    'provider' => 'osrm', 'profile' => 'fixture', 'data_version' => $mode.'|crop_sha256='.str_repeat('a', 64).'|profile_sha256='.str_repeat('b', 64),
                    'geometry' => array_map(fn ($p) => [$p['lng'], $p['lat']], $points),
                    'waypoints' => array_map(fn ($p) => ['location' => [$p['lng'], $p['lat']], 'distance_meters' => 0], $points),
                    'legs' => $legs, 'distance_meters' => array_sum(array_column($legs, 'distance_meters')),
                    'duration_seconds' => array_sum(array_column($legs, 'duration_seconds')),
                ];
            }
        });
    }

    private function prefs(string $role = 'rider'): array
    {
        return ['role' => $role, 'vehicle_preference' => 'both', 'schedule_mode' => 'fixed', 'weekdays' => [1, 2, 3, 4, 5],
            'home' => ['lat' => 12.9716, 'lng' => 77.5946, 'label' => 'Demo home'],
            'campus' => ['lat' => 12.9352, 'lng' => 77.6200, 'label' => 'Demo campus'],
            'outbound_time' => '08:30', 'return_time' => '17:30', 'max_walk_meters' => 999];
    }

    private function demo(string $role): User
    {
        $json = $this->postJson('/api/mobility/commute/demo-session', ['role' => $role])->assertOk()->json();
        return User::findOrFail($json['user']['id']);
    }

    private function secondRider(string $fixture = 'rider-two'): User
    {
        $rider = User::factory()->create(['name' => 'Second waitlist rider', 'active' => true, 'banned' => false]);
        DB::table('mobility_commute_demo_actors')->insert(['user_id' => $rider->id, 'fixture_key' => $fixture, 'created_at' => now(), 'updated_at' => now()]);
        DB::table('mobility_memberships')->insert(['user_id' => $rider->id, 'college_code' => 'CAMPUS-BLR', 'affiliation' => 'student', 'status' => 'approved', 'version' => 1, 'created_at' => now(), 'updated_at' => now()]);
        return $rider;
    }

    public function test_full_ride_waitlist_is_quote_bound_authorized_and_non_booking(): void
    {
        $driver = $this->demo('driver');
        $first = $this->demo('rider');
        $second = $this->secondRider();
        $third = $this->secondRider('rider-three');
        foreach ([[$driver, 'driver'], [$first, 'rider'], [$second, 'rider'], [$third, 'rider']] as [$user, $role]) {
            $this->actingAsApiUser($user)->putJson('/api/mobility/commute/profile', $this->prefs($role))->assertOk();
        }

        $date = now('Asia/Kolkata')->addDay()->toDateString();
        $published = $this->actingAsApiUser($driver)->postJson('/api/mobility/commute/offers', [
            'date' => $date, 'direction' => 'outbound', 'vehicle_type' => 'car', 'choice' => 'DIRECT_RIDER_PICKUP',
        ], ['Idempotency-Key' => 'waitlist-publish'])->assertOk()->json('data');
        $trip = (int) $published['trip_id'];

        $firstCard = $this->actingAsApiUser($first)->getJson('/api/mobility/commute/rides?direction=outbound&date='.$date.'&vehicle_type=car')->assertOk()->json('data.0');
        $booking = $this->actingAsApiUser($first)->postJson('/api/mobility/commute/rides/'.$trip.'/request', ['quote_token' => $firstCard['quote_token']], ['Idempotency-Key' => 'waitlist-first-request'])->assertOk()->json('data.booking_id');
        $this->actingAsApiUser($driver)->postJson('/api/mobility/commute/bookings/'.$booking.'/accept', [], ['Idempotency-Key' => 'waitlist-first-accept'])->assertOk();

        $full = $this->actingAsApiUser($second)->getJson('/api/mobility/commute/rides?direction=outbound&date='.$date.'&vehicle_type=car')->assertOk()->json('data.0');
        $this->assertSame(0, $full['seats_available']);
        $this->assertTrue($full['waitlist_available']);
        $this->assertSame(1, DB::table('trip_passengers')->where('trip_id', $trip)->where('request_state', 1)->count());

        $this->actingAsApiUser($second)->postJson('/api/mobility/commute/rides/'.$trip.'/waitlist', ['quote_token' => str_repeat('0', 64)], ['Idempotency-Key' => 'waitlist-forged'])->assertStatus(409)->assertJsonPath('error.code', 'COMMUTE_QUOTE_CHANGED');
        $changed = $this->prefs();
        $changed['home']['label'] = 'Changed stale home';
        $this->actingAsApiUser($second)->putJson('/api/mobility/commute/profile', $changed)->assertOk();
        $this->actingAsApiUser($second)->postJson('/api/mobility/commute/rides/'.$trip.'/waitlist', ['quote_token' => $full['quote_token']], ['Idempotency-Key' => 'waitlist-stale'])->assertStatus(409)->assertJsonPath('error.code', 'COMMUTE_QUOTE_CHANGED');
        $this->actingAsApiUser($second)->putJson('/api/mobility/commute/profile', $this->prefs())->assertOk();
        $fresh = $this->actingAsApiUser($second)->getJson('/api/mobility/commute/rides?direction=outbound&date='.$date.'&vehicle_type=car')->assertOk()->json('data.0');

        DB::table('mobility_memberships')->where('user_id', $driver->id)->update(['status' => 'pending']);
        $this->actingAsApiUser($second)->postJson('/api/mobility/commute/rides/'.$trip.'/waitlist', ['quote_token' => $fresh['quote_token']], ['Idempotency-Key' => 'waitlist-unapproved'])->assertForbidden()->assertJsonPath('error.code', 'MEMBERSHIP_REQUIRED');
        DB::table('mobility_memberships')->where('user_id', $driver->id)->update(['status' => 'approved']);

        $entry = $this->actingAsApiUser($second)->postJson('/api/mobility/commute/rides/'.$trip.'/waitlist', ['quote_token' => $fresh['quote_token']], ['Idempotency-Key' => 'waitlist-join'])->assertOk()->json('data');
        $this->assertSame('pending', $entry['status']);
        $this->assertDatabaseMissing('trip_passengers', ['trip_id' => $trip, 'user_id' => $second->id]);
        $this->assertSame(1, DB::table('trip_passengers')->where('trip_id', $trip)->count());
        $thirdCard = $this->actingAsApiUser($third)->getJson('/api/mobility/commute/rides?direction=outbound&date='.$date.'&vehicle_type=car')->assertOk()->json('data.0');
        $thirdEntry = $this->actingAsApiUser($third)->postJson('/api/mobility/commute/rides/'.$trip.'/waitlist', ['quote_token' => $thirdCard['quote_token']], ['Idempotency-Key' => 'waitlist-third'])->assertOk()->json('data');
        $this->assertFalse($this->actingAsApiUser($third)->getJson('/api/mobility/commute/waitlist')->assertOk()->json('data.0.actionable'));
        $listed=$this->actingAsApiUser($second)->getJson('/api/mobility/commute/waitlist')->assertOk()->json('data.0');
        $this->assertFalse($listed['actionable']);
        DB::table('mobility_commute_profiles')->where('user_id',$second->id)->update(['preferences'=>json_encode(array_replace($this->prefs(),['home'=>['lat'=>12.8,'lng'=>77.5,'label'=>'Changed home']]))]);
        $this->actingAsApiUser($second)->postJson('/api/mobility/commute/waitlist/'.$entry['id'].'/refresh', [], ['Idempotency-Key' => 'waitlist-invalid-head'])->assertOk()->assertJsonPath('data.status', 'expired');
        $this->assertDatabaseHas('mobility_commute_waitlist', ['id' => $entry['id'], 'status' => 'expired']);
        $this->assertDatabaseHas('mobility_commute_waitlist', ['id' => $thirdEntry['id'], 'status' => 'pending']);
        $this->actingAsApiUser($second)->putJson('/api/mobility/commute/profile', $this->prefs())->assertOk();

        $entry = $this->actingAsApiUser($second)->postJson('/api/mobility/commute/rides/'.$trip.'/waitlist', ['quote_token' => $fresh['quote_token']], ['Idempotency-Key' => 'waitlist-join-repeat'])->assertOk()->json('data');
        $this->actingAsApiUser($first)->postJson('/api/mobility/commute/waitlist/'.$entry['id'].'/cancel', [], ['Idempotency-Key' => 'waitlist-wrong-cancel'])->assertForbidden()->assertJsonPath('error.code', 'WAITLIST_FORBIDDEN');
        $this->actingAsApiUser($second)->postJson('/api/mobility/commute/waitlist/'.$entry['id'].'/cancel', [], ['Idempotency-Key' => 'waitlist-cancel'])->assertOk()->assertJsonPath('data.status', 'cancelled');
        $this->assertDatabaseHas('mobility_commute_waitlist', ['id' => $entry['id'], 'status' => 'cancelled']);
        $fresh = $this->actingAsApiUser($second)->getJson('/api/mobility/commute/rides?direction=outbound&date='.$date.'&vehicle_type=car')->assertOk()->json('data.0');
        $rejoin = $this->actingAsApiUser($second)->postJson('/api/mobility/commute/rides/'.$trip.'/waitlist', ['quote_token' => $fresh['quote_token']], ['Idempotency-Key' => 'waitlist-rejoin'])->assertOk()->json('data');
        $this->actingAsApiUser($first)->postJson('/api/mobility/commute/bookings/'.$booking.'/cancel', [], ['Idempotency-Key' => 'waitlist-release'])->assertOk();
        $thirdAvailable = $this->actingAsApiUser($third)->getJson('/api/mobility/commute/waitlist')->assertOk()->json('data.0');
        $this->assertTrue($thirdAvailable['actionable']);
        $this->actingAsApiUser($third)->postJson('/api/mobility/commute/waitlist/'.$thirdEntry['id'].'/cancel', [], ['Idempotency-Key' => 'waitlist-third-cancel'])->assertOk();
        $available = $this->actingAsApiUser($second)->getJson('/api/mobility/commute/waitlist')->assertOk()->json('data.0');
        $this->assertTrue($available['actionable']);
        $refreshed = $this->actingAsApiUser($second)->postJson('/api/mobility/commute/waitlist/'.$rejoin['id'].'/refresh', [], ['Idempotency-Key' => 'waitlist-refresh-seat'])->assertOk()->json('data');
        $this->assertNotEmpty($refreshed['quote_token']);
        $request = $this->actingAsApiUser($second)->postJson('/api/mobility/commute/waitlist/'.$rejoin['id'].'/request', ['quote_token' => $refreshed['quote_token'], 'consent' => true], ['Idempotency-Key' => 'waitlist-request-seat'])->assertOk()->assertJsonPath('data.request_state', 0)->json('data');
        $this->assertDatabaseHas('mobility_commute_waitlist', ['id' => $rejoin['id'], 'status' => 'requested', 'consent_quote_hash' => hash('sha256', $refreshed['quote_token'])]);
        DB::table('mobility_commute_waitlist')->where('id', $rejoin['id'])->update(['consent_quote_hash' => str_repeat('0', 64)]);
        $this->actingAsApiUser($driver)->postJson('/api/mobility/commute/bookings/'.$request['booking_id'].'/accept', [], ['Idempotency-Key' => 'waitlist-approval-tampered'])->assertStatus(409)->assertJsonPath('error.code', 'WAITLIST_CONSENT_MISMATCH');
        $this->assertDatabaseHas('trip_passengers', ['id' => $request['booking_id'], 'request_state' => 0]);
        DB::table('mobility_commute_waitlist')->where('id', $rejoin['id'])->update(['consent_quote_hash' => hash('sha256', $refreshed['quote_token'])]);
        $this->actingAsApiUser($driver)->postJson('/api/mobility/commute/bookings/'.$request['booking_id'].'/accept', [], ['Idempotency-Key' => 'waitlist-approval'])->assertOk()->assertJsonPath('data.request_state', 1);
        $this->assertDatabaseHas('trip_passengers', ['id' => $request['booking_id'], 'request_state' => 1]);
        $this->assertDatabaseHas('mobility_commute_waitlist', ['id' => $rejoin['id'], 'status' => 'fulfilled']);
    }

    public function test_gender_preference_is_rechecked_across_waitlist_join_refresh_and_request(): void
    {
        $driver = $this->demo('driver');
        $first = $this->demo('rider');
        $second = $this->secondRider('gender-waitlist-rider');
        $driverPrefs = array_merge($this->prefs('driver'), ['gender_identity' => 'man', 'same_gender_only' => false]);
        $firstPrefs = array_merge($this->prefs(), ['gender_identity' => 'woman', 'same_gender_only' => false]);
        $secondPrefs = array_merge($this->prefs(), ['gender_identity' => 'man', 'same_gender_only' => true]);
        foreach ([[$driver, $driverPrefs], [$first, $firstPrefs], [$second, $secondPrefs]] as [$user, $prefs]) {
            $this->actingAsApiUser($user)->putJson('/api/mobility/commute/profile', $prefs)->assertOk();
        }
        $date = now('Asia/Kolkata')->addDay()->toDateString();
        $this->actingAsApiUser($driver)->postJson('/api/mobility/commute/offers', ['date' => $date, 'direction' => 'outbound', 'vehicle_type' => 'car', 'choice' => 'DIRECT_RIDER_PICKUP'], ['Idempotency-Key' => 'gender-waitlist-offer'])->assertOk();
        $url = '/api/mobility/commute/rides?direction=outbound&date='.$date.'&vehicle_type=car';
        $firstCard = $this->actingAsApiUser($first)->getJson($url)->assertOk()->json('data.0');
        $booking = $this->actingAsApiUser($first)->postJson('/api/mobility/commute/rides/'.$firstCard['trip_id'].'/request', ['quote_token' => $firstCard['quote_token']], ['Idempotency-Key' => 'gender-waitlist-book'])->assertOk()->json('data.booking_id');
        $this->actingAsApiUser($driver)->postJson('/api/mobility/commute/bookings/'.$booking.'/accept', [], ['Idempotency-Key' => 'gender-waitlist-accept'])->assertOk();
        $card = $this->actingAsApiUser($second)->getJson($url)->assertOk()->json('data.0');
        $entry = $this->actingAsApiUser($second)->postJson('/api/mobility/commute/rides/'.$card['trip_id'].'/waitlist', ['quote_token' => $card['quote_token']], ['Idempotency-Key' => 'gender-waitlist-join'])->assertOk()->json('data');
        $driverPrefs['gender_identity'] = 'woman';$driverPrefs['same_gender_only'] = true;
        $this->actingAsApiUser($driver)->putJson('/api/mobility/commute/profile', $driverPrefs)->assertOk();
        $this->actingAsApiUser($second)->postJson('/api/mobility/commute/waitlist/'.$entry['id'].'/refresh', [], ['Idempotency-Key' => 'gender-waitlist-refresh-blocked'])->assertStatus(409)->assertJsonPath('error.code', 'SAME_GENDER_PREFERENCE_CHANGED');
        $driverPrefs['gender_identity'] = 'man';$driverPrefs['same_gender_only'] = false;
        $this->actingAsApiUser($driver)->putJson('/api/mobility/commute/profile', $driverPrefs)->assertOk();
        $this->actingAsApiUser($first)->postJson('/api/mobility/commute/bookings/'.$booking.'/cancel', [], ['Idempotency-Key' => 'gender-waitlist-release'])->assertOk();
        $terms = $this->actingAsApiUser($second)->postJson('/api/mobility/commute/waitlist/'.$entry['id'].'/refresh', [], ['Idempotency-Key' => 'gender-waitlist-refresh'])->assertOk()->json('data');
        $request = $this->actingAsApiUser($second)->postJson('/api/mobility/commute/waitlist/'.$entry['id'].'/request', ['quote_token' => $terms['quote_token'], 'consent' => true], ['Idempotency-Key' => 'gender-waitlist-request'])->assertOk()->json('data');
        $this->assertSame(0, $request['request_state']);
        $this->assertDatabaseHas('mobility_commute_waitlist', ['id' => $entry['id'], 'status' => 'requested']);
    }
}
