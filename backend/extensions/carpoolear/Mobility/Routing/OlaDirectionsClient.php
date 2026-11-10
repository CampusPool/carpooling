<?php

namespace STS\Mobility\Routing;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * Ola Directions API adapter. Normalizes provider data without pretending its
 * data_version is an OSRM graph SHA. Not wired into the booking system yet.
 */
final class OlaDirectionsClient
{
    private const HOST = 'https://api.olamaps.io/routing/v1/directions';
    private const MAX_POINTS = 8;
    private const MAX_BODY_BYTES = 2097152;
    private const MAX_GEOMETRY_POINTS = 20000;
    private const MAX_ROUTE_METERS = 100000;
    private const MAX_ROUTE_SECONDS = 86400;

    /** @param list<array{lat:float|int,lng:float|int}> $points */
    public function directions(array $points, string $mode, float $timeoutSeconds = 5): array
    {
        if (! in_array($mode, ['car', 'bike', 'foot'], true)
            || ! array_is_list($points) || count($points) < 2 || count($points) > self::MAX_POINTS
            || ! is_finite($timeoutSeconds) || $timeoutSeconds <= 0 || $timeoutSeconds > 5) {
            throw new RoutingException('ROUTE_INVALID');
        }
        $key = trim((string) config('mobility_routing.ola_api_key', ''));
        if (! preg_match('/^[A-Za-z0-9_-]{16,128}$/D', $key)) {
            throw new RoutingException('ROUTING_MISCONFIGURED');
        }
        foreach ($points as $point) {
            if (! is_array($point) || ! $this->number($point['lat'] ?? null, -90, 90)
                || ! $this->number($point['lng'] ?? null, -180, 180)) {
                throw new RoutingException('ROUTE_INVALID');
            }
        }
        $format = static fn (array $point): string => $point['lat'].','.$point['lng'];
        $params = [
            'origin' => $format($points[0]), 'destination' => $format($points[array_key_last($points)]),
            'mode' => ['car' => 'driving', 'bike' => 'bike', 'foot' => 'walking'][$mode],
            'overview' => 'full', 'steps' => 'false', 'alternatives' => 'false', 'api_key' => $key,
        ];
        if (count($points) > 2) {
            $params['waypoints'] = implode('|', array_map($format, array_slice($points, 1, -1)));
        }
        try {
            // POST and fixed, audited host. Disable redirects so credentials are not
            // forwarded to third-party domains; never return/log the request URL.
            // Ola Directions expects a query-string POST with *no JSON body*;
            // Laravel's ->post($url) sends [] and Ola returns HTTP 400.
            $response = Http::connectTimeout(min(2, $timeoutSeconds))->timeout($timeoutSeconds)
                ->withoutRedirecting()->acceptJson()->withHeaders(['X-Request-Id' => (string) Str::uuid()])
                ->send('POST', self::HOST.'?'.http_build_query($params, '', '&', PHP_QUERY_RFC3986));
        } catch (\Throwable) {
            throw new RoutingException('ROUTE_PROVIDER_UNAVAILABLE');
        }
        if ($response->status() === 429) {
            throw new RoutingException('ROUTE_PROVIDER_UNAVAILABLE');
        }
        if (! $response->successful()) {
            if (in_array($response->status(), [400, 404, 422], true)
                && in_array($response->json('status'), ['ZERO_RESULTS', 'NOT_FOUND', 'NO_ROUTE'], true)) {
                throw new RoutingException('NO_ROUTE');
            }
            throw new RoutingException('ROUTE_PROVIDER_UNAVAILABLE');
        }
        if (strlen($response->body()) > self::MAX_BODY_BYTES) {
            throw new RoutingException('ROUTE_INVALID');
        }
        $body = $response->json();
        if (! is_array($body) || ($body['status'] ?? null) !== 'SUCCESS' || ! is_array($body['routes'][0] ?? null)) {
            if (in_array($body['status'] ?? null, ['ZERO_RESULTS', 'NOT_FOUND', 'NO_ROUTE'], true)) {
                throw new RoutingException('NO_ROUTE');
            }
            throw new RoutingException('ROUTE_INVALID');
        }
        $route = $body['routes'][0];
        $legs = $route['legs'] ?? null;
        if (! is_array($legs) || ! array_is_list($legs) || count($legs) !== count($points) - 1) {
            throw new RoutingException('ROUTE_INVALID');
        }
        $snaps = [];
        $totals = ['distance_meters' => 0.0, 'duration_seconds' => 0.0];
        $normalizedLegs = [];
        foreach ($legs as $index => $leg) {
            if (! is_array($leg) || ! $this->number($leg['distance'] ?? null, 0, self::MAX_ROUTE_METERS)
                || ! $this->number($leg['duration'] ?? null, 0, self::MAX_ROUTE_SECONDS)) {
                throw new RoutingException('ROUTE_INVALID');
            }
            $start = $this->snapped($leg['start_location'] ?? null);
            $end = $this->snapped($leg['end_location'] ?? null);
            $limit = $mode === 'foot' ? 50 : 250;
            foreach ([[$points[$index], $start], [$points[$index + 1], $end]] as [$source, $snap]) {
                if ($this->haversine($source, $snap) > $limit) {
                    throw new RoutingException('ROUTE_SNAP_TOO_FAR');
                }
            }
            if ($index === 0) {
                $snaps[] = $start;
            } elseif ($this->haversine($snaps[$index], $start) > 15) {
                throw new RoutingException('ROUTE_SNAP_INVALID');
            }
            $snaps[] = $end;
            $coincident = $this->haversine($start, $end) <= 1;
            if (! $coincident && ((float) $leg['distance'] <= 0 || (float) $leg['duration'] <= 0)) {
                throw new RoutingException('ROUTE_INVALID');
            }
            $totals['distance_meters'] += (float) $leg['distance'];
            $totals['duration_seconds'] += (float) $leg['duration'];
            $normalizedLegs[] = [
                'distance_meters' => (int) ceil($leg['distance']),
                'duration_seconds' => (int) ceil($leg['duration']),
            ];
        }
        if ($totals['distance_meters'] > self::MAX_ROUTE_METERS || $totals['duration_seconds'] > self::MAX_ROUTE_SECONDS) {
            throw new RoutingException('ROUTE_INVALID');
        }
        $geometry = $this->decodePolyline($route['overview_polyline'] ?? null);
        if ($this->haversine(['lat' => $geometry[0][1], 'lng' => $geometry[0][0]], $snaps[0]) > 20
            || $this->haversine(['lat' => $geometry[array_key_last($geometry)][1], 'lng' => $geometry[array_key_last($geometry)][0]], $snaps[array_key_last($snaps)]) > 20) {
            throw new RoutingException('ROUTE_INVALID');
        }
        // Encoded polyline precision can displace the endpoints by a few meters.
        // The validated provider-snapped points are authoritative for matching.
        $geometry[0] = [$snaps[0]['lng'], $snaps[0]['lat']];
        $geometry[array_key_last($geometry)] = [$snaps[array_key_last($snaps)]['lng'], $snaps[array_key_last($snaps)]['lat']];
        // Preserve the ordered intermediate stops for four-point pickup journeys.
        $previous = 0;
        foreach (array_slice($snaps, 1, -1) as $snap) {
            $nearest = null; $best = INF;
            for ($i = $previous + 1; $i < count($geometry) - 1; $i++) {
                $gap = $this->haversine(['lat' => $geometry[$i][1], 'lng' => $geometry[$i][0]], $snap);
                if ($gap < $best) { $best = $gap; $nearest = $i; }
            }
            if ($nearest === null || $best > 20) throw new RoutingException('ROUTE_INVALID');
            $geometry[$nearest] = [$snap['lng'], $snap['lat']];
            $previous = $nearest;
        }
        return [
            'provider' => 'ola', 'profile' => $mode,
            // Provider identity, not an OSRM graph provenance assertion.
            'data_version' => 'ola-directions-v1:'.$mode,
            'distance_meters' => (int) ceil($totals['distance_meters']),
            'duration_seconds' => (int) ceil($totals['duration_seconds']),
            'geometry' => $geometry,
            'waypoints' => array_map(function (array $snap, int $i) use ($points): array {
                return [
                    'distance_meters' => $this->haversine($points[$i], $snap),
                    'location' => [$snap['lng'], $snap['lat']],
                ];
            }, $snaps, array_keys($snaps)),
            'legs' => $normalizedLegs,
        ];
    }

