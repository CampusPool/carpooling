<?php

// This returns invented metrics. It is deliberately not a road routing engine.
if (getenv('APP_ENV') !== 'testing' || getenv('MOBILITY_SYNTHETIC_ROUTING_FIXTURE') !== 'true') {
    http_response_code(404);
    exit;
}
header('Content-Type: application/json');
header('Cache-Control: no-store');
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (! preg_match('~^/route/v1/(synthetic-car|synthetic-motorbike)/([^/]+)$~D', $path, $match)) {
    http_response_code(400); echo json_encode(['code' => 'NoSegment', 'mobility_synthetic' => true]); exit;
}
$pairs = explode(';', $match[2]);
$valid = static function (string $pair): bool {
    $parts = explode(',', $pair);
    return count($parts) === 2 && is_numeric($parts[0]) && is_numeric($parts[1])
        && (float) $parts[0] >= 77.0 && (float) $parts[0] <= 78.0
        && (float) $parts[1] >= 12.0 && (float) $parts[1] <= 14.0;
};
if (count($pairs) !== 2 || $pairs[0] === $pairs[1] || ! $valid($pairs[0]) || ! $valid($pairs[1])) {
    http_response_code(400); echo json_encode(['code' => 'NoSegment', 'mobility_synthetic' => true]); exit;
}
$points = array_map(static fn ($pair) => array_map('floatval', explode(',', $pair)), $pairs);
 $mode = $match[1] === 'synthetic-car' ? 'car' : 'bike';
echo json_encode(['code' => 'Ok', 'mobility_synthetic' => true,
    'data_version' => $mode.'|crop_sha256='.str_repeat('a', 64).'|profile_sha256='.str_repeat('b', 64),
    'routes' => [['distance' => 2500, 'duration' => 600, 'legs' => [['distance' => 2500, 'duration' => 600]], 'geometry' => ['type' => 'LineString', 'coordinates' => $points]]],
    'waypoints' => array_map(static fn ($point) => ['distance' => 0, 'location' => $point], $points)]);
