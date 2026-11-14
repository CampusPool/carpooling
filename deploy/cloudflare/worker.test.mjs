import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker,{validSession} from './worker.mjs';
const env={TESTER_PASSWORD:'synthetic-long-tester-key',SESSION_SECRET:'synthetic-long-signing-key',ORIGIN_URL:'https://3013-example.instabox.tech',ORIGIN_TOKEN:'synthetic-port-key'};
test('anonymous pages redirect and anonymous APIs cannot reach origin',async()=>{
 const page=await worker.fetch(new Request('https://preview.workers.dev/'),env);
 assert.equal(page.status,303);assert.equal(page.headers.get('location'),'/_tester');
 assert.equal((await worker.fetch(new Request('https://preview.workers.dev/api/mobility/commute/me'),env)).status,401);
});
test('tester login rejects cross-origin, bad passwords and forged sessions',async()=>{
 const form=await worker.fetch(new Request('https://preview.workers.dev/_tester'),env);
 assert.equal(form.headers.get('Referrer-Policy'),'same-origin');
 const login=(origin,password)=>worker.fetch(new Request('https://preview.workers.dev/_tester',{method:'POST',headers:{Origin:origin},body:new URLSearchParams({password})}),env);
 assert.equal((await login('https://evil.example',env.TESTER_PASSWORD)).status,403);
 assert.equal((await login('null',env.TESTER_PASSWORD)).status,403);
 const invalid=await login('https://preview.workers.dev','wrong');
 assert.equal(invalid.status,403);
 assert.equal(invalid.headers.get('Referrer-Policy'),'same-origin');
 assert.equal(invalid.headers.get('Set-Cookie'),null);
 const invalidPage=await invalid.text();
 assert.match(invalidPage,/role="alert">That key did not match/);
 assert.match(invalidPage,/aria-describedby="key-error"/);
 assert.doesNotMatch(invalidPage,/wrong/);
 const response=await login('https://preview.workers.dev',env.TESTER_PASSWORD);
 assert.equal(response.status,303);
 const cookie=response.headers.get('set-cookie');
 assert.ok(cookie.includes('Secure; HttpOnly; SameSite=Strict'));
 assert.equal(await validSession(cookie,env.SESSION_SECRET),true);
 assert.equal(await validSession(cookie,'wrong'),false);
 assert.equal(await validSession(cookie,env.SESSION_SECRET,Date.now()+9*3600000),false);
 assert.equal(await validSession(cookie.replace(/tester=\d+/, 'tester=1'),env.SESSION_SECRET),false);
});
test('authenticated proxy preserves app bearer and replaces tester cookie with private origin credential',async()=>{
 const login=await worker.fetch(new Request('https://preview.workers.dev/_tester',{method:'POST',headers:{Origin:'https://preview.workers.dev'},body:new URLSearchParams({password:env.TESTER_PASSWORD})}),env);
 const original=globalThis.fetch;
 globalThis.fetch=async(url,init)=>{
  assert.equal(url.href,'https://3013-example.instabox.tech/api/mobility/commute/me');
  assert.equal(init.headers.get('Authorization'),'Bearer synthetic-app-session');
  assert.equal(init.headers.get('Cookie'),'__Host-instabox_port_auth=synthetic-port-key');
  assert.equal(init.headers.get('X-Forwarded-For'),null);
  return new Response('{}',{status:200});
 };
 try {assert.equal((await worker.fetch(new Request('https://preview.workers.dev/api/mobility/commute/me',{headers:{Cookie:login.headers.get('set-cookie'),Authorization:'Bearer synthetic-app-session','X-Forwarded-For':'spoofed'}}),env)).status,200);} finally{globalThis.fetch=original;}
});

