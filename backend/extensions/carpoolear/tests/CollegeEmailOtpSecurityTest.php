<?php

namespace Tests\Feature\Mobility;

use Carbon\Carbon;
use Illuminate\Mail\Message;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use STS\Mobility\Identity\CollegeEmailAuth;
use STS\Models\User;
use Tests\TestCase;

final class CollegeEmailOtpSecurityTest extends TestCase
{
    protected function tearDown(): void
    {
        Carbon::setTestNow();
        putenv('MOBILITY_PUBLIC_STUDENT_ONLY');
        putenv('MOBILITY_EMAIL_TRANSPORT');
        putenv('MOBILITY_RESEND_API_KEY');
        putenv('MOBILITY_RESEND_FROM');
        putenv('MOBILITY_RESEND_HTTPS_PROXY');
        parent::tearDown();
    }

    private function studentChallenge(string $email, string $code = '000123', int $lifetime = 300): string
    {
        $id = (string) Str::uuid();
        DB::table('mobility_college_email_challenges')->insert([
            'challenge_id' => $id, 'email' => $email,
            'code_hash' => app(CollegeEmailAuth::class)->otpDigest($id, $email, $code),
            'expires_at' => now()->addSeconds($lifetime),
            'resend_after' => now()->addSeconds(60),
            'created_at' => now(), 'updated_at' => now(),
        ]);
        return $id;
    }

    private function verify(string $id, string $code): \Illuminate\Testing\TestResponse
    {
        return $this->postJson('/api/mobility/college-auth/verify', [
            'challenge_id' => $id, 'code' => $code,
            'name' => 'Secure Student', 'srn' => 'PES1UG24CS777', 'campus_code' => 'CAMPUS-BLR',
        ]);
    }

    public function test_exact_domain_normalization_and_confusables(): void
    {
        $auth = app(CollegeEmailAuth::class);
        $this->assertSame('student@stu.pes.edu', $auth->normalizeEmail(' Student@STU.PES.EDU '));
        $this->assertSame('pes1ug24am920@stu.pes.edu', $auth->normalizeEmail('PES1UG24AM920'));
        $this->assertSame('pes1ug24am920@stu.pes.edu', $auth->normalizeEmail('PES1UG24AM920@STU.PES.EDU'));
        $this->assertNull($auth->normalizeEmail('PES1UG24AM920@attacker.edu'));
        foreach (['student@gmail.com', 'student@evil-stu.pes.edu', 'student@stu.pes.edu.evil.com',
            'student+alias@stu.pes.edu', 'student＠stu.pes.edu', "student\n@stu.pes.edu"] as $invalid) {
            $this->assertNull($auth->normalizeEmail($invalid));
        }
    }

    public function test_code_supports_leading_zeroes_and_is_single_use(): void
    {
        $id = $this->studentChallenge('leading.zero@stu.pes.edu');
        $this->verify($id, '000123')->assertOk()->assertJsonPath('verified_college_email', true);
        $this->verify($id, '000123')->assertStatus(422)->assertJsonPath('error.code', 'COLLEGE_OTP_EXPIRED');
        $this->assertSame(1, DB::table('mobility_verified_identities')->where('email', 'leading.zero@stu.pes.edu')->count());
    }

    public function test_one_minute_test_expiry_rejects_exact_boundary_without_real_wait(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-11-10 12:00:00'));
        $id = $this->studentChallenge('expiry.boundary@stu.pes.edu', '000123', 60);
        Carbon::setTestNow(Carbon::parse('2026-11-10 12:01:00'));
        $this->verify($id, '000123')->assertStatus(422)->assertJsonPath('error.code', 'COLLEGE_OTP_EXPIRED');
        $this->assertDatabaseMissing('users', ['email' => 'expiry.boundary@stu.pes.edu']);
    }

    public function test_five_wrong_attempts_lock_a_challenge(): void
    {
        $id = $this->studentChallenge('attempts@stu.pes.edu');
        for ($i = 0; $i < 5; $i++) {
            $this->verify($id, '111111')->assertStatus(422)->assertJsonPath('error.code', 'COLLEGE_OTP_INVALID');
        }
        $this->verify($id, '000123')->assertStatus(422)->assertJsonPath('error.code', 'COLLEGE_OTP_ATTEMPTS_EXCEEDED');
        $this->assertSame(5, (int) DB::table('mobility_college_email_challenges')->where('challenge_id', $id)->value('attempts'));
    }

    public function test_resend_invalidates_old_code_and_keeps_300_second_default(): void
    {
        $email = 'resend@stu.pes.edu';
        $old = $this->studentChallenge($email);
        DB::table('mobility_college_email_challenges')->where('challenge_id', $old)
            ->update(['resend_after' => now()->subSecond()]);
        config([
            'mail.default' => 'smtp',
            'mail.mailers.smtp.host' => 'smtp.test.invalid',
            'mail.mailers.smtp.username' => 'fake-user',
            'mail.mailers.smtp.password' => 'fake-pass',
        ]);
        Mail::shouldReceive('raw')->once()->withArgs(function (string $body, callable $callback) use ($email): bool {
            $this->assertStringContainsString('five minutes', $body);
            $message = \Mockery::mock(Message::class);
            $message->shouldReceive('to')->once()->with($email)->andReturnSelf();
            $message->shouldReceive('subject')->once()->andReturnSelf();
            $callback($message);
            return true;
        });
        $result = $this->postJson('/api/mobility/college-auth/request', ['email' => $email])
            ->assertCreated()->assertJsonPath('expires_in', 300)->assertJsonPath('resend_after', 60);
        $this->assertNotSame($old, $result->json('challenge_id'));
        $this->assertNotNull(DB::table('mobility_college_email_challenges')->where('challenge_id', $old)->value('invalidated_at'));
        $this->verify($old, '000123')->assertStatus(422)->assertJsonPath('error.code', 'COLLEGE_OTP_EXPIRED');
    }

