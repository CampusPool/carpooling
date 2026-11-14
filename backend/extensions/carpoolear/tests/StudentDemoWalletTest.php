<?php

namespace Tests\Feature\Mobility;

use Illuminate\Support\Facades\DB;
use STS\Mobility\Pickup\PathProvider;
use STS\Models\User;
use Tests\TestCase;

final class StudentDemoWalletTest extends TestCase
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
        foreach (['MOBILITY_PUBLIC_STUDENT_ONLY' => 'true', 'MOBILITY_PILOT_UI_ENABLED' => 'false', 'MOBILITY_COLLEGE_CODE' => 'CAMPUS-BLR', 'MOBILITY_COHORT_REQUIRED' => 'true', 'MOBILITY_DEMO_VEHICLES_ENABLED' => 'true', 'MOBILITY_STUDENT_DEMO_WALLET_ENABLED' => 'false'] as $key => $value) {
            $this->environment[$key] = getenv($key);
            putenv($key.'='.$value);
        }
        // Opt in only on a disposable configured host; keep normal CI deterministic.
        if (filter_var(getenv('ADDRESS_TEST_REAL_ROUTING'), FILTER_VALIDATE_BOOLEAN)) return;
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

    private const API = '/api/mobility/address-rides/';

    public function test_demo_payment_is_explicitly_enabled_and_settles_once(): void
    {
        $driver = $this->student('wallet.driver@stu.pes.edu');
        $rider = $this->student('wallet.rider@stu.pes.edu');
        $this->actingAsApiUser($rider)->getJson(self::API.'wallet')->assertOk()->assertJsonPath('enabled', false);
        $this->walletPost($rider, 'wallet/topup', ['amount_minor' => 10000], 'disabled')->assertNotFound();

        putenv('MOBILITY_STUDENT_DEMO_WALLET_ENABLED=true');
        $this->walletPost($rider, 'wallet/topup', ['amount_minor' => 10000], 'credit')->assertOk()->assertJsonPath('available_minor', 10000);
        $this->walletPost($rider, 'wallet/topup', ['amount_minor' => 10000], 'credit')->assertOk()->assertJsonPath('available_minor', 10000);
        [$trip, $booking, $fare] = $this->book($driver, $rider, 1);
        $this->assertGreaterThan(0, $fare);

        $this->walletPost($driver, 'bookings/'.$booking.'/payment/pay', [], 'driver-cannot-pay')->assertForbidden();
        $this->walletPost($rider, 'bookings/'.$booking.'/payment/pay', [], 'pay')->assertOk()->assertJsonPath('data.wallet_state', 'held');
        $this->walletPost($rider, 'bookings/'.$booking.'/payment/pay', [], 'pay-retry')->assertOk()->assertJsonPath('data.wallet_state', 'held');
        $this->actingAsApiUser($rider)->getJson(self::API.'wallet')->assertOk()
            ->assertJsonPath('wallet.available_minor', 10000 - $fare)->assertJsonPath('wallet.held_minor', $fare);

        foreach (['start', 'board', 'alight', 'complete'] as $action) {
            $body = ['action' => $action] + (in_array($action, ['board', 'alight'], true) ? ['passenger_id' => $rider->id] : []);
            $this->walletPost($driver, 'trips/'.$trip.'/transition', $body, $action)->assertOk();
        }
        $this->walletPost($rider, 'bookings/'.$booking.'/payment/arrive', [], 'arrive')->assertOk();
        $this->walletPost($driver, 'wallet/release', [], 'not-due')->assertOk()->assertJsonPath('available_minor', 0);
        $this->travel(3)->hours();
        $this->walletPost($driver, 'wallet/release', [], 'due')->assertOk()->assertJsonPath('available_minor', $fare);
        $this->walletPost($driver, 'wallet/release', [], 'due-retry')->assertOk()->assertJsonPath('available_minor', $fare);
        $receipt = $this->walletPost($driver, 'bookings/'.$booking.'/payment/confirm-payment-received', [], 'receipt')->assertOk()
            ->assertJsonPath('receipt.non_redeemable', true)->json('receipt.receipt_number');
        $this->walletPost($driver, 'bookings/'.$booking.'/payment/confirm-payment-received', [], 'receipt-retry')->assertOk()
            ->assertJsonPath('receipt.receipt_number', $receipt);
        $this->assertDatabaseCount('mobility_commute_demo_holds', 1);
        $this->assertDatabaseCount('mobility_commute_demo_receipts', 1);
    }

    public function test_booking_and_whole_ride_cancellation_refund_held_credits_once(): void
    {
        putenv('MOBILITY_STUDENT_DEMO_WALLET_ENABLED=true');
        $driver = $this->student('refund.driver@stu.pes.edu');
        $rider = $this->student('refund.rider@stu.pes.edu');
        $this->walletPost($rider, 'wallet/topup', ['amount_minor' => 10000], 'credit')->assertOk();
        foreach ([1, 2] as $offset) {
            [$trip, $booking] = $this->book($driver, $rider, $offset);
            $this->walletPost($rider, 'bookings/'.$booking.'/payment/pay', [], 'hold-'.$offset)->assertOk();
            if ($offset === 1) {
                $this->walletPost($rider, 'bookings/'.$booking.'/cancel', [], 'cancel-booking')->assertOk();
            } else {
                $this->walletPost($driver, 'trips/'.$trip.'/transition', ['action' => 'cancel'], 'cancel-trip')->assertOk();
                $this->walletPost($driver, 'trips/'.$trip.'/transition', ['action' => 'cancel'], 'cancel-trip')->assertOk();
            }
            $this->assertDatabaseHas('mobility_commute_demo_holds', ['booking_id' => $booking, 'state' => 'refunded']);
            $this->actingAsApiUser($rider)->getJson(self::API.'wallet')->assertOk()
                ->assertJsonPath('wallet.available_minor', 10000)->assertJsonPath('wallet.held_minor', 0);
        }
        $this->assertSame(2, DB::table('mobility_commute_demo_entries')->where('kind', 'refund')->count());
    }

    private function book(User $driver, User $rider, int $offset): array
    {
        $this->actingAsApiUser($driver)->putJson(self::API.'profile', $this->profile('driver'))->assertOk();
        $this->actingAsApiUser($rider)->putJson(self::API.'profile', $this->profile('rider'))->assertOk();
        $car = $this->walletPost($driver, 'vehicles', ['registration' => 'KA00DE0007'], 'car')->assertOk()->json('data.id');
        $date = now('Asia/Kolkata')->addDays($offset)->toDateString();
        $offer = ['date' => $date, 'direction' => 'outbound', 'vehicle_type' => 'car', 'choice' => 'DIRECT_RIDER_PICKUP', 'car_id' => $car, 'total_seats' => 1];
        $trip = $this->walletPost($driver, 'offers', $offer, 'offer-'.$offset)->assertOk()->json('data.trip_id');
        $card = $this->actingAsApiUser($rider)->getJson(self::API.'rides?direction=outbound&date='.$date.'&vehicle_type=car')->assertOk()->json('data.0');
        $booking = $this->walletPost($rider, 'rides/'.$trip.'/request', ['quote_token' => $card['quote_token']], 'book-'.$offset)->assertOk()->json('data.booking_id');
        $fare = $this->walletPost($driver, 'bookings/'.$booking.'/accept', [], 'accept-'.$offset)->assertOk()->json('data.fare_minor');

        return [$trip, $booking, $fare];
    }

    private function walletPost(User $actor, string $path, array $data, string $key): \Illuminate\Testing\TestResponse
    {
        return $this->actingAsApiUser($actor)->postJson(self::API.$path, $data, ['Idempotency-Key' => $key]);
    }

    private function student(string $email): User
    {
        $user = User::factory()->create(['email' => $email, 'active' => true, 'banned' => false]);
        DB::table('mobility_memberships')->insert(['user_id' => $user->id, 'college_code' => 'CAMPUS-BLR', 'affiliation' => 'student', 'status' => 'approved', 'version' => 1, 'created_at' => now(), 'updated_at' => now()]);
        DB::table('mobility_verified_identities')->insert(['user_id' => $user->id, 'provider' => 'college_email_otp', 'email' => $email, 'domain' => 'stu.pes.edu', 'verified_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
        return $user;
    }

    private function profile(string $role): array
    {
        return ['role' => $role, 'vehicle_preference' => 'both', 'schedule_mode' => 'custom', 'home' => ['lat' => 12.9716, 'lng' => 77.5946, 'label' => 'Private selected origin'], 'campus' => ['lat' => 12.9352, 'lng' => 77.62, 'label' => 'Private selected destination'], 'outbound_time' => '08:30', 'return_time' => '17:30', 'weekdays' => [1, 2, 3, 4, 5, 6, 7], 'max_walk_meters' => 999];
    }
}