test('remembered student credential is HttpOnly, can restore without tester cookie, and is forwarded only to the session route', async () => {
 const host = 'https://preview.workers.dev';
 const auth = '/api/mobility/college-auth';
 const secret = 'a'.repeat(64);
 const login = await worker.fetch(new Request(host+'/_tester',{method:'POST',headers:{Origin:host},body:new URLSearchParams({password:env.TESTER_PASSWORD})}),env);
 const tester = login.headers.get('set-cookie').split(';')[0];
 const original = globalThis.fetch;
 const seen = [];
 globalThis.fetch = async (url, init) => {
  seen.push([url.pathname, init.headers.get('X-CampusPool-Browser-Session')]);
  if (url.pathname === auth+'/verify') return Response.json({token:'synthetic-jwt',browser_session:secret});
  if (url.pathname === auth+'/session' && init.method === 'DELETE') return Response.json({logged_out:true});
  return Response.json({token:'restored-jwt'});
 };
 try {
  const verified = await worker.fetch(new Request(host+auth+'/verify',{method:'POST',headers:{Cookie:tester,'X-CampusPool-Browser-Session':'spoofed'},body:'{}'}),env);
  assert.deepEqual(await verified.json(),{token:'synthetic-jwt'});
  const cookie = verified.headers.get('set-cookie');
  assert.match(cookie, /__Host-campuspool_student=.*Secure; HttpOnly; SameSite=Strict; Max-Age=2592000/);
  const student = cookie.split(';')[0];
  assert.equal((await worker.fetch(new Request(host+'/',{headers:{Cookie:student}}),env)).status,200);
  const restored = await worker.fetch(new Request(host+auth+'/session',{headers:{Cookie:student}}),env);
  assert.equal((await restored.json()).token,'restored-jwt');
  assert.equal((await worker.fetch(new Request(host+auth+'/session',{headers:{Cookie:student+'x'}}),env)).status,401);
  assert.equal((await worker.fetch(new Request(host+auth+'/session',{method:'DELETE',headers:{Cookie:student,Origin:'https://other.example'}}),env)).status,403);
  const logout = await worker.fetch(new Request(host+auth+'/session',{method:'DELETE',headers:{Cookie:student,Origin:host}}),env);
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  assert.deepEqual(seen,[[auth+'/verify',null],['/',null],[auth+'/session',secret],[auth+'/session',secret]]);
  globalThis.fetch = async () => { throw new Error('Synthetic outage'); };
  const failedLogout = await worker.fetch(new Request(host+auth+'/session',{method:'DELETE',headers:{Cookie:student,Origin:host}}),env);
  assert.equal(failedLogout.status,502);
  assert.match(failedLogout.headers.get('set-cookie'), /Max-Age=0/);
 } finally {globalThis.fetch=original;}
});

test('anonymous admin ingress forwards only dashboard routes and static assets', async (t) => {
  const host = 'https://preview.workers.dev';
  const upstream = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 418 }));
  const allowed = [
    ['GET', '/admin'],
    ['HEAD', '/admin/'],
    ['GET', '/_next/static/chunks/2eim0gx_cb-2q.css'],
    ['GET', '/_next/static/chunks/turbopack-3-ry682tkyiqk.js'],
    ['POST', '/api/mobility/operator/login'],
    ['POST', '/api/mobility/operator/logout'],
    ['GET', '/api/mobility/operator/analytics?days=7'],
    ['GET', '/api/mobility/operator/trips/12'],
    ['POST', '/api/mobility/operator/memberships/12/decision'],
    ['POST', '/api/mobility/operator/driver-onboarding/12/review'],
    ['GET', '/api/admin/support/tickets/12'],
    ['POST', '/api/admin/support/tickets/12/resolve'],
  ];
  for (const [method, path] of allowed) {
    const response = await worker.fetch(new Request(host + path, {
      method, headers: { Authorization: 'Bearer synthetic-session' },
    }), env);
    assert.equal(response.status, 418, path);
    const [target, options] = upstream.mock.calls.at(-1).arguments;
    assert.equal(target.pathname + target.search, path);
    assert.equal(options.headers.get('Authorization'), 'Bearer synthetic-session');
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
  for (const [method, path, status] of [
    ['GET', '/', 303],
    ['GET', '/admin-other', 303],
    ['GET', '/_next/static/chunks/student.js.map', 303],
    ['POST', '/_next/static/chunks/asset.js', 303],
    ['GET', '/api/mobility/college-auth/config', 401],
    ['GET', '/api/mobility/operator/unknown', 401],
    ['GET', '/api/admin/support/tickets', 401],
    ['GET', '/api/mobility/operator/login', 401],
    ['DELETE', '/api/admin/support/tickets/12', 401],
  ]) {
    assert.equal((await worker.fetch(new Request(host + path, { method }), env)).status, status, path);
  }
  assert.equal(upstream.mock.callCount(), allowed.length);
});

test('password login stores the student browser session in a secure cookie', async () => {
 const host = 'https://preview.workers.dev';
 const login = await worker.fetch(new Request(host+'/_tester',{method:'POST',headers:{Origin:host},body:new URLSearchParams({password:env.TESTER_PASSWORD})}),env);
 const tester = login.headers.get('set-cookie').split(';')[0];
 const original = globalThis.fetch;
 globalThis.fetch = async () => Response.json({token:'synthetic-jwt', browser_session:'b'.repeat(64)});
 try {
  const response = await worker.fetch(new Request(host+'/api/mobility/college-auth/password-login',{
   method:'POST', headers:{Cookie:tester,Origin:host,'Content-Type':'application/json'}, body:'{}',
  }), env);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /__Host-campuspool_student=.*Secure; HttpOnly; SameSite=Strict/);
  assert.deepEqual(await response.json(), {token:'synthetic-jwt'});
 } finally { globalThis.fetch = original; }
});
