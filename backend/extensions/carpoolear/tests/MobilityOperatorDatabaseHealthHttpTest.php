<?php

namespace Tests\Feature\Mobility;

use STS\Models\User;
use Tests\TestCase;

final class MobilityOperatorDatabaseHealthHttpTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        putenv('MOBILITY_COLLEGE_CODE=CAMPUS-BLR');
    }

    public function test_database_health_is_private_and_reports_only_allow_list_metadata(): void
    {
        $student = User::factory()->create(['active' => true, 'banned' => false, 'is_admin' => false]);
        $this->actingAsApiUser($student)->getJson('/api/mobility/operator/dbms/health')
            ->assertForbidden()->assertJsonPath('error.code', 'OPERATOR_FORBIDDEN');

        $admin = User::factory()->create(['active' => true, 'banned' => false, 'is_admin' => true]);
        $response = $this->actingAsApiUser($admin)->getJson('/api/mobility/operator/dbms/health')->assertOk()
            ->assertJsonPath('audience', 'operator')
            ->assertJsonPath('scope', 'configured_college')
            ->assertHeader('Cache-Control', 'private, no-store');
        $tables = collect($response->json('tables'))->keyBy('name');
        $this->assertTrue($tables->get('users')['exists']);
        $this->assertNull($tables->get('users')['rows']);
        $this->assertTrue($tables->has('mobility_memberships'));
        $this->assertSame('mobility_operator_ride_facts', $response->json('objects.0.name'));
        $this->assertSame('VIEW', $response->json('objects.0.kind'));
        $this->assertIsBool($response->json('objects.0.installed'));
        $this->assertArrayNotHasKey('database', $response->json());
        $this->assertArrayNotHasKey('credentials', $response->json());

        // A caller cannot broaden the fixed table allow-list through a query.
        $restricted = $this->actingAsApiUser($admin)->getJson('/api/mobility/operator/dbms/health?table=users&sql=SELECT+*+FROM+users')->assertOk();
        $this->assertSame($response->json('tables'), $restricted->json('tables'));
    }

    public function test_banned_or_inactive_operator_cannot_inspect_the_database(): void
    {
        foreach ([['active' => false, 'banned' => false], ['active' => true, 'banned' => true]] as $flags) {
            $actor = User::factory()->create(array_merge(['is_admin' => true], $flags));
            $status = $this->actingAsApiUser($actor)->getJson('/api/mobility/operator/dbms/health')->status();
            $this->assertContains($status, [401, 403]);
        }
    }
}
