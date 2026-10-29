<?php
declare(strict_types=1);

// Separate CLI process exercising the guarded commute HTTP surface against
// the disposable app/MySQL stack. Routing metrics come from the labeled local
// fixture; booking and policy services remain the real application services.
require '/var/www/vendor/autoload.php';
$app = require '/var/www/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;
use STS\Models\Passenger;
use STS\Mobility\Trust\CohortPolicy;

$report = [
    'source_revision' => '6ba3d8913a8f77e664e848a526f196690a03c1e8',
    'started_at' => gmdate(DATE_ATOM),
    'method' => 'Separate PHP CLI process issuing HTTP/JWT requests to the cohort-guarded app server',
    'fixture' => 'Two built-in demo actors with approved synthetic memberships; invented OSRM-shaped route metrics from an internal fixture server; no real road provider, rider identity, payment or money.',
    'steps' => [],
    'checks' => [],
];

function api(string $method, string $path, array $body = [], ?string $token = null, ?string $key = null): array
{
    $headers = ['Accept: application/json', 'Content-Type: application/json'];
    if ($token !== null) $headers[] = 'Authorization: Bearer '.$token;
    if ($key !== null) $headers[] = 'Idempotency-Key: '.$key;
    $options = ['method' => $method, 'header' => implode("\r\n", $headers), 'ignore_errors' => true, 'timeout' => 20];
    if ($method !== 'GET') $options['content'] = json_encode($body, JSON_THROW_ON_ERROR);
    $raw = @file_get_contents('http://127.0.0.1:8000/api/'.$path, false, stream_context_create(['http' => $options]));
    $status = 0;
    foreach ($http_response_header ?? [] as $line) {
        if (preg_match('/^HTTP\/\S+ (\d+)/', $line, $match)) $status = (int) $match[1];
    }
    return ['status' => $status, 'json' => json_decode($raw ?: '', true)];
}

function step(string $name, array $response, int $expected = 200): array
{
    global $report;
    $code = $response['json']['error']['code'] ?? null;
    $report['steps'][] = ['name' => $name, 'status' => $response['status'], 'expected' => $expected, 'error_code' => $code];
    if ($response['status'] !== $expected) throw new RuntimeException($name.' returned '.$response['status'].' ('.(is_string($code) ? $code : 'no machine code').')');
    return $response['json'] ?? [];
}

function check(string $name, bool $passed, array $observed = []): void
{
    global $report;
    $report['checks'][] = ['name' => $name, 'passed' => $passed, 'observed' => $observed];
    if (!$passed) throw new RuntimeException($name.' failed: '.json_encode($observed));
}

