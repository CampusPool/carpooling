<?php

// Reuses the explicitly gated local seed; never accepts or changes a real user.
if (PHP_SAPI !== 'cli' || getenv('APP_ENV') !== 'testing' || getenv('MOBILITY_COLLEGE_CODE') !== 'SYNTHETIC-LOCAL'
    || getenv('MOBILITY_ROUTING_SYNTHETIC_ONLY') !== 'true') {
    fwrite(STDERR, "Start the explicitly synthetic routing pilot before seeding.\n");
    exit(2);
}
require __DIR__.'/seed-local-pilot.php';

use Illuminate\Support\Facades\DB;
use STS\Mobility\Trust\CohortPolicy;
use STS\Mobility\Trust\DriverOnboardingPolicy;
use STS\Models\NodeGeo;

if (CohortPolicy::college() !== 'SYNTHETIC-LOCAL' || ! config('mobility_routing.synthetic_only')) {
    throw new RuntimeException('Synthetic routing configuration required.');
}
DB::transaction(function () use ($host, $rider, $operator, $car, $nonce): void {
    $reason = 'SYNTHETIC FIXTURE ONLY: no real affiliation, vehicle or identity verification.';
    foreach ([$host, $rider] as $actor) {
        $memberId = DB::table('mobility_memberships')->insertGetId(['user_id' => $actor->id, 'college_code' => 'SYNTHETIC-LOCAL',
            'affiliation' => 'student', 'status' => 'approved', 'version' => 1, 'reviewed_by' => $operator->id,
            'reviewed_at' => now(), 'review_reason' => $reason, 'created_at' => now(), 'updated_at' => now()]);
        DB::table('mobility_membership_audits')->insert(['membership_id' => $memberId, 'user_id' => $actor->id, 'actor_id' => $operator->id,
            'previous_status' => null, 'new_status' => 'approved', 'version' => 1, 'reason' => $reason, 'created_at' => now(), 'updated_at' => now()]);
    }
    // The local demo buttons use these fixture keys to issue their normal
    // testing-only JWTs for the very same approved canonical host and rider.
    DB::table('mobility_commute_demo_actors')->insert([
        ['user_id' => $host->id, 'fixture_key' => 'campus-driver-car', 'created_at' => now(), 'updated_at' => now()],
        ['user_id' => $rider->id, 'fixture_key' => 'campus-rider', 'created_at' => now(), 'updated_at' => now()],
    ]);
    $id = DB::table('mobility_host_applications')->insertGetId(['user_id' => $host->id, 'car_id' => $car->id, 'vehicle_type' => 'car',
        'vehicle_fingerprint' => CohortPolicy::vehicleFingerprint($car), 'status' => 'approved', 'version' => 1, 'reviewed_by' => $operator->id,
        'reviewed_at' => now(), 'review_reason' => $reason, 'created_at' => now(), 'updated_at' => now()]);
    DB::table('mobility_host_application_audits')->insert(['application_id' => $id, 'actor_id' => $operator->id, 'previous_status' => null,
        'new_status' => 'approved', 'version' => 1, 'reason' => $reason, 'created_at' => now(), 'updated_at' => now()]);
    $onboardingId = DB::table('mobility_driver_onboardings')->insertGetId([
        'user_id' => $host->id, 'host_application_id' => $id, 'car_id' => $car->id, 'vehicle_type' => 'car',
        'vehicle_fingerprint' => CohortPolicy::vehicleFingerprint($car), 'profile_display_name' => 'Synthetic Demo Host',
        'profile_phone' => $host->mobile_phone, 'status' => 'approved', 'version' => 1, 'reviewed_by' => $operator->id,
        'submitted_at' => now(), 'reviewed_at' => now(), 'review_reason' => $reason, 'legal_passenger_capacity' => 2,
        'created_at' => now(), 'updated_at' => now(),
    ]);
    DB::table('mobility_driver_onboarding_audits')->insert(['onboarding_id' => $onboardingId, 'actor_id' => $operator->id,
        'previous_status' => null, 'new_status' => 'approved', 'version' => 1, 'reason' => $reason,
        'created_at' => now(), 'updated_at' => now()]);
    foreach (DriverOnboardingPolicy::requiredTypes() as $documentType) {
        DB::table('mobility_driver_documents')->insert([
            'onboarding_id' => $onboardingId, 'document_type' => $documentType, 'version' => 1,
            'storage_path' => 'synthetic-fixtures/'.$nonce.'/'.$documentType.'.txt', 'mime_type' => 'text/plain', 'byte_size' => 32,
            'expires_at' => DriverOnboardingPolicy::expiring($documentType) ? now()->addYear()->toDateString() : null,
            'status' => 'accepted', 'review_reason' => $reason, 'submitted_by' => $host->id,
            'reviewed_by' => $operator->id, 'reviewed_at' => now(), 'created_at' => now(), 'updated_at' => now(),
        ]);
    }
    foreach ([['Synthetic Routing Stop A', 13.0, 77.5], ['Synthetic Routing Stop B', 13.01, 77.51], ['Synthetic Routing Stop C', 13.02, 77.52]] as [$name, $lat, $lng]) {
        $node = NodeGeo::firstOrCreate(['name' => $name, 'type' => 'mobility-synthetic'], ['lat' => $lat, 'lng' => $lng]);
        if ((float) $node->lat !== $lat || (float) $node->lng !== $lng) {
            throw new RuntimeException('Synthetic catalog collision.');
        }
        DB::table('mobility_pickup_points')->updateOrInsert(['college_code' => 'SYNTHETIC-LOCAL', 'name' => $name, 'synthetic_only' => true],
            ['canonical_node_id' => $node->id, 'version' => 1, 'lat' => $lat, 'lng' => $lng, 'vehicle_modes' => json_encode(['car', 'bike']),
                'active' => true, 'verified_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
    }
});
echo "Synthetic route catalog and preapproved test fixtures prepared. No real verification or road metrics.\n";
