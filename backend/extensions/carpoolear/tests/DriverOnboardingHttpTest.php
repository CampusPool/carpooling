<?php

namespace Tests\Feature\Mobility;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use STS\Models\Car;
use STS\Models\User;
use STS\Mobility\Trust\CohortPolicy;
use Tests\TestCase;

final class DriverOnboardingHttpTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        putenv('MOBILITY_COHORT_REQUIRED=true');
        putenv('MOBILITY_COLLEGE_CODE=CAMPUS-BLR');
        putenv('MOBILITY_DRIVER_DOCUMENTS_REQUIRED=true');
        Storage::fake('local');

    }

    protected function tearDown(): void
    {
        putenv('MOBILITY_COHORT_REQUIRED');
        putenv('MOBILITY_COLLEGE_CODE');
        putenv('MOBILITY_DRIVER_DOCUMENTS_REQUIRED');
        parent::tearDown();
    }

    public function test_submission_requires_current_checklist_and_manual_approval_controls_publish(): void
    {
        $applicant = User::factory()->create(['active' => true, 'banned' => false]);
        $operator = User::factory()->create(['active' => true, 'banned' => false, 'is_admin' => true]);
        DB::table('mobility_memberships')->insert(['user_id' => $applicant->id, 'college_code' => 'CAMPUS-BLR', 'affiliation' => 'student', 'status' => 'approved', 'version' => 2, 'created_at' => now(), 'updated_at' => now()]);
        $car = Car::factory()->withCatalog()->create(['user_id' => $applicant->id]);
        $created = $this->actingAsApiUser($applicant)->postJson('/api/mobility/driver-onboarding', ['car_id' => $car->id, 'vehicle_type' => 'car', 'legal_passenger_capacity' => 4, 'profile_display_name' => 'Synthetic Driver'])->assertCreated();
        $id = $created->json('onboarding_id');
        $this->actingAsApiUser($applicant)->post('/api/mobility/driver-onboarding/'.$id.'/documents', ['document_type' => 'rc', 'document' => UploadedFile::fake()->createWithContent('stale.pdf', "%PDF-synthetic\n"), 'expires_at' => now()->addYear()->toDateString(), 'expected_version' => 99])->assertStatus(409)->assertJsonPath('error.code', 'VERSION_CONFLICT');
        $types = ['driver_license', 'profile_photo', 'rc', 'insurance', 'permit', 'fitness', 'puc', 'identity_or_address', 'ownership_noc'];
        $onboardingVersion = 1;
        foreach ($types as $type) {
            $payload = ['document_type' => $type, 'document' => UploadedFile::fake()->createWithContent($type.'.pdf', "%PDF-synthetic\n"), 'expected_version' => $onboardingVersion];
            if (in_array($type, ['driver_license', 'rc', 'insurance', 'permit', 'fitness', 'puc'], true)) $payload['expires_at'] = now()->addYear()->toDateString();
            $onboardingVersion = $this->actingAsApiUser($applicant)->post('/api/mobility/driver-onboarding/'.$id.'/documents', $payload)->assertCreated()->json('onboarding_version');
        }
        $onboardingVersion = $this->actingAsApiUser($applicant)->postJson('/api/mobility/driver-onboarding/'.$id.'/submit', ['expected_version' => $onboardingVersion])->assertOk()->json('version');
        $inactive = User::factory()->create(['active' => false, 'banned' => false, 'is_admin' => true]);
        $this->actingAsApiUser($inactive)->postJson('/api/mobility/operator/driver-onboarding/'.$id.'/review', ['expected_version' => $onboardingVersion, 'status' => 'approved', 'reason' => 'inactive'])->assertUnauthorized();
        $this->actingAsApiUser($operator)->postJson('/api/mobility/operator/driver-onboarding/'.$id.'/review', ['expected_version' => $onboardingVersion, 'status' => 'needs_resubmission', 'document_type' => 'insurance', 'reason' => 'Upload a clearer synthetic image'])->assertOk();
        $this->actingAsApiUser($applicant)->getJson('/api/mobility/driver-onboarding/me')->assertJsonPath('data.0.review_reason', 'Upload a clearer synthetic image')->assertJsonPath('data.0.checklist.3.review_reason', 'Upload a clearer synthetic image');
        $onboardingVersion = $this->actingAsApiUser($applicant)->post('/api/mobility/driver-onboarding/'.$id.'/documents', ['document_type' => 'insurance', 'document' => UploadedFile::fake()->createWithContent('insurance-new.pdf', "%PDF-synthetic\n"), 'expires_at' => now()->addYear()->toDateString(), 'expected_version' => $onboardingVersion + 1])->assertCreated()->json('onboarding_version');
        $onboardingVersion = $this->actingAsApiUser($applicant)->postJson('/api/mobility/driver-onboarding/'.$id.'/submit', ['expected_version' => $onboardingVersion])->assertOk()->json('version');
        $this->actingAsApiUser($operator)->postJson('/api/mobility/operator/driver-onboarding/'.$id.'/review', ['expected_version' => $onboardingVersion, 'status' => 'approved', 'reason' => 'Synthetic checklist inspected'])->assertOk();
        $this->assertTrue(CohortPolicy::hostApproved($applicant->id, $car->id, 'car'));
        $this->assertDatabaseHas('mobility_driver_onboarding_audits', ['onboarding_id' => $id, 'new_status' => 'approved']);
        $this->actingAsApiUser($operator)->postJson('/api/mobility/operator/host-applications/'.DB::table('mobility_host_applications')->where('user_id', $applicant->id)->value('id').'/decision', ['expected_version' => 2, 'status' => 'rejected', 'reason' => 'legacy bypass'])->assertStatus(409)->assertJsonPath('error.code', 'DRIVER_ONBOARDING_REQUIRED');
    }

    public function test_legacy_host_application_is_closed_when_document_workflow_is_required(): void
    {
        $applicant = User::factory()->create(['active' => true, 'banned' => false]);
        DB::table('mobility_memberships')->insert(['user_id' => $applicant->id, 'college_code' => 'CAMPUS-BLR', 'affiliation' => 'student', 'status' => 'approved', 'version' => 2, 'created_at' => now(), 'updated_at' => now()]);
        $car = Car::factory()->withCatalog()->create(['user_id' => $applicant->id]);
        $this->actingAsApiUser($applicant)->postJson('/api/mobility/host-applications', ['car_id' => $car->id, 'vehicle_type' => 'car'])
            ->assertStatus(409)->assertJsonPath('error.code', 'DRIVER_ONBOARDING_REQUIRED');
    }

    public function test_approved_legacy_host_without_onboarding_cannot_publish_when_documents_are_optional(): void
    {
        putenv('MOBILITY_DRIVER_DOCUMENTS_REQUIRED=false');
        $applicant = User::factory()->create(['active' => true, 'banned' => false]);
        DB::table('mobility_memberships')->insert(['user_id' => $applicant->id, 'college_code' => 'CAMPUS-BLR', 'affiliation' => 'student', 'status' => 'approved', 'version' => 2, 'created_at' => now(), 'updated_at' => now()]);
        $car = Car::factory()->withCatalog()->create(['user_id' => $applicant->id]);
        DB::table('mobility_host_applications')->insert(['user_id' => $applicant->id, 'car_id' => $car->id, 'vehicle_type' => 'car', 'vehicle_fingerprint' => CohortPolicy::vehicleFingerprint($car), 'status' => 'approved', 'version' => 2, 'created_at' => now(), 'updated_at' => now()]);

        $this->assertFalse(CohortPolicy::hostApproved($applicant->id, $car->id, 'car'));
        $this->actingAsApiUser($applicant)->postJson('/api/trips', ['is_passenger' => 0, 'car_id' => $car->id, 'vehicle_type' => 'car', 'total_seats' => 1])->assertForbidden()->assertJsonPath('error.code', 'HOST_APPROVAL_REQUIRED');
    }

    public function test_legacy_approved_application_can_add_capacity_only_by_returning_to_operator_review(): void
    {
        putenv('MOBILITY_DRIVER_DOCUMENTS_REQUIRED=false');
        $applicant = User::factory()->create(['active' => true, 'banned' => false]);
        DB::table('mobility_memberships')->insert(['user_id' => $applicant->id, 'college_code' => 'CAMPUS-BLR', 'affiliation' => 'student', 'status' => 'approved', 'version' => 2, 'created_at' => now(), 'updated_at' => now()]);
        $car = Car::factory()->withCatalog()->create(['user_id' => $applicant->id]);
        $hostApplicationId = DB::table('mobility_host_applications')->insertGetId(['user_id' => $applicant->id, 'car_id' => $car->id, 'vehicle_type' => 'car', 'vehicle_fingerprint' => CohortPolicy::vehicleFingerprint($car), 'status' => 'approved', 'version' => 2, 'created_at' => now(), 'updated_at' => now()]);
        $onboardingId = DB::table('mobility_driver_onboardings')->insertGetId(['user_id' => $applicant->id, 'host_application_id' => $hostApplicationId, 'car_id' => $car->id, 'vehicle_type' => 'car', 'vehicle_fingerprint' => CohortPolicy::vehicleFingerprint($car), 'profile_display_name' => 'Old approved profile', 'status' => 'approved', 'version' => 3, 'created_at' => now(), 'updated_at' => now()]);
        $this->actingAsApiUser($applicant)->putJson('/api/mobility/driver-onboarding/'.$onboardingId.'/profile', ['profile_display_name' => 'Old approved profile', 'legal_passenger_capacity' => 4, 'expected_version' => 3])->assertOk();
        $this->assertDatabaseHas('mobility_driver_onboardings', ['id' => $onboardingId, 'legal_passenger_capacity' => 4, 'status' => 'needs_resubmission']);
        $this->assertDatabaseHas('mobility_host_applications', ['id' => $hostApplicationId, 'status' => 'pending']);
        $this->assertFalse(CohortPolicy::hostApproved($applicant->id, $car->id, 'car'));
    }

    public function test_capacity_is_required_and_bike_capacity_is_exactly_one_passenger(): void
    {
        $applicant = User::factory()->create(['active' => true, 'banned' => false]);
        DB::table('mobility_memberships')->insert(['user_id' => $applicant->id, 'college_code' => 'CAMPUS-BLR', 'affiliation' => 'student', 'status' => 'approved', 'version' => 1, 'created_at' => now(), 'updated_at' => now()]);
        $car = Car::factory()->withCatalog()->create(['user_id' => $applicant->id]);

        $this->actingAsApiUser($applicant)->postJson('/api/mobility/driver-onboarding', ['car_id' => $car->id, 'vehicle_type' => 'car', 'profile_display_name' => 'No capacity'])->assertStatus(422)->assertJsonPath('error.code', 'ONBOARDING_INPUT_INVALID');
        $this->actingAsApiUser($applicant)->postJson('/api/mobility/driver-onboarding', ['car_id' => $car->id, 'vehicle_type' => 'bike', 'legal_passenger_capacity' => 2, 'profile_display_name' => 'Invalid bike'])->assertStatus(422)->assertJsonPath('error.code', 'ONBOARDING_INPUT_INVALID');
        $created = $this->actingAsApiUser($applicant)->postJson('/api/mobility/driver-onboarding', ['car_id' => $car->id, 'vehicle_type' => 'bike', 'legal_passenger_capacity' => 1, 'profile_display_name' => 'One passenger'])->assertCreated();
        $this->actingAsApiUser($applicant)->getJson('/api/mobility/driver-onboarding/me')->assertJsonPath('data.0.legal_passenger_capacity', 1);
        $this->assertSame(1, (int) DB::table('mobility_driver_onboardings')->where('id', $created->json('onboarding_id'))->value('legal_passenger_capacity'));
    }

    public function test_onboarding_profile_and_uploaded_documents_are_private_to_the_applicant(): void
    {
        $applicant = User::factory()->create(['active' => true, 'banned' => false]);
        $otherUser = User::factory()->create(['active' => true, 'banned' => false]);
        DB::table('mobility_memberships')->insert(['user_id' => $applicant->id, 'college_code' => 'CAMPUS-BLR', 'affiliation' => 'student', 'status' => 'approved', 'version' => 2, 'created_at' => now(), 'updated_at' => now()]);
        $car = Car::factory()->withCatalog()->create(['user_id' => $applicant->id]);
        $onboardingId = $this->actingAsApiUser($applicant)
            ->postJson('/api/mobility/driver-onboarding', ['car_id' => $car->id, 'vehicle_type' => 'car', 'legal_passenger_capacity' => 4, 'profile_display_name' => 'Synthetic Driver'])
            ->assertCreated()->json('onboarding_id');
        $version = $this->actingAsApiUser($applicant)
            ->post('/api/mobility/driver-onboarding/'.$onboardingId.'/documents', [
                'document_type' => 'rc',
                'document' => UploadedFile::fake()->createWithContent('rc.pdf', "%PDF-synthetic\n"),
                'expires_at' => now()->addYear()->toDateString(),
                'expected_version' => 1,
            ])->assertCreated()->json('onboarding_version');
        $documentId = DB::table('mobility_driver_documents')->where('onboarding_id', $onboardingId)->value('id');

        $this->actingAsApiUser($otherUser)
            ->putJson('/api/mobility/driver-onboarding/'.$onboardingId.'/profile', [
                'profile_display_name' => 'Unauthorized edit', 'legal_passenger_capacity' => 4, 'expected_version' => $version,
            ])->assertForbidden()->assertJsonPath('error.code', 'ONBOARDING_FORBIDDEN');
        $this->actingAsApiUser($otherUser)
            ->getJson('/api/mobility/driver-onboarding/'.$onboardingId.'/documents/'.$documentId)
            ->assertForbidden()->assertJsonPath('error.code', 'ONBOARDING_FORBIDDEN');
        $this->assertDatabaseHas('mobility_driver_onboardings', ['id' => $onboardingId, 'profile_display_name' => 'Synthetic Driver']);
        $this->assertDatabaseHas('mobility_driver_documents', ['id' => $documentId, 'onboarding_id' => $onboardingId]);
    }
}
