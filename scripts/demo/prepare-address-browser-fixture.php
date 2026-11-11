<?php
/** Synthetic approved actors for an isolated HTTP/browser integration run. */
require getcwd().'/vendor/autoload.php';
$app = require getcwd().'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;
use STS\Mobility\Trust\CohortPolicy;
use STS\Mobility\Trust\DriverOnboardingPolicy;
use STS\Models\Car;
use STS\Models\User;

if (!app()->environment('testing') || DB::connection()->getDatabaseName() !== 'testing_address_browser') {
    throw new RuntimeException('Only testing_address_browser with APP_ENV=testing is permitted.');
}
$destination = $argv[1] ?? '';
if (!str_starts_with($destination, '/tmp/') || !str_ends_with($destination, '.json')) {
    throw new RuntimeException('Provide a private /tmp/*.json output path.');
}
$fixture = DB::transaction(function (): array {
    $actors = [];
    foreach (['driver', 'rider', 'outsider'] as $index => $role) {
        $email = 'browser.'.$role.'.'.bin2hex(random_bytes(4)).'@stu.pes.edu';
        $user = User::factory()->create(['name' => 'Synthetic Browser '.ucfirst($role), 'email' => $email, 'active' => true, 'banned' => false]);
        DB::table('mobility_memberships')->insert(['user_id' => $user->id, 'college_code' => 'CAMPUS-BLR', 'affiliation' => 'student', 'status' => 'approved', 'version' => 1, 'created_at' => now(), 'updated_at' => now()]);
        DB::table('mobility_verified_identities')->insert(['user_id' => $user->id, 'provider' => 'college_email_otp', 'email' => $email, 'domain' => 'stu.pes.edu', 'verified_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
        DB::table('mobility_student_profiles')->insert(['user_id' => $user->id, 'srn_normalized' => 'BROWSER'.strtoupper(bin2hex(random_bytes(6))), 'campus_code' => 'CAMPUS-BLR', 'gender_identity' => 'prefer_not_to_say', 'phone_e164' => '+91999999999'.$index, 'created_at' => now(), 'updated_at' => now()]);
        $actors[$role] = ['id' => $user->id, 'token' => auth('api')->fromUser($user)];
        if ($role !== 'driver') continue;
        $car = Car::factory()->withCatalog()->create(['user_id' => $user->id]);
        $fingerprint = CohortPolicy::vehicleFingerprint($car);
        $application = DB::table('mobility_host_applications')->insertGetId(['user_id' => $user->id, 'car_id' => $car->id, 'vehicle_type' => 'car', 'vehicle_fingerprint' => $fingerprint, 'status' => 'approved', 'version' => 1, 'created_at' => now(), 'updated_at' => now()]);
        $onboarding = DB::table('mobility_driver_onboardings')->insertGetId(['user_id' => $user->id, 'host_application_id' => $application, 'car_id' => $car->id, 'vehicle_type' => 'car', 'legal_passenger_capacity' => 4, 'vehicle_fingerprint' => $fingerprint, 'profile_display_name' => 'Synthetic Browser Driver', 'status' => 'approved', 'version' => 1, 'created_at' => now(), 'updated_at' => now()]);
        foreach (DriverOnboardingPolicy::requiredTypes() as $type) DB::table('mobility_driver_documents')->insert(['onboarding_id' => $onboarding, 'document_type' => $type, 'version' => 1, 'storage_path' => 'synthetic-browser/'.$type, 'mime_type' => 'application/pdf', 'byte_size' => 1, 'expires_at' => now()->addYear()->toDateString(), 'status' => 'accepted', 'submitted_by' => $user->id, 'reviewed_by' => $user->id, 'reviewed_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
        $actors[$role]['car_id'] = $car->id;
    }
    return ['synthetic' => true, 'database' => DB::connection()->getDatabaseName(), 'actors' => $actors];
});
umask(0077);
if (file_put_contents($destination, json_encode($fixture, JSON_THROW_ON_ERROR)) === false) throw new RuntimeException('Could not write fixture.');
chmod($destination, 0600);
echo "Synthetic browser fixture prepared in testing_address_browser. Tokens written privately.\n";
