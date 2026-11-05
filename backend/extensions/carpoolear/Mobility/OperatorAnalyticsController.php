<?php

namespace STS\Mobility;

use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use STS\Mobility\Trust\CohortPolicy;

/** Private operational reporting; never participates in booking transactions. */
final class OperatorAnalyticsController
{
    public function show(Request $request): JsonResponse
    {
        $actor = $request->user();
        $college = CohortPolicy::college();
        if (! $actor || ! $actor->is_admin || ! $actor->active || $actor->banned || ! $college) {
            return $this->json(['error' => ['code' => 'OPERATOR_FORBIDDEN']], 403);
        }
        $value = $request->query('days', '7');
        if (! is_scalar($value) || ! preg_match('/^(?:[1-9]|[12][0-9]|3[01])$/D', (string) $value)) {
            return $this->json(['error' => ['code' => 'INVALID_REPORT_WINDOW']], 422);
        }
        $days = (int) $value;
        $to = CarbonImmutable::now('Asia/Kolkata')->startOfDay();
        $from = $to->subDays($days - 1);
        try {
            $data = DB::transaction(function () use ($college, $from, $to): array {
                $query = DB::table('mobility_operator_ride_facts')->where('college_code', $college)
                    ->whereBetween('service_day', [$from->toDateString(), $to->toDateString()]);
                $summary = (array) (clone $query)->selectRaw("COUNT(*) AS rides,
                    COALESCE(SUM(state = 'planned'), 0) AS planned,
                    COALESCE(SUM(state = 'in_progress'), 0) AS in_progress,
                    COALESCE(SUM(state = 'completed'), 0) AS completed,
                    COALESCE(SUM(state = 'cancelled'), 0) AS cancelled,
                    COALESCE(SUM(total_seats), 0) AS total_seats,
                    COALESCE(SUM(accepted_seats), 0) AS accepted_seats,
                    COALESCE(SUM(pending_requests), 0) AS pending_requests,
                    COALESCE(SUM(declined_requests), 0) AS declined_requests,
                    COALESCE(SUM(cancelled_requests), 0) AS cancelled_requests,
                    COALESCE(SUM(capacity_alert), 0) AS over_capacity_rides")->first();
                $ids = (clone $query)->orderBy('trip_id')->limit(5001)->pluck('trip_id')->map(fn ($id) => (int) $id)->all();
                // Query bounds never silently turn an incomplete Mongo scope into exact totals.
                $truncated = count($ids) > 5000;
                $ids = array_slice($ids, 0, 5000);
                $rides = (clone $query)->orderByDesc('departure_at')->orderByDesc('trip_id')->limit(100)->get([
                    'trip_id', 'service_day', 'departure_at', 'state', 'total_seats', 'accepted_seats', 'available_seats',
                    'pending_requests', 'declined_requests', 'cancelled_requests', 'utilization_pct', 'capacity_alert',
                ])->map(function ($row): array {
                    $row = (array) $row;
                    foreach (['trip_id', 'total_seats', 'accepted_seats', 'available_seats', 'pending_requests', 'declined_requests', 'cancelled_requests'] as $key) {
                        $row[$key] = (int) $row[$key];
                    }
                    $row['utilization_pct'] = (float) $row['utilization_pct'];
                    $row['capacity_alert'] = (bool) $row['capacity_alert'];
                    $row['departure_at'] = CarbonImmutable::parse($row['departure_at'], 'Asia/Kolkata')->toIso8601String();
                    return $row;
                })->all();

                // Drain the procedure's extra result set before reusing Laravel's PDO connection.
                $statement = DB::connection()->getPdo()->prepare('CALL mobility_operator_daily(?, ?, ?)');
                $statement->execute([$college, $from->toDateString(), $to->toDateString()]);
                $daily = $statement->fetchAll(\PDO::FETCH_ASSOC);
                while ($statement->nextRowset()) {}
                $statement->closeCursor();
                foreach ($daily as &$day) {
                    foreach (['rides', 'accepted_seats', 'pending_requests', 'cancelled_requests'] as $key) {
                        $day[$key] = (int) $day[$key];
                    }
                    $day['utilization_pct'] = (float) $day['utilization_pct'];
                    $day['rides_7d_average'] = (float) $day['rides_7d_average'];
                }
                unset($day);
                $audit = DB::table('mobility_booking_decision_events as e')
                    ->joinSub((clone $query)->select('trip_id'), 'visible', fn ($join) => $join->on('visible.trip_id', '=', 'e.trip_id'))
                    ->where('e.college_code', $college)->orderByDesc('e.id')->limit(20)
                    ->get(['e.id as event_id', 'e.trip_id', 'e.booking_id', 'e.previous_state', 'e.next_state', 'e.occurred_at'])
                    ->map(fn ($event) => [
                        'event_id' => (int) $event->event_id, 'trip_id' => (int) $event->trip_id,
                        'booking_id' => $event->booking_id === null ? null : (int) $event->booking_id,
                        'previous_state' => $event->previous_state === null ? null : (int) $event->previous_state,
                        'next_state' => (int) $event->next_state,
                        'occurred_at' => CarbonImmutable::parse($event->occurred_at, 'UTC')->toIso8601String(),
                    ])->all();
                return [
                    'sql' => ['summary' => array_map('intval', $summary), 'daily' => $daily, 'rides' => $rides,
                        'audit' => $audit, 'limits' => ['rides' => 100, 'audit' => 20],
                        'truncated' => $truncated || $summary['rides'] > 100],
                    'ids' => $ids, 'scope_truncated' => $truncated,
                ];
            });
        } catch (\PDOException $error) {
            return $this->json(['error' => ['code' => 'ANALYTICS_SCHEMA_UNAVAILABLE']], 503);
        }
        return $this->json([
            'audience' => 'operator', 'scope' => 'local_published_rides', 'timezone' => 'Asia/Kolkata',
            'window' => ['days' => $days, 'from' => $from->toDateString(), 'to' => $to->toDateString()],
            'sql' => $data['sql'],
            'activity' => $this->activity($from, $to->addDay(), $data['ids'], $data['scope_truncated']),
        ]);
    }

    private function activity(CarbonImmutable $from, CarbonImmutable $to, array $tripIds, bool $truncated): array
    {
        $base = ['status' => 'unavailable', 'last_synced_at' => null, 'lag_seconds' => null, 'daily' => []];
        if ($truncated) {
            return $base + ['message' => 'Activity scope exceeds the report limit. Narrow the date window.'];
        }
        $url = (string) config('operator_analytics.url');
        $key = (string) config('operator_analytics.key');
        if ($url === '' || strlen($key) < 32) {
            return array_replace($base, ['status' => 'disabled', 'message' => 'Ride activity reporting is not configured.']);
        }
        try {
            $response = Http::timeout(2)->connectTimeout(1)->withHeaders(['X-Mobility-Analytics-Key' => $key])->post(rtrim($url, '/').'/daily', [
                'from' => $from->utc()->toIso8601String(), 'to' => $to->utc()->toIso8601String(), 'trip_ids' => $tripIds,
            ]);
            if (! $response->successful()) {
                return $base + ['message' => 'Ride activity is temporarily unavailable.'];
            }
            $body = $response->json();
            if (! is_array($body) || ! in_array($body['status'] ?? null, ['ready', 'stale'], true)
                || ! is_array($body['daily'] ?? null) || count($body['daily']) > 1024) {
                return $base + ['message' => 'Ride activity is temporarily unavailable.'];
            }
            $daily = [];
            foreach ($body['daily'] as $row) {
                if (! is_array($row) || ! preg_match('/^\d{4}-\d{2}-\d{2}$/D', (string) ($row['day'] ?? ''))
                    || $row['day'] < $from->toDateString() || $row['day'] > $to->subDay()->toDateString()
                    || ! preg_match('/^[a-z_]{1,32}$/D', (string) ($row['action'] ?? ''))
                    || ! is_int($row['eventCount'] ?? null) || $row['eventCount'] < 0
                    || ! is_int($row['uniqueTripCount'] ?? null) || $row['uniqueTripCount'] < 0) {
                    return $base + ['message' => 'Ride activity is temporarily unavailable.'];
                }
                $daily[] = array_intersect_key($row, array_flip(['day', 'action', 'eventCount', 'uniqueTripCount']));
            }
            $synced = is_string($body['last_synced_at'] ?? null) ? CarbonImmutable::parse($body['last_synced_at'])->utc() : null;
            if (! $synced) {
                return $base + ['message' => 'Ride activity is awaiting its first verified update.'];
            }
            return ['status' => $body['status'], 'last_synced_at' => $synced->toIso8601String(),
                'lag_seconds' => max(0, (int) $synced->diffInSeconds(CarbonImmutable::now('UTC'))), 'daily' => $daily];
        } catch (\Throwable $error) {
            return $base + ['message' => 'Ride activity is temporarily unavailable.'];
        }
    }

    private function json(array $body, int $status = 200): JsonResponse
    {
        return response()->json($body, $status)->header('Cache-Control', 'private, no-store, max-age=0');
    }
}
