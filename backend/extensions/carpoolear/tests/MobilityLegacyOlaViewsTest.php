<?php
namespace Tests\Feature\Mobility;

use Tests\TestCase;

final class MobilityLegacyOlaViewsTest extends TestCase
{
    private mixed $previousPilot;
    private mixed $previousUrl;

    protected function setUp(): void
    {
        parent::setUp();
        $this->previousPilot = getenv('MOBILITY_PILOT_UI_ENABLED');
        $this->previousUrl = getenv('MOBILITY_FRONTEND_URL');
        putenv('MOBILITY_PILOT_UI_ENABLED=true');
        putenv('MOBILITY_FRONTEND_URL=http://127.0.0.1:3133');
    }

    protected function tearDown(): void
    {
        foreach (['MOBILITY_PILOT_UI_ENABLED' => $this->previousPilot, 'MOBILITY_FRONTEND_URL' => $this->previousUrl] as $name => $value) {
            putenv($value === false ? $name : $name.'='.$value);
        }
        parent::tearDown();
    }

    public function test_ola_browser_entries_route_to_next_without_serving_google_assets(): void
    {
        config(['mobility_routing.provider' => 'ola']);
        $this->get('/mobility')->assertRedirect('http://127.0.0.1:3133/');
        $this->get('/mobility-pilot')->assertRedirect('http://127.0.0.1:3133/');
        foreach (['/mobility/commute-map.mjs', '/mobility/place-search.mjs',
                   '/mobility-pilot/maps', '/mobility-pilot/maps.js'] as $uri) {
            $this->get($uri)->assertStatus(410);
        }
        $this->get('/mobility-pilot/maps-config')
            ->assertStatus(410)->assertJsonPath('error', 'LEGACY_MAPS_DISABLED_IN_OLA_MODE');
    }

    public function test_osrm_rollback_still_serves_existing_legacy_pages(): void
    {
        config(['mobility_routing.provider' => 'osrm']);
        $this->get('/mobility')->assertOk();
        $this->get('/mobility-pilot')->assertOk();
    }
}
