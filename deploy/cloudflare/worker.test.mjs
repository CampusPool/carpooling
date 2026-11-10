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
 assert.equal((await login('https://preview.workers.dev','wrong')).status,403);
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
