<?php
declare(strict_types=1);

// Issue #23 evidence: real HTTP clients against the disposable MySQL stack.
// This probe never prints or persists bearer tokens.
require '/var/www/vendor/autoload.php';
$app = require '/var/www/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\DB;
use STS\Models\Passenger;

$report = [
    'probe' => 'booking-concurrency-probe',
    'started_at' => gmdate(DATE_ATOM),
    'method' => 'real HTTP requests, pcntl fork, and durable MySQL observations',
    'workers' => getenv('PHP_CLI_SERVER_WORKERS') ?: 'unknown',
    'trials' => [],
    'coverage' => '12 sampled overlapping HTTP acceptance races; not a universal concurrency proof',
    'gaps' => ['Synthetic demo actors and fixture routing are used; identity, payment, and provider-backed routing are out of scope.'],
];

function callApi(string $method, string $path, array $data = [], ?string $token = null, ?string $idempotency = null): array
{
    $headers = ['Accept: application/json', 'Content-Type: application/json'];
    if ($token !== null) $headers[] = 'Authorization: Bearer '.$token;
    if ($idempotency !== null) $headers[] = 'Idempotency-Key: '.$idempotency;
    $options = ['http' => ['method' => $method, 'header' => implode("\r\n", $headers), 'ignore_errors' => true, 'timeout' => 30]];
    if ($method !== 'GET') $options['http']['content'] = json_encode($data, JSON_THROW_ON_ERROR);
    $body = @file_get_contents('http://127.0.0.1:8000/api/mobility/commute/'.$path, false, stream_context_create($options));
    $status = 0;
    foreach ($http_response_header ?? [] as $line) if (preg_match('/^HTTP\/\S+ (\d+)/', $line, $m)) $status = (int) $m[1];
    return ['status' => $status, 'json' => json_decode($body ?: '', true)];
}

function requireOk(array $response, string $label): array
{
    if ($response['status'] !== 200) { $code = $response['json']['error']['code'] ?? $response['json']['message'] ?? (($response['json']['errors'] ?? []) ? implode(',', array_keys($response['json']['errors'])) : 'unknown'); throw new RuntimeException($label.' returned HTTP '.$response['status'].' ('.$code.')'); }
    return $response['json'] ?? [];
}

function concurrentAccepts(int $a, int $b, string $token): array
{
    DB::disconnect();
    $start = microtime(true) + 0.2;
    $children = [];
    foreach ([$a, $b] as $booking) {
        $sockets = stream_socket_pair(STREAM_PF_UNIX, STREAM_SOCK_STREAM, 0);
        if ($sockets === false) throw new RuntimeException('Cannot create client result pipe');
        $pid = pcntl_fork();
        if ($pid === -1) throw new RuntimeException('pcntl_fork failed');
        if ($pid === 0) {
            fclose($sockets[0]);
            while (microtime(true) < $start) usleep(500);
            $started = microtime(true);
            $r = callApi('POST', 'bookings/'.$booking.'/accept', [], $token, 'probe-accept-'.$booking);
            // Only whitelisted observations leave children; never credentials or bodies.
            fwrite($sockets[1], json_encode(['booking_id' => $booking, 'status' => $r['status'], 'code' => $r['json']['error']['code'] ?? null, 'started' => $started, 'finished' => microtime(true)], JSON_THROW_ON_ERROR));
            fclose($sockets[1]);
            exit(0);
        }
        fclose($sockets[1]);
        $children[] = [$pid, $sockets[0]];
    }
    $responses = [];
    foreach ($children as [$pid, $socket]) {
        $json = stream_get_contents($socket);
        fclose($socket);
        pcntl_waitpid($pid, $status);
        if (!pcntl_wifexited($status) || pcntl_wexitstatus($status) !== 0) throw new RuntimeException('Contention client failed');
        $responses[] = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
    }
    return $responses;
}

