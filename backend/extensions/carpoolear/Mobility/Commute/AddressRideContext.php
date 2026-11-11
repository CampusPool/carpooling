<?php

namespace STS\Mobility\Commute;

use Illuminate\Support\Facades\DB;
use STS\Mobility\Pickup\PickupPolicy;
use STS\Mobility\Pickup\PickupException;
use STS\Mobility\Segments\SegmentException;
use STS\Mobility\Trust\CohortPolicy;
use STS\Mobility\Trust\DriverOnboardingPolicy;
use STS\Models\Car;
use STS\Models\User;

/** Scoped server authority for the authenticated student address endpoints. */
final class AddressRideContext
{
    private static int $depth = 0;

    public static function active(): bool
    {
        return self::$depth > 0;
    }

    public static function eligible(User $user): bool
    {
        return CohortPolicy::activeUser($user) && CohortPolicy::approved((int) $user->id)
            && DB::table('mobility_verified_identities')->where('user_id', $user->id)
                ->where('provider', 'college_email_otp')->where('email', $user->email)->exists();
    }

    public static function allows(User $user): bool
    {
        return self::active() && self::eligible($user);
    }

    public static function run(User $actor, callable $operation): mixed
    {
        if (!self::eligible($actor)) throw new SegmentException('STUDENT_EMAIL_VERIFICATION_REQUIRED', 403);
        self::$depth++;
        try {
            return $operation();
        } finally {
            self::$depth--;
        }
    }

    public static function approvedVehicle(User $driver, int $carId, string $mode, int $seats = 1): Car
    {
        if (!self::eligible($driver)) throw new SegmentException('HOST_APPROVAL_REQUIRED', 403);
        $car = Car::where('user_id', $driver->id)->find($carId);
        if (!$car) throw new SegmentException('HOST_APPROVAL_REQUIRED', 403);
        $demo = DemoVehicle::details($car);
        if ($demo) {
            if ($demo['vehicle_type'] !== $mode) throw new SegmentException('HOST_APPROVAL_REQUIRED', 403);
            if ($seats > $demo['passenger_seats']) throw new SegmentException('VEHICLE_SEAT_LIMIT', 422);
            return $car;
        }
        if ($seats !== 1) throw new SegmentException('VEHICLE_SEAT_LIMIT', 422);
        $car = PickupPolicy::host($driver, $carId, $mode);
        $application = DB::table('mobility_host_applications')->where('user_id', $driver->id)
            ->where('car_id', $carId)->where('status', 'approved')->first();
        $capacity = $application ? DriverOnboardingPolicy::approvedPassengerCapacity((int) $application->id) : null;
        if ($capacity === null || $capacity < 1) throw new SegmentException('HOST_APPROVAL_REQUIRED', 403);
        return $car;
    }

    public static function vehicles(User $driver): array
    {
        $approvedTypes = DB::table('mobility_host_applications')->where('user_id', $driver->id)
            ->where('status', 'approved')->pluck('vehicle_type', 'car_id');
        $vehicles = [];
        foreach (Car::where('user_id', $driver->id)->with(['brand', 'carModel'])->orderBy('id')->get() as $car) {
            $demo = DemoVehicle::details($car);
            if ($demo) {
                $vehicles[] = $demo;
                continue;
            }
            $mode = $approvedTypes[$car->id] ?? null;
            if (!$mode) continue;
            try {
                self::approvedVehicle($driver, (int) $car->id, $mode);
            } catch (PickupException|SegmentException) {
                continue;
            }
            $vehicles[] = [
                'id' => (int) $car->id, 'registration' => $car->patente,
                'name' => trim($car->brand_name.' '.$car->model_name),
                'vehicle_type' => $mode, 'passenger_seats' => 1, 'demo_verified' => false,
            ];
        }

        return $vehicles;
    }

    public static function publication(int $tripId): bool
    {
        return DB::table('mobility_commute_demo_trips')->where('trip_id', $tripId)
            ->where('journey->student_address', true)->exists();
    }
}
