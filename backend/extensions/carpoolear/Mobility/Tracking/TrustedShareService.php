<?php

namespace STS\Mobility\Tracking;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Crypt;
use STS\Mobility\Trust\CohortPolicy;
use STS\Models\Passenger;
use STS\Models\Trip;
use STS\Models\User;

/** Short-lived, participant-created bearer grants for a minimum ride status view. */
final class TrustedShareService
{
    public const MAX_TTL_MINUTES = 240;
    public const DEFAULT_TTL_MINUTES = 120;
    public const TOKEN_BYTES = 32;

    public function create(int $tripId, User $actor, string $scope, int $ttlMinutes, string $idempotencyKey): array
    {
        if ($scope !== 'status') throw new TrustedShareException('TRUSTED_SHARE_SCOPE_INVALID');
        if ($ttlMinutes < 5 || $ttlMinutes > self::MAX_TTL_MINUTES) throw new TrustedShareException('TRUSTED_SHARE_EXPIRY_INVALID');
        if (! preg_match('/^[\x21-\x7E]{1,100}$/D', $idempotencyKey)) throw new TrustedShareException('INVALID_IDEMPOTENCY_KEY');

        return DB::transaction(function () use ($tripId, $actor, $scope, $ttlMinutes, $idempotencyKey): array {
            $trip = Trip::query()->whereKey($tripId)->lockForUpdate()->first();
            if (! $trip) throw new TrustedShareException('TRIP_NOT_FOUND', 404);
            $this->assertParticipant($trip, $actor);
            $this->assertOpen($trip);
            $keyHash = hash('sha256', $idempotencyKey);
            $fingerprint = hash('sha256', json_encode(['scope' => $scope, 'expires_in_minutes' => $ttlMinutes], JSON_THROW_ON_ERROR));
            $existing = DB::table('mobility_trusted_share_grants')->where(['trip_id' => $tripId, 'created_by' => $actor->id, 'idempotency_key_hash' => $keyHash])->lockForUpdate()->first();
            if ($existing) {
                if ($existing->revoked_at) throw new TrustedShareException('TRUSTED_SHARE_REVOKED', 409);
                if (CarbonImmutable::parse($existing->expires_at, 'UTC')->lte(CarbonImmutable::now('UTC'))) throw new TrustedShareException('TRUSTED_SHARE_EXPIRED', 409);
                if (! hash_equals((string) $existing->request_fingerprint, $fingerprint)) throw new TrustedShareException('IDEMPOTENCY_CONFLICT', 409);
                try { $token = Crypt::decryptString((string) $existing->token_ciphertext); } catch (\Throwable) { throw new TrustedShareException('TRUSTED_SHARE_RECOVERY_UNAVAILABLE', 503); }
                return ['grant_id' => (int) $existing->id, 'scope' => (string) $existing->scope, 'token' => $token, 'expires_at' => CarbonImmutable::parse($existing->expires_at, 'UTC')->toISOString()];
            }
            // A new explicit create action rotates the creator's previous link.
            DB::table('mobility_trusted_share_grants')->where(['trip_id' => $tripId, 'created_by' => $actor->id])->whereNull('revoked_at')->update(['revoked_at' => now(), 'updated_at' => now()]);
            $token = bin2hex(random_bytes(self::TOKEN_BYTES));
            $expires = CarbonImmutable::now('UTC')->addMinutes($ttlMinutes);
            $id = DB::table('mobility_trusted_share_grants')->insertGetId([
                'trip_id' => $tripId, 'created_by' => $actor->id, 'scope' => $scope, 'idempotency_key_hash' => $keyHash,
                'token_hash' => hash('sha256', $token), 'token_ciphertext' => Crypt::encryptString($token), 'request_fingerprint' => $fingerprint, 'expires_at' => $expires,
                'created_at' => now(), 'updated_at' => now(),
            ]);
            return ['grant_id' => (int) $id, 'scope' => $scope, 'token' => $token, 'expires_at' => $expires->toISOString()];
        });
    }

    public function revoke(int $tripId, int $grantId, User $actor): array
    {
        return DB::transaction(function () use ($tripId, $grantId, $actor): array {
            $trip = Trip::query()->whereKey($tripId)->lockForUpdate()->first();
            if (! $trip) throw new TrustedShareException('TRIP_NOT_FOUND', 404);
            $grant = DB::table('mobility_trusted_share_grants')->where(['id' => $grantId, 'trip_id' => $tripId])->lockForUpdate()->first();
            if (! $grant) throw new TrustedShareException('TRUSTED_SHARE_NOT_FOUND', 404);
            if ((int) $grant->created_by !== (int) $actor->id) throw new TrustedShareException('TRUSTED_SHARE_FORBIDDEN', 403);
            if (! $grant->revoked_at) DB::table('mobility_trusted_share_grants')->where('id', $grantId)->update(['revoked_at' => now(), 'updated_at' => now()]);
            return ['grant_id' => $grantId, 'revoked' => true];
        });
    }

    public function read(string $token): array
    {
        if (! preg_match('/^[a-f0-9]{64}$/D', $token)) throw new TrustedShareException('TRUSTED_SHARE_NOT_FOUND', 404);
        $grant = DB::table('mobility_trusted_share_grants')->where('token_hash', hash('sha256', $token))->first();
        if (! $grant || $grant->revoked_at || CarbonImmutable::parse($grant->expires_at, 'UTC')->lte(CarbonImmutable::now('UTC'))) throw new TrustedShareException('TRUSTED_SHARE_NOT_FOUND', 404);
        $trip = Trip::query()->find((int) $grant->trip_id);
        if (! $trip) throw new TrustedShareException('TRUSTED_SHARE_NOT_FOUND', 404);
        $lifecycle = DB::table('mobility_trip_lifecycles')->where('trip_id', $trip->id)->value('state') ?: 'planned';
        if ($trip->state === Trip::STATE_CANCELED || in_array($lifecycle, ['completed', 'cancelled'], true)) throw new TrustedShareException('TRUSTED_SHARE_NOT_FOUND', 404);
        $body = ['status' => $lifecycle, 'departure_at' => CarbonImmutable::parse($trip->trip_date, 'Asia/Kolkata')->toISOString(), 'expires_at' => CarbonImmutable::parse($grant->expires_at, 'UTC')->toISOString()];
        return $body;
    }

    private function assertParticipant(Trip $trip, User $actor): void
    {
        if (! CohortPolicy::required() || ! CohortPolicy::approved((int) $actor->id)) throw new TrustedShareException('TRUSTED_SHARE_FORBIDDEN', 403);
        $participant = (int) $trip->user_id === (int) $actor->id || Passenger::query()->where(['trip_id' => $trip->id, 'user_id' => $actor->id, 'passenger_type' => Passenger::TYPE_PASAJERO, 'request_state' => Passenger::STATE_ACCEPTED])->exists();
        if (! $participant) throw new TrustedShareException('TRUSTED_SHARE_FORBIDDEN', 403);
    }

    private function assertOpen(Trip $trip): void
    {
        $state = DB::table('mobility_trip_lifecycles')->where('trip_id', $trip->id)->value('state');
        if ($trip->state === Trip::STATE_CANCELED || in_array($state, ['completed', 'cancelled'], true)) throw new TrustedShareException('TRUSTED_SHARE_CLOSED', 409);
    }
}