try {
    $driver = requireOk(callApi('POST', 'demo-session', ['role' => 'driver']), 'driver demo session');
    $riderA = requireOk(callApi('POST', 'demo-session', ['role' => 'rider']), 'rider demo session');
    $riderB = requireOk(callApi('POST', 'demo-session', ['role' => 'rider', 'scenario' => 'campus-route']), 'second rider demo session');
    $driverToken = $driver['token'];
    $riderAToken = $riderA['token'];
    $riderBToken = $riderB['token'];
    $prefs = static fn (string $role): array => ['role' => $role, 'vehicle_preference' => 'both', 'schedule_mode' => 'fixed', 'home' => ['lat' => 12.9716, 'lng' => 77.5946, 'label' => 'Demo home'], 'campus' => ['lat' => 12.9352, 'lng' => 77.62, 'label' => 'Demo campus'], 'outbound_time' => '09:00', 'return_time' => '17:30', 'weekdays' => [1, 2, 3, 4, 5, 6, 7]];
    if (DB::connection()->getDriverName() !== 'mysql' || getenv('PHP_CLI_SERVER_WORKERS') !== '4') throw new RuntimeException('Probe requires isolated MySQL and four HTTP workers');
    $trialCount = 12;
    for ($i = 0; $i < $trialCount; $i++) {
        $date = (new DateTimeImmutable('now', new DateTimeZone('Asia/Kolkata')))->modify('+'.(2 + $i).' day')->format('Y-m-d');
        $time = sprintf('09:%02d', $i);
        foreach ([[$driverToken, 'driver'], [$riderAToken, 'rider'], [$riderBToken, 'rider']] as [$token, $role]) {
            $p = $prefs($role); $p['outbound_time'] = $time;
            requireOk(callApi('PUT', 'profile', $p, $token), 'profile '.$role.' trial '.$i);
        }
        $published = requireOk(callApi('POST', 'offers', ['date' => $date, 'direction' => 'outbound', 'vehicle_type' => 'car', 'choice' => 'DIRECT_RIDER_PICKUP'], $driverToken, 'probe-publish-'.$i), 'publish trial '.$i);
        $trip = (int) $published['data']['trip_id'];
        $cards = [];
        foreach ([$riderAToken, $riderBToken] as $token) {
            $found = requireOk(callApi('GET', 'rides?direction=outbound&date='.$date.'&vehicle_type=car', [], $token), 'search trial '.$i)['data'];
            $card = collect($found)->firstWhere('trip_id', $trip);
            if (!$card) throw new RuntimeException('Published contention trip is not discoverable');
            $cards[] = $card;
        }
        $bookings = [];
        foreach ([[$riderAToken, $cards[0]], [$riderBToken, $cards[1]]] as $n => [$token, $card]) {
            $bookings[] = (int) requireOk(callApi('POST', 'rides/'.$trip.'/request', ['quote_token' => $card['quote_token']], $token, 'probe-request-'.$i.'-'.$n), 'request '.$n.' trial '.$i)['data']['booking_id'];
        }
        $responses = concurrentAccepts($bookings[0], $bookings[1], $driverToken);
        $accepted = (int) DB::table('trip_passengers')->where('trip_id', $trip)->where('request_state', Passenger::STATE_ACCEPTED)->count();
        $pending = (int) DB::table('trip_passengers')->where('trip_id', $trip)->where('request_state', Passenger::STATE_PENDING)->count();
        $winners = array_values(array_filter($responses, fn ($r) => $r['status'] === 200));
        $losers = array_values(array_filter($responses, fn ($r) => ($r['status'] === 409 && $r['code'] === 'COMMUTE_BUSY_RETRY') || ($r['status'] === 422 && $r['code'] === 'NOT_SEAT_AVAILABLE')));
        $overlap = max(array_column($responses, 'started')) < min(array_column($responses, 'finished'));
        $terms = (int) DB::table('mobility_commute_booking_terms')->whereIn('booking_id', $bookings)->count();
        $retry = count($losers) === 1 ? callApi('POST', 'bookings/'.$losers[0]['booking_id'].'/accept', [], $driverToken, 'probe-retry-'.$trip) : ['status' => 0, 'json' => []];
        $retryCode = $retry['json']['error']['code'] ?? null;
        $pass = $accepted === 1 && $pending === 1 && $terms === 2 && $overlap && count($winners) === 1 && count($losers) === 1 && $retry['status'] === 422 && $retryCode === 'NOT_SEAT_AVAILABLE';
        $pass = $pass && DB::table('trip_passengers')->where('trip_id', $trip)->where('request_state', 1)->count() === 1 && DB::table('trip_passengers')->where('trip_id', $trip)->where('request_state', 0)->count() === 1;
        $report['trials'][] = ['trial' => $i + 1, 'trip_id' => $trip, 'capacity' => 1, 'accepted_rows' => $accepted, 'pending_rows' => $pending, 'terms_rows' => $terms, 'overlapping_http_calls' => $overlap, 'responses' => $responses, 'loser_retry_status' => $retry['status'], 'loser_retry_code' => $retryCode, 'passed' => $pass];
        if (! $pass) throw new RuntimeException('last-seat invariant failed on trial '.($i + 1));
    }
    $report['completed'] = true;
} catch (Throwable $e) {
    $report['completed'] = false;
    $report['failure'] = $e->getMessage();
}
$report['finished_at'] = gmdate(DATE_ATOM);
$report['all_checks_passed'] = ($report['completed'] ?? false) && ! in_array(false, array_column($report['trials'], 'passed'), true);
echo json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)."\n";
exit($report['all_checks_passed'] ? 0 : 1);
