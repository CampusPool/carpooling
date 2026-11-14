<?php

namespace Tests\Feature\Mobility;

use Illuminate\Support\Facades\DB;
use STS\Models\User;
use Tests\TestCase;

final class MobilityPesTimetableTest extends TestCase
{
    protected function beforeRefreshingDatabase(): void
    {
        if (!preg_match('/^testing[a-zA-Z0-9_-]*$/', DB::connection()->getDatabaseName())) {
            throw new \RuntimeException('Refusing non-test database');
        }
    }

    public function test_save_read_isolation_invalid_update_and_delete(): void
    {
        $previousPublicMode = getenv('MOBILITY_PUBLIC_STUDENT_ONLY');
        putenv('MOBILITY_PUBLIC_STUDENT_ONLY=false');
        try {
            $first = User::factory()->create();
            $second = User::factory()->create();
            $path = '/api/mobility/commute/pes-timetable';
            $entry = [
                'day' => 1, 'dayName' => 'Monday', 'slot' => 1, 'option' => 1,
                'start' => '08:00', 'end' => '09:00', 'title' => 'Synthetic class',
            ];

            $this->actingAsApiUser($first)->putJson($path, ['entries' => [$entry]])->assertOk()->assertJsonPath('count', 1);
            $this->actingAsApiUser($second)->getJson($path)->assertOk()->assertJsonCount(0, 'data');
            $this->actingAsApiUser($first)->putJson($path, ['entries' => [array_merge($entry, ['end' => '07:00'])]])->assertStatus(422);
            $this->actingAsApiUser($first)->getJson($path)->assertOk()->assertJsonPath('data.0.title', 'Synthetic class');
            $this->actingAsApiUser($second)->deleteJson($path)->assertOk();
            $this->actingAsApiUser($first)->getJson($path)->assertJsonCount(1, 'data');
            $this->actingAsApiUser($first)->deleteJson($path)->assertOk();
            $this->actingAsApiUser($first)->getJson($path)->assertJsonCount(0, 'data');
        } finally {
            putenv($previousPublicMode === false ? 'MOBILITY_PUBLIC_STUDENT_ONLY' : 'MOBILITY_PUBLIC_STUDENT_ONLY='.$previousPublicMode);
        }
    }
}
