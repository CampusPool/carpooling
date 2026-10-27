<?php

namespace STS\Mobility;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use STS\Models\SupportTicket;
use STS\Mobility\Trust\CohortPolicy;

/** Read-only, bounded operator facts for the teacher demo. */
final class OperatorDashboardController
{
    public function show(Request $request): JsonResponse
    {
        $actor = $request->user();
        if (! $actor || ! (bool) $actor->is_admin || ! (bool) $actor->active || (bool) $actor->banned || ! CohortPolicy::college()) {
            return response()->json(['error' => ['code' => 'OPERATOR_FORBIDDEN']], 403);
        }

        // The dashboard is additive: an older deployment without the commute
        // tables still gets a safe empty view rather than a SQL exception.
        if (! Schema::hasTable('mobility_commute_demo_trips')) {
            return response()->json([
                'audience' => 'operator',
                'demo_only' => true,
                'usage' => ['demo_actors' => 0, 'demo_trips' => 0, 'bookings' => 0, 'waitlist_pending' => 0, 'reports_open' => 0, 'ratings_submitted' => 0],
                'reports' => [],
                'limits' => ['reports' => 50],
                'schema' => 'legacy_without_commute_tables',
            ]);
        }

        $demoTrips = DB::table('mobility_commute_demo_trips')->select('trip_id');
        $reports = SupportTicket::query()
            ->where('type', 'report')
            ->whereIn('trip_id', $demoTrips)
            ->orderByDesc('id')
            ->limit(50)
            ->get(['id', 'trip_id', 'subject', 'status', 'priority', 'unread_for_admin', 'created_at', 'updated_at'])
            ->map(static fn (SupportTicket $ticket): array => [
                'id' => (int) $ticket->id,
                'trip_id' => (int) $ticket->trip_id,
                'subject' => (string) $ticket->subject,
                'status' => (string) $ticket->status,
                'priority' => (string) $ticket->priority,
                'unread_for_admin' => (bool) $ticket->unread_for_admin,
                'created_at' => $ticket->created_at,
                'updated_at' => $ticket->updated_at,
            ])->values()->all();

        return response()->json([
            'audience' => 'operator',
            'demo_only' => true,
            'usage' => [
                'demo_actors' => Schema::hasTable('mobility_commute_demo_actors') ? DB::table('mobility_commute_demo_actors')->count() : 0,
                'demo_trips' => (clone $demoTrips)->count(),
                'bookings' => DB::table('trip_passengers')->whereIn('trip_id', $demoTrips)->count(),
                'waitlist_pending' => Schema::hasTable('mobility_commute_waitlist') ? DB::table('mobility_commute_waitlist')->whereIn('trip_id', $demoTrips)->whereIn('status', ['pending', 'requested'])->count() : 0,
                'reports_open' => SupportTicket::query()->where('type', 'report')->whereIn('trip_id', $demoTrips)->whereNotIn('status', ['Closed', 'Resolved', 'Cerrado', 'Resuelto'])->count(),
                'ratings_submitted' => Schema::hasTable('mobility_trip_ratings') ? DB::table('mobility_trip_ratings')->whereIn('trip_id', $demoTrips)->count() : 0,
            ],
            'reports' => $reports,
            'limits' => ['reports' => 50],
        ]);
    }
}
