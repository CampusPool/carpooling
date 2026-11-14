<?php

namespace Tests\Feature\Mobility;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use STS\Mobility\Commute\CommuteService;
use Tests\TestCase;

final class LocalAccountAuthTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        putenv('MOBILITY_PILOT_UI_ENABLED=true');
    }

    protected function tearDown(): void
    {
        putenv('MOBILITY_PILOT_UI_ENABLED');
        parent::tearDown();
    }

    public function test_separate_rider_and_driver_accounts_register_and_sign_in_with_hashed_passwords(): void
    {
        $rider = $this->postJson('/api/mobility/local-auth/register', [
            'username' => 'Rider_One', 'password' => 'local-pass-123', 'role' => 'rider',
        ])->assertCreated()->assertJsonPath('role', 'rider')->assertJsonStructure(['token', 'role', 'user' => ['id', 'name']]);
        $driver = $this->postJson('/api/mobility/local-auth/register', [
            'username' => 'Driver_One', 'password' => 'local-pass-456', 'role' => 'driver',
        ])->assertCreated()->assertJsonPath('role', 'driver');

        $this->assertNotSame($rider->json('user.id'), $driver->json('user.id'));
        $this->assertSame('rider', DB::table('mobility_local_accounts')->where('username', 'rider_one')->value('role'));
        $this->assertSame('driver', DB::table('mobility_local_accounts')->where('username', 'driver_one')->value('role'));
        $this->assertTrue(Hash::check('local-pass-123', DB::table('users')->where('id', $rider->json('user.id'))->value('password')));
        $this->assertNotSame('local-pass-123', DB::table('users')->where('id', $rider->json('user.id'))->value('password'));

        $this->postJson('/api/mobility/local-auth/login', ['username' => 'RIDER_ONE', 'password' => 'local-pass-123'])
            ->assertOk()->assertJsonPath('role', 'rider');
        $this->postJson('/api/mobility/local-auth/login', ['username' => 'rider_one', 'password' => 'wrong-password'])
            ->assertUnauthorized()->assertJsonPath('error.code', 'INVALID_CREDENTIALS');
        $this->postJson('/api/mobility/local-auth/register', ['username' => 'rider_one', 'password' => 'local-pass-789', 'role' => 'driver'])
            ->assertStatus(409)->assertJsonPath('error.code', 'USERNAME_TAKEN');

        $this->assertTrue(CommuteService::demoActor((int) $rider->json('user.id')));
        $this->assertTrue(CommuteService::demoActor((int) $driver->json('user.id')));
    }

    public function test_local_registration_is_hidden_outside_testing_gate(): void
    {
        $this->assertTrue(app()->environment('testing'));
        putenv('MOBILITY_PILOT_UI_ENABLED=false');
        $this->postJson('/api/mobility/local-auth/register', [
            'username' => 'hidden_user', 'password' => 'local-pass-123', 'role' => 'rider',
        ])->assertNotFound();
    }

    public function test_registration_rejects_bcrypt_overlength_utf8_passwords(): void
    {
        $this->postJson('/api/mobility/local-auth/register', [
            'username' => 'long_password', 'password' => str_repeat('é', 37), 'role' => 'rider',
        ])->assertStatus(422)->assertJsonPath('error.code', 'PASSWORD_TOO_LONG_BYTES');
        $this->assertDatabaseMissing('mobility_local_accounts', ['username' => 'long_password']);
    }

    public function test_registration_accepts_gender_and_stores_commute_profile(): void
    {
        $res = $this->postJson('/api/mobility/local-auth/register', [
            'username' => 'gender_rider', 'password' => 'local-pass-123', 'role' => 'rider', 'gender' => 'female',
        ])->assertCreated();

        $userId = (int) $res->json('user.id');
        $profile = DB::table('mobility_commute_profiles')->where('user_id', $userId)->first();
        $this->assertNotNull($profile);
        $this->assertSame('woman', $profile->gender_identity);
        $this->assertSame(0, (int) $profile->same_gender_only);
    }
}
