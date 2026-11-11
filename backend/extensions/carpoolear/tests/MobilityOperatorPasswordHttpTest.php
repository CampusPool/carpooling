<?php
namespace Tests\Feature\Mobility;
use Illuminate\Support\Facades\RateLimiter;
use STS\Models\User;
use Tests\TestCase;

final class MobilityOperatorPasswordHttpTest extends TestCase
{
    private array $originalEnvironment = [];
    protected function setUp(): void
    {
        parent::setUp();
        foreach (['MOBILITY_OPERATOR_PASSWORD_HASH', 'MOBILITY_OPERATOR_USER_ID', 'MOBILITY_PUBLIC_STUDENT_ONLY', 'MOBILITY_COLLEGE_CODE'] as $key) {
            $this->originalEnvironment[$key] = getenv($key);
        }
        putenv('MOBILITY_PUBLIC_STUDENT_ONLY=true');
        putenv('MOBILITY_COLLEGE_CODE=CAMPUS-BLR');
        RateLimiter::clear('mobility-operator-password:'.hash('sha256', '127.0.0.1'));
    }
    protected function tearDown(): void
    {
        foreach ($this->originalEnvironment as $key => $original) {
            putenv($original === false ? $key : $key.'='.$original);
        }
        parent::tearDown();
    }
    public function test_password_only_admin_session_supports_operator_reports_without_student_login(): void
    {
        $admin = User::factory()->create(['is_admin' => true, 'active' => true, 'banned' => false]);
        putenv('MOBILITY_OPERATOR_USER_ID='.$admin->id);
        putenv('MOBILITY_OPERATOR_PASSWORD_HASH='.password_hash('synthetic-operator-password-2026', PASSWORD_BCRYPT));
        $this->postJson('/api/login', [])->assertNotFound();
        $this->postJson('/api/mobility/operator/login', ['password' => 'incorrect-synthetic-password'])
            ->assertUnauthorized()->assertJsonPath('error.code', 'OPERATOR_INVALID_PASSWORD');
        $response = $this->postJson('/api/mobility/operator/login', ['password' => 'synthetic-operator-password-2026'])
            ->assertOk();
        $jwt = $response->json('token');
        $this->assertIsString($jwt);
        $header = ['Authorization' => 'Bearer '.$jwt, 'Accept' => 'application/json'];
        $this->withHeaders($header)->getJson('/api/mobility/operator/dashboard')
            ->assertOk()->assertJsonPath('audience', 'operator');
        $this->withHeaders($header)->getJson('/api/mobility/operator/dbms/health')
            ->assertOk()->assertJsonPath('scope', 'configured_college');
        $this->withHeaders($header)->postJson('/api/mobility/operator/logout')->assertOk();
        $this->withHeaders($header)->getJson('/api/mobility/operator/dashboard')->assertUnauthorized();
    }
    public function test_unconfigured_or_unprivileged_account_is_rejected(): void
    {
        putenv('MOBILITY_OPERATOR_PASSWORD_HASH');
        putenv('MOBILITY_OPERATOR_USER_ID');
        $this->postJson('/api/mobility/operator/login', ['password' => 'synthetic-operator-password-2026'])
            ->assertStatus(503)->assertJsonPath('error.code', 'OPERATOR_LOGIN_UNAVAILABLE');
        $ordinary = User::factory()->create(['is_admin' => false, 'active' => true, 'banned' => false]);
        putenv('MOBILITY_OPERATOR_USER_ID='.$ordinary->id);
        putenv('MOBILITY_OPERATOR_PASSWORD_HASH='.password_hash('synthetic-operator-password-2026', PASSWORD_BCRYPT));
        $this->postJson('/api/mobility/operator/login', ['password' => 'synthetic-operator-password-2026'])
            ->assertStatus(503)->assertJsonPath('error.code', 'OPERATOR_LOGIN_UNAVAILABLE');
    }
}
