<?php

// Run once with the configured application bootstrap after reviewing these public stops.
// Coordinates were resolved with Google Places and snapped to the preserved road graph.
require '/var/www/vendor/autoload.php';
$app = require '/var/www/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

$college = \STS\Mobility\Trust\CohortPolicy::college();
if (!$college) throw new RuntimeException('College configuration is missing');

$points = [
    [91001, 'PES University Ring Road', 12.935149, 77.533656],
    [91002, 'Pantharapalya – Nayandahalli Metro', 12.941782, 77.525226],
    [91003, 'PES University Electronic City Campus', 12.861891, 77.663893],
];

DB::transaction(function () use ($points, $college): void {
    foreach ($points as [$id, $name, $lat, $lng]) {
        $existing = DB::table('mobility_pickup_points')->where('id', $id)->lockForUpdate()->first();
        if ($existing) {
            if ($existing->name !== $name || $existing->college_code !== $college) {
                throw new RuntimeException('Pickup identifier is already in use');
            }
            continue;
        }
        if (DB::table('nodes_geo')->where('id', $id)->exists()) {
            throw new RuntimeException('Node identifier is already in use');
        }
        DB::table('nodes_geo')->insert(['id' => $id, 'name' => $name, 'lat' => $lat, 'lng' => $lng, 'type' => 'campus_pickup']);
        DB::table('mobility_pickup_points')->insert([
            'id' => $id, 'canonical_node_id' => $id, 'college_code' => $college, 'version' => 1,
            'name' => $name, 'lat' => $lat, 'lng' => $lng,
            'vehicle_modes' => json_encode(['car', 'bike']), 'active' => true,
            'verified_at' => now(), 'synthetic_only' => false, 'created_at' => now(), 'updated_at' => now(),
        ]);
    }
});
echo "Campus pickup catalog prepared.\n";
