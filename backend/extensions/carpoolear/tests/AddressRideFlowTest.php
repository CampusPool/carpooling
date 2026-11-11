<?php

namespace Tests\Feature\Mobility;

use Illuminate\Support\Facades\DB;
use STS\Mobility\Commute\AddressRideContext;
use STS\Mobility\Commute\CommuteService;
use STS\Mobility\Pickup\PathProvider;
use STS\Mobility\Segments\SegmentException;
use STS\Mobility\Trust\CohortPolicy;
use STS\Mobility\Trust\DriverOnboardingPolicy;
use STS\Models\Car;
use STS\Models\User;
use Tests\TestCase;

final class AddressRideFlowTest extends TestCase
{
    private array $environment = [];

    protected function beforeRefreshingDatabase(): void
    {
        if (!preg_match('/^testing[a-zA-Z0-9_-]*$/', DB::connection()->getDatabaseName())) {
            throw new \RuntimeException('Refusing non-test database');
        }
    }

    protected function setUp(): void
    {
        parent::setUp();
        foreach (['MOBILITY_PUBLIC_STUDENT_ONLY' => 'true', 'MOBILITY_PILOT_UI_ENABLED' => 'false', 'MOBILITY_COLLEGE_CODE' => 'CAMPUS-BLR'] as $key => $value) {
            $this->environment[$key] = getenv($key);
            putenv($key.'='.$value);
        }
        foreach (['car', 'bike', 'foot'] as $mode) {
            config(['mobility_routing.'.$mode.'_expected_data_version' => $mode.'|crop_sha256='.str_repeat('a', 64).'|profile_sha256='.str_repeat('b', 64)]);
        }
        app()->bind(PathProvider::class, fn () => new class implements PathProvider {
            public function path(array $points, string $mode, float $timeoutSeconds = 5): array
            {
                $legs = [];
                for ($i = 1; $i < count($points); $i++) {
                    $meters = (int) round(hypot(($points[$i]['lat'] - $points[$i - 1]['lat']) * 111000, ($points[$i]['lng'] - $points[$i - 1]['lng']) * 100000));
                    $legs[] = ['distance_meters' => $meters, 'duration_seconds' => $meters ? (int) ceil($meters / ($mode === 'foot' ? 1.3 : 8)) : 0];
                }
                return [
                    'provider' => 'osrm', 'profile' => 'fixture',
                    'data_version' => $mode.'|crop_sha256='.str_repeat('a', 64).'|profile_sha256='.str_repeat('b', 64),
                    'geometry' => array_map(fn ($point) => [$point['lng'], $point['lat']], $points),
                    'waypoints' => array_map(fn ($point) => ['location' => [$point['lng'], $point['lat']], 'distance_meters' => 0], $points),
                    'legs' => $legs, 'distance_meters' => array_sum(array_column($legs, 'distance_meters')),
                    'duration_seconds' => array_sum(array_column($legs, 'duration_seconds')),
                ];
            }
        });
    }

    protected function tearDown(): void
    {
        foreach ($this->environment as $key => $value) putenv($value === false ? $key : $key.'='.$value);
        parent::tearDown();
    }

