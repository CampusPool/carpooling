<?php

namespace STS\Mobility\Identity;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class LocalAccountAuthController
{
    public function __construct(private LocalAccountAuth $auth) {}

    public function config(): JsonResponse
    {
        return $this->json(['enabled' => $this->auth->enabled()]);
    }

    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'username' => ['required', 'string', 'min:3', 'max:32', 'regex:/^[A-Za-z0-9_]+$/D'],
            'password' => ['required', 'string', 'min:8', 'max:72'],
            'role' => ['required', 'in:rider,driver'],
            'gender' => ['sometimes', 'nullable', 'string', 'in:male,female,other,man,woman,non_binary'],
        ]);
        if (strlen($data['password']) > 72) return $this->error('PASSWORD_TOO_LONG_BYTES', 422);
        try {
            return $this->json($this->auth->register($data['username'], $data['password'], $data['role'], $data['gender'] ?? null), 201);
        } catch (LocalAccountAuthException $e) {
            return $this->error($e->machineCode, $e->httpStatus);
        }
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'username' => ['required', 'string', 'min:3', 'max:32'],
            'password' => ['required', 'string', 'min:1', 'max:72'],
        ]);
        try {
            return $this->json($this->auth->login($data['username'], $data['password']));
        } catch (LocalAccountAuthException $e) {
            return $this->error($e->machineCode, $e->httpStatus);
        }
    }

    private function json(array $body, int $status = 200): JsonResponse
    {
        return response()->json($body, $status)->header('Cache-Control', 'no-store, max-age=0')->header('Pragma', 'no-cache');
    }

    private function error(string $code, int $status): JsonResponse
    {
        return $this->json(['error' => ['code' => $code]], $status);
    }
}
