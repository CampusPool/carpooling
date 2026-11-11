<?php

namespace STS\Mobility\Commute;

use Illuminate\Support\Facades\DB;
use STS\Mobility\Segments\SegmentException;
use STS\Mobility\Trust\CohortPolicy;
use STS\Models\Car;
use STS\Models\User;

/** Simulated approvals used only by the student address ride endpoints. */
final class DemoVehicle
{
    public const DISCLAIMER = 'Demo verified — simulated vehicle lookup, not RTO verified.';

    private const CATALOGUE = [
        'KA00DE0001' => ['Honda', 'Activa 6G', 'Scooter', 1],
        'KA00DE0002' => ['TVS', 'Jupiter', 'Scooter', 1],
        'KA00DE0003' => ['Suzuki', 'Access 125', 'Scooter', 1],
        'KA00DE0004' => ['Hero', 'Splendor Plus', 'Bike', 1],
        'KA00DE0005' => ['Bajaj', 'Pulsar NS200', 'Bike', 1],
        'KA00DE0006' => ['Royal Enfield', 'Classic 350', 'Bike', 1],
        'KA00DE0007' => ['Maruti Suzuki', 'Swift', 'Car', 4],
        'KA00DE0008' => ['Hyundai', 'i20', 'Car', 4],
        'KA00DE0009' => ['Tata', 'Nexon', 'Car', 4],
        'KA00DE0010' => ['Honda', 'City', 'Car', 4],
    ];

    public static function enabled(): bool
    {
        return app()->environment('testing')
            && filter_var(getenv('MOBILITY_PUBLIC_STUDENT_ONLY'), FILTER_VALIDATE_BOOLEAN)
            && filter_var(getenv('MOBILITY_DEMO_VEHICLES_ENABLED'), FILTER_VALIDATE_BOOLEAN);
    }

    public static function lookup(string $registration): array
    {
        if (!self::enabled()) throw new SegmentException('DEMO_VEHICLES_DISABLED', 404);
        $registration = strtoupper(preg_replace('/[\s-]+/', '', trim($registration)));
        $sample = self::CATALOGUE[$registration] ?? null;
        if (!$sample) throw new SegmentException('DEMO_VEHICLE_NOT_FOUND', 404);
        [$brand, $model, $type, $capacity] = $sample;

        return [
            'registration' => $registration, 'name' => "$brand $model", 'type' => $type,
            'vehicle_type' => $type === 'Car' ? 'car' : 'bike', 'passenger_seats' => $capacity,
            'demo_verified' => true, 'description' => self::DISCLAIMER,
        ];
    }

    public static function save(User $user, string $registration): array
    {
        $details = self::lookup($registration);
        return DB::transaction(function () use ($user, $details): array {
            User::whereKey($user->id)->lockForUpdate()->firstOrFail();
            $registration = $details['registration'];
            $saved = DB::table('mobility_demo_vehicle_approvals')->where('user_id', $user->id)
                ->where('registration', $registration)->first();
            if ($saved) {
                $car = Car::where('user_id', $user->id)->find($saved->car_id);
                if (!$car || !self::details($car)) throw new SegmentException('DEMO_VEHICLE_CHANGED', 409);
                return $details + ['id' => (int) $car->id];
            }

            if (Car::where('user_id', $user->id)->where('patente', $registration)->exists()) {
                throw new SegmentException('VEHICLE_REGISTRATION_IN_USE', 409);
            }

            [$brand, $model] = self::CATALOGUE[$registration];
            $car = Car::create([
                'user_id' => $user->id, 'patente' => $registration,
                'brand_other' => $brand, 'model_other' => $model, 'description' => self::DISCLAIMER,
            ]);

            DB::table('mobility_demo_vehicle_approvals')->insert([
                'car_id' => $car->id, 'user_id' => $user->id, 'registration' => $registration,
                'vehicle_fingerprint' => CohortPolicy::vehicleFingerprint($car->fresh()),
                'created_at' => now(), 'updated_at' => now(),
            ]);
            return $details + ['id' => (int) $car->id];
        });
    }

    public static function details(Car $car): ?array
    {
        if (!self::enabled() || !isset(self::CATALOGUE[$car->patente])) return null;
        $approval = DB::table('mobility_demo_vehicle_approvals')->where('car_id', $car->id)
            ->where('user_id', $car->user_id)->where('registration', $car->patente)->first();
        if (!$approval || !hash_equals($approval->vehicle_fingerprint, CohortPolicy::vehicleFingerprint($car))) return null;

        return self::lookup($car->patente) + ['id' => (int) $car->id];
    }
}
