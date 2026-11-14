<?php

namespace STS\Mobility\Routing;

/** Route-provider adapter for Ola Directions. Must be opt-in after graph-identity migration. */
final class OlaRouteProvider implements RouteProvider
{
    public function __construct(private readonly OlaDirectionsClient $client) {}

    public function route(array $pickup, array $dropoff, string $vehicleType): array
    {
        if (! in_array($vehicleType, ['car', 'bike'], true)) {
            throw new RoutingException('INVALID_VEHICLE_TYPE');
        }
        $route = $this->client->directions([$pickup, $dropoff], $vehicleType);
        if ($route['distance_meters'] <= 0 || $route['duration_seconds'] <= 0) {
            throw new RoutingException('NO_ROUTE');
        }
        return ['distance_meters' => $route['distance_meters'], 'duration_seconds' => $route['duration_seconds'],
            'provider' => $route['provider'], 'profile' => $route['profile'], 'data_version' => $route['data_version']];
    }
}
