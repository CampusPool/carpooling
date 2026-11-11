<?php

namespace Tests\Feature\Mobility;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Mail\Message;
use STS\Models\User;
use Tests\TestCase;

final class CollegeEmailAuthRegistrationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['college.campuses' => ['CAMPUS-BLR', 'CAMPUS-MYS']]);
    }

    public function test_verified_student_registration_persists_normalized_unique_profile(): void
    {
        $challenge = $this->challenge('new.student@stu.pes.edu');

        $response = $this->postJson('/api/mobility/college-auth/verify', [
            'challenge_id' => $challenge,
            'code' => '123456',
            'name' => '  New Student  ',
            'srn' => ' pes1ug24am123 ',
            'campus_code' => 'campus-blr',
        ])->assertOk()->assertJsonPath('verified_college_email', true)
            ->assertJsonPath('user.name', 'New Student')
            ->assertJsonPath('student_profile.srn', 'PES1UG24AM123')
            ->assertJsonPath('student_profile.campus_code', 'CAMPUS-BLR');

        $userId = (int) $response->json('user.id');
        $user = User::findOrFail($userId);
        $this->assertSame('new.student@stu.pes.edu', $user->email);
        $this->assertDatabaseHas('mobility_verified_identities', ['user_id' => $userId, 'email' => $user->email, 'domain' => 'stu.pes.edu']);
        $this->assertDatabaseHas('mobility_student_profiles', ['user_id' => $userId, 'srn_normalized' => 'PES1UG24AM123', 'campus_code' => 'CAMPUS-BLR']);
        $this->assertDatabaseHas('mobility_memberships', ['user_id' => $userId, 'affiliation' => 'student', 'status' => 'approved']);
        $this->assertNotEmpty($user->password);
        $this->assertDatabaseHas('mobility_college_email_challenges', ['challenge_id' => $challenge]);
        $this->assertNotNull(DB::table('mobility_college_email_challenges')->where('challenge_id', $challenge)->value('consumed_at'));
    }

    public function test_registration_rejects_invalid_identity_fields_without_consuming_verified_challenge(): void
    {
        $challenge = $this->challenge('invalid.student@stu.pes.edu');

        $this->postJson('/api/mobility/college-auth/verify', [
            'challenge_id' => $challenge, 'code' => '123456', 'name' => 'A', 'srn' => 'bad srn', 'campus_code' => 'CAMPUS-OTHER',
        ])->assertStatus(422)->assertJsonPath('error.code', 'STUDENT_NAME_INVALID');

        $this->assertNull(DB::table('mobility_college_email_challenges')->where('challenge_id', $challenge)->value('consumed_at'));
        $this->assertDatabaseMissing('users', ['email' => 'invalid.student@stu.pes.edu']);
    }

    public function test_request_delivers_a_hidden_otp_to_eligible_college_email(): void
    {
        $email = 'mail.student@stu.pes.edu';
        config([
            'mail.default' => 'smtp',
            'mail.mailers.smtp.host' => 'smtp.test.invalid',
            'mail.mailers.smtp.username' => 'synthetic-user',
            'mail.mailers.smtp.password' => 'synthetic-password',
        ]);
        $deliveredCode = null;
        Mail::shouldReceive('raw')->once()->withArgs(function (string $body, callable $configure) use ($email, &$deliveredCode): bool {
            $this->assertMatchesRegularExpression('/Your college sign-in code is ([0-9]{6})[.] It expires in five minutes[.]/', $body);
            preg_match('/Your college sign-in code is ([0-9]{6})[.]/', $body, $match);
            $deliveredCode = $match[1] ?? null;
            $message = \Mockery::mock(Message::class);
            $message->shouldReceive('to')->once()->with($email)->andReturnSelf();
            $message->shouldReceive('subject')->once()->with('Your college sign-in code')->andReturnSelf();
            $configure($message);
            return true;
        });

        $response = $this->postJson('/api/mobility/college-auth/request', ['email' => $email])
            ->assertCreated()
            ->assertJsonStructure(['challenge_id', 'expires_in', 'resend_after']);

        $challenge = (string) $response->json('challenge_id');
        $stored = DB::table('mobility_college_email_challenges')->where('challenge_id', $challenge)->first();
        $this->assertNotNull($stored);
        $this->assertSame($email, $stored->email);
        $this->assertNotNull($deliveredCode);
        $this->assertSame(app(\STS\Mobility\Identity\CollegeEmailAuth::class)->otpDigest($challenge, $email, $deliveredCode), $stored->code_hash);
        $this->assertArrayNotHasKey('code', $response->json());
    }

    public function test_registration_rejects_duplicate_srn_case_insensitively(): void
    {
        $existing = User::factory()->create(['email' => 'existing.student@stu.pes.edu']);
        DB::table('mobility_student_profiles')->insert(['user_id' => $existing->id, 'srn_normalized' => 'PES1UG24AM456', 'campus_code' => 'CAMPUS-BLR', 'created_at' => now(), 'updated_at' => now()]);
        $challenge = $this->challenge('second.student@stu.pes.edu');

        $this->postJson('/api/mobility/college-auth/verify', [
            'challenge_id' => $challenge, 'code' => '123456', 'name' => 'Second Student', 'srn' => 'pes1ug24am456', 'campus_code' => 'CAMPUS-MYS',
        ])->assertStatus(409)->assertJsonPath('error.code', 'STUDENT_SRN_TAKEN');

        $this->assertDatabaseMissing('users', ['email' => 'second.student@stu.pes.edu']);
        $this->assertSame(1, DB::table('mobility_student_profiles')->where('srn_normalized', 'PES1UG24AM456')->count());
    }

    public function test_existing_password_account_can_complete_student_profile_without_replacing_credentials(): void
    {
        $passwordHash = Hash::make('Keep-this-existing-password-42');
        $existing = User::factory()->create(['email' => 'existing.account@stu.pes.edu', 'name' => 'Existing Account', 'password' => $passwordHash]);
        $challenge = $this->challenge($existing->email);

        $response = $this->postJson('/api/mobility/college-auth/verify', [
            'challenge_id' => $challenge, 'code' => '123456', 'name' => 'Existing Student', 'srn' => 'PES1UG24AM999', 'campus_code' => 'CAMPUS-MYS',
        ])->assertOk()->assertJsonPath('user.id', $existing->id)
            ->assertJsonPath('user.name', 'Existing Student')
            ->assertJsonPath('student_profile.campus_code', 'CAMPUS-MYS');

        $existing->refresh();
        $this->assertSame($passwordHash, $existing->password);
        $this->assertTrue(Hash::check('Keep-this-existing-password-42', $existing->password));
        $this->assertDatabaseHas('mobility_student_profiles', ['user_id' => $existing->id, 'srn_normalized' => 'PES1UG24AM999', 'campus_code' => 'CAMPUS-MYS']);
    }

    public function test_config_returns_allowed_campuses_and_logout_revokes_verified_token(): void
    {
        $this->getJson('/api/mobility/college-auth/config')->assertOk()->assertJsonPath('campuses.0', 'CAMPUS-BLR');
        $challenge = $this->challenge('logout.student@stu.pes.edu');
        $login = $this->postJson('/api/mobility/college-auth/verify', [
            'challenge_id' => $challenge, 'code' => '123456', 'name' => 'Logout Student', 'srn' => 'PES1UG24AM789', 'campus_code' => 'CAMPUS-BLR',
        ])->assertOk();
        $token = (string) $login->json('token');
        $headers = ['Authorization' => 'Bearer '.$token, 'Accept' => 'application/json'];

        $this->withHeaders($headers)->getJson('/api/mobility/commute/me')->assertOk();
        $this->withHeaders($headers)->postJson('/api/mobility/college-auth/logout')->assertOk()->assertJsonPath('logged_out', true);
        $this->withHeaders($headers)->getJson('/api/mobility/commute/me')->assertUnauthorized();
    }

    public function test_public_student_profile_and_browser_session_are_private_and_revocable(): void
    {
        putenv('MOBILITY_PUBLIC_STUDENT_ONLY=true');
        try {
            $path = '/api/mobility/college-auth/';
            $this->getJson($path.'profile')->assertUnauthorized();
            $this->getJson($path.'session')->assertUnauthorized();
            $challenge = $this->challenge('remembered.student@stu.pes.edu');
            $details = [
                'challenge_id' => $challenge, 'code' => '123456', 'name' => 'Remembered Student',
                'srn' => 'PES1UG24AM890', 'campus_code' => 'CAMPUS-BLR',
            ];
            $this->postJson($path.'verify', $details)->assertUnprocessable()->assertJsonPath('error.code', 'STUDENT_GENDER_INVALID');
            $login = $this->postJson($path.'verify', $details + ['gender_identity' => 'prefer_not_to_say', 'phone' => '98765 43210'])->assertOk();
            $browser = $login->json('browser_session');
            $this->assertMatchesRegularExpression('/^[a-f0-9]{64}$/D', $browser);
            $this->assertDatabaseHas('mobility_student_browser_sessions', ['token_hash' => hash('sha256', $browser)]);
            $this->assertDatabaseMissing('mobility_student_browser_sessions', ['token_hash' => $browser]);

            $browserHeader = ['X-CampusPool-Browser-Session' => $browser];
            $restored = $this->getJson($path.'session', $browserHeader)->assertOk()->json('token');
            $auth = ['Authorization' => 'Bearer '.$restored];
            $this->getJson($path.'profile', $auth)->assertOk()->assertJsonPath('phone', '+919876543210')->assertJsonPath('complete', true);
            $this->putJson($path.'profile', [
                'name' => 'Updated Student', 'phone' => '+91 99999 88888', 'gender_identity' => 'non_binary',
                'srn' => 'UNAUTHORIZED-CHANGE', 'email' => 'different@stu.pes.edu',
            ], $auth)->assertOk()->assertJsonPath('name', 'Updated Student')->assertJsonPath('srn', $details['srn'])
                ->assertJsonPath('email', 'remembered.student@stu.pes.edu');
            $this->deleteJson($path.'session', [], $browserHeader)->assertOk();
            $this->getJson($path.'session', $browserHeader)->assertUnauthorized();
        } finally {
            putenv('MOBILITY_PUBLIC_STUDENT_ONLY');
        }
    }

    private function challenge(string $email): string
    {
        $id = (string) Str::uuid();
        DB::table('mobility_college_email_challenges')->insert([
            'challenge_id' => $id, 'email' => $email,
            'code_hash' => app(\STS\Mobility\Identity\CollegeEmailAuth::class)->otpDigest($id, $email, '123456'),
            'expires_at' => now()->addMinutes(5), 'resend_after' => now()->addSeconds(30),
            'created_at' => now(), 'updated_at' => now(),
        ]);

        return $id;
    }
}
