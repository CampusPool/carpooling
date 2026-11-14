<?php

namespace STS\Mobility\Tracking;

use Closure;
use Illuminate\Http\Request;
use STS\Mobility\Identity\StudentIdentityBoundary;

/** Keep the historical tracking prototype unavailable in the student product. */
final class TrackingScope
{
    public function handle(Request $request, Closure $next)
    {
        if (StudentIdentityBoundary::publicMode()) {
            return response()->json(['error' => ['code' => 'TRACKING_OUT_OF_SCOPE']], 404)
                ->header('Cache-Control', 'no-store, max-age=0');
        }

        return $next($request);
    }
}
