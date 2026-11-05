import { createServer } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { ACTIONS, dailyAggregation } from './projection.mjs';

const DAY = 86_400_000;
const MAX_BODY = 131_072;
const digest = (value) => createHash('sha256').update(value).digest();

function isoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(value)) return null;
  const [year, month, day, hour, minute, second] = value.slice(0, 19).split(/[-T:]/).map(Number);
  if (year < 1970 || month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()
      || hour > 23 || minute > 59 || second > 59 || /[+-]14:(?!00)/.test(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) ? date : null;
}

export function validateDailyInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).sort().join(',') !== 'from,to,trip_ids') throw new Error('Invalid activity request');
  const from = isoDate(body.from), to = isoDate(body.to);
  const duration = to && from ? to.valueOf() - from.valueOf() : 0;
  if (!from || !to || duration < DAY || duration > 31 * DAY || duration % DAY !== 0
      || !Array.isArray(body.trip_ids) || body.trip_ids.length > 5000
      || !body.trip_ids.every((id) => Number.isSafeInteger(id) && id > 0)
      || new Set(body.trip_ids).size !== body.trip_ids.length) throw new Error('Invalid activity request');
  return { from, to, tripIds: body.trip_ids };
}

function send(response, code, body) {
  response.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  let length = 0;
  const chunks = [];
  for await (const chunk of request) {
    length += chunk.length;
    if (length > MAX_BODY) throw new Error('Invalid activity request');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function safeRows(rows) {
  if (!Array.isArray(rows) || rows.length > 32 * ACTIONS.length) throw new Error('Invalid activity result');
  return rows.map((row) => {
    if (!row || !/^\d{4}-\d{2}-\d{2}$/.test(row.day) || !ACTIONS.includes(row.action)
        || !Number.isSafeInteger(row.eventCount) || row.eventCount < 0
        || !Number.isSafeInteger(row.uniqueTripCount) || row.uniqueTripCount < 0 || row.uniqueTripCount > row.eventCount) {
      throw new Error('Invalid activity result');
    }
    return { day: row.day, action: row.action, eventCount: row.eventCount, uniqueTripCount: row.uniqueTripCount };
  });
}

/** Only Laravel calls this private service; no public database/query surface. */
export function createActivityServer({ key, worker, collection }) {
  if (typeof key !== 'string' || key.length < 32) throw new Error('Analytics service key is required');
  const expectedKey = digest(key);
  const server = createServer(async (request, response) => {
    try {
      if (request.url === '/health' && request.method === 'GET') {
        const ready = worker.freshness().status === 'ready';
        return send(response, ready ? 200 : 503, { status: ready ? 'ready' : 'unavailable' });
      }
      const suppliedKey = request.headers['x-mobility-analytics-key'];
      if (typeof suppliedKey !== 'string' || !timingSafeEqual(expectedKey, digest(suppliedKey))) {
        return send(response, 401, { error: 'UNAUTHORIZED' });
      }
      if (request.url !== '/daily') return send(response, 404, { error: 'NOT_FOUND' });
      if (request.method !== 'POST') return send(response, 405, { error: 'METHOD_NOT_ALLOWED' });
      let input;
      try {
        if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] ?? '')) throw new Error('Invalid content type');
        input = validateDailyInput(await readBody(request));
      } catch { return send(response, 400, { error: 'INVALID_ACTIVITY_REQUEST' }); }

      let freshness = worker.freshness();
      if (freshness.status === 'unavailable') {
        return send(response, 503, { ...freshness, daily: [], message: 'Ride activity is temporarily unavailable.' });
      }
      const generation = worker.state.generation;
      const snapshotUpperId = worker.state.snapshotUpperId;
      const rows = safeRows(await collection.aggregate(dailyAggregation({ ...input, snapshotUpperId }), { maxTimeMS: 3000 }).toArray());
      // A replay may start while aggregate awaits Mongo; discard its result.
      freshness = worker.freshness();
      if (generation !== worker.state.generation || freshness.status === 'unavailable') {
        return send(response, 503, { ...freshness, status: 'unavailable', daily: [], message: 'Ride activity is being refreshed.' });
      }
      return send(response, 200, { ...freshness, daily: rows });
    } catch {
      return send(response, 503, { ...worker.freshness(), status: 'unavailable', daily: [], message: 'Ride activity is temporarily unavailable.' });
    }
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  server.keepAliveTimeout = 1000;
  server.maxRequestsPerSocket = 100;
  return server;
}
