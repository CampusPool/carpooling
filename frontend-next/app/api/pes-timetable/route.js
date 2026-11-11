import { createHash } from 'node:crypto';
import { fetchTimetable } from '../../../lib/pesu-client.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const attempts = new Map();
const reply = (body, status) => Response.json(body, { status, headers: {
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
} });

// The Worker changes Host when forwarding. The public origin is explicit rather
// than trusting arbitrary client-supplied X-Forwarded-Host values.
function allowedOrigin(req) {
  try {
    const origin = new URL(req.headers.get('origin') || '');
    const configured = process.env.MOBILITY_PUBLIC_ORIGIN;
    const local = new URL(req.url);
    const expected = configured ? new URL(configured) : local;
    if (!configured && !['localhost', '127.0.0.1', '[::1]'].includes(local.hostname)) return false;
    return ['http:', 'https:'].includes(expected.protocol) && origin.origin === expected.origin
      && req.headers.get('sec-fetch-site') !== 'cross-site';
  } catch { return false; }
}

async function readBody(req) {
  if (Number(req.headers.get('content-length') || 0) > 4096) throw Error('BODY_TOO_LARGE');
  const reader = req.body?.getReader();
  if (!reader) throw Error('INVALID_BODY');
  const timer = setTimeout(() => { reader.cancel().catch(() => {}); }, 5000);
  try {
    const chunks = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); throw Error('BODY_TOO_LARGE'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const value of chunks) { bytes.set(value, offset); offset += value.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } finally { clearTimeout(timer); reader.releaseLock(); }
}

export async function POST(req) {
  if (!allowedOrigin(req)) return reply({ error: 'Forbidden' }, 403);
  if (!(req.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return reply({ error: 'Expected JSON' }, 415);
  const authorization = req.headers.get('authorization') || '';
  if (!/^Bearer [^\s]{8,2048}$/.test(authorization)) return reply({ error: 'Sign in to CampusPool first' }, 401);
  const backend = process.env.MOBILITY_API_ORIGIN || 'http://127.0.0.1:18080';
  try {
    const response = await fetch(`${backend}/api/mobility/commute/me`, { headers: { Authorization: authorization }, signal: AbortSignal.timeout(5000), cache: 'no-store', redirect: 'error' });
    if (!response.ok) {
      const unauthorized = response.status === 401 || response.status === 403;
      return reply({
        error: unauthorized ? 'Your CampusPool session expired. Sign in again to import.' : 'CampusPool service unavailable.',
        code: unauthorized ? 'CAMPUSPOOL_SESSION_EXPIRED' : 'CAMPUSPOOL_UNAVAILABLE',
      }, unauthorized ? 401 : 503);
    }
  } catch { return reply({ error: 'CampusPool service unavailable' }, 503); }
  const hash = createHash('sha256').update(authorization).digest('hex');
  const now = Date.now();
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
  const attempt = attempts.get(hash) || { count: 0, until: now + 300000 };
  if (attempt.count >= 3 || attempts.size >= 10000 && !attempts.has(hash)) return reply({ error: 'Please wait before trying again' }, 429);
  attempt.count++; attempts.set(hash, attempt);
  let payload;
  try { payload = await readBody(req); if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw Error('INVALID_BODY'); } catch { return reply({ error: 'Invalid or oversized request' }, 400); }
  try {
    const data = await fetchTimetable(payload?.username, payload?.password);
    return reply({ data }, 200);
  } catch (error) {
    const code = error?.code || 'PES_UNAVAILABLE';
    const messages = {
      INVALID_INPUT: [400, 'Enter your PES SRN and password.'],
      PES_SIGN_IN_FAILED: [401, 'PES sign-in failed. Check your details or sign in to Academy directly.'],
      PES_VERIFICATION_REQUIRED: [422, 'Academy requires an additional verification step. Open PES Academy to view your schedule and add your classes here.'],
      PES_SESSION_EXPIRED: [401, 'PES session expired. Please try again.'],
      PES_UNAVAILABLE: [503, 'PES Academy is temporarily unavailable.'],
      UNSAFE_REDIRECT: [502, 'PES returned an unexpected redirect.'],
      PES_LOGIN_CHANGED: [502, 'The PES login page has changed.'],
      EMPTY_OR_UNRECOGNIZED_TIMETABLE: [422, 'No timetable could be verified.'],
      PES_UNEXPECTED_RESPONSE: [502, 'Academy returned an unexpected response. Try again or add your classes manually.'],
      TIMETABLE_FORMAT_CHANGED: [502, 'The PES timetable format has changed.'],
    };
    const [status, message] = messages[code] || [502, 'PES timetable could not be retrieved.'];
    return reply({ error: message, code }, status);
  } finally { if (payload) { payload.password = undefined; payload.username = undefined; } }
}
