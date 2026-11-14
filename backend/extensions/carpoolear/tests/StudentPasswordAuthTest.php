<?php

namespace Tests\Feature\Mobility;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use STS\Mobility\Identity\CollegeEmailAuth;
use Tests\TestCase;

final class StudentPasswordAuthTest extends TestCase
{
    private $oldCollegeCode;
    protected function setUp(): void
    {
        parent::setUp();
        $this->oldCollegeCode = getenv('MOBILITY_COLLEGE_CODE');
        putenv('MOBILITY_COLLEGE_CODE=CAMPUS-BLR');
        putenv('MOBILITY_PUBLIC_STUDENT_ONLY=true');
        config(['college.code' => 'CAMPUS-BLR', 'college.campuses' => ['CAMPUS-BLR']]);
    }

    protected function tearDown(): void
    {
        putenv('MOBILITY_PUBLIC_STUDENT_ONLY');
        putenv($this->oldCollegeCode === false ? 'MOBILITY_COLLEGE_CODE' : 'MOBILITY_COLLEGE_CODE='.$this->oldCollegeCode);
        parent::tearDown();
    }

    private function challenge(string $email): string
    {
        $id = (string) Str::uuid();
        DB::table('mobility_college_email_challenges')->insert([
            'challenge_id' => $id, 'email' => $email,
            'code_hash' => app(CollegeEmailAuth::class)->otpDigest($id, $email, '123456'),
            'expires_at' => now()->addMinutes(5), 'resend_after' => now()->addSeconds(30),
            'created_at' => now(), 'updated_at' => now(),
        ]);
        return $id;
    }

    public function test_verified_registration_password_login_and_reset_revoke_old_sessions(): void
    {
        $base = '/api/mobility/college-auth/';
        $email = 'password.student@stu.pes.edu';
        $registered = $this->postJson($base.'verify', [
            'challenge_id' => $this->challenge($email), 'code' => '123456',
            'name' => 'Student Test', 'srn' => 'PES1UG24CS111', 'campus_code' => 'CAMPUS-BLR',
            'gender_identity' => 'woman', 'phone' => '9876543210',
            'password_action' => 'register', 'username' => 'Student.Test', 'password' => 'initial-secret-123',
        ])->assertOk()->assertJsonPath('verified_college_email', true);
        $id = (int) $registered->json('user.id');
        $this->assertDatabaseHas('mobility_student_profiles', ['user_id' => $id, 'gender_identity' => 'woman']);
        $row = DB::table('mobility_student_password_accounts')->where('user_id', $id)->first();
        $this->assertSame('student.test', $row->username);
        $this->assertNotSame('initial-secret-123', $row->password_hash);
        $this->assertTrue(Hash::check('initial-secret-123', $row->password_hash));

        $this->postJson($base.'password-login', ['username' => 'student.test', 'password' => 'incorrect-password'])
            ->assertUnauthorized()->assertJsonPath('error.code', 'INVALID_CREDENTIALS');
        $login = $this->postJson($base.'password-login', ['username' => 'STUDENT.TEST', 'password' => 'initial-secret-123'])->assertOk();
        $oldToken = $login->json('token');
        $oldBrowser = $login->json('browser_session');
        $this->getJson($base.'profile', ['Authorization' => 'Bearer '.$oldToken])->assertOk()->assertJsonPath('gender_identity', 'woman');

        $reset = $this->postJson($base.'verify', [
            'challenge_id' => $this->challenge($email), 'code' => '123456',
            'password_action' => 'reset', 'password' => 'replacement-secret-456',
        ])->assertOk();
        $this->getJson($base.'session', ['X-CampusPool-Browser-Session' => $oldBrowser])->assertUnauthorized();
        $this->getJson($base.'profile', ['Authorization' => 'Bearer '.$oldToken])->assertUnauthorized();
        $this->postJson($base.'password-login', ['username' => 'student.test', 'password' => 'initial-secret-123'])->assertUnauthorized();
        $this->postJson($base.'password-login', ['username' => 'student.test', 'password' => 'replacement-secret-456'])->assertOk();
        $this->assertNotEmpty($reset->json('token'));
    }

    public function test_password_cannot_be_registered_or_reset_without_verified_email_code(): void
    {
        $base = '/api/mobility/college-auth/';
        $challenge = $this->challenge('notverified@stu.pes.edu');
        $this->postJson($base.'verify', [
            'challenge_id' => $challenge, 'code' => '999999', 'name' => 'Test User',
            'srn' => 'PES1UG24CS112', 'campus_code' => 'CAMPUS-BLR', 'gender_identity' => 'man',
            'phone' => '9876543210', 'password_action' => 'register', 'username' => 'unverified',
            'password' => 'initial-secret-123',
        ])->assertUnprocessable()->assertJsonPath('error.code', 'COLLEGE_OTP_INVALID');
        $this->assertDatabaseMissing('mobility_student_password_accounts', ['username' => 'unverified']);
        $this->postJson($base.'verify', [
            'challenge_id' => $this->challenge('unknown@stu.pes.edu'), 'code' => '123456',
            'password_action' => 'reset', 'password' => 'replacement-secret-456',
        ])->assertUnprocessable()->assertJsonPath('error.code', 'STUDENT_PASSWORD_RESET_UNAVAILABLE');
    }
}
