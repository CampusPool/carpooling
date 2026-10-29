<?php
declare(strict_types=1);

require '/var/www/vendor/autoload.php';
$app = require '/var/www/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

/**
 * Exercises simultaneous acceptance of two pending requests for one seat on
 * the supported commute API. This runs only in the runner's disposable DB.
 */
const BASE_URL = 'http://127.0.0.1:8000/api/mobility/commute';

function fail(string $message): never
{
    fwrite(STDERR, "FAIL: {$message}\n");
    exit(1);
}

function request(string $method, string $path, ?string $token = null, array $body = [], ?string $key = null): array
{
    $headers = ['Accept: application/json', 'Content-Type: application/json'];
    if ($token !== null) $headers[] = 'Authorization: Bearer '.$token;
    if ($key !== null) $headers[] = 'Idempotency-Key: '.$key;
    $curl = curl_init(BASE_URL.$path);
    curl_setopt_array($curl, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => $body === [] ? null : json_encode($body, JSON_THROW_ON_ERROR),
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 20,
    ]);
    $response = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $error = curl_error($curl);
    if (! is_string($response)) fail('HTTP transport failed: '.$error);
    $json = json_decode($response, true);
    if (! is_array($json)) fail("Non-JSON response (HTTP {$status})");
    return [$status, $json];
}

function expectStatus(int $status, array $json, int $expected, string $label): array
{
    if ($status !== $expected) {
        $code = $json['error']['code'] ?? 'unknown';
        fail("{$label}: expected HTTP {$expected}, received {$status} ({$code})");
    }
    return $json;
}

function demo(string $role, string $key, ?string $scenario = null): array
{
    $body = ['role' => $role];
    if ($scenario !== null) $body['scenario'] = $scenario;
    [$status, $json] = request('POST', '/demo-session', null, $body, $key);
    return expectStatus($status, $json, 200, "create {$role} demo session");
}

function profile(string $token, string $role, string $key): void
{
    $prefs = [
        'role' => $role,
        'vehicle_preference' => 'both',
        'schedule_mode' => 'fixed',
        'home' => ['lat' => 12.9716, 'lng' => 77.5946, 'label' => 'Race test home'],
        'campus' => ['lat' => 12.9352, 'lng' => 77.62, 'label' => 'Race test campus'],
        'outbound_time' => '08:30',
        'return_time' => '17:30',
        'weekdays' => [1, 2, 3, 4, 5],
    ];
    [$status, $json] = request('PUT', '/profile', $token, $prefs, $key);
    expectStatus($status, $json, 200, "set {$role} profile");
}

$run = bin2hex(random_bytes(6));
$driver = demo('driver', $run.'-driver')['token'];
$riderASession = demo('rider', $run.'-rider-a');
$riderBSession = demo('rider', $run.'-rider-b', 'campus-route');
$riderA = $riderASession['token'];
$riderB = $riderBSession['token'];
if ((int) $riderASession['user']['id'] === (int) $riderBSession['user']['id']) {
    fail('race riders are not independent accounts');
}
profile($driver, 'driver', $run.'-driver-profile');
profile($riderA, 'rider', $run.'-rider-a-profile');
profile($riderB, 'rider', $run.'-rider-b-profile');

$date = (new DateTimeImmutable('tomorrow', new DateTimeZone('Asia/Kolkata')))->format('Y-m-d');
[$status, $json] = request('POST', '/offers', $driver, [
    'date' => $date,
    'direction' => 'outbound',
    'vehicle_type' => 'car',
    'choice' => 'DIRECT_RIDER_PICKUP',
], $run.'-offer');
$tripId = (int) expectStatus($status, $json, 200, 'publish one-seat offer')['data']['trip_id'];

$quotes = [];
foreach ([[$riderA, 'a'], [$riderB, 'b']] as [$token, $suffix]) {
    [$status, $json] = request('GET', '/rides?date='.$date.'&direction=outbound&vehicle_type=car', $token);
    $cards = expectStatus($status, $json, 200, "discover ride for rider {$suffix}")['data'] ?? [];
    $card = $cards[0] ?? null;
    if (! is_array($card) || (int) $card['trip_id'] !== $tripId) {
        fwrite(STDERR, json_encode(['date' => $date, 'trip_id' => $tripId, 'cards' => $cards, 'response' => $json], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)."\n");
        fail("rider {$suffix} did not receive the test offer");
    }
    $quotes[] = [$token, $suffix, $card['quote_token']];
}