    /** @return array{lat: float,lng: float} */
    private function snapped(mixed $point): array
    {
        if (! is_array($point) || ! $this->number($point['lat'] ?? null, -90, 90)
            || ! $this->number($point['lng'] ?? null, -180, 180)) {
            throw new RoutingException('ROUTE_SNAP_INVALID');
        }
        return ['lat' => (float) $point['lat'], 'lng' => (float) $point['lng']];
    }

    private function number(mixed $value, float $min, float $max): bool
    {
        return (is_int($value) || is_float($value)) && is_finite((float) $value) && $value >= $min && $value <= $max;
    }

    /** Decode standard encoded polyline precision=5, in [longitude,latitude] order. */
    private function decodePolyline(mixed $encoded): array
    {
        if (! is_string($encoded) || $encoded === '' || strlen($encoded) > 300000) {
            throw new RoutingException('ROUTE_INVALID');
        }
        $points = []; $position = 0; $lat = 0; $lng = 0; $length = strlen($encoded);
        while ($position < $length) {
            foreach (['lat', 'lng'] as $axis) {
                $value = 0; $shift = 0;
                do {
                    if ($position >= $length || $shift > 35) {
                        throw new RoutingException('ROUTE_INVALID');
                    }
                    $char = ord($encoded[$position++]) - 63;
                    if ($char < 0 || $char > 63) {
                        throw new RoutingException('ROUTE_INVALID');
                    }
                    $value |= ($char & 0x1f) << $shift;
                    $shift += 5;
                } while ($char >= 0x20);
                $delta = ($value & 1) ? ~($value >> 1) : ($value >> 1);
                if ($axis === 'lat') $lat += $delta;
                else $lng += $delta;
            }
            $point = [$lng / 100000, $lat / 100000];
            if (! $this->number($point[0], -180, 180) || ! $this->number($point[1], -90, 90)) {
                throw new RoutingException('ROUTE_INVALID');
            }
            $points[] = $point;
            if (count($points) > self::MAX_GEOMETRY_POINTS) {
                throw new RoutingException('ROUTE_INVALID');
            }
        }
        if (count($points) < 2) {
            throw new RoutingException('ROUTE_INVALID');
        }
        return $points;
    }

    private function haversine(array $a, array $b): float
    {
        $lat = deg2rad((float) $b['lat'] - (float) $a['lat']);
        $lng = deg2rad((float) $b['lng'] - (float) $a['lng']);
        $h = sin($lat / 2) ** 2 + cos(deg2rad((float) $a['lat'])) * cos(deg2rad((float) $b['lat'])) * sin($lng / 2) ** 2;
        return 6371000 * 2 * asin(sqrt(min(1, max(0, $h))));
    }
}
