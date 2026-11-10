<?php

namespace Tests\Feature\Mobility;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use STS\Mobility\Pickup\OlaPathProvider;
use STS\Mobility\Routing\OlaDirectionsClient;
use STS\Mobility\Routing\OlaRouteProvider;
use STS\Mobility\Routing\RoutingException;
use Tests\TestCase;

final class MobilityOlaDirectionsClientTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        config(['mobility_routing.ola_api_key' => 'synthetic-ola-maps-key-for-test']);
    }

    public function test_three_point_driving_route_preserves_legs_geometry_snaps_and_mode(): void
    {
        Http::fake(fn () => Http::response($this->routeBody()));
        $path = (new OlaPathProvider(new OlaDirectionsClient))->path($this->points(), 'car');
        $this->assertSame('ola', $path['provider']);
        $this->assertSame('car', $path['profile']);
        $this->assertSame('ola-directions-v1:car', $path['data_version']);
        $this->assertSame(1800, $path['distance_meters']);
        $this->assertSame(420, $path['duration_seconds']);
        $this->assertCount(3, $path['geometry']);
        $this->assertCount(3, $path['waypoints']);
        $this->assertCount(2, $path['legs']);
        Http::assertSent(fn ($request) => $request->method() === 'POST'
            && $request->body() === ''
            && str_starts_with($request->url(), 'https://api.olamaps.io/routing/v1/directions?')
            && str_contains($request->url(), 'mode=driving')
            && str_contains($request->url(), 'waypoints=12.971%2C77.595')
            && str_contains($request->url(), 'origin=12.97%2C77.59')
            && str_contains($request->url(), 'destination=12.98%2C77.6'));
        Http::assertSentCount(1);
    }

    public function test_two_point_quote_provider_returns_ola_identity(): void
    {
        $body = $this->routeBody();
        $body['routes'][0]['legs'] = [[
            'distance' => 1800, 'duration' => 420,
            'start_location' => $this->points()[0], 'end_location' => $this->points()[2],
        ]];
        Http::fake(fn () => Http::response($body));
        $quote = (new OlaRouteProvider(new OlaDirectionsClient))->route($this->points()[0], $this->points()[2], 'bike');
        $this->assertSame(['distance_meters' => 1800, 'duration_seconds' => 420,
            'provider' => 'ola', 'profile' => 'bike', 'data_version' => 'ola-directions-v1:bike'], $quote);
        Http::assertSent(fn ($request) => str_contains($request->url(), 'mode=bike'));
    }

    public function test_walking_requests_use_walking_mode(): void
    {
        Http::fake(fn () => Http::response($this->routeBody()));
        $path = (new OlaPathProvider(new OlaDirectionsClient))->path($this->points(), 'foot');
        $this->assertSame('foot', $path['profile']);
        Http::assertSent(fn ($request) => str_contains($request->url(), 'mode=walking'));
    }

    public function test_unconfigured_key_bad_points_or_unrecognized_mode_never_send_requests(): void
    {
        Http::fake();
        foreach (['', 'short', 'with/slash', 'a key with spaces'] as $key) {
            config(['mobility_routing.ola_api_key' => $key]);
            $this->reject(fn () => (new OlaDirectionsClient)->directions($this->points(), 'car'), 'ROUTING_MISCONFIGURED');
        }
        config(['mobility_routing.ola_api_key' => 'synthetic-ola-maps-key-for-test']);
        $this->reject(fn () => (new OlaDirectionsClient)->directions($this->points(), 'plane'), 'ROUTE_INVALID');
        $this->reject(fn () => (new OlaDirectionsClient)->directions([['lat' => 200, 'lng' => 77.59], $this->points()[1]], 'car'), 'ROUTE_INVALID');
        $this->reject(fn () => (new OlaDirectionsClient)->directions($this->points(), 'car', 10), 'ROUTE_INVALID');
        Http::assertNothingSent();
    }

    public function test_malformed_legs_polyline_snap_and_bad_status_fail_closed(): void
    {
        $cases = [];
        $b = $this->routeBody(); $b['routes'][0]['legs'] = []; $cases[] = [$b, 'ROUTE_INVALID'];
        $b = $this->routeBody(); $b['routes'][0]['legs'][0]['distance'] = '999'; $cases[] = [$b, 'ROUTE_INVALID'];
        $b = $this->routeBody(); $b['routes'][0]['legs'][0]['distance'] = 100001; $cases[] = [$b, 'ROUTE_INVALID'];
        $b = $this->routeBody(); $b['routes'][0]['legs'][0]['end_location'] = ['lat' => 13.40, 'lng' => 78.50]; $cases[] = [$b, 'ROUTE_SNAP_TOO_FAR'];
        $b = $this->routeBody(); $b['routes'][0]['overview_polyline'] = 'bad'; $cases[] = [$b, 'ROUTE_INVALID'];
        $b = $this->routeBody(); $b['routes'][0]['overview_polyline'] = self::encode([[12.6, 77.2], [12.61, 77.21]]); $cases[] = [$b, 'ROUTE_INVALID'];
        $cases[] = [['status' => 'NO_ROUTE', 'routes' => []], 'NO_ROUTE'];
        foreach ($cases as [$body, $code]) {
            Http::swap(new \Illuminate\Http\Client\Factory);
            Http::preventStrayRequests();
            Http::fake(fn () => Http::response($body));
            $this->reject(fn () => (new OlaDirectionsClient)->directions($this->points(), 'car'), $code);
        }
    }

    public function test_quota_limit_redirect_and_network_timeout_are_bounded(): void
    {
        foreach ([429, 302, 500] as $status) {
            Http::swap(new \Illuminate\Http\Client\Factory);
            Http::preventStrayRequests();
            Http::fake(fn () => Http::response([], $status, ['Location' => 'https://attacker.invalid/']));
            $this->reject(fn () => (new OlaDirectionsClient)->directions($this->points(), 'car'), 'ROUTE_PROVIDER_UNAVAILABLE');
        }
        Http::swap(new \Illuminate\Http\Client\Factory);
        Http::fake(fn () => throw new ConnectionException('synthetic network failure'));
        $this->reject(fn () => (new OlaDirectionsClient)->directions($this->points(), 'car'), 'ROUTE_PROVIDER_UNAVAILABLE');
    }

    private function points(): array
    {
        return [['lat' => 12.97, 'lng' => 77.59], ['lat' => 12.971, 'lng' => 77.595], ['lat' => 12.98, 'lng' => 77.60]];
    }

    private function routeBody(): array
    {
        $points = $this->points();
        return ['status' => 'SUCCESS', 'routes' => [[
            'overview_polyline' => self::encode(array_map(fn ($p) => [$p['lat'], $p['lng']], $points)),
            'legs' => [
                ['distance' => 800, 'duration' => 190, 'start_location' => $points[0], 'end_location' => $points[1]],
                ['distance' => 1000, 'duration' => 230, 'start_location' => $points[1], 'end_location' => $points[2]],
            ],
        ]]];
    }

    /** Synthetic encoder to exercise the real decoder, without provider requests. */
    private static function encode(array $points): string
    {
        $text = ''; $lastLat = 0; $lastLng = 0;
        foreach ($points as [$lat, $lng]) {
            $ilat = (int) round($lat * 100000); $ilng = (int) round($lng * 100000);
            foreach ([$ilat - $lastLat, $ilng - $lastLng] as $delta) {
                $value = $delta < 0 ? ~($delta << 1) : ($delta << 1);
                while ($value >= 0x20) {
                    $text .= chr((0x20 | ($value & 0x1f)) + 63);
                    $value >>= 5;
                }
                $text .= chr($value + 63);
            }
            $lastLat = $ilat; $lastLng = $ilng;
        }
        return $text;
    }

    private function reject(callable $test, string $expected): void
    {
        try { $test(); $this->fail('Expected '.$expected); }
        catch (RoutingException $e) { $this->assertSame($expected, $e->machineCode); }
    }
}