try {
    $suffix = bin2hex(random_bytes(5));
    check('cohort guard is enabled with a synthetic college', CohortPolicy::required() && CohortPolicy::college() === 'SYNTHETIC-LOCAL', [
        'required' => CohortPolicy::required(), 'college' => CohortPolicy::college(),
    ]);
    $riderSession = step('rider demo session', api('POST', 'mobility/commute/demo-session', ['role' => 'rider']));
    $driverSession = step('driver demo session', api('POST', 'mobility/commute/demo-session', ['role' => 'driver']));
    $rider = $riderSession['user'] ?? [];
    $driver = $driverSession['user'] ?? [];
    $riderToken = $riderSession['token'] ?? null;
    $driverToken = $driverSession['token'] ?? null;
    if (!is_int($rider['id'] ?? null) || !is_int($driver['id'] ?? null) || !is_string($riderToken) || !is_string($driverToken)) {
        throw new RuntimeException('Demo session response lacks actor ids or tokens');
    }
    check('separate rider and driver actors', $rider['id'] !== $driver['id']);
    check('synthetic host is approved by the demo policy', ($driverSession['driver_approved'] ?? false) === true);

    $profile = static function (string $role): array {
        return [
            'role' => $role, 'vehicle_preference' => 'both', 'schedule_mode' => 'fixed',
            'home' => ['lat' => 12.9716, 'lng' => 77.5946, 'label' => 'Synthetic home'],
            'campus' => ['lat' => 12.9352, 'lng' => 77.6200, 'label' => 'Synthetic campus'],
            'outbound_time' => '08:30', 'return_time' => '17:30', 'weekdays' => [1, 2, 3, 4, 5],
        ];
    };
    step('save rider commute profile', api('PUT', 'mobility/commute/profile', $profile('rider'), $riderToken));
    step('save driver commute profile', api('PUT', 'mobility/commute/profile', $profile('driver'), $driverToken));

    $date = now('Asia/Kolkata')->addDay()->toDateString();
    step('driver publishes synthetic commute', api('POST', 'mobility/commute/offers', [
        'date' => $date, 'direction' => 'outbound', 'vehicle_type' => 'car', 'choice' => 'DIRECT_RIDER_PICKUP',
    ], $driverToken, 'commute-smoke-'.$suffix.'-offer'));
    $rides = step('rider discovers commute', api('GET', 'mobility/commute/rides?date='.$date.'&direction=outbound&vehicle_type=car', [], $riderToken));
    $cards = $rides['data'] ?? [];
    if (count($cards) !== 1 || !is_string($cards[0]['quote_token'] ?? null) || !is_int($cards[0]['trip_id'] ?? null)) {
        throw new RuntimeException('Expected one discoverable synthetic commute with a quote token');
    }
    $card = $cards[0];
    $booking = step('rider requests quoted seat', api('POST', 'mobility/commute/rides/'.$card['trip_id'].'/request', [
        'quote_token' => $card['quote_token'],
    ], $riderToken, 'commute-smoke-'.$suffix.'-request'));
    $bookingId = $booking['data']['booking_id'] ?? null;
    if (!is_int($bookingId)) throw new RuntimeException('Request response lacks booking id');
    $passenger = Passenger::findOrFail($bookingId);
    check('request persisted with expected trip and rider', (int) $passenger->trip_id === (int) $card['trip_id']
        && (int) $passenger->user_id === (int) $rider['id'], [
            'trip_id_matches' => (int) $passenger->trip_id === (int) $card['trip_id'],
            'rider_id_matches' => (int) $passenger->user_id === (int) $rider['id'],
        ]);
    check('request persisted as pending', (int) $passenger->request_state === Passenger::STATE_PENDING);

    $accepted = step('driver accepts booking', api('POST', 'mobility/commute/bookings/'.$bookingId.'/accept', [], $driverToken, 'commute-smoke-'.$suffix.'-accept'));
    check('accept persisted as accepted', (int) Passenger::findOrFail($bookingId)->request_state === Passenger::STATE_ACCEPTED,
        ['request_state' => (int) Passenger::findOrFail($bookingId)->request_state]);
    check('accept response identifies the accepted booking', (int) ($accepted['data']['booking_id'] ?? 0) === $bookingId);

    $cancelled = step('rider cancels accepted booking', api('POST', 'mobility/commute/bookings/'.$bookingId.'/cancel', [], $riderToken, 'commute-smoke-'.$suffix.'-cancel'));
    $state = (int) Passenger::findOrFail($bookingId)->request_state;
    check('cancellation persisted', $state === Passenger::STATE_CANCELED, ['request_state' => $state]);
    check('cancel response identifies the cancelled booking', (int) ($cancelled['data']['booking_id'] ?? 0) === $bookingId);

    $memberships = DB::table('mobility_memberships')->whereIn('user_id', [$rider['id'], $driver['id']])
        ->where('college_code', CohortPolicy::college())->where('status', 'approved')->count();
    check('both HTTP actors have approved cohort membership', $memberships === 2, ['approved_memberships' => $memberships]);
    $report['completed'] = true;
} catch (Throwable $error) {
    $report['completed'] = false;
    $report['failure'] = $error->getMessage();
}

$report['finished_at'] = gmdate(DATE_ATOM);
$report['all_checks_passed'] = ($report['completed'] ?? false) && !in_array(false, array_column($report['checks'], 'passed'), true);
file_put_contents('/opt/mobility/results/commute-http-latest.json', json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)."\n");
echo json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)."\n";
exit($report['all_checks_passed'] ? 0 : 1);
