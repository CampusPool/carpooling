import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
import { rows } from '@/server/db';
import { upsertActivityEvent, type ActivityEventDocument, assertSafeActivityData } from '@/server/mongo';

export type EventInput = {
  type: string;
  actorId: number;
  audienceIds: number[];
  rideId?: number;
  bookingId?: number;
  data: Record<string, unknown>;
};

export type OutboxRow = RowDataPacket & {
  event_id: string;
  type: string;
  actor_id: number;
  audience_ids: string | number[];
  ride_id: number | null;
  booking_id: number | null;
  data: string | Record<string, unknown>;
  created_at: Date | string;
  attempts: number;
};

function json(value: unknown): string {
  return JSON.stringify(value ?? {});
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.name === 'MongoServerSelectionError') return 'MongoDB unavailable';
  return 'MongoDB publish failed';
}

export function validateEvent(event: EventInput): void {
  if (!event.type || !Number.isInteger(event.actorId) || !Array.isArray(event.audienceIds)) {
    throw new Error('invalid activity event');
  }
  assertSafeActivityData(event.data);
}

export async function insertOutboxEvent(cx: PoolConnection, event: EventInput): Promise<string> {
  validateEvent(event);
  const eventId = randomUUID();
  await cx.execute(
    `INSERT INTO outbox
      (event_id, type, actor_id, audience_ids, ride_id, booking_id, data, created_at, published_at, attempts)
     VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), NULL, 0)`,
    [eventId, event.type, event.actorId, json(event.audienceIds), event.rideId ?? null,
      event.bookingId ?? null, json(event.data)],
  );
  return eventId;
}

function parseJson<T>(value: string | T): T {
  return typeof value === 'string' ? JSON.parse(value) as T : value;
}

function utcDate(value: Date | string): Date {
  if (value instanceof Date) return value;
  // db.ts intentionally uses dateStrings:true. MySQL's UTC datetime has no offset,
  // so append Z rather than letting Node interpret it in the host timezone.
  return new Date(value.includes('T') ? `${value}Z` : `${value.replace(' ', 'T')}Z`);
}

export function eventDocument(row: OutboxRow): ActivityEventDocument {
  const audienceIds = parseJson<number[]>(row.audience_ids);
  const data = parseJson<Record<string, unknown>>(row.data);
  return {
    eventId: row.event_id,
    type: row.type,
    actorId: Number(row.actor_id),
    audienceIds: audienceIds.map(Number),
    ...(row.ride_id == null ? {} : { rideId: Number(row.ride_id) }),
    ...(row.booking_id == null ? {} : { bookingId: Number(row.booking_id) }),
    data,
    createdAt: utcDate(row.created_at),
  };
}

export async function pendingOutbox(cx: PoolConnection, limit: number): Promise<OutboxRow[]> {
  const bounded = Math.max(1, Math.min(100, Math.trunc(limit)));
  return rows<OutboxRow>(cx,
    `SELECT event_id,type,actor_id,audience_ids,ride_id,booking_id,data,created_at,attempts
       FROM outbox
      WHERE published_at IS NULL
      ORDER BY created_at,event_id
      LIMIT ? FOR UPDATE SKIP LOCKED`, [bounded]);
}

export async function markPublished(cx: PoolConnection, eventId: string): Promise<void> {
  await cx.execute('UPDATE outbox SET published_at = UTC_TIMESTAMP() WHERE event_id = ? AND published_at IS NULL', [eventId]);
}

export async function markAttemptFailed(cx: PoolConnection, eventId: string): Promise<void> {
  await cx.execute('UPDATE outbox SET attempts = attempts + 1 WHERE event_id = ? AND published_at IS NULL', [eventId]);
}

export async function publishOutboxBatch(cx: PoolConnection, limit = 25): Promise<{ published: number; failed: number }> {
  const pending = await pendingOutbox(cx, limit);
  let published = 0;
  let failed = 0;
  for (const row of pending) {
    try {
      await upsertActivityEvent(eventDocument(row));
      await markPublished(cx, row.event_id);
      published += 1;
    } catch (error) {
      await markAttemptFailed(cx, row.event_id);
      failed += 1;
      console.error(`activity event ${row.event_id} was not published`, safeErrorMessage(error));
      // Do not hold a batch lock while waiting through repeated Mongo server
      // selection timeouts. The next worker pass will retry this and the rest.
      break;
    }
  }
  return { published, failed };
}
