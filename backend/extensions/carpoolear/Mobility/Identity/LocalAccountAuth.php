<?php

namespace STS\Mobility\Identity;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Database\QueryException;
use STS\Models\Car;
use STS\Models\User;
use STS\Mobility\Commute\CommuteService;
use STS\Mobility\Trust\CohortPolicy;
use STS\Mobility\Trust\DriverOnboardingPolicy;

final class LocalAccountAuth
{
    public function enabled(): bool
    {
        return CommuteService::demoEnabled() && ! StudentIdentityBoundary::publicMode();
    }

    public function register(string $username, string $password, string $role): array
    {
        $this->assertEnabled();
        $username = Str::lower(trim($username));

        try {
            return DB::transaction(function () use ($username, $password, $role): array {
                if (DB::table('mobility_local_accounts')->where('username', $username)->exists()) {
                    throw new LocalAccountAuthException('USERNAME_TAKEN', 409);
                }

                $user = User::query()->create([
                    'name' => $username,
                    'email' => $username.'@local.mobility.invalid',
                    'password' => Hash::make($password),
                    'active' => true,
                    'banned' => false,
                ]);
                DB::table('mobility_local_accounts')->insert([
                    'user_id' => $user->id,
                    'username' => $username,
                    'role' => $role,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                DB::table('mobility_memberships')->insertOrIgnore([
                    'user_id' => $user->id,
                    'college_code' => CohortPolicy::college(),
                    'affiliation' => 'student',
                    'status' => 'approved',
                    'version' => 1,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                if ($role === 'driver') {
                    $this->provisionSyntheticDriver($user);
                }

                return $this->session($user, $role);
            });
        } catch (QueryException $error) {
            // A concurrent registration may win after the existence check. The
            // transaction rollback keeps the losing user and role rows atomic.
            if (DB::table('mobility_local_accounts')->where('username', $username)->exists()) {
                throw new LocalAccountAuthException('USERNAME_TAKEN', 409, $error);
            }
            throw $error;
        }
    }

    public function login(string $username, string $password): array
    {
        $this->assertEnabled();
        $account = DB::table('mobility_local_accounts')->where('username', Str::lower(trim($username)))->first();
        $user = $account ? User::query()->find($account->user_id) : null;
        if (! $user || ! Hash::check($password, (string) $user->password) || ! $user->active || $user->banned) {
            throw new LocalAccountAuthException('INVALID_CREDENTIALS', 401);
        }

        return $this->session($user, $account->role);
    }

    private function session(User $user, string $role): array
    {
        return [
            'token' => auth('api')->fromUser($user),
            'role' => $role,
            'user' => ['id' => $user->id, 'name' => $user->name],
        ];
    }

    /** Only a local pilot account gets a conspicuously synthetic approved vehicle fixture. */
    private function provisionSyntheticDriver(User $user): void
    {
        $colorId = DB::table('car_colors')->orderBy('id')->value('id');
        if (! $colorId) {
            $now = now();
            $colorId = DB::table('car_colors')->insertGetId([
                'name' => 'Synthetic local demo color',
                'slug' => 'local-demo-'.$user->id,
                'hex' => '#64748b',
                'is_active' => true,
                'sort_order' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
        $carId = DB::table('cars')->insertGetId([
            'patente' => 'DEMO'.$user->id,
            'description' => 'Synthetic local demo vehicle',
            'user_id' => $user->id,
            'brand_other' => 'Local demo',
            'model_other' => 'Synthetic vehicle',
            'car_color_id' => $colorId,
            'year' => (int) now()->format('Y'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $car = Car::query()->findOrFail($carId);
        $now = now();
        $applicationId = DB::table('mobility_host_applications')->insertGetId([
            'user_id' => $user->id,
            'car_id' => $car->id,
            'vehicle_type' => 'car',
            'vehicle_fingerprint' => CohortPolicy::vehicleFingerprint($car),
            'status' => 'approved',
            'version' => 1,
            'reviewed_by' => $user->id,
            'reviewed_at' => $now,
            'review_reason' => 'Synthetic local account fixture; not a real vehicle approval.',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        DB::table('mobility_host_application_audits')->insert([
            'application_id' => $applicationId,
            'actor_id' => $user->id,
            'previous_status' => null,
            'new_status' => 'approved',
            'version' => 1,
            'reason' => 'Synthetic local account fixture; not a real vehicle approval.',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $onboardingId = DB::table('mobility_driver_onboardings')->insertGetId([
            'user_id' => $user->id,
            'host_application_id' => $applicationId,
            'car_id' => $car->id,
            'vehicle_type' => 'car',
            'vehicle_fingerprint' => CohortPolicy::vehicleFingerprint($car),
            'profile_display_name' => 'Local demo driver',
            'status' => 'approved',
            'version' => 1,
            'reviewed_by' => $user->id,
            'submitted_at' => $now,
            'reviewed_at' => $now,
            'review_reason' => 'Synthetic local account fixture; no real identity documents.',
            'legal_passenger_capacity' => 1,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        DB::table('mobility_driver_onboarding_audits')->insert([
            'onboarding_id' => $onboardingId,
            'actor_id' => $user->id,
            'previous_status' => null,
            'new_status' => 'approved',
            'version' => 1,
            'reason' => 'Synthetic local account fixture; no real identity documents.',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        foreach (DriverOnboardingPolicy::requiredTypes() as $type) {
            DB::table('mobility_driver_documents')->insert([
                'onboarding_id' => $onboardingId,
                'document_type' => $type,
                'version' => 1,
                'storage_path' => 'local-demo/synthetic-fixture/'.$type.'.placeholder',
                'mime_type' => 'application/octet-stream',
                'byte_size' => 1,
                'expires_at' => DriverOnboardingPolicy::expiring($type) ? $now->copy()->addYear()->toDateString() : null,
                'status' => 'accepted',
                'review_reason' => 'Synthetic local fixture, not a real submitted document.',
                'submitted_by' => $user->id,
                'reviewed_by' => $user->id,
                'reviewed_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    private function assertEnabled(): void
    {
        if (! $this->enabled()) abort(404);
    }
}

final class LocalAccountAuthException extends \RuntimeException
{
    public function __construct(public readonly string $machineCode, public readonly int $httpStatus, ?\Throwable $previous = null)
    {
        parent::__construct($machineCode, 0, $previous);
    }
}
