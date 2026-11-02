<?php

// This returns invented metrics. It is deliberately not a road routing engine.
if (getenv('APP_ENV') !== 'testing' || getenv('MOBILITY_SYNTHETIC_ROUTING_FIXTURE') !== 'true') {
    http_response_code(404);
    exit;
}
header('Content-Type: application/json');
header('Cache-Control: no-store');
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (! preg_match('~^/route/v1/(synthetic-car|synthetic-motorbike|synthetic-foot)/([^/]+)$~D', $path, $match)) {
    http_response_code(400); echo json_encode(['code' => 'NoSegment', 'mobility_synthetic' => true]); exit;
}
$pairs = explode(';', $match[2]);
$valid = static function (string $pair): bool {
    $parts = explode(',', $pair);
    return count($parts) === 2 && is_numeric($parts[0]) && is_numeric($parts[1])
        && (float) $parts[0] >= 77.0 && (float) $parts[0] <= 78.0
        && (float) $parts[1] >= 12.0 && (float) $parts[1] <= 14.0;
};
if (count($pairs) < 2 || count($pairs) > 8 || array_filter($pairs, static fn ($pair) => ! $valid($pair)) !== []) {
    http_response_code(400); echo json_encode(['code' => 'NoSegment', 'mobility_synthetic' => true]); exit;
}
$points = array_map(static fn ($pair) => array_map('floatval', explode(',', $pair)), $pairs);
$mode = match ($match[1]) {
    'synthetic-car' => 'car',
    'synthetic-motorbike' => 'bike',
    default => 'foot',
};
$legs = [];
$distance = 0;
$duration = 0;
for ($i = 1; $i < count($points); $i++) {
    [$fromLng, $fromLat] = $points[$i - 1];
    [$toLng, $toLat] = $points[$i];
    $meters = (int) round(hypot(($toLat - $fromLat) * 111000, ($toLng - $fromLng) * 100000));
    $meters = $meters < 1 ? 0 : max(100, $meters);
    $seconds = $meters === 0 ? 0 : max(1, (int) ceil($meters / ($mode === 'foot' ? 1.3 : 8)));
    $legs[] = ['distance' => $meters, 'duration' => $seconds];
    $distance += $meters;
    $duration += $seconds;
}
$version = $mode === 'foot'
    ? 'foot|crop_sha256='.str_repeat('c', 64).'|profile_sha256='.str_repeat('d', 64)
    : $mode.'|crop_sha256='.str_repeat('a', 64).'|profile_sha256='.str_repeat('b', 64);
echo json_encode(['code' => 'Ok', 'mobility_synthetic' => true, 'data_version' => $version,
    'routes' => [['distance' => $distance, 'duration' => $duration, 'legs' => $legs, 'geometry' => ['type' => 'LineString', 'coordinates' => $points]]],
    'waypoints' => array_map(static fn ($point) => ['distance' => 0, 'location' => $point], $points)]);
