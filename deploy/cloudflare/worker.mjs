// Tester-only HTTPS ingress. The origin remains an InstaBox private port.
const COOKIE = '__Host-campuspool_tester';
const encoder = new TextEncoder();
const hex = bytes => [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
async function key(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), {name:'HMAC', hash:'SHA-256'}, false, ['sign','verify']);
}
async function signature(value, secret) {
  return hex(await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(value)));
}
async function equal(a, b) {
  const digest = value => crypto.subtle.digest('SHA-256', encoder.encode(value));
  const [x,y] = await Promise.all([digest(a),digest(b)]);
  let difference = 0;
  const u = new Uint8Array(x), v = new Uint8Array(y);
  for (let i=0;i<u.length;i++) difference |= u[i]^v[i];
  return difference === 0;
}
export async function validSession(cookie, secret, now=Date.now()) {
  const match = cookie.match(/(?:^|;\s*)__Host-campuspool_tester=(\d+)\.([0-9a-f]{64})(?:;|$)/);
  if (!match || Number(match[1]) <= now || Number(match[1]) > now+8*3600000) return false;
  return equal(match[2], await signature(match[1], secret));
}
const page = `<!doctype html><meta name="viewport" content="width=device-width"><title>CampusPool tester access</title><main style="font:18px system-ui;max-width:440px;margin:12vh auto;padding:24px"><h1>CampusPool tester access</h1><p>Enter the access key shared by the CampusPool team to open this private preview. Once inside, sign in separately with your PES email or SRN.</p><form method="post" action="/_tester"><label>Tester access key <input name="password" type="password" required autocomplete="current-password" style="display:block;width:100%;margin:16px 0;padding:10px;box-sizing:border-box"></label><button style="padding:10px 20px">Open CampusPool</button></form></main>`;
function reply(body, status, headers={}) {
  return new Response(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...headers}});
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!env.TESTER_PASSWORD || !env.SESSION_SECRET || !env.ORIGIN_TOKEN || !env.ORIGIN_URL) return reply('Preview unavailable',503);
    if (url.pathname === '/_tester') {
      // Native form submissions need their same-origin Origin header for the POST check.
      if (request.method === 'GET') return reply(page,200,{
        'Content-Type':'text/html; charset=utf-8',
        'Referrer-Policy':'same-origin',
        'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
      });
      if (request.method !== 'POST' || request.headers.get('Origin') !== url.origin) return reply('Forbidden',403);
      if (Number(request.headers.get('Content-Length')||0)>1024) return reply('Request too large',413);
      const body = await request.text();
      if (body.length>1024) return reply('Request too large',413);
      const password = new URLSearchParams(body).get('password')||'';
      if (!await equal(password,env.TESTER_PASSWORD)) return reply('Invalid tester key',403);
      const expiry = String(Date.now()+8*3600000);
      return reply(null,303,{'Location':'/','Set-Cookie':`${COOKIE}=${expiry}.${await signature(expiry,env.SESSION_SECRET)}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=28800`});
    }
    if (!await validSession(request.headers.get('Cookie')||'',env.SESSION_SECRET)) {
      if (url.pathname.startsWith('/api/')) return reply('{"error":"tester_access_required"}',401,{'Content-Type':'application/json'});
      return reply(null,303,{'Location':'/_tester'});
    }
    const origin = new URL(env.ORIGIN_URL);
    if (origin.protocol !== 'https:' || !origin.hostname.endsWith('.instabox.tech')) return reply('Origin configuration invalid',503);
    origin.pathname=url.pathname; origin.search=url.search;
    const headers = new Headers(request.headers);
    // Never forward the tester credential to the application or trust client proxy headers.
    headers.set('Cookie', `__Host-instabox_port_auth=${env.ORIGIN_TOKEN}`);
    headers.delete('Host'); headers.delete('Forwarded'); headers.delete('X-Forwarded-For');
    headers.set('X-Forwarded-Host',url.host); headers.set('X-Forwarded-Proto','https');
    let upstream;
    try { upstream = await fetch(origin, {method:request.method, headers, body:['GET','HEAD'].includes(request.method)?undefined:request.body, redirect:'manual'}); }
    catch { return reply('CampusPool origin unavailable',502); }
    const responseHeaders=new Headers(upstream.headers);
    responseHeaders.set('Cache-Control','no-store');
    responseHeaders.set('X-Content-Type-Options','nosniff');
    responseHeaders.set('Referrer-Policy','no-referrer');
    responseHeaders.set('Strict-Transport-Security','max-age=31536000');
    const location=responseHeaders.get('Location');
    if(location) {
      const target=new URL(location,origin);
      if(target.origin===origin.origin) { target.host=url.host; responseHeaders.set('Location',target.toString()); }
    }
    return new Response(upstream.body,{status:upstream.status,headers:responseHeaders});
  }
};
