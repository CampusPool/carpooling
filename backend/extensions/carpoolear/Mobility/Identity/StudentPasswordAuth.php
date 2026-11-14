<?php

namespace STS\Mobility\Identity;

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use STS\Mobility\Trust\CohortPolicy;
use STS\Models\User;

/** Username credentials belong to an already OTP-verified student account. */
final class StudentPasswordAuth
{
    private const DUMMY_HASH = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';

    public function applyVerified(User $user, array $input): void
    {
        $action = $input['password_action'] ?? null;
        if ($action === null || $action === '') return;
        if (!in_array($action, ['register', 'reset'], true)) throw new CollegeEmailAuthException('PASSWORD_ACTION_INVALID', 422);
        $password = $input['password'] ?? null;
        if (!is_string($password) || strlen($password) < 10 || strlen($password) > 72) {
            throw new CollegeEmailAuthException('STUDENT_PASSWORD_INVALID', 422);
        }
        $current = DB::table('mobility_student_password_accounts')->where('user_id', $user->id)->lockForUpdate()->first();
        if ($action === 'register') {
            $username = self::username($input['username'] ?? null);
            if ($username === null) throw new CollegeEmailAuthException('STUDENT_USERNAME_INVALID', 422);
            if ($current) throw new CollegeEmailAuthException('STUDENT_PASSWORD_EXISTS', 409);
            try {
                DB::table('mobility_student_password_accounts')->insert([
                    'user_id' => $user->id, 'username' => $username,
                    'password_hash' => Hash::make($password), 'credential_version' => 1,
                    'created_at' => now(), 'updated_at' => now(),
                ]);
            } catch (QueryException $e) {
                if (($e->errorInfo[0] ?? null) === '23000') throw new CollegeEmailAuthException('USERNAME_TAKEN', 409);
                throw $e;
            }
        } else {
            if (!$current) throw new CollegeEmailAuthException('STUDENT_PASSWORD_RESET_UNAVAILABLE', 422);
            DB::table('mobility_student_password_accounts')->where('user_id', $user->id)->update([
                'password_hash' => Hash::make($password),
                'credential_version' => (int) $current->credential_version + 1,
                'updated_at' => now(),
            ]);
        }
        // OTP authorization changes the credential generation. Old browser
        // sessions and all earlier JWT generations must no longer authenticate.
        DB::table('mobility_student_browser_sessions')->where('user_id', $user->id)->delete();
    }

    public function login(mixed $name, mixed $password, ?string $ip): array
    {
        $username = self::username($name);
        app(CollegeEmailAuth::class)->consumeRate([
            ['password-login-user:'.($username ?? 'invalid'), 8],
            ['password-login-ip:'.($ip ?: 'unknown'), 30],
        ], 60);
        $row = $username === null ? null : DB::table('mobility_student_password_accounts')->where('username', $username)->first();
        $candidate = is_string($password) && strlen($password) <= 72 ? $password : '';
        $valid = Hash::check($candidate, (string) ($row->password_hash ?? self::DUMMY_HASH));
        $user = $row ? User::find($row->user_id) : null;
        if (!$valid || !$user || !CohortPolicy::activeUser($user) || !CohortPolicy::approved((int) $user->id)
            || !DB::table('mobility_verified_identities')->where('user_id', $user->id)
                ->where('provider', 'college_email_otp')->where('email', $user->email)->exists()) {
            throw new CollegeEmailAuthException('INVALID_CREDENTIALS', 401);
        }
        $browser = StudentIdentityBoundary::publicMode() ? ['browser_session' => app(StudentBrowserSession::class)->issue($user)] : [];
        return $browser + [
            'token' => auth('api')->claims($this->tokenClaims($user))->fromUser($user),
            'user' => ['id' => (int) $user->id, 'name' => (string) $user->name, 'email' => (string) $user->email],
            'verified_college_email' => true,
        ];
    }

    public function tokenClaims(User $user): array
    {
        $version = DB::table('mobility_student_password_accounts')->where('user_id', $user->id)->value('credential_version');
        return $version === null ? [] : ['campuspool_credential_version' => (int) $version];
    }

    private static function username(mixed $value): ?string
    {
        if (!is_string($value)) return null;
        $value = strtolower(trim($value));
        return preg_match('/^[a-z][a-z0-9_.-]{2,31}$/D', $value) ? $value : null;
    }
}
