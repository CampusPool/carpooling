const FORBIDDEN = new Set(['response_body', 'request_fingerprint', 'idempotency_key']);
export const ACTIONS = Object.freeze(['arrive', 'start', 'board', 'alight', 'complete', 'cancel']);

const positiveInteger = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0;

/** Mongo validates the same allow-listed shape as the SQL projector. */
export function eventValidator() {
  const integer = { bsonType: ['double', 'int', 'long'], minimum: 1, maximum: Number.MAX_SAFE_INTEGER, multipleOf: 1 };
  return { $jsonSchema: {
    bsonType: 'object', additionalProperties: false,
    required: ['source', 'sourceEventId', 'tripId', 'actorId', 'passengerId', 'action', 'version', 'responseStatus', 'occurredAt', 'projectedAt', 'sourceTimezone', 'privacy'],
    properties: {
      _id: {}, source: { enum: ['mysql.mobility_trip_events'] },
      sourceEventId: integer, tripId: integer, actorId: integer,
      passengerId: { anyOf: [integer, { bsonType: 'null' }] },
      action: { enum: [...ACTIONS] }, version: integer,
      responseStatus: { bsonType: ['double', 'int', 'long'], minimum: 100, maximum: 599, multipleOf: 1 },
      occurredAt: { bsonType: 'date' }, projectedAt: { bsonType: 'date' },
      sourceTimezone: { bsonType: 'string', pattern: '^(UTC|Z|[+-](0[0-9]|1[0-4]):[0-5][0-9])$' },
      privacy: { bsonType: 'object', additionalProperties: false,
        required: ['responseBodyOmitted', 'containsLinkableIdentifiers'], properties: {
          responseBodyOmitted: { enum: [true] }, containsLinkableIdentifiers: { enum: [true] }
        } }
    }
  } };
}

/** Convert only the non-sensitive, SQL-authoritative event columns. */
export function projectEvent(row, projectedAt = new Date(), sourceTimezone = 'UTC') {
  for (const key of FORBIDDEN) {
    if (Object.hasOwn(row, key)) throw new Error(`refusing sensitive SQL column: ${key}`);
  }
  const occurredAt = row.created_at instanceof Date ? row.created_at : new Date(row.created_at);
  if (![row.id, row.trip_id, row.actor_id, row.version].every(positiveInteger)
      || (row.passenger_id != null && !positiveInteger(row.passenger_id))
      || !ACTIONS.includes(row.action)
      || !Number.isInteger(Number(row.response_status)) || Number(row.response_status) < 100 || Number(row.response_status) > 599
      || Number.isNaN(occurredAt.valueOf()) || !(projectedAt instanceof Date) || Number.isNaN(projectedAt.valueOf())
      || !/^(?:UTC|Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(sourceTimezone)) {
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
    { key: { actorId: 1, occurredAt: -1 }, options: { name: 'activity_actor_occurred' } },
    { key: { tripId: 1, occurredAt: 1 }, options: { name: 'activity_trip_occurred' } }
  ];
}

export async function ensureCollection(db, name) {
  const options = { validator: eventValidator(), validationLevel: 'strict', validationAction: 'error' };
  try {
    await db.createCollection(name, options);
  } catch (error) {
    if (error.codeName !== 'NamespaceExists' && error.code !== 48) throw error;
    await db.command({ collMod: name, ...options });
  }
  const collection = db.collection(name);
  for (const index of eventIndexes()) await collection.createIndex(index.key, index.options);
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

export function dailyAggregation({ timezone = 'Asia/Kolkata', tripIds, from, to, snapshotUpperId } = {}) {
  const match = {};
  if (tripIds !== undefined) match.tripId = { $in: tripIds };
  if (from !== undefined && to !== undefined) match.occurredAt = { $gte: from, $lt: to };
  if (snapshotUpperId !== undefined) match.sourceEventId = { $lte: snapshotUpperId };
  return [
    ...(Object.keys(match).length ? [{ $match: { ...match, source: 'mysql.mobility_trip_events', action: { $in: [...ACTIONS] } } }] : []),
    { $group: {
      _id: { day: { $dateToString: { date: '$occurredAt', format: '%Y-%m-%d', timezone } }, action: '$action' },
      eventCount: { $sum: 1 },
      tripCount: { $addToSet: '$tripId' }
    } },
    { $project: { _id: 0, day: '$_id.day', action: '$_id.action', eventCount: 1, uniqueTripCount: { $size: '$tripCount' } } },
    { $sort: { day: 1, action: 1 } }
  ];
}

export async function syncSqlToMongo({ sql, collection, pageSize = 250, sourceTimezone = 'UTC', now = () => new Date(), maxDurationMs = 120_000, clock = () => Date.now() }) {
  const size = Math.max(1, Math.min(5000, Number(pageSize) || 250));
  const started = clock();
  const assertTime = () => { if (clock() - started >= maxDurationMs) throw new Error('projection run timed out'); };
  await sql.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
  await sql.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
  let upper;
  let count = 0;
  try {
    const [maxRows] = await sql.query('SELECT COALESCE(MAX(id), 0) AS upper_id FROM mobility_trip_events');
    upper = Number(maxRows[0].upper_id);
    let after = 0;
    while (after < upper) {
      assertTime();
      const [rows] = await sql.execute(
        `SELECT id, trip_id, actor_id, action, passenger_id, version, response_status, created_at
           FROM mobility_trip_events WHERE id > ? AND id <= ? ORDER BY id ASC LIMIT ${size}`,
        [after, upper]
      );
      if (!rows.length) break;
      for (const row of rows) { assertTime(); await upsertEvent(collection, row, now(), sourceTimezone); count++; }
      after = Number(rows.at(-1).id);
    }
    assertTime();
    await sql.query('COMMIT');
  } catch (error) {
    await sql.query('ROLLBACK').catch(() => {});
    throw error;
  }
  return { scanned: count, snapshotUpperId: upper };
}
