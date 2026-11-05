import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyAggregation, eventIndexes, eventValidator, ensureCollection, projectEvent, syncSqlToMongo, upsertEvent } from '../src/projection.mjs';

const row = (id = 1) => ({ id, trip_id: 7, actor_id: 11, action: 'arrive', passenger_id: null, version: 1, response_status: 200, created_at: '2026-10-27T10:00:00Z' });

test('projection redacts response payload and request identifiers', () => {
  const doc = projectEvent(row());
  assert.equal(doc.sourceEventId, 1);
  assert.equal(doc.privacy.responseBodyOmitted, true);
  assert.equal(doc.privacy.containsLinkableIdentifiers, true);
  assert.equal('response_body' in doc, false);
  assert.throws(() => projectEvent({ ...row(), response_body: '{"phone":"secret"}' }), /sensitive/);
});

test('upsert is idempotent on source event id', async () => {
  const docs = new Map();
  const collection = { updateOne: async (filter, update) => {
    if (docs.has(filter.sourceEventId)) return { upsertedCount: 0 };
    docs.set(filter.sourceEventId, update.$setOnInsert);
    return { upsertedCount: 1 };
  } };
  await upsertEvent(collection, row());
  await upsertEvent(collection, row());
  assert.equal(docs.size, 1);
});

test('sync uses a transaction snapshot and replays from zero without high-water state', async () => {
  const calls = [];
  const sql = {
    query: async (q) => { calls.push(q); if (q.startsWith('SELECT COALESCE')) return [[{ upper_id: 2 }]]; return [[]]; },
    execute: async () => [[row(1), row(2)]]
  };
  const ids = [];
  const collection = { updateOne: async (f) => { ids.push(f.sourceEventId); return { upsertedCount: 1 }; } };
  const result = await syncSqlToMongo({ sql, collection, pageSize: 250, sourceTimezone: 'UTC' });
  assert.deepEqual(ids, [1, 2]);
  assert.equal(result.snapshotUpperId, 2);
  assert.match(calls[0], /SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY/);
  assert.match(calls[1], /START TRANSACTION WITH CONSISTENT SNAPSHOT/);
  assert.equal(calls.some((q) => /high.?water/i.test(q)), false);
});

test('indexes and daily aggregation support analytics queries', () => {
  assert.equal(eventIndexes()[0].options.unique, true);
  const pipeline = dailyAggregation();
  assert.equal(pipeline[0].$group.eventCount.$sum, 1);
  assert.equal(pipeline[0].$group._id.day.$dateToString.timezone, 'Asia/Kolkata');
  assert.equal(pipeline[0].$group._id.day.$dateToString.format, '%Y-%m-%d');
});

test('replay recovers a delayed lower-id commit and partial writes without duplicate events', async () => {
  let visible = [row(1), row(3)];
  const documents = new Map();
  let failAt = null;
  let rollbacks = 0;
  const sql = {
    query: async (statement) => {
      if (statement.startsWith('SELECT COALESCE')) return [[{ upper_id: Math.max(...visible.map((r) => r.id)) }]];
      if (statement === 'ROLLBACK') rollbacks++;
      return [[]];
    },
    execute: async (_, [after, upper]) => [visible.filter((r) => r.id > after && r.id <= upper)]
  };
  const collection = { updateOne: async (filter, update) => {
    if (filter.sourceEventId === failAt) throw new Error('write interrupted');
    if (documents.has(filter.sourceEventId)) return { upsertedCount: 0 };
    documents.set(filter.sourceEventId, update.$setOnInsert);
    return { upsertedCount: 1 };
  } };
  await syncSqlToMongo({ sql, collection });
  assert.deepEqual([...documents.keys()], [1, 3]);
  visible = [row(1), row(2), row(3), row(4)];
  failAt = 4;
  await assert.rejects(syncSqlToMongo({ sql, collection }), /interrupted/);
  assert.equal(rollbacks, 1);
  assert.equal(documents.size, 3);
  failAt = null;
  const result = await syncSqlToMongo({ sql, collection });
  assert.equal(result.snapshotUpperId, 4);
  assert.deepEqual([...documents.keys()].sort(), [1, 2, 3, 4]);
  await syncSqlToMongo({ sql, collection });
  assert.equal(documents.size, 4);
});

test('projection rejects invalid identifiers, action, status and timezone before Mongo writes', () => {
  for (const change of [{ trip_id: 0 }, { actor_id: 'bad' }, { passenger_id: -1 }, { version: 0 },
    { id: Number.MAX_SAFE_INTEGER + 1 }, { action: '$where' }, { response_status: 999 }, { created_at: 'bad' }]) {
    assert.throws(() => projectEvent({ ...row(), ...change }), /invalid SQL/);
  }
  assert.throws(() => projectEvent(row(), new Date(), 'untrusted-zone'), /invalid SQL/);
});

test('strict schema validator and trip/time index are installed for new and existing collections', async () => {
  const calls = [];
  const db = {
    createCollection: async (name, options) => { calls.push({ name, options }); },
    command: async (command) => { calls.push(command); },
    collection: () => ({ createIndex: async (key, options) => { calls.push({ key, options }); } })
  };
  await ensureCollection(db, 'events');
  assert.equal(calls[0].options.validationAction, 'error');
  assert.deepEqual(calls[0].options.validator, eventValidator());
  assert.equal(eventValidator().$jsonSchema.additionalProperties, false);
  assert.ok(calls.some((call) => call.options?.name === 'activity_trip_occurred' && call.key.tripId === 1));
  calls.length = 0;
  db.createCollection = async () => { throw { code: 48, codeName: 'NamespaceExists' }; };
  await ensureCollection(db, 'events');
  assert.equal(calls[0].collMod, 'events');
  assert.equal(calls[0].validationLevel, 'strict');
  db.createCollection = async () => { throw new Error('permission denied'); };
  await assert.rejects(ensureCollection(db, 'events'), /permission/);
});

test('replay run budget rolls back instead of reporting a successful partial scan', async () => {
  let rolledBack = false;
  let time = 0;
  const sql = { query: async (statement) => {
    if (statement === 'ROLLBACK') rolledBack = true;
    return statement.startsWith('SELECT COALESCE') ? [[{ upper_id: 2 }]] : [[]];
  }, execute: async () => [[row(1), row(2)]] };
  const collection = { updateOne: async () => { time += 100; return { upsertedCount: 1 }; } };
  await assert.rejects(syncSqlToMongo({ sql, collection, clock: () => time, maxDurationMs: 100 }), /timed out/);
  assert.equal(rolledBack, true);
});
