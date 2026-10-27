import { pool, rows } from '@/server/db';
import { readActivityFeed } from '@/server/mongo';
import { publishOutboxBatch } from '@/server/outbox';
import type { PoolConnection } from 'mysql2/promise';

export type ActivityDto = {
  events: Array<{
    eventId: string;
    type: string;
    actorId: number;
    rideId?: number;
    bookingId?: number;
    data: Record<string, unknown>;
    createdAt: string;
  }>;
  summary: Array<{ type: string; count: number }>;
  pendingCount: number;
};

export async function pendingActivityCount(userId: number): Promise<number> {
  const [row] = await rows<{ pending_count: number }>(
    // The audience array is the access-control boundary; do not return another user's events.
    pool(),
    `SELECT COUNT(*) AS pending_count FROM outbox
      WHERE published_at IS NULL
        AND (actor_id = ? OR JSON_CONTAINS(audience_ids, JSON_ARRAY(?)))`,
    [userId, userId],
  );
  return Number(row?.pending_count ?? 0);
}

export async function getActivity(userId: number, limit = 50): Promise<ActivityDto> {
  const [feed, pendingCount] = await Promise.all([
    readActivityFeed(userId, limit),
    pendingActivityCount(userId),
  ]);
  return {
    events: feed.events.map((event) => ({
      eventId: event.eventId,
      type: event.type,
      actorId: event.actorId,
      ...(event.rideId == null ? {} : { rideId: event.rideId }),
      ...(event.bookingId == null ? {} : { bookingId: event.bookingId }),
      data: event.data,
      createdAt: event.createdAt.toISOString(),
    })),
    summary: feed.summary,
    pendingCount,
  };
}

export async function syncActivity(cx: PoolConnection, limit = 25): Promise<{ published: number; failed: number }> {
  return publishOutboxBatch(cx, limit);
}
