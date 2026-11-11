<?php
namespace STS\Mobility;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use STS\Models\User;
use STS\Mobility\Trust\CohortPolicy;
use Tymon\JWTAuth\Facades\JWTAuth;

/** Preview password login: restricted to a single provisioned admin account. */
final class OperatorPasswordController
{
    public function login(Request $request): JsonResponse
    {
        $hash = (string) getenv('MOBILITY_OPERATOR_PASSWORD_HASH');
        $id = filter_var(getenv('MOBILITY_OPERATOR_USER_ID'), FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if (! $id || ! preg_match('/^\\$2[aby]\\$[0-9]{2}\\$[.\\/A-Za-z0-9]{53}$/D', $hash)
            || ! CohortPolicy::college()) return $this->error('OPERATOR_LOGIN_UNAVAILABLE', 503);
        $key = 'mobility-operator-password:'.hash('sha256', (string) ($request->ip() ?: 'unknown'));
        if (RateLimiter::tooManyAttempts($key, 12)) return $this->error('OPERATOR_LOGIN_RATE_LIMITED', 429)
            ->header('Retry-After', (string) RateLimiter::availableIn($key));
        $password = $request->input('password');
        if (! is_string($password) || strlen($password) < 16 || strlen($password) > 256
            || ! password_verify($password, $hash)) {
            RateLimiter::hit($key, 900);
            return $this->error('OPERATOR_INVALID_PASSWORD', 401);
        }
        $user = User::find((int) $id);
        if (! $user || ! $user->is_admin || ! $user->active || $user->banned) {
            return $this->error('OPERATOR_LOGIN_UNAVAILABLE', 503);
        }
        RateLimiter::clear($key);
        return response()->json(['token' => JWTAuth::fromUser($user)])
            ->header('Cache-Control', 'private, no-store');
    }
    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user || ! $user->is_admin || ! $user->active || $user->banned) return $this->error('OPERATOR_FORBIDDEN', 403);
        auth('api')->logout();
        return response()->json(['logged_out' => true])->header('Cache-Control', 'private, no-store');
    }
    private function error(string $code, int $status): JsonResponse
    {
        return response()->json(['error' => ['code' => $code]], $status)
            ->header('Cache-Control', 'private, no-store');
    }
}