$bookingIds = [];
foreach ($quotes as [$token, $suffix, $quoteToken]) {
    [$status, $json] = request('POST', '/rides/'.$tripId.'/request', $token, ['quote_token' => $quoteToken], $run.'-request-'.$suffix);
    $bookingIds[] = (int) expectStatus($status, $json, 200, "create pending request {$suffix}")['data']['booking_id'];
}
if (count(array_unique($bookingIds)) !== 2) {
    fail('riders did not create two distinct passenger bookings');
}
$passengers = \Illuminate\Support\Facades\DB::table('trip_passengers')
    ->whereIn('id', $bookingIds)->orderBy('id')->get(['id', 'user_id', 'trip_id']);
$riderIds = [(int) $riderASession['user']['id'], (int) $riderBSession['user']['id']];
if ($passengers->count() !== 2
    || $passengers->pluck('user_id')->map(fn ($id): int => (int) $id)->unique()->count() !== 2
    || $passengers->pluck('user_id')->map(fn ($id): int => (int) $id)->sort()->values()->all() !== collect($riderIds)->sort()->values()->all()
    || $passengers->pluck('trip_id')->map(fn ($id): int => (int) $id)->unique()->all() !== [$tripId]) {
    fail('pending bookings are not two durable passenger rows for the distinct riders and target trip');
}

// A database trigger records and holds the first acceptance inside its
// transaction. Both independent HTTP clients start in the same multi handle.
$trigger = 'commute_race_'.$run;
$observations = $trigger.'_observations';
\Illuminate\Support\Facades\DB::statement("CREATE TABLE `{$observations}` (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, fired_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6))");
\Illuminate\Support\Facades\DB::unprepared(
    "CREATE TRIGGER `{$trigger}` BEFORE UPDATE ON trip_passengers FOR EACH ROW " .
    "BEGIN IF OLD.request_state = 0 AND NEW.request_state = 1 THEN INSERT INTO `{$observations}` () VALUES (); DO SLEEP(1); END IF; END"
);
register_shutdown_function(static function () use ($trigger, $observations): void {
    try {
        \Illuminate\Support\Facades\DB::unprepared("DROP TRIGGER IF EXISTS `{$trigger}`");
        \Illuminate\Support\Facades\DB::statement("DROP TABLE IF EXISTS `{$observations}`");
    } catch (\Throwable) {
        // The runner also destroys the uniquely named disposable DB on errors.
    }
});

$accepts = [
    [$driver, $bookingIds[0], $run.'-accept-a'],
    [$driver, $bookingIds[1], $run.'-accept-b'],
];
$handles = [];
foreach ($accepts as [$token, $bookingId, $key]) {
    $curl = curl_init(BASE_URL.'/bookings/'.$bookingId.'/accept');
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Accept: application/json',
            'Content-Type: application/json',
            'Authorization: Bearer '.$token,
            'Idempotency-Key: '.$key,
        ],
        CURLOPT_POSTFIELDS => '{}',
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 15,
    ]);
    $handles[] = $curl;
}
$multi = curl_multi_init();
foreach ($handles as $curl) curl_multi_add_handle($multi, $curl);
$raceStartedAt = microtime(true);
do {
    $multiStatus = curl_multi_exec($multi, $active);
    if ($active > 0) curl_multi_select($multi, 0.1);
} while ($active > 0 && $multiStatus === CURLM_OK);
$raceElapsed = microtime(true) - $raceStartedAt;