    public function test_resend_http_api_accepts_only_explicitly_configured_sender(): void
    {
        putenv('MOBILITY_EMAIL_TRANSPORT=resend_api');
        $this->assertFalse(app(CollegeEmailAuth::class)->deliveryAvailable());
        putenv('MOBILITY_RESEND_API_KEY=re_synthetic_test_key_1234567890');
        putenv('MOBILITY_RESEND_FROM=otp@campuspool.invalid');
        $this->assertFalse(app(CollegeEmailAuth::class)->deliveryAvailable());
        putenv('MOBILITY_RESEND_FROM=otp@stu.pes.edu');
        $this->assertFalse(app(CollegeEmailAuth::class)->deliveryAvailable());
        putenv('MOBILITY_RESEND_FROM=otp@campuspool.example');
        $this->assertTrue(app(CollegeEmailAuth::class)->deliveryAvailable());
        $this->assertSame('external_api_configured_unverified', app(CollegeEmailAuth::class)->deliveryScope());

        Http::fake(['https://api.resend.com/emails' => Http::response(['id' => 'synthetic-accepted-id'], 200)]);
        $response = $this->postJson('/api/mobility/college-auth/request', [
            'email' => 'synthetic.httpapi@stu.pes.edu',
        ])->assertCreated()->assertJsonPath('expires_in', 300);
        $this->assertNotEmpty($response->json('challenge_id'));
        Http::assertSent(function ($request): bool {
            return $request->url() === 'https://api.resend.com/emails'
                && $request['from'] === 'otp@campuspool.example'
                && $request['to'] === ['synthetic.httpapi@stu.pes.edu']
                && str_contains((string) $request['text'], 'five minutes');
        });
    }

    public function test_resend_api_failure_invalidates_undelivered_code(): void
    {
        putenv('MOBILITY_EMAIL_TRANSPORT=resend_api');
        putenv('MOBILITY_RESEND_API_KEY=re_synthetic_test_key_1234567890');
        putenv('MOBILITY_RESEND_FROM=otp@campuspool.example');
        Http::fake(['https://api.resend.com/emails' => Http::response(['message' => 'synthetic rejected sender'], 403)]);
        $this->postJson('/api/mobility/college-auth/request', [
            'email' => 'synthetic.rejected@stu.pes.edu',
        ])->assertStatus(503)->assertJsonPath('error.code', 'COLLEGE_MAIL_UNAVAILABLE');
        $row = DB::table('mobility_college_email_challenges')
            ->where('email', 'synthetic.rejected@stu.pes.edu')->first();
        $this->assertNotNull($row);
        $this->assertNotNull($row->invalidated_at);
    }

    public function test_failed_mail_send_invalidates_its_challenge(): void
    {
        config([
            'mail.default' => 'smtp',
            'mail.mailers.smtp.host' => 'smtp.test.invalid',
            'mail.mailers.smtp.username' => 'fake-user',
            'mail.mailers.smtp.password' => 'fake-pass',
        ]);
        Mail::shouldReceive('raw')->once()->andThrow(new \RuntimeException('synthetic smtp failure'));
        $this->postJson('/api/mobility/college-auth/request', ['email' => 'smtp.failure@stu.pes.edu'])
            ->assertStatus(503)->assertJsonPath('error.code', 'COLLEGE_MAIL_UNAVAILABLE');
        $row = DB::table('mobility_college_email_challenges')->where('email', 'smtp.failure@stu.pes.edu')->first();
        $this->assertNotNull($row);
        $this->assertNotNull($row->invalidated_at);
    }

    public function test_public_mode_rejects_demo_endpoints_and_unverified_jwt(): void
    {
        putenv('MOBILITY_PUBLIC_STUDENT_ONLY=true');
        $this->getJson('/api/mobility/college-auth/config')->assertOk()->assertJsonPath('student_only', true);
        $this->getJson('/api/mobility/local-auth/config')->assertNotFound();
        $this->postJson('/api/mobility/commute/demo-session', ['role' => 'rider'])->assertNotFound();

        $user = User::factory()->create(['email' => 'unverified@stu.pes.edu']);
        $token = auth('api')->fromUser($user);
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/mobility/commute/me')
            ->assertForbidden()->assertJsonPath('error.code', 'STUDENT_EMAIL_VERIFICATION_REQUIRED');

        DB::table('mobility_verified_identities')->insert([
            'user_id' => $user->id, 'provider' => 'college_email_otp',
            'email' => 'unverified@stu.pes.edu', 'domain' => 'stu.pes.edu',
            'verified_at' => now(), 'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/mobility/commute/me')->assertOk();
    }
}
