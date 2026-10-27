<?php

namespace Tests\Feature\Mobility;

use Illuminate\Support\Facades\DB;
use STS\Models\Passenger;
use STS\Models\Trip;
use STS\Models\User;
use Tests\TestCase;

final class MobilityTrustedShareHttpTest extends TestCase
{
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

    public function test_only_owner_or_accepted_passenger_can_create_and_public_read_is_minimal(): void
    {
        [$owner, $rider, $trip] = $this->fixture();
        $outsider = $this->member();
        $path = '/api/mobility/trips/'.$trip->id.'/trusted-shares';
        $this->actingAsApiUser($outsider)->postJson($path, ['scope' => 'status'], ['Idempotency-Key' => 'outsider'])->assertForbidden();
        $created = $this->actingAsApiUser($rider)->postJson($path, ['scope' => 'status', 'expires_in_minutes' => 30], ['Idempotency-Key' => 'create'])->assertCreated();
        $token = (string) $created->json('data.token');
        $this->assertSame(64, strlen($token));
        $this->assertDatabaseMissing('mobility_trusted_share_grants', ['token_hash' => $token]);
        $read = $this->getJson('/api/mobility/trusted-shares/'.$token)->assertOk();
        $this->assertArrayNotHasKey('trip_id', $read->json('data'));
        $this->assertArrayNotHasKey('token', $read->json('data'));
        $this->assertStringContainsString('no-store', (string) $read->headers->get('Cache-Control'));
    }

    public function test_status_scope_is_expiring_and_same_key_recovers_without_rotation(): void
    {
        [$owner, , $trip] = $this->fixture();
        $created = $this->actingAsApiUser($owner)->postJson('/api/mobility/trips/'.$trip->id.'/trusted-shares', ['scope' => 'status', 'expires_in_minutes' => 5], ['Idempotency-Key' => 'status'])->assertCreated();
        $read = $this->getJson('/api/mobility/trusted-shares/'.$created->json('data.token'))->assertOk();
        $this->assertArrayNotHasKey('location', $read->json('data'));
        $retry = $this->actingAsApiUser($owner)->postJson('/api/mobility/trips/'.$trip->id.'/trusted-shares', ['scope' => 'status', 'expires_in_minutes' => 5], ['Idempotency-Key' => 'status'])->assertCreated();
        $this->assertSame($created->json('data.grant_id'), $retry->json('data.grant_id'));
        $this->assertSame($created->json('data.token'), $retry->json('data.token'));
        $this->actingAsApiUser($owner)->postJson('/api/mobility/trips/'.$trip->id.'/trusted-shares', ['scope' => 'status', 'expires_in_minutes' => 6], ['Idempotency-Key' => 'status'])->assertStatus(409)->assertJsonPath('error.code', 'IDEMPOTENCY_CONFLICT');
        DB::table('mobility_trusted_share_grants')->where('id', $created->json('data.grant_id'))->update(['expires_at' => now('UTC')->subSecond()]);
        $this->getJson('/api/mobility/trusted-shares/'.$created->json('data.token'))->assertNotFound()->assertJsonPath('error.code', 'TRUSTED_SHARE_NOT_FOUND');
    }

    public function test_only_creator_can_revoke_and_revocation_is_immediate(): void
    {
        [$owner, $rider, $trip] = $this->fixture();
        $created = $this->actingAsApiUser($owner)->postJson('/api/mobility/trips/'.$trip->id.'/trusted-shares', ['scope' => 'status'], ['Idempotency-Key' => 'revoke'])->assertCreated();
        $token = $created->json('data.token');
        $this->actingAsApiUser($rider)->deleteJson('/api/mobility/trips/'.$trip->id.'/trusted-shares/'.$created->json('data.grant_id'))->assertForbidden();
        DB::table('trip_passengers')->where(['trip_id' => $trip->id, 'user_id' => $owner->id])->delete();
        $this->actingAsApiUser($owner)->deleteJson('/api/mobility/trips/'.$trip->id.'/trusted-shares/'.$created->json('data.grant_id'))->assertOk();
        $this->getJson('/api/mobility/trusted-shares/'.$token)->assertNotFound();
    }

