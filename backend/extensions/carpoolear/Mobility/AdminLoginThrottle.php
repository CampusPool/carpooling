<?php

namespace STS\Mobility;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

/** Shared-cache throttle for the host application's credential login route. */
final class AdminLoginThrottle
{
    private const MAX_ATTEMPTS = 5;
    private const DECAY_SECONDS = 900;

    public function handle(Request $request, Closure $next): mixed
    {
        if (strtolower($request->method()) !== 'post' || trim($request->path(), '/') !== 'api/login') return $next($request);
        $key = 'mobility-login-ip:'.($request->ip() ?: 'unknown');
        if (RateLimiter::tooManyAttempts($key, self::MAX_ATTEMPTS)) {
            return response()->json(['error' => ['code' => 'LOGIN_RATE_LIMITED']], 429)->header('Retry-After', (string) RateLimiter::availableIn($key))->header('Cache-Control', 'no-store');
        }
        RateLimiter::hit($key, self::DECAY_SECONDS);
        return $next($request);
    }
}
