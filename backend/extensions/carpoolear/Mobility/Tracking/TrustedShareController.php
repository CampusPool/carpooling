<?php

namespace STS\Mobility\Tracking;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class TrustedShareController
{
    public function create(Request $request, int $trip, TrustedShareService $service): JsonResponse
    {
        try {
            $body = $request->validate(['scope' => 'required|in:status', 'expires_in_minutes' => 'nullable|integer|min:5|max:240']);
            return $this->private(response()->json(['data' => $service->create($trip, $request->user(), $body['scope'], (int) ($body['expires_in_minutes'] ?? TrustedShareService::DEFAULT_TTL_MINUTES), (string) $request->header('Idempotency-Key', ''))], 201));
        } catch (TrustedShareException $e) { return $this->error($e); }
    }

    public function revoke(Request $request, int $trip, int $grant, TrustedShareService $service): JsonResponse
    { try { return $this->private(response()->json(['data' => $service->revoke($trip, $grant, $request->user())])); } catch (TrustedShareException $e) { return $this->error($e); } }

    public function read(Request $request, string $token, TrustedShareService $service): JsonResponse
    { try { return $this->publicResponse(response()->json(['data' => $service->read($token)])); } catch (TrustedShareException $e) { return $this->publicResponse(response()->json(['error' => ['code' => 'TRUSTED_SHARE_NOT_FOUND']], 404)); } }

    private function private(JsonResponse $response): JsonResponse { return $response->setPrivate()->header('Cache-Control', 'private, no-store, max-age=0')->header('X-Content-Type-Options', 'nosniff'); }
    private function publicResponse(JsonResponse $response): JsonResponse { return $response->setPublic()->header('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate')->header('Pragma', 'no-cache')->header('X-Content-Type-Options', 'nosniff')->header('X-Robots-Tag', 'noindex, nofollow')->header('Referrer-Policy', 'no-referrer'); }
    private function error(TrustedShareException $e): JsonResponse { return $this->private(response()->json(['error' => ['code' => $e->errorCode]], $e->httpStatus)); }
}
