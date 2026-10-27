const FORBIDDEN = new Set(['response_body', 'request_fingerprint', 'idempotency_key']);

/** Convert only the non-sensitive, SQL-authoritative event columns. */
export function projectEvent(row, projectedAt = new Date(), sourceTimezone = 'UTC') {
  for (const key of FORBIDDEN) {
    if (Object.hasOwn(row, key)) throw new Error(`refusing sensitive SQL column: ${key}`);
  }
  const occurredAt = row.created_at instanceof Date ? row.created_at : new Date(row.created_at);
  if (!Number.isInteger(Number(row.id)) || Number.isNaN(occurredAt.valueOf())) {
    throw new Error('invalid SQL event row');
  }
  return {
    source: 'mysql.mobility_trip_events',
    sourceEventId: Number(row.id),
    tripId: Number(row.trip_id),
    actorId: Number(row.actor_id),
    passengerId: row.passenger_id == null ? null : Number(row.passenger_id),
    action: String(row.action),
    version: Number(row.version),
    responseStatus: Number(row.response_status),
    occurredAt,
    projectedAt,
    sourceTimezone,
    privacy: { responseBodyOmitted: true, containsLinkableIdentifiers: true }
  };
}

export function eventIndexes() {
  return [
    { key: { sourceEventId: 1 }, options: { unique: true, name: 'uniq_activity_source_event' } },
    { key: { occurredAt: -1, action: 1 }, options: { name: 'activity_occurred_action' } },
    { key: { actorId: 1, occurredAt: -1 }, options: { name: 'activity_actor_occurred' } }
  ];
}

export async function ensureCollection(db, name) {
  let collection;
  try {
    collection = db.collection(name);
    await collection.createIndex({ sourceEventId: 1 }, { unique: true, name: 'uniq_activity_source_event' });
  } catch (error) {
    if (error.codeName !== 'NamespaceNotFound') throw error;
    await db.createCollection(name);
    collection = db.collection(name);
    await collection.createIndex({ sourceEventId: 1 }, { unique: true, name: 'uniq_activity_source_event' });
  }
  for (const index of eventIndexes().slice(1)) await collection.createIndex(index.key, index.options);
  return collection;
}

export async function upsertEvent(collection, row, projectedAt = new Date(), sourceTimezone = 'UTC') {
  const document = projectEvent(row, projectedAt, sourceTimezone);
  const result = await collection.updateOne(
    { sourceEventId: document.sourceEventId },
    { $setOnInsert: document },
    { upsert: true }
  );
  return { document, inserted: result.upsertedCount === 1 };
}

export function dailyAggregation({ timezone = 'Asia/Kolkata' } = {}) {
  return [
    { $group: {
      _id: { day: { $dateToString: { date: '$occurredAt', timezone } }, action: '$action' },
      eventCount: { $sum: 1 },
      tripCount: { $addToSet: '$tripId' }
    } },
    { $project: { _id: 0, day: '$_id.day', action: '$_id.action', eventCount: 1, uniqueTripCount: { $size: '$tripCount' } } },
    { $sort: { day: 1, action: 1 } }
  ];
}

export async function syncSqlToMongo({ sql, collection, pageSize = 250, sourceTimezone = 'UTC', now = () => new Date() }) {
  const size = Math.max(1, Math.min(5000, Number(pageSize) || 250));
  await sql.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
  await sql.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
  let upper;
  let count = 0;
  try {
    const [maxRows] = await sql.query('SELECT COALESCE(MAX(id), 0) AS upper_id FROM mobility_trip_events');
    upper = Number(maxRows[0].upper_id);
    let after = 0;
    while (after < upper) {
      const [rows] = await sql.execute(
        `SELECT id, trip_id, actor_id, action, passenger_id, version, response_status, created_at
           FROM mobility_trip_events WHERE id > ? AND id <= ? ORDER BY id ASC LIMIT ${size}`,
        [after, upper]
      );
      if (!rows.length) break;
      for (const row of rows) { await upsertEvent(collection, row, now(), sourceTimezone); count++; }
      after = Number(rows.at(-1).id);
    }
    await sql.query('COMMIT');
  } catch (error) {
    await sql.query('ROLLBACK').catch(() => {});
    throw error;
  }
  return { scanned: count, snapshotUpperId: upper };
}
