import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createActivityServer, validateDailyInput } from '../src/server.mjs';
import { createWorker } from '../src/worker.mjs';
import { databaseConfig, mysqlOptions, serviceConfig } from '../src/config.mjs';

const key = 'unit-private-key-0123456789-abcdef';
const input = { from: '2026-11-04T00:00:00+05:30', to: '2026-11-05T00:00:00+05:30', trip_ids: [7, 8] };
const row = { day: '2026-11-04', action: 'start', eventCount: 2, uniqueTripCount: 1 };
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };

async function fixture(t, { sync = async () => ({ snapshotUpperId: 8 }), aggregate = async () => [row], now } = {}) {
  const worker = createWorker({ sync, now });
  let queries = 0;
  const collection = { aggregate(pipeline, options) { queries++; return { toArray: () => aggregate(pipeline, options) }; } };
  const server = createActivityServer({ key, worker, collection });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); await worker.stop(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(body = input, { token = key, path = '/daily', method = 'POST', contentType = 'application/json', raw } = {}) {
    const headers = { 'Content-Type': contentType };
    if (token !== null) headers['X-Mobility-Analytics-Key'] = token;
    const response = await fetch(base + path, { method, headers, ...(method === 'POST' ? { body: raw ?? JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json(), headers: response.headers };
  }
  return { worker, request, queries: () => queries };
}

test('private HTTP authenticates before reading queries and returns opaque health only', async (t) => {
  const f = await fixture(t);
  for (const token of [null, 'wrong', 'x'.repeat(400)]) {
    const result = await f.request(input, { token });
    assert.equal(result.status, 401);
    assert.deepEqual(result.body, { error: 'UNAUTHORIZED' });
  }
  assert.equal(f.queries(), 0);
  const health = await f.request(null, { path: '/health', method: 'GET', token: null });
  assert.equal(health.status, 503);
  assert.deepEqual(health.body, { status: 'unavailable' });
  await f.worker.run();
  assert.equal((await f.request(null, { path: '/health', method: 'GET', token: null })).status, 200);
});

test('HTTP rejects invalid or injectable input without querying Mongo', async (t) => {
  const f = await fixture(t);
  await f.worker.run();
  const invalid = [null, [], {}, { ...input, trip_ids: [7, 7] }, { ...input, trip_ids: ['7'] },
    { ...input, trip_ids: [0] }, { ...input, trip_ids: [Number.MAX_SAFE_INTEGER + 1] },
    { ...input, trip_ids: [{ $ne: null }] }, { ...input, pipeline: [{ $out: 'leak' }] },
    { ...input, trip_ids: Array.from({ length: 5001 }, (_, i) => i + 1) },
    { ...input, from: '2026-02-30T00:00:00Z' }, { ...input, from: '2026-11-04' },
    { ...input, to: input.from }, { ...input, to: '2026-12-07T00:00:00+05:30' },
    { ...input, to: '2026-11-05T00:30:00+05:30' }];
  for (const body of invalid) assert.equal((await f.request(body)).status, 400);
  assert.equal((await f.request(null, { raw: '{broken' })).status, 400);
  assert.equal((await f.request(input, { contentType: 'text/plain' })).status, 400);
  assert.equal((await f.request(input, { raw: ' '.repeat(131073) })).status, 400);
  assert.equal((await f.request(null, { method: 'GET' })).status, 405);
  assert.equal((await f.request(input, { path: '/unknown' })).status, 404);
  assert.equal(f.queries(), 0);
  assert.equal(validateDailyInput({ ...input, trip_ids: [] }).tripIds.length, 0);
  assert.equal(validateDailyInput({ ...input, from: '2026-10-05T00:00:00+05:30' }).tripIds.length, 2);
});

test('HTTP bounds Mongo to trip/time/completed snapshot and returns aggregate allow-list only', async (t) => {
  const f = await fixture(t, { aggregate: async (pipeline, options) => {
    assert.deepEqual(pipeline[0].$match.tripId, { $in: [7, 8] });
    assert.equal(pipeline[0].$match.occurredAt.$gte.toISOString(), '2026-11-03T18:30:00.000Z');
    assert.equal(pipeline[0].$match.occurredAt.$lt.toISOString(), '2026-11-04T18:30:00.000Z');
    assert.deepEqual(pipeline[0].$match.sourceEventId, { $lte: 8 });
    assert.equal(options.maxTimeMS, 3000);
    return [{ ...row, actorId: 101, passengerId: 102, request_fingerprint: 'private', response_body: { phone: 'private' } }];
  } });
  await f.worker.run();
  const result = await f.request();
  assert.equal(result.status, 200);
  assert.equal(result.body.status, 'ready');
  assert.deepEqual(result.body.daily, [row]);
  assert.match(result.headers.get('cache-control'), /private, no-store/);
  assert.doesNotMatch(JSON.stringify(result.body), /actorId|passengerId|fingerprint|phone|private/);
});

test('initial and failed partial replay suppress counts; concurrent run is single flight; retry recovers', async (t) => {
  let calls = 0;
  const gate = deferred();
  const f = await fixture(t, { sync: async () => { calls++; if (calls === 1) { await gate.promise; throw new Error('mysql://secret@host/private'); } return { snapshotUpperId: 9 }; } });
  assert.equal((await f.request()).status, 503);
  const first = f.worker.run();
  assert.equal(first, f.worker.run());
  assert.equal((await f.request()).status, 503);
  gate.resolve();
  assert.equal(await first, false);
  const failed = await f.request();
  assert.equal(failed.status, 503);
  assert.equal(failed.body.last_synced_at, null);
  assert.deepEqual(failed.body.daily, []);
  assert.doesNotMatch(JSON.stringify(failed.body), /secret|mysql|host/);
  assert.equal(f.queries(), 0);
  assert.equal(calls, 1);
  assert.equal(await f.worker.run(), true);
  assert.equal((await f.request()).status, 200);
});

test('failed refresh keeps old success timestamp but cannot present partial documents as ready or zero', async (t) => {
  let time = Date.parse('2026-11-05T00:00:00Z');
  let fail = false;
  const f = await fixture(t, { now: () => new Date(time), sync: async () => { if (fail) throw new Error('private'); return { snapshotUpperId: 8 }; } });
  await f.worker.run();
  const previous = f.worker.freshness().last_synced_at;
  time += 181000;
  let result = await f.request();
  assert.equal(result.body.status, 'stale');
  assert.equal(result.body.lag_seconds, 181);
  assert.deepEqual(result.body.daily, [row]);
  fail = true;
  await f.worker.run();
  result = await f.request();
  assert.equal(result.status, 503);
  assert.equal(result.body.last_synced_at, previous);
  assert.deepEqual(result.body.daily, []);
  assert.equal(f.worker.state.snapshotUpperId, 8);
});

test('HTTP discards aggregate if a replay starts and completes during the Mongo query', async (t) => {
  const entered = deferred(), release = deferred();
  const f = await fixture(t, { aggregate: async () => { entered.resolve(); await release.promise; return [row]; } });
  await f.worker.run();
  const pending = f.request();
  await entered.promise;
  await f.worker.run();
  release.resolve();
  const result = await pending;
  assert.equal(result.status, 503);
  assert.equal(result.body.status, 'unavailable');
  assert.deepEqual(result.body.daily, []);
});

test('Mongo outage and malformed aggregate return safe unavailable response', async (t) => {
  let mode = 'outage';
  const f = await fixture(t, { aggregate: async () => {
    if (mode === 'outage') throw new Error('mongodb://user:secret@private.internal/database');
    return [{ ...row, eventCount: '2' }];
  } });
  await f.worker.run();
  for (mode of ['outage', 'malformed']) {
    const result = await f.request();
    assert.equal(result.status, 503);
    assert.deepEqual(result.body.daily, []);
    assert.doesNotMatch(JSON.stringify(result.body), /mongodb|secret|internal|database/);
  }
});

test('synchronous worker failure can recover and periodic loop never overlaps', async () => {
  let calls = 0;
  const worker = createWorker({ sync: () => { if (++calls === 1) throw new Error('failure'); return { snapshotUpperId: 0 }; } });
  assert.equal(await worker.run(), false);
  assert.equal(await worker.run(), true);
  assert.equal(worker.freshness().status, 'ready');
  let active = 0, peak = 0;
  const done = deferred();
  const periodic = createWorker({ intervalSeconds: 0.005, sync: async () => {
    peak = Math.max(peak, ++active); await new Promise((resolve) => setTimeout(resolve, 8)); active--;
    if (++calls >= 5) done.resolve(); return { snapshotUpperId: calls };
  } });
  periodic.start(); periodic.start();
  await done.promise; await periodic.stop();
  const stoppedCalls = calls;
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(peak, 1);
  assert.equal(calls, stoppedCalls);
});

test('configuration validates service secret, database names and limits without exposing credentials', () => {
  const env = { MOBILITY_ACTIVITY_MYSQL_URL: 'mysql://reader:p%40ss@localhost:3307/mobility_test',
    MOBILITY_ACTIVITY_MYSQL_TIMEZONE: '+05:30', MOBILITY_ACTIVITY_MONGODB_URI: 'mongodb://localhost:27017',
    MOBILITY_ACTIVITY_MONGODB_DB: 'analytics_test', MOBILITY_ACTIVITY_SERVICE_KEY: key };
  const config = serviceConfig(env);
  assert.equal(config.mysql.password, 'p@ss'); assert.equal(config.mysql.port, 3307);
  assert.equal(config.port, 8090); assert.equal(config.intervalSeconds, 60);
  for (const change of [{ MOBILITY_ACTIVITY_SERVICE_KEY: 'short' }, { PORT: '0' }, { PORT: '1e3' },
    { SYNC_INTERVAL_SECONDS: '0' }, { MOBILITY_ACTIVITY_MONGODB_DB: '../private' },
    { MOBILITY_ACTIVITY_MYSQL_TIMEZONE: '+14:30' }, { MOBILITY_ACTIVITY_MYSQL_URL: 'https://reader:p%40ss@host/db' }]) {
    assert.throws(() => serviceConfig({ ...env, ...change }), (error) => !/p%40ss|p@ss|mongodb:\/\//.test(error.message));
  }
  assert.throws(() => databaseConfig({}));
  assert.throws(() => mysqlOptions('bad://secret', 'Z'));
});
