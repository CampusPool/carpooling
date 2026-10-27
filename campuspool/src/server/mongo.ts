import { MongoClient, type Collection, type Db } from 'mongodb';

export type ActivityEventDocument = {
  eventId: string;
  type: string;
  actorId: number;
  audienceIds: number[];
  rideId?: number;
  bookingId?: number;
  data: Record<string, unknown>;
  createdAt: Date;
};

type ActivitySummary = { type: string; count: number };

let clientPromise: Promise<MongoClient> | undefined;
let indexesPromise: Promise<void> | undefined;

export class MongoUnavailableError extends Error {
  constructor() { super('MongoDB unavailable'); this.name = 'MongoUnavailableError'; }
}

function safeMongoError(): Error {
  // Never expose a Mongo URI, host, or credentials in request/worker logs.
  return new MongoUnavailableError();
}

export function isMongoUnavailable(error: unknown): boolean {
  return error instanceof MongoUnavailableError || (error instanceof Error && error.name === 'MongoServerSelectionError');
}

/** Test/worker lifecycle hook; production callers normally keep the pool warm. */
export async function closeMongo(): Promise<void> {
  const pending = clientPromise;
  clientPromise = undefined;
  indexesPromise = undefined;
  if (pending) {
    try { (await pending).close(); } catch { /* already closed or failed to connect */ }
  }
}

function mongoConfig(): { uri: string; database: string } {
  const uri = process.env.MONGODB_URI;
  const database = process.env.MONGODB_DB || 'campuspool';
  if (!uri) throw new Error('MONGODB_URI is not configured');
  return { uri, database };
}

async function client(): Promise<MongoClient> {
  if (!clientPromise) {
    const { uri } = mongoConfig();
    clientPromise = new MongoClient(uri, {
      appName: 'campuspool-activity',
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 2_000,
      connectTimeoutMS: 2_000,
    }).connect().catch(() => {
      clientPromise = undefined;
      throw safeMongoError();
    });
  }
  return clientPromise;
}

export async function mongoDb(): Promise<Db> {
  const { database } = mongoConfig();
  return (await client()).db(database);
}

export async function activityCollection(): Promise<Collection<ActivityEventDocument>> {
  const collection = (await mongoDb()).collection<ActivityEventDocument>('activity_events');
  if (!indexesPromise) {
    indexesPromise = Promise.all([
      collection.createIndex({ eventId: 1 }, { name: 'activity_event_id_unique', unique: true }),
      collection.createIndex({ audienceIds: 1, createdAt: -1 }, { name: 'activity_audience_created' }),
      collection.createIndex({ type: 1, createdAt: -1 }, { name: 'activity_type_created' }),
    ]).then(() => undefined).catch(() => {
      indexesPromise = undefined;
      throw safeMongoError();
    });
  }
  await indexesPromise;
  return collection;
}

const UNSAFE_KEY = /(password|pass_hash|token|secret|credential|api.?key|email|phone|address)/i;

/** Activity data is deliberately a small, non-sensitive projection. */
export function assertSafeActivityData(value: unknown, path = 'data'): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (UNSAFE_KEY.test(key)) throw new Error(`sensitive activity field: ${key}`);
    if (child && typeof child === 'object') {
      if (Array.isArray(child)) child.forEach((item, index) => {
        if (item && typeof item === 'object') assertSafeActivityData(item, `${path}.${key}[${index}]`);
      });
      else assertSafeActivityData(child, `${path}.${key}`);
    }
  }
}

export async function upsertActivityEvent(event: ActivityEventDocument): Promise<void> {
  assertSafeActivityData(event.data);
  const collection = await activityCollection();
  try {
    await collection.updateOne(
      { eventId: event.eventId },
      { $setOnInsert: event },
      { upsert: true },
    );
  } catch { throw new MongoUnavailableError(); }
}

export async function readActivityFeed(userId: number, limit = 50): Promise<{
  events: ActivityEventDocument[];
  summary: ActivitySummary[];
}> {
  const collection = await activityCollection();
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  try {
    const [result] = await collection.aggregate<{
      events: ActivityEventDocument[];
      summary: ActivitySummary[];
    }>([
      { $match: { audienceIds: userId } },
      {
        $facet: {
          events: [
            { $sort: { createdAt: -1, eventId: -1 } },
            { $limit: safeLimit },
          ],
          summary: [
            { $group: { _id: '$type', count: { $sum: 1 } } },
            { $project: { _id: 0, type: '$_id', count: 1 } },
            { $sort: { count: -1, type: 1 } },
          ],
        },
      },
    ]).toArray();
    return { events: result?.events ?? [], summary: result?.summary ?? [] };
  } catch { throw new MongoUnavailableError(); }
}

export async function databaseEvidence(): Promise<Record<string, unknown>> {
  const db = await mongoDb();
  const collection = await activityCollection();
  const indexes = await collection.listIndexes().toArray();
  return {
    database: db.databaseName,
    collection: 'activity_events',
    indexes: indexes.map((index) => ({ name: index.name, key: index.key, unique: index.unique === true })),
  };
}
