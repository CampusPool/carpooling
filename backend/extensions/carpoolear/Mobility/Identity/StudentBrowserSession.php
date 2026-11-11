<?php

namespace STS\Mobility\Identity;

use Illuminate\Support\Facades\DB;
use STS\Models\User;

final class StudentBrowserSession
{
    public function issue(User $user, ?string $priorToken = null): string
    {
        $priorHash = $this->hash($priorToken);
        if ($priorHash !== null && DB::table('mobility_student_browser_sessions')->where('token_hash', $priorHash)
            ->where('user_id', $user->id)->where('expires_at', '>', now())->exists()) {
            DB::table('mobility_student_browser_sessions')->where('token_hash', $priorHash)->where('user_id', $user->id)
                ->update(['expires_at' => now()->addDays(30)]);
            return $priorToken;
        }
        $token = bin2hex(random_bytes(32));
        DB::table('mobility_student_browser_sessions')->where('expires_at', '<=', now())->delete();
        DB::table('mobility_student_browser_sessions')->insert([
            'token_hash' => hash('sha256', $token), 'user_id' => $user->id, 'expires_at' => now()->addDays(30),
        ]);
        return $token;
    }

    public function restore(?string $token): string
    {
        $hash = $this->hash($token);
        $session = $hash === null ? null : DB::table('mobility_student_browser_sessions')
            ->where('token_hash', $hash)->where('expires_at', '>', now())->first();
        $user = $session ? User::query()->find($session->user_id) : null;
        if (!$user || !$user->active || $user->banned || !DB::table('mobility_verified_identities')
            ->where('user_id', $user->id)->where('provider', 'college_email_otp')->where('email', $user->email)->exists()) {
            throw new CollegeEmailAuthException('STUDENT_SESSION_EXPIRED', 401);
        }
        return auth('api')->fromUser($user);
    }

    public function revoke(?string $token): void
    {
        $hash = $this->hash($token);
        if ($hash !== null) DB::table('mobility_student_browser_sessions')->where('token_hash', $hash)->delete();
    }

    private function hash(?string $token): ?string
    {
        return $token !== null && preg_match('/^[a-f0-9]{64}$/D', $token) ? hash('sha256', $token) : null;
    }
}
