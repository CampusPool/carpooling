<?php
declare(strict_types=1);

// Synthetic actors and route metrics; real app HTTP/JWT, SQL and Mongo services.
require '/var/www/vendor/autoload.php';
$app = require '/var/www/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;
use STS\Models\User;
use STS\Mobility\Trust\CohortPolicy;

$phase = $argv[1] ?? '';
$stateFile = '/tmp/dbms-application-probe.json';
$report = ['phase' => $phase, 'started_at' => gmdate(DATE_ATOM), 'checks' => []];

function requestApi(string $method, string $path, array $body = [], ?string $token = null, ?string $key = null): array {
    $headers = ['Accept: application/json', 'Content-Type: application/json'];
    if ($token) $headers[] = 'Authorization: Bearer '.$token;
    if ($key) $headers[] = 'Idempotency-Key: '.$key;
    $options = ['method' => $method, 'header' => implode("\r\n", $headers), 'ignore_errors' => true, 'timeout' => 10];
    if ($method !== 'GET') $options['content'] = json_encode($body, JSON_THROW_ON_ERROR);
    $raw = @file_get_contents('http://127.0.0.1:8000/api/'.$path, false, stream_context_create(['http' => $options]));
    $status = 0;
    foreach ($http_response_header ?? [] as $line) if (preg_match('/^HTTP\/\S+ (\d+)/', $line, $match)) $status = (int) $match[1];
    return ['status' => $status, 'json' => json_decode($raw ?: '', true)];
}
function verify(string $name, bool $passed, array $observed = []): void {
    global $report;
    $report['checks'][] = ['name' => $name, 'passed' => $passed, 'observed' => $observed];
    if (!$passed) throw new RuntimeException($name.' failed: '.json_encode($observed));
}
function expectApi(string $name, array $response, int $status = 200): array {
    verify($name, $response['status'] === $status, ['status' => $response['status'], 'expected' => $status,
        'code' => $response['json']['error']['code'] ?? null]);
    return $response['json'] ?? [];
}
function operatorReport(array $state): array {
    return expectApi('operator report HTTP', requestApi('GET', 'mobility/operator/analytics?days=7', [], $state['operator_token']));
}
function countActivity(array $json): int {
    return array_sum(array_column($json['activity']['daily'] ?? [], 'eventCount'));
}
function privateStatus(array $body, string $key): int {
    @file_get_contents(rtrim((string) getenv('MOBILITY_ACTIVITY_SERVICE_URL'), '/').'/daily', false, stream_context_create(['http' => [
        'method' => 'POST', 'header' => "Content-Type: application/json\r\nX-Mobility-Analytics-Key: ".$key,
        'content' => json_encode($body, JSON_THROW_ON_ERROR), 'ignore_errors' => true, 'timeout' => 5,
    ]]));
    $status = 0;
    foreach ($http_response_header ?? [] as $line) if (preg_match('/^HTTP\/\S+ (\d+)/', $line, $match)) $status = (int) $match[1];
    return $status;
}

