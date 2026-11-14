import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const client = vi.hoisted(() => ({ fetchTimetable: vi.fn() }));
vi.mock('../lib/pesu-client.mjs', () => client);
import { POST } from '../app/api/pes-timetable/route';
const origin = 'https://campuspool-preview.example';
let sequence = 0;
function request({ headers = {}, body, raw, url = 'http://127.0.0.1:3013/api/pes-timetable' } = {}) {
  return new Request(url, { method: 'POST', headers: {
    Origin: origin, 'Content-Type': 'application/json', Authorization: `Bearer synthetic-session-${++sequence}`, ...headers,
  }, body: raw ?? JSON.stringify(body ?? { username: 'synthetic-srn', password: 'synthetic-secret' }), duplex: 'half' });
}
beforeEach(() => {
  vi.stubEnv('MOBILITY_PUBLIC_ORIGIN', origin);
  vi.stubEnv('MOBILITY_API_ORIGIN', 'http://127.0.0.1:18083');
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
  client.fetchTimetable.mockReset();
  client.fetchTimetable.mockResolvedValue({ entries: [{ title: 'Synthetic class' }] });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it('accepts the configured public origin despite private proxy Host, and verifies the app session', async () => {
  const response = await POST(request());
  expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store');
  expect(fetch.mock.calls[0][0]).toBe('http://127.0.0.1:18083/api/mobility/commute/me');
  expect(client.fetchTimetable).toHaveBeenCalledWith('synthetic-srn', 'synthetic-secret');
  expect(await response.text()).not.toContain('synthetic-secret');
});
it('rejects forged origins/forwarded hosts and cross-site requests before contacting Academy', async () => {
  expect((await POST(request({ headers: { Origin: 'https://attacker.example', 'X-Forwarded-Host': 'attacker.example' } }))).status).toBe(403);
  expect((await POST(request({ headers: { 'Sec-Fetch-Site': 'cross-site' } }))).status).toBe(403);
  expect(fetch).not.toHaveBeenCalled(); expect(client.fetchTimetable).not.toHaveBeenCalled();
});
it('fails closed without a configured public origin for remote requests; supports loopback development', async () => {
  vi.stubEnv('MOBILITY_PUBLIC_ORIGIN', '');
  expect((await POST(request({ url: 'https://private.example/api/pes-timetable', headers: { Origin: 'https://private.example' } }))).status).toBe(403);
  expect((await POST(request({ headers: { Origin: 'http://127.0.0.1:3013' } }))).status).toBe(200);
});
it('never sends credentials when app authentication is missing or rejected', async () => {
  expect((await POST(request({ headers: { Authorization: '' } }))).status).toBe(401);
  fetch.mockResolvedValueOnce(new Response('', { status: 401 }));
  expect((await POST(request())).status).toBe(401); expect(client.fetchTimetable).not.toHaveBeenCalled();
});
it('rejects oversized streamed JSON without trusting Content-Length and primitive JSON safely', async () => {
  const raw = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(JSON.stringify({ password: 'x'.repeat(5000) }))); c.close(); } });
  expect((await POST(request({ raw }))).status).toBe(400);
  for (const raw of ['123', '"string"', 'null', '[]']) expect((await POST(request({ raw }))).status).toBe(400);
  expect(client.fetchTimetable).not.toHaveBeenCalled();
});
it('limits attempts per session and never echoes upstream error details', async () => {
  client.fetchTimetable.mockRejectedValue(Object.assign(Error('synthetic-secret'), { code: 'PES_SIGN_IN_FAILED' }));
  const headers = { Authorization: `Bearer synthetic-limited-${++sequence}` };
  for (let i = 0; i < 3; ++i) {
    const response = await POST(request({ headers })); expect(response.status).toBe(401); expect(await response.text()).not.toContain('synthetic-secret');
  }
  expect((await POST(request({ headers }))).status).toBe(429); expect(client.fetchTimetable).toHaveBeenCalledTimes(3);
});
