<?php

namespace STS\Mobility;

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
        // Host tables are reported as installed/not installed only: their row
        // counts could include people from other colleges.
        $allowList = [
            'users' => 'Account identities (platform-wide)',
            'cars' => 'Vehicle records (platform-wide)',
            'trips' => 'Published trips (platform-wide)',
            'trip_passengers' => 'Seat request history (platform-wide)',
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
                $tables[] = ['name' => $table, 'purpose' => $purpose, 'exists' => $exists, 'rows' => $count];
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
            'tables' => $tables, 'objects' => $objects,
            'note' => 'Only college-scoped counts are supplied. Other table counts are intentionally withheld.',
        ], 200, ['Cache-Control' => 'private, no-store']);
    }
}
