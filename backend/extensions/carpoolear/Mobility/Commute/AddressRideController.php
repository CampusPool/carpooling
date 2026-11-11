<?php

namespace STS\Mobility\Commute;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use STS\Mobility\MobilityController;
use STS\Mobility\Pickup\PathProvider;
use STS\Mobility\Pickup\PickupException;
use STS\Mobility\Routing\RoutingException;
use STS\Mobility\Segments\SegmentException;
use STS\Mobility\Trust\CohortPolicy;
use STS\Models\Passenger;
use STS\Models\Trip;

final class AddressRideController
{
    public function me(Request $request): JsonResponse
    {
        return $this->run($request, function () use ($request): JsonResponse {
            $response = app(CommuteController::class)->me($request, app(CommuteService::class));
            $data = $response->getData(true);
            $data['driver_approved'] = CohortPolicy::hostApproved((int) $request->user()->id);
            $data['seats_per_offer'] = 1;
            return $response->setData($data);
        });
    }

    public function profile(Request $request): JsonResponse
    {
        return $this->run($request, fn () => app(CommuteController::class)->profile($request, app(CommuteService::class)));
    }

    public function rides(Request $request): JsonResponse
    {
        return $this->run($request, function () use ($request): JsonResponse {
            $service = app(CommuteService::class);
            $response = app(CommuteController::class)->rides($request, $service);
            $profile = $service->profile($request->user());
            $return = $request->input('direction') === 'return';
            $mode = $request->input('vehicle_type') === 'bike' ? 'bike' : 'car';
            $path = app(PathProvider::class)->path([$profile[$return ? 'campus' : 'home'], $profile[$return ? 'home' : 'campus']], $mode);
            $data = $response->getData(true);
            $data['route_summary'] = ['distance_meters' => $path['distance_meters'], 'duration_seconds' => $path['duration_seconds']];
            return $response->setData($data);
        }, 'rides');
    }

    public function offers(Request $request): JsonResponse
    {
        return $this->run($request, fn () => app(CommuteController::class)->offers($request, app(CommuteMatchingService::class)));
    }

    public function publish(Request $request): JsonResponse
    {
        return $this->run($request, function () use ($request): JsonResponse {
            $validated = $request->validate([
                'date' => 'required|date_format:Y-m-d', 'direction' => 'required|in:outbound,return',
                'vehicle_type' => 'required|in:car,bike', 'car_id' => 'required|integer|min:1',
                'total_seats' => 'required|integer|in:1',
                'choice' => 'required|in:DIRECT_RIDER_PICKUP,ON_ROUTE_MEETING_POINT',
                'max_detour_meters' => 'sometimes|integer|between:0,10000',
                'max_detour_seconds' => 'sometimes|integer|between:0,1800',
            ]);
            $validated += ['max_detour_meters' => 3000, 'max_detour_seconds' => 600];
            $service = app(CommuteService::class);
            return response()->json($service->receipt($request->user(), $request->header('Idempotency-Key', ''),
                ['address-publish', $validated, $service->profile($request->user())],
                fn () => app(CommuteMatchingService::class)->publish($request->user(), $validated)));
        });
    }

    public function request(Request $request, int $trip): JsonResponse
    {
        return $this->run($request, function () use ($request, $trip): JsonResponse {
            $this->publication($trip);
            return app(CommuteController::class)->request($request, $trip, app(CommuteService::class));
        }, 'booking');
    }

    public function bookings(Request $request): JsonResponse
    {
        return $this->run($request, fn () => app(CommuteController::class)->bookings($request, app(CommuteService::class)), 'bookings');
    }

    public function action(Request $request, int $booking, string $action): JsonResponse
    {
        return $this->run($request, function () use ($request, $booking, $action): JsonResponse {
            $passenger = Passenger::findOrFail($booking);
            $this->publication((int) $passenger->trip_id);
            return app(CommuteController::class)->action($request, $booking, $action, app(CommuteService::class));
        }, 'booking');
    }

    public function notifications(Request $request): JsonResponse
    {
        return $this->run($request, fn () => app(CommuteController::class)->notifications($request, app(CommuteService::class)), 'notifications');
    }

    public function transition(Request $request, int $trip): JsonResponse
    {
        return $this->run($request, function () use ($request, $trip): JsonResponse {
            $this->publication($trip);
            $request->validate(['action' => 'required|in:start,board,alight,complete', 'passenger_id' => 'sometimes|integer|min:1']);
            return DB::transaction(function () use ($request, $trip): JsonResponse {
                $locked = Trip::whereKey($trip)->lockForUpdate()->firstOrFail();
                if ((int) $locked->user_id !== (int) $request->user()->id) throw new SegmentException('TRIP_OWNER_REQUIRED', 403);
                $meta = DB::table('mobility_commute_demo_trips')->where('trip_id', $trip)->first();
                AddressRideContext::approvedVehicle($request->user(), (int) $locked->car_id, $meta->vehicle_type);
                $request->attributes->set('commute.canonical_transition', true);
                return app(MobilityController::class)->transition($request, $locked);
            });
        });
    }

    private function publication(int $trip): void
    {
        if (!AddressRideContext::publication($trip)) throw new SegmentException('ADDRESS_RIDE_NOT_FOUND', 404);
    }

    private function run(Request $request, callable $operation, string $kind = ''): JsonResponse
    {
        try {
            $response = AddressRideContext::run($request->user(), $operation);
            return AddressRidePresenter::response($response, $kind);
        } catch (PickupException $error) {
            return $this->error($error->machineCode, $error->httpStatus);
        } catch (RoutingException $error) {
            return $this->error($error->machineCode, $error->machineCode === 'ROUTE_PROVIDER_UNAVAILABLE' ? 503 : 422);
        }
    }

    private function error(string $code, int $status): JsonResponse
    {
        return response()->json(['error' => ['code' => $code]], $status)->header('Cache-Control', 'private, no-store, max-age=0');
    }
}