try {
    verify('testing-only synthetic cohort', app()->environment('testing') && CohortPolicy::required()
        && CohortPolicy::college() === 'SYNTHETIC-LOCAL');
    if ($phase === 'journey') {
        $run = bin2hex(random_bytes(5));
        $actors = [];
        foreach (['driver', 'rider'] as $role) {
            $session = expectApi('register separate '.$role, requestApi('POST', 'mobility/local-auth/register', [
                'username' => 'dbms_'.$role.'_'.$run, 'password' => 'synthetic-password-'.$run, 'role' => $role,
            ]), 201);
            $actors[$role] = ['id' => $session['user']['id'], 'token' => $session['token']];
            expectApi('save '.$role.' route', requestApi('PUT', 'mobility/commute/profile', [
                'role' => $role, 'vehicle_preference' => 'both', 'schedule_mode' => 'fixed',
                'home' => ['lat' => 12.9716, 'lng' => 77.5946, 'label' => 'Synthetic home'],
                'campus' => ['lat' => 12.9352, 'lng' => 77.6200, 'label' => 'Synthetic campus'],
                'outbound_time' => '08:30', 'return_time' => '17:30', 'weekdays' => [1,2,3,4,5,6,7],
            ], $session['token']));
        }
        $date = now('Asia/Kolkata')->addDay()->toDateString();
        $offer = expectApi('publish actual local account ride', requestApi('POST', 'mobility/commute/offers', [
            'date' => $date, 'direction' => 'outbound', 'vehicle_type' => 'car', 'choice' => 'DIRECT_RIDER_PICKUP',
        ], $actors['driver']['token'], 'dbms-'.$run.'-offer'));
        $trip = (int) $offer['data']['trip_id'];
        $rides = expectApi('independent rider discovers ride', requestApi('GET', 'mobility/commute/rides?date='.$date.'&direction=outbound&vehicle_type=car', [], $actors['rider']['token']));
        $cards = array_values(array_filter($rides['data'] ?? [], fn ($card) => (int) $card['trip_id'] === $trip));
        verify('published ride visible across accounts', count($cards) === 1);
        $booking = expectApi('request ride', requestApi('POST', 'mobility/commute/rides/'.$trip.'/request', [
            'quote_token' => $cards[0]['quote_token'],
        ], $actors['rider']['token'], 'dbms-'.$run.'-request'));
        $bookingId = (int) $booking['data']['booking_id'];
        expectApi('driver accepts request', requestApi('POST', 'mobility/commute/bookings/'.$bookingId.'/accept', [], $actors['driver']['token'], 'dbms-'.$run.'-accept'));
        foreach (['start', 'board', 'alight', 'complete'] as $action) {
            expectApi('lifecycle '.$action, requestApi('POST', 'mobility/commute/trips/'.$trip.'/transition',
                ['action' => $action] + (in_array($action, ['board','alight'], true) ? ['passenger_id' => $actors['rider']['id']] : []),
                $actors['driver']['token'], 'dbms-'.$run.'-'.$action));
        }
        // Put the synthetic completed ride in today's historical report window.
        // All publication/booking/lifecycle operations above went through the API.
        DB::table('trips')->where('id', $trip)->update(['trip_date' => now('Asia/Kolkata')->setTime(8,30)->format('Y-m-d H:i:s')]);
        $operator = User::factory()->create(['active' => true, 'banned' => false, 'is_admin' => true]);
        $state = ['trip' => $trip, 'booking' => $bookingId, 'driver' => $actors['driver']['id'],
            'driver_token' => $actors['driver']['token'], 'rider_token' => $actors['rider']['token'],
            'operator_token' => auth('api')->fromUser($operator)];
        umask(0077);
        file_put_contents($stateFile, json_encode($state, JSON_THROW_ON_ERROR));
        verify('SQL lifecycle has four real events', DB::table('mobility_trip_events')->where('trip_id', $trip)->count() === 4);
        verify('booking triggers captured request and acceptance', DB::table('mobility_booking_decision_events')->where('booking_id', $bookingId)->count() === 2);
        expectApi('rider denied operator report', requestApi('GET', 'mobility/operator/analytics', [], $actors['rider']['token']), 403);
        verify('private service rejects an unauthenticated caller', privateStatus([], str_repeat('x',32)) === 401);
        verify('private service rejects caller-supplied query operators', privateStatus([
            'from' => now('UTC')->startOfDay()->toIso8601String(), 'to' => now('UTC')->startOfDay()->addDay()->toIso8601String(),
            'trip_ids' => [['$ne' => 0]],
        ], (string) getenv('MOBILITY_ACTIVITY_SERVICE_KEY')) === 400);
    } else {
        $state = json_decode(file_get_contents($stateFile), true, 512, JSON_THROW_ON_ERROR);
        if ($phase === 'ready' || $phase === 'replay') {
            $json = null;
            for ($attempt = 0; $attempt < 30; $attempt++) {
                $response = requestApi('GET', 'mobility/operator/analytics?days=7', [], $state['operator_token']);
                $candidate = $response['json'] ?? [];
                if ($response['status'] === 200 && ($candidate['activity']['status'] ?? null) === 'ready' && countActivity($candidate) === 4) { $json = $candidate; break; }
                usleep(500000);
            }
            verify('actual Mongo aggregation ready with four lifecycle events', $json !== null,
                ['http_status' => $response['status'], 'code' => $candidate['error']['code'] ?? null,
                    'activity_status' => $candidate['activity']['status'] ?? null, 'event_count' => countActivity($candidate)]);
            verify('SQL report counts completed ride and accepted seat', $json['sql']['summary']['rides'] === 1
                && $json['sql']['summary']['completed'] === 1 && $json['sql']['summary']['accepted_seats'] === 1);
            verify('Mongo groups distinct real transitions', count($json['activity']['daily']) === 4);
            verify('aggregate has no event actor or payload', !preg_match('/"(?:actorId|passengerId|response_body|idempotency_key)"/', json_encode($json)));
            $report['summary'] = $json['sql']['summary'];
            $report['activity'] = $json['activity'];
            if ($phase === 'ready') {
                $state['first_synced_at'] = $json['activity']['last_synced_at'];
                file_put_contents($stateFile, json_encode($state, JSON_THROW_ON_ERROR));
            } else {
                verify('a later full replay completed', strtotime($json['activity']['last_synced_at']) > strtotime($state['first_synced_at']));
                verify('replay did not duplicate actual events', countActivity($json) === 4);
            }
        } elseif ($phase === 'scope') {
            DB::table('mobility_memberships')->where('user_id', $state['driver'])->update(['college_code' => 'OTHER-COLLEGE']);
            try {
                for ($attempt = 0; $attempt < 20; $attempt++) {
                    $json = operatorReport($state);
                    if (in_array($json['activity']['status'], ['ready','stale'], true)) break;
                    usleep(250000);
                }
                verify('foreign college ride excluded by server SQL scope', $json['sql']['summary']['rides'] === 0 && count($json['sql']['rides']) === 0);
                verify('foreign college activity is excluded', in_array($json['activity']['status'], ['ready','stale'], true) && countActivity($json) === 0);
            } finally {
                DB::table('mobility_memberships')->where('user_id', $state['driver'])->update(['college_code' => 'SYNTHETIC-LOCAL']);
            }
        } elseif ($phase === 'outage') {
            $json = operatorReport($state);
            verify('Mongo outage explicitly unavailable without false zero success', $json['activity']['status'] === 'unavailable' && $json['activity']['daily'] === []);
            verify('SQL reports remain available through Mongo outage', $json['sql']['summary']['completed'] === 1 && $json['sql']['summary']['accepted_seats'] === 1);
            $run = bin2hex(random_bytes(5));
            $date = now('Asia/Kolkata')->addDays(2)->toDateString();
            $offer = expectApi('publish another ride during Mongo outage', requestApi('POST', 'mobility/commute/offers', [
                'date' => $date, 'direction' => 'outbound', 'vehicle_type' => 'car', 'choice' => 'DIRECT_RIDER_PICKUP',
            ], $state['driver_token'], 'dbms-outage-'.$run.'-offer'));
            $trip = (int) $offer['data']['trip_id'];
            $rides = expectApi('search during Mongo outage', requestApi('GET', 'mobility/commute/rides?date='.$date.'&direction=outbound&vehicle_type=car', [], $state['rider_token']));
            $cards = array_values(array_filter($rides['data'] ?? [], fn ($card) => (int) $card['trip_id'] === $trip));
            verify('new ride discoverable while Mongo stopped', count($cards) === 1);
            $booking = expectApi('request during Mongo outage', requestApi('POST', 'mobility/commute/rides/'.$trip.'/request', [
                'quote_token' => $cards[0]['quote_token'],
            ], $state['rider_token'], 'dbms-outage-'.$run.'-request'));
            $bookingId = (int) $booking['data']['booking_id'];
            $accepted = expectApi('driver accepts during Mongo outage', requestApi('POST', 'mobility/commute/bookings/'.$bookingId.'/accept', [], $state['driver_token'], 'dbms-outage-'.$run.'-accept'));
            verify('booking authority commits accepted state without Mongo', (int) $accepted['data']['request_state'] === 1
                && (int) DB::table('trip_passengers')->where('id', $bookingId)->value('request_state') === 1);
        } else throw new RuntimeException('Unknown probe phase');
    }
    $report['completed'] = true;
} catch (Throwable $error) {
    $report['completed'] = false;
    $report['failure'] = $error->getMessage();
}
$report['finished_at'] = gmdate(DATE_ATOM);
echo json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)."\n";
exit($report['completed'] ? 0 : 1);