$results = [];
foreach ($handles as $i => $curl) {
    $raw = curl_multi_getcontent($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $json = is_string($raw) ? json_decode($raw, true) : null;
    if (! is_array($json)) fail('Concurrent accept returned non-JSON response');
    $results[] = ['booking_id' => $bookingIds[$i], 'status' => $status, 'total_time' => (float) curl_getinfo($curl, CURLINFO_TOTAL_TIME), 'body' => $json];
    curl_multi_remove_handle($multi, $curl);
}
curl_multi_close($multi);

\Illuminate\Support\Facades\DB::unprepared("DROP TRIGGER IF EXISTS `{$trigger}`");
$triggerFirings = (int) \Illuminate\Support\Facades\DB::table($observations)->count();
\Illuminate\Support\Facades\DB::statement("DROP TABLE IF EXISTS `{$observations}`");
if ($triggerFirings !== 1 || $raceElapsed < 0.9) {
    fail('the single-seat acceptance was not demonstrably held during the concurrent HTTP sample');
}
$contended = array_values(array_filter($results, fn (array $r): bool => $r['status'] !== 200));
$contendedResponseProvesOverlap = count($contended) === 1
    && (($contended[0]['status'] === 409 && ($contended[0]['body']['error']['code'] ?? null) === 'COMMUTE_BUSY_RETRY')
        || ($contended[0]['status'] === 422 && ($contended[0]['body']['error']['code'] ?? null) === 'NOT_SEAT_AVAILABLE' && $contended[0]['total_time'] >= 0.9));
if (! $contendedResponseProvesOverlap) {
    fail('the losing concurrent request did not encounter the held trip lock or wait through its release');
}

$busyRetries = [];
foreach ($results as $i => $result) {
    for ($attempt = 1; $attempt <= 5 && $result['status'] === 409 && ($result['body']['error']['code'] ?? null) === 'COMMUTE_BUSY_RETRY'; $attempt++) {
        usleep(100_000 * $attempt);
        [$retryStatus, $retryBody] = request('POST', '/bookings/'.$bookingIds[$i].'/accept', $driver, [], $run.'-retry-'.$i.'-'.$attempt);
        $busyRetries[] = ['booking_id' => $bookingIds[$i], 'attempt' => $attempt, 'status' => $retryStatus, 'error_code' => $retryBody['error']['code'] ?? null];
        $result['status'] = $retryStatus;
        $result['body'] = $retryBody;
    }
    $results[$i] = $result;
}

$accepted = array_values(array_filter($results, fn (array $r): bool => $r['status'] === 200));
$rejected = array_values(array_filter($results, fn (array $r): bool => $r['status'] === 422 && ($r['body']['error']['code'] ?? null) === 'NOT_SEAT_AVAILABLE'));
if (count($accepted) !== 1 || count($rejected) !== 1) {
    fwrite(STDERR, json_encode(['trip_id' => $tripId, 'results' => $results], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)."\n");
    fail('expected exactly one accepted and one NOT_SEAT_AVAILABLE response');
}

$states = \Illuminate\Support\Facades\DB::table('trip_passengers')->whereIn('id', $bookingIds)->orderBy('id')->pluck('request_state')->map(fn ($v): int => (int) $v)->all();
if (count(array_filter($states, fn (int $state): bool => $state === 1)) !== 1 || count(array_filter($states, fn (int $state): bool => $state === 0)) !== 1) {
    fail('database does not contain exactly one accepted and one pending booking');
}

fwrite(STDOUT, json_encode([
    'result' => 'PASS',
    'trip_id' => $tripId,
    'rider_ids' => [(int) $riderASession['user']['id'], (int) $riderBSession['user']['id']],
    'simultaneous_accepts' => array_map(fn (array $r): array => ['booking_id' => $r['booking_id'], 'http_status' => $r['status'], 'elapsed_seconds' => round($r['total_time'], 3), 'error_code' => $r['body']['error']['code'] ?? null], $results),
    'booking_states' => $states,
    'busy_retries' => $busyRetries,
    'race_sample' => ['elapsed_seconds' => round($raceElapsed, 3), 'trigger_firings' => $triggerFirings, 'forced_hold_seconds' => 1],
    'note' => 'Synthetic sampled race: two independent HTTP clients were launched together; a test-only trigger recorded and held one passenger-state update inside the disposable MySQL transaction.',
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)."\n");
