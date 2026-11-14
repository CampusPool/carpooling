<?php

namespace Tests\Feature\Mobility;

use Illuminate\Support\Facades\DB;
use STS\Models\User;
use Tests\TestCase;

final class PlannedRidesTest extends TestCase
{
    protected function beforeRefreshingDatabase(): void
    {
        if (!preg_match('/^testing[a-zA-Z0-9_-]*$/', DB::connection()->getDatabaseName())) {
            throw new \RuntimeException('Refusing non-test database');
        }
    }

    public function test_verified_student_plans_are_private_and_do_not_publish_trips(): void
    {
        $environment = [
            'MOBILITY_PUBLIC_STUDENT_ONLY' => 'true',
            'MOBILITY_COLLEGE_CODE' => 'CAMPUS-BLR',
            'MOBILITY_COHORT_REQUIRED' => 'true',
        ];
        $previous = [];
        foreach ($environment as $key => $value) {
            $previous[$key] = getenv($key);
            putenv($key.'='.$value);
        }

        try {
            $first = $this->student('planned.first@stu.pes.edu');
            $second = $this->student('planned.second@stu.pes.edu');
            $unverified = User::factory()->create();
            $path = '/api/mobility/address-rides/plan';
            $plan = [
                'home' => ['label' => 'Home fixture', 'lat' => 12.976, 'lng' => 77.601],
                'campus' => ['label' => 'Campus fixture', 'lat' => 12.937, 'lng' => 77.536],
                'outbound_time' => '07:30',
                'return_time' => '16:30',
                'weekdays' => [5, 2, 3],
                'paused' => false,
                'outbound_enabled' => true,
                'return_enabled' => true,
            ];

            $this->actingAsApiUser($unverified)->getJson($path)->assertForbidden();
            $this->actingAsApiUser($first)->getJson($path)->assertOk()->assertJsonPath('data', null);
            $this->actingAsApiUser($first)->putJson($path, $plan)
                ->assertOk()->assertJsonPath('data.weekdays', [2, 3, 5])->assertHeader('Cache-Control', 'no-store, private');
            $this->actingAsApiUser($second)->getJson($path)->assertOk()->assertJsonPath('data', null);
            $this->actingAsApiUser($first)->putJson($path, array_replace($plan, ['weekdays' => [2, 2]]))
                ->assertUnprocessable()->assertJsonValidationErrors('weekdays.1');
            $this->actingAsApiUser($first)->getJson($path)->assertOk()->assertJsonPath('data.paused', false);
            $this->actingAsApiUser($first)->putJson($path, array_replace($plan, ['paused' => true, 'return_enabled' => false]))
                ->assertOk()->assertJsonPath('data.paused', true);
            $this->actingAsApiUser($first)->getJson($path)->assertOk()
                ->assertJsonPath('data.paused', true)->assertJsonPath('data.return_enabled', false);
            $this->assertDatabaseCount('mobility_student_ride_plans', 1);
            $this->assertDatabaseCount('mobility_commute_demo_trips', 0);
        } finally {
            foreach ($previous as $key => $value) putenv($value === false ? $key : $key.'='.$value);
        }
    }

    private function student(string $email): User
    {
        $student = User::factory()->create(['email' => $email, 'active' => true, 'banned' => false]);
        DB::table('mobility_memberships')->insert([
            'user_id' => $student->id, 'college_code' => 'CAMPUS-BLR', 'affiliation' => 'student',
            'status' => 'approved', 'version' => 1, 'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('mobility_verified_identities')->insert([
            'user_id' => $student->id, 'provider' => 'college_email_otp', 'email' => $email,
            'domain' => 'stu.pes.edu', 'verified_at' => now(), 'created_at' => now(), 'updated_at' => now(),
        ]);

        return $student;
    }
}
