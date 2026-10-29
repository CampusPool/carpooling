import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyAggregation, eventIndexes, projectEvent, syncSqlToMongo, upsertEvent } from '../src/projection.mjs';

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