    public function test_verified_address_rides_preserve_approval_privacy_capacity_and_context(): void
    {
        $driver = $this->student('address.driver@stu.pes.edu');
        $rider = $this->student('address.rider@stu.pes.edu');
        $other = $this->student('address.other@stu.pes.edu');
        $car = $this->approvedCar($driver);
        $secondCar = $this->approvedCar($driver);
        $base = '/api/mobility/address-rides/';
        foreach ([[$driver, 'driver'], [$rider, 'rider'], [$other, 'rider']] as [$actor, $role]) {
            $this->actingAsApiUser($actor)->putJson($base.'profile', $this->profile($role))->assertOk();
        }
        $this->assertDatabaseCount('mobility_pickup_points', 0);
        $this->assertDatabaseCount('mobility_local_accounts', 0);
        $this->assertDatabaseCount('mobility_commute_demo_actors', 0);
        $date = now('Asia/Kolkata')->addDay()->toDateString();
        $offer = ['date' => $date, 'direction' => 'outbound', 'vehicle_type' => 'car', 'choice' => 'DIRECT_RIDER_PICKUP', 'car_id' => $car->id, 'total_seats' => 1];
        $this->actingAsApiUser($rider)->postJson($base.'offers', $offer, ['Idempotency-Key' => 'not-owner'])->assertForbidden();
        $trip = $this->actingAsApiUser($driver)->postJson($base.'offers', $offer, ['Idempotency-Key' => 'publish-address'])->assertOk()->json('data.trip_id');
        $this->assertDatabaseHas('trips', ['id' => $trip, 'car_id' => $car->id, 'total_seats' => 1]);
        $this->actingAsApiUser($driver)->postJson($base.'offers', array_replace($offer, ['car_id' => $secondCar->id]), ['Idempotency-Key' => 'publish-address'])->assertStatus(409)->assertJsonPath('error.code', 'IDEMPOTENCY_CONFLICT');
        $url = $base.'rides?direction=outbound&date='.$date.'&vehicle_type=car';
        $card = $this->actingAsApiUser($rider)->getJson($url)->assertOk()->assertJsonCount(1, 'data')->json('data.0');
        $this->assertArrayNotHasKey('route_map', $card);
        $this->assertArrayNotHasKey('driver_route_origin_label', $card);
        $this->assertArrayNotHasKey('demo_fixture', $card);
        $booking = $this->actingAsApiUser($rider)->postJson($base.'rides/'.$trip.'/request', ['quote_token' => $card['quote_token']], ['Idempotency-Key' => 'request-address'])->assertOk()->json('data');
        $this->assertArrayNotHasKey('route_map', $booking);
        $this->assertArrayNotHasKey('wallet_state', $booking);
        $otherCard = $this->actingAsApiUser($other)->getJson($url)->assertOk()->json('data.0');
        $otherBooking = $this->actingAsApiUser($other)->postJson($base.'rides/'.$trip.'/request', ['quote_token' => $otherCard['quote_token']], ['Idempotency-Key' => 'request-other'])->assertOk()->json('data.booking_id');
        $accepted = $this->actingAsApiUser($driver)->postJson($base.'bookings/'.$booking['booking_id'].'/accept', [], ['Idempotency-Key' => 'accept-address'])->assertOk()->assertJsonPath('data.request_state', 1)->json('data');
        $this->assertArrayHasKey('route_map', $accepted);
        $this->actingAsApiUser($driver)->postJson($base.'bookings/'.$otherBooking.'/accept', [], ['Idempotency-Key' => 'accept-full'])->assertStatus(422)->assertJsonPath('error.code', 'NOT_SEAT_AVAILABLE');
        foreach (['start', 'board', 'alight', 'complete'] as $action) {
            $body = ['action' => $action] + (in_array($action, ['board', 'alight']) ? ['passenger_id' => $rider->id] : []);
            $this->actingAsApiUser($driver)->postJson($base.'trips/'.$trip.'/transition', $body, ['Idempotency-Key' => 'address-'.$action])->assertOk();
        }
        $this->assertDatabaseHas('mobility_trip_lifecycles', ['trip_id' => $trip, 'state' => 'completed']);
        $this->assertDatabaseCount('mobility_commute_demo_holds', 0);
        $this->assertDatabaseCount('mobility_commute_demo_wallets', 0);
        $this->assertDatabaseCount('mobility_pickup_points', 0);
        $this->assertFalse(AddressRideContext::active());
        try {
            app(CommuteService::class)->requireDemo($rider);
            $this->fail('Student context leaked into ordinary demo services');
        } catch (SegmentException $error) {
            $this->assertSame('DEMO_SESSION_REQUIRED', $error->machineCode);
        }
    }

    private function student(string $email): User
    {
        $user = User::factory()->create(['email' => $email, 'active' => true, 'banned' => false]);
        DB::table('mobility_memberships')->insert(['user_id' => $user->id, 'college_code' => 'CAMPUS-BLR', 'affiliation' => 'student', 'status' => 'approved', 'version' => 1, 'created_at' => now(), 'updated_at' => now()]);
        DB::table('mobility_verified_identities')->insert(['user_id' => $user->id, 'provider' => 'college_email_otp', 'email' => $email, 'domain' => 'stu.pes.edu', 'verified_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
        return $user;
    }

    private function approvedCar(User $user): Car
    {
        $car = Car::factory()->withCatalog()->create(['user_id' => $user->id]);
        $fingerprint = CohortPolicy::vehicleFingerprint($car);
        $application = DB::table('mobility_host_applications')->insertGetId(['user_id' => $user->id, 'car_id' => $car->id, 'vehicle_type' => 'car', 'vehicle_fingerprint' => $fingerprint, 'status' => 'approved', 'version' => 1, 'created_at' => now(), 'updated_at' => now()]);
        $onboarding = DB::table('mobility_driver_onboardings')->insertGetId(['user_id' => $user->id, 'host_application_id' => $application, 'car_id' => $car->id, 'vehicle_type' => 'car', 'legal_passenger_capacity' => 4, 'vehicle_fingerprint' => $fingerprint, 'profile_display_name' => 'Synthetic approved driver', 'status' => 'approved', 'version' => 1, 'created_at' => now(), 'updated_at' => now()]);
        foreach (DriverOnboardingPolicy::requiredTypes() as $type) {
            DB::table('mobility_driver_documents')->insert(['onboarding_id' => $onboarding, 'document_type' => $type, 'version' => 1, 'storage_path' => 'synthetic/'.$type, 'mime_type' => 'application/pdf', 'byte_size' => 1, 'expires_at' => now()->addYear()->toDateString(), 'status' => 'accepted', 'submitted_by' => $user->id, 'reviewed_by' => $user->id, 'reviewed_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
        }
        return $car;
    }

    private function profile(string $role): array
    {
        return ['role' => $role, 'vehicle_preference' => 'both', 'schedule_mode' => 'custom', 'home' => ['lat' => 12.9716, 'lng' => 77.5946, 'label' => 'Private selected origin'], 'campus' => ['lat' => 12.9352, 'lng' => 77.62, 'label' => 'Private selected destination'], 'outbound_time' => '08:30', 'return_time' => '17:30', 'weekdays' => [1, 2, 3, 4, 5, 6, 7], 'max_walk_meters' => 999];
    }
}