    public function test_public_read_rejects_terminal_trip(): void
    {
        [$owner, , $trip] = $this->fixture();
        $created = $this->actingAsApiUser($owner)->postJson('/api/mobility/trips/'.$trip->id.'/trusted-shares', ['scope' => 'status'], ['Idempotency-Key' => 'terminal-read'])->assertCreated();
        $trip->update(['state' => Trip::STATE_CANCELED]);
        $this->getJson('/api/mobility/trusted-shares/'.$created->json('data.token'))->assertNotFound();
    }

    public function test_key_recovery_failure_is_safe_when_application_key_changes(): void
    {
        [$owner, , $trip] = $this->fixture();
        $this->actingAsApiUser($owner)->postJson('/api/mobility/trips/'.$trip->id.'/trusted-shares', ['scope' => 'status'], ['Idempotency-Key' => 'key-rotation'])->assertCreated();
        DB::table('mobility_trusted_share_grants')->where('trip_id', $trip->id)->update(['token_ciphertext' => 'corrupt-after-key-rotation']);
        $this->actingAsApiUser($owner)->postJson('/api/mobility/trips/'.$trip->id.'/trusted-shares', ['scope' => 'status'], ['Idempotency-Key' => 'key-rotation'])->assertStatus(503)->assertJsonPath('error.code', 'TRUSTED_SHARE_RECOVERY_UNAVAILABLE');
    }

    public function test_same_key_for_an_expired_grant_returns_controlled_error(): void
    {
        [$owner, , $trip] = $this->fixture();
        $this->actingAsApiUser($owner)->postJson('/api/mobility/trips/'.$trip->id.'/trusted-shares', ['scope' => 'status'], ['Idempotency-Key' => 'expired-key'])->assertCreated();
        DB::table('mobility_trusted_share_grants')->where(['trip_id' => $trip->id, 'created_by' => $owner->id])->update(['expires_at' => now('UTC')->subSecond()]);
        $this->actingAsApiUser($owner)->postJson('/api/mobility/trips/'.$trip->id.'/trusted-shares', ['scope' => 'status'], ['Idempotency-Key' => 'expired-key'])->assertStatus(409)->assertJsonPath('error.code', 'TRUSTED_SHARE_EXPIRED');
    }

    public function test_terminal_trip_cannot_create_and_anonymous_bad_tokens_are_generic(): void
    {
        [$owner, , $trip] = $this->fixture();
        $trip->update(['state' => Trip::STATE_CANCELED]);
        $this->actingAsApiUser($owner)->postJson('/api/mobility/trips/'.$trip->id.'/trusted-shares', ['scope' => 'status'], ['Idempotency-Key' => 'closed'])->assertStatus(409)->assertJsonPath('error.code', 'TRUSTED_SHARE_CLOSED');
        $this->getJson('/api/mobility/trusted-shares/not-a-token')->assertNotFound()->assertJsonPath('error.code', 'TRUSTED_SHARE_NOT_FOUND');
    }

    private function fixture(): array
    {
        $owner = $this->member(); $rider = $this->member(); $trip = Trip::factory()->create(['user_id' => $owner->id]);
        Passenger::factory()->aceptado()->create(['trip_id' => $trip->id, 'user_id' => $rider->id]);
        return [$owner, $rider, $trip];
    }

    protected function beforeRefreshingDatabase(): void
    {
        if (! preg_match('/^testing[a-zA-Z0-9_-]*$/', DB::connection()->getDatabaseName())) {
            throw new \RuntimeException('Refusing to refresh a non-test database.');
        }
    }

    private function member(): User
    {
        $user = User::factory()->create(['active' => true, 'banned' => false]);
        DB::table('mobility_memberships')->insert(['user_id' => $user->id, 'college_code' => 'CAMPUS-BLR', 'affiliation' => 'student', 'status' => 'approved', 'version' => 1, 'created_at' => now(), 'updated_at' => now()]);
        return $user;
    }
}
