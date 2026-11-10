<?php

namespace STS\Mobility\Identity;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Fail-closed student-identity boundary for publicly exposed CampusPool APIs.
 * Keep the existing classroom demo private; never accept a synthetic demo
 * account as a publicly verified student.
 */
final class StudentIdentityBoundary
{
    public static function publicMode(): bool
    {
        return ! app()->environment(['local', 'testing'])
            || filter_var(getenv('MOBILITY_PUBLIC_STUDENT_ONLY'), FILTER_VALIDATE_BOOLEAN);
    }

    public function handle(Request $request, Closure $next)
    {
        if (! self::publicMode()) return $next($request);

        $path = $request->path();
        if ($path === 'api/mobility/commute/demo-session'
            || str_starts_with($path, 'api/mobility/local-auth/')
            || str_starts_with($path, 'api/mobility/pilot/')
            || in_array($path, ['api/login', 'api/register', 'api/auth/login', 'api/auth/register'], true)) {
            return response()->json(['error' => ['code' => 'PUBLIC_DEMO_AUTH_DISABLED']], 404)
                ->header('Cache-Control', 'no-store, max-age=0');
        }

        // OTP request/verification cannot require an authenticated user.
        if (in_array($path, ['api/mobility/college-auth/config', 'api/mobility/college-auth/request', 'api/mobility/college-auth/verify'], true)) {
            return $next($request);
        }

        // Resolve the JWT guard even if upstream "logged" middleware runs later.
        try { $user = $request->user('api') ?: auth('api')->user(); } catch (\Throwable) { $user = null; }
        if ($user !== null) {
            $email = (string) ($user->email ?? '');
            $normalized = app(CollegeEmailAuth::class)->normalizeEmail($email);
            $verified = $normalized !== null && $normalized === $email
                && DB::table('mobility_verified_identities')
                    ->where('user_id', $user->id)
                    ->where('provider', 'college_email_otp')
                    ->where('email', $normalized)
                    ->exists();
            if (! $verified) {
                return response()->json(['error' => ['code' => 'STUDENT_EMAIL_VERIFICATION_REQUIRED']], 403)
                    ->header('Cache-Control', 'private, no-store, max-age=0');
            }
        }

        return $next($request);
    }
}
