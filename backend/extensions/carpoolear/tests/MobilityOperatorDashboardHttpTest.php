<?php

namespace Tests\Feature\Mobility;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use STS\Models\SupportTicket;
use STS\Models\Trip;
use STS\Models\User;
use Tymon\JWTAuth\Facades\JWTAuth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

final class MobilityOperatorDashboardHttpTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        putenv('MOBILITY_COLLEGE_CODE=CAMPUS-BLR');
    }

    public function test_dashboard_is_admin_only_and_returns_bounded_demo_usage_and_report_projection(): void
    {
        $outsider = User::factory()->create(['active' => true, 'banned' => false, 'is_admin' => false]);
        $this->actingAsApiUser($outsider)->getJson('/api/mobility/operator/dashboard')
            ->assertForbidden()->assertJsonPath('error.code', 'OPERATOR_FORBIDDEN');

        $admin = User::factory()->create(['active' => true, 'banned' => false, 'is_admin' => true]);
        $driver = User::factory()->create(['active' => true, 'banned' => false]);
        $trip = Trip::factory()->create(['user_id' => $driver->id]);
        DB::table('mobility_commute_demo_actors')->insert([
            'user_id' => $driver->id, 'fixture_key' => 'operator-dashboard-driver',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('mobility_commute_demo_trips')->insert([
            'trip_id' => $trip->id, 'audience_id' => 0, 'fixture_key' => 'operator-dashboard-trip',
            'vehicle_type' => 'car', 'fare_minor' => 0, 'base_fare_minor' => 0,
            'surcharge_minor' => 0, 'journey' => '{}', 'created_at' => now(), 'updated_at' => now(),
        ]);
        $ticket = SupportTicket::create([
            'user_id' => $driver->id, 'created_by' => $driver->id, 'trip_id' => $trip->id,
            'type' => 'report', 'source' => 'web_form', 'subject' => 'Pickup report',
            'status' => 'Open', 'priority' => 'high', 'unread_for_user' => 0, 'unread_for_admin' => 1,
        ]);

        $response = $this->actingAsApiUser($admin)->getJson('/api/mobility/operator/dashboard')->assertOk();
        $response->assertJsonPath('audience', 'operator')
            ->assertJsonPath('demo_only', true)
            ->assertJsonPath('usage.demo_actors', 1)
            ->assertJsonPath('usage.demo_trips', 1)
            ->assertJsonPath('usage.reports_open', 1)
            ->assertJsonPath('reports.0.id', $ticket->id)
            ->assertJsonPath('reports.0.subject', 'Pickup report');
        $this->assertStringNotContainsString('internal_note_markdown', $response->getContent());

        $this->actingAsApiUser($admin)->getJson('/api/mobility/commute/me')
            ->assertOk()->assertJsonPath('operator', true);

        putenv('MOBILITY_PILOT_UI_ENABLED=true');
        $demo = $this->postJson('/api/mobility/commute/demo-session', ['role' => 'rider', 'scenario' => 'campus-route'])->assertOk();
        $this->assertFalse((bool) User::findOrFail($demo->json('user.id'))->is_admin);
    }

    public function test_inactive_or_banned_admin_cannot_open_dashboard(): void
    {
        foreach ([['active' => false, 'banned' => false], ['active' => true, 'banned' => true]] as $flags) {
            $admin = User::factory()->create(array_merge($flags, ['is_admin' => true]));
            $response = $this->actingAsApiUser($admin)->getJson('/api/mobility/operator/dashboard');
            $this->assertContains($response->status(), [401, 403]);
        }
    }

    public function test_legacy_schema_returns_empty_dashboard_without_commute_tables(): void
    {
        $admin = User::factory()->create(['active' => true, 'banned' => false, 'is_admin' => true]);
        Schema::dropIfExists('mobility_commute_demo_trips');

        $this->actingAsApiUser($admin)->getJson('/api/mobility/operator/dashboard')
            ->assertOk()->assertJsonPath('schema', 'legacy_without_commute_tables')
            ->assertJsonPath('usage.demo_trips', 0)->assertJsonPath('reports', []);
    }

    public function test_existing_support_api_enforces_admin_and_resolves_report_with_backend_status(): void
    {
        $admin = User::factory()->create(['active' => true, 'banned' => false, 'is_admin' => true]);
        $outsider = User::factory()->create(['active' => true, 'banned' => false, 'is_admin' => false]);
        $driver = User::factory()->create(['active' => true, 'banned' => false]);
        $trip = Trip::factory()->create(['user_id' => $driver->id]);
        $ticket = SupportTicket::create([
            'user_id' => $driver->id, 'created_by' => $driver->id, 'trip_id' => $trip->id,
            'type' => 'report', 'source' => 'web_form', 'subject' => 'Resolution audit',
            'status' => 'Open', 'priority' => 'high', 'unread_for_user' => 0, 'unread_for_admin' => 1,
        ]);

        $denied = $this->withHeaders($this->jwtHeaders($outsider))->getJson('/api/admin/support/tickets?type=report&per_page=20&page=1');
        $this->assertContains($denied->status(), [401, 403]);
        $this->withHeaders($this->jwtHeaders($admin))->getJson('/api/admin/support/tickets?type=report&per_page=20&page=1')
            ->assertOk();
        $this->withHeaders($this->jwtHeaders($admin))->postJson('/api/admin/support/tickets/'.$ticket->id.'/resolve', [], ['Idempotency-Key' => 'operator-resolution-'.$ticket->id])
            ->assertOk();
        $this->assertContains((string) SupportTicket::findOrFail($ticket->id)->status, ['Resuelto', 'Resolved']);
    }

    private function jwtHeaders(User $user): array
    {
        return ['Authorization' => 'Bearer '.JWTAuth::fromUser($user), 'Accept' => 'application/json'];
    }

    public function test_host_login_route_is_shared_cache_throttled(): void
    {
        RateLimiter::clear('mobility-login-ip:127.0.0.1');
        for ($attempt = 1; $attempt <= 5; $attempt++) {
            $this->assertNotSame(429, $this->postJson('/api/login', ['email' => 'missing-admin@example.invalid', 'password' => 'invalid-password'])->status());
        }
        $this->postJson('/api/login', ['email' => 'missing-admin@example.invalid', 'password' => 'invalid-password'])
            ->assertStatus(429)->assertJsonPath('error.code', 'LOGIN_RATE_LIMITED');
        RateLimiter::clear('mobility-login-ip:127.0.0.1');
    }

    public function test_real_admin_credentials_issue_signed_operator_session(): void
    {
        RateLimiter::clear('mobility-login-ip:127.0.0.1');
        $email = 'isolated-admin-'.bin2hex(random_bytes(4)).'@example.invalid';
        $password = 'A-safe-synthetic-password-42';
        User::factory()->create([
            'email' => $email,
            'password' => Hash::make($password),
            'active' => true,
            'banned' => false,
            'is_admin' => true,
        ]);

        $this->postJson('/api/login', ['email' => $email, 'password' => 'wrong-password'])
            ->assertStatus(401);
        $login = $this->postJson('/api/login', ['email' => $email, 'password' => $password])->assertOk();
        $token = $login->json('token');
        $this->assertIsString($token);
        $this->assertNotSame('', $token);
        $headers = ['Authorization' => 'Bearer '.$token, 'Accept' => 'application/json'];
        $this->withHeaders($headers)->getJson('/api/mobility/commute/me')
            ->assertOk()->assertJsonPath('operator', true);
        $this->withHeaders($headers)->getJson('/api/mobility/operator/dashboard')
            ->assertOk()->assertJsonPath('audience', 'operator');
        RateLimiter::clear('mobility-login-ip:127.0.0.1');
    }
}
