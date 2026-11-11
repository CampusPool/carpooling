<?php

namespace STS\Mobility;

use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use STS\Mobility\Trust\CohortPolicy;

/** Read-only, allow-listed DBMS evidence for an authenticated college operator. */
final class OperatorDatabaseHealthController
{
    public function show(Request $request): JsonResponse
    {
        $actor = $request->user();
        $college = CohortPolicy::college();
        if (! $actor || ! (bool) $actor->is_admin || ! (bool) $actor->active || (bool) $actor->banned || ! $college) {
            return response()->json(['error' => ['code' => 'OPERATOR_FORBIDDEN']], 403, ['Cache-Control' => 'private, no-store']);
        }

        // The user never supplies table names, SQL or a database identifier.
        // Counts use explicit college ownership. Other tables report presence only.
        $allowList = [
            'users' => 'Account identities (platform-wide)',
            'cars' => 'Vehicle records (platform-wide)',
            'trips' => 'Trips hosted by members of the configured college',
            'trip_passengers' => 'Seat request history for college-hosted trips',
            'mobility_memberships' => 'College membership decisions',
            'mobility_host_applications' => 'College host permission requests',
            'mobility_driver_onboardings' => 'College driver/vehicle reviews',
            'mobility_commute_demo_trips' => 'Synthetic classroom rides',
            'mobility_booking_decision_events' => 'College booking decision audit',
            'mobility_trip_lifecycles' => 'Ride lifecycle state',
            'mobility_route_quotes' => 'Bounded route proposals',
            'mobility_recurring_programs' => 'Scheduled trip programs',
            'mobility_match_references' => 'Candidate route matches',
            'mobility_payment_attempts' => 'Payment attempt records (non-settling)',
            'mobility_cash_receipts' => 'Cash reconciliation records',
        ];
        $objects = [
            ['name' => 'mobility_operator_ride_facts', 'kind' => 'VIEW'],
            ['name' => 'mobility_operator_daily', 'kind' => 'PROCEDURE'],
            ['name' => 'mobility_utilization_pct', 'kind' => 'FUNCTION'],
            ['name' => 'mobility_booking_decision_insert', 'kind' => 'TRIGGER'],
            ['name' => 'mobility_booking_decision_update', 'kind' => 'TRIGGER'],
        ];
        try {
            $database = DB::connection()->getDatabaseName();
            $tablesPresent = DB::table('information_schema.TABLES')
                ->where('TABLE_SCHEMA', $database)
                ->whereIn('TABLE_NAME', array_keys($allowList))
                ->pluck('TABLE_TYPE', 'TABLE_NAME')->all();
            $viewNames = DB::table('information_schema.VIEWS')->where('TABLE_SCHEMA', $database)
                ->where('TABLE_NAME', 'mobility_operator_ride_facts')->pluck('TABLE_NAME')->all();
            $routines = DB::table('information_schema.ROUTINES')->where('ROUTINE_SCHEMA', $database)
                ->whereIn('ROUTINE_NAME', ['mobility_operator_daily', 'mobility_utilization_pct'])
                ->get(['ROUTINE_NAME', 'ROUTINE_TYPE']);
            $triggers = DB::table('information_schema.TRIGGERS')->where('TRIGGER_SCHEMA', $database)
                ->whereIn('TRIGGER_NAME', ['mobility_booking_decision_insert', 'mobility_booking_decision_update'])
                ->pluck('TRIGGER_NAME')->all();

            $collegeTrips = null;
            if (isset($tablesPresent['trips'], $tablesPresent['mobility_memberships'])) {
                $collegeTrips = DB::table('trips as trip')
                    ->whereExists(fn ($query) => $query->selectRaw('1')
                        ->from('mobility_memberships as membership')
                        ->whereColumn('membership.user_id', 'trip.user_id')
                        ->where('membership.college_code', $college));
            }

            $tables = [];
            foreach ($allowList as $table => $purpose) {
                $exists = isset($tablesPresent[$table]) && $tablesPresent[$table] === 'BASE TABLE';
                $count = null;
                if ($exists && in_array($table, ['mobility_memberships', 'mobility_booking_decision_events'], true)) {
                    $count = DB::table($table)->where('college_code', $college)->count();
                }
                if ($exists && in_array($table, ['mobility_host_applications', 'mobility_driver_onboardings'], true)
                    && isset($tablesPresent['mobility_memberships'])) {
                    $count = DB::table($table.' as items')
                        ->join('mobility_memberships as memberships', 'memberships.user_id', '=', 'items.user_id')
                        ->where('memberships.college_code', $college)->count();
                }
                if ($exists && $collegeTrips !== null) {
                    if ($table === 'trips') {
                        $count = (clone $collegeTrips)->count();
                    } elseif (in_array($table, ['trip_passengers', 'mobility_commute_demo_trips', 'mobility_trip_lifecycles'], true)) {
                        $count = DB::table($table)->whereIn('trip_id', (clone $collegeTrips)->select('trip.id'))->count();
                    }
                }
                $tables[] = ['name' => $table, 'purpose' => $purpose, 'exists' => $exists, 'rows' => $count];
            }
            $recentTrips = null;
            if ($collegeTrips !== null) {
                $recentTrips = $collegeTrips->orderByDesc('trip.trip_date')->orderByDesc('trip.id')->limit(25)
                    ->get(['trip.id', 'trip.trip_date', 'trip.total_seats'])
                    ->map(fn ($trip) => [
                        'id' => (int) $trip->id,
                        'departure_at' => $trip->trip_date === null ? null
                            : CarbonImmutable::parse($trip->trip_date, 'Asia/Kolkata')->toIso8601String(),
                        'total_seats' => (int) $trip->total_seats,
                    ])->all();
            }
            foreach ($objects as &$object) {
                $object['installed'] = match ($object['kind']) {
                    'VIEW' => in_array($object['name'], $viewNames, true),
                    'TRIGGER' => in_array($object['name'], $triggers, true),
                    default => $routines->contains(fn ($r) => $r->ROUTINE_NAME === $object['name'] && $r->ROUTINE_TYPE === $object['kind']),
                };
            }
            unset($object);
        } catch (\Throwable $error) {
            report($error);
            return response()->json(['error' => ['code' => 'DBMS_EVIDENCE_UNAVAILABLE']], 503, ['Cache-Control' => 'private, no-store']);
        }

        return response()->json([
            'audience' => 'operator', 'scope' => 'configured_college',
            'tables' => $tables, 'objects' => $objects, 'recent_trips' => $recentTrips,
            'note' => 'Only college-scoped counts are supplied. Other table counts are intentionally withheld.',
        ], 200, ['Cache-Control' => 'private, no-store']);
    }
}
