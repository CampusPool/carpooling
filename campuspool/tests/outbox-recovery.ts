import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mysql, { type Pool, type PoolConnection, type RowDataPacket } from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { activityCollection, closeMongo, readActivityFeed, upsertActivityEvent } from '../src/server/mongo';
import { publishOutboxBatch } from '../src/server/outbox';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const enabled = process.env.RUN_CAMPUSPOOL_INTEGRATION === '1';

describe.skipIf(!enabled)('CampusPool outbox worker recovery evidence', () => {
  let db: Pool;
  beforeAll(() => {
    const value = process.env.DATABASE_URL;
    if (!value) throw new Error('DATABASE_URL is required for outbox evidence');
    const url = new URL(value);
    db = mysql.createPool({ host: url.hostname, port: Number(url.port || 3306),
      user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
      database: url.pathname.slice(1), timezone: 'Z', dateStrings: true });
  });
  afterAll(async () => { await closeMongo(); await db?.end(); });

  async function users(cx: PoolConnection): Promise<{ actor: number; audience: number; actorEmail: string; audienceEmail: string }> {
    const suffix = randomUUID().slice(0, 8);
    const actorEmail = `outbox-actor-${suffix}@campuspool.test`;
    const audienceEmail = `outbox-audience-${suffix}@campuspool.test`;
    for (const [name, email] of [['Outbox Actor', actorEmail], ['Outbox Audience', audienceEmail]]) {
      await cx.query(`INSERT INTO users(name,email,password_hash,role,status,credits) VALUES(?,?, 'test', 'RIDER','APPROVED',0)`, [name, email]);
    }
    const [rows] = await cx.query<Array<RowDataPacket & { id: number; email: string }>>(
      'SELECT id,email FROM users WHERE email IN (?,?)', [actorEmail, audienceEmail]);
    const actor = rows.find((row) => row.email === actorEmail)?.id ?? 0;
    const audience = rows.find((row) => row.email === audienceEmail)?.id ?? 0;
    expect(actor).toBeGreaterThan(0); expect(audience).toBeGreaterThan(0);
    return { actor, audience, actorEmail, audienceEmail };
  }

  async function worker(cx: PoolConnection, limit = 1): Promise<{ published: number; failed: number }> {
    await cx.beginTransaction();
    try { const result = await publishOutboxBatch(cx, limit); await cx.commit(); return result; }
    catch (error) { await cx.rollback(); throw error; }
  }

  it('uses the real worker path for failure, recovery, replay, and audience isolation', async () => {
    const cx = await db.getConnection();
    const originalUri = process.env.MONGODB_URI;
    const failedEventId = randomUUID();
    const replayEventId = randomUUID();
    const highAttemptEventId = randomUUID();
    let actor = 0;
    let audience = 0;
    let actorEmail = '';
    let audienceEmail = '';
    try {
      ({ actor, audience, actorEmail, audienceEmail } = await users(cx));
      const event = (eventId: string) => ({ eventId, type: 'DBMS_OUTBOX_TEST', actorId: actor,
        audienceIds: [audience], data: { testId: eventId }, createdAt: new Date('2000-01-01T00:00:00.000Z') });
      const fixtureRows = [[failedEventId, '1970-01-01 00:00:00.000', 0], [replayEventId, '1970-01-01 00:00:01.000', 0], [highAttemptEventId, '1970-01-01 00:00:02.000', 9]] as const;
      for (const [eventId, createdAt, attempts] of fixtureRows) {
        await cx.query(`INSERT INTO outbox(event_id,type,actor_id,audience_ids,data,created_at,attempts)
          VALUES(?,?,?,?,?,?,?)`, [eventId, 'DBMS_OUTBOX_TEST', actor, JSON.stringify([audience]), JSON.stringify({ testId: eventId }), createdAt, attempts]);
      }

      await closeMongo();
      process.env.MONGODB_URI = 'mongodb://127.0.0.1:1';
      const failed = await worker(cx, 1);
      expect(failed.failed).toBe(1);
      const [failedRow] = await cx.query<Array<RowDataPacket & { attempts: number; published_at: string | null }>>(
        'SELECT attempts,published_at FROM outbox WHERE event_id=?', [failedEventId]);
      expect(Number(failedRow[0]?.attempts)).toBe(1);
      expect(failedRow[0]?.published_at).toBeNull();

      await closeMongo();
      process.env.MONGODB_URI = originalUri;
      // Simulate a crash after Mongo accepted the event but before SQL publish.
      await upsertActivityEvent(event(replayEventId));
      const recovered = await worker(cx, 100);
      expect(recovered.published).toBeGreaterThanOrEqual(3);
      const [published] = await cx.query<Array<RowDataPacket & { published_at: string | null; attempts: number }>>(
        'SELECT published_at,attempts FROM outbox WHERE event_id IN (?,?,?)', [failedEventId, replayEventId, highAttemptEventId]);
      expect(published).toHaveLength(3);
      expect(published.every((row) => row.published_at !== null)).toBe(true);
      expect(Number(published.find((row) => Number(row.attempts) > 8)?.attempts ?? 0)).toBeGreaterThan(8);

      const collection = await activityCollection();
      expect(await collection.countDocuments({ eventId: replayEventId })).toBe(1);
      const audienceFeed = await readActivityFeed(audience);
      const eventIds: string[] = [failedEventId, replayEventId, highAttemptEventId];
      expect(audienceFeed.events.filter((item) => eventIds.includes(item.eventId))).toHaveLength(3);
      const actorFeed = await readActivityFeed(actor);
      expect(actorFeed.events.some((item) => item.eventId === failedEventId)).toBe(false);
      await collection.deleteMany({ eventId: { $in: [failedEventId, replayEventId, highAttemptEventId] } });
    } finally {
      process.env.MONGODB_URI = originalUri;
      await cx.query('DELETE FROM outbox WHERE event_id IN (?,?,?)', [failedEventId, replayEventId, highAttemptEventId]);
      if (actorEmail && audienceEmail) await cx.query('DELETE FROM users WHERE email IN (?,?)', [actorEmail, audienceEmail]);
      cx.release();
    }
  });
});
