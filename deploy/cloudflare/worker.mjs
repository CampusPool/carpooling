// HTTPS ingress for the tester preview and administrator sign-in. The origin remains an InstaBox private port.
const COOKIE = '__Host-campuspool_tester';
const STUDENT_COOKIE = '__Host-campuspool_student';
const STUDENT_MAX_AGE = 30 * 86400;
const STUDENT_SESSION_PATH = '/api/mobility/college-auth/session';
const STUDENT_VERIFY_PATH = '/api/mobility/college-auth/verify';
const STUDENT_PASSWORD_LOGIN_PATH = '/api/mobility/college-auth/password-login';
const STUDENT_HEADER = 'X-CampusPool-Browser-Session';

// Laravel checks the administrator password and authorizes each protected API.
function isAdminIngress(pathname, method) {
  if (method === 'GET' || method === 'HEAD') {
    return pathname === '/admin' || pathname === '/admin/'
      || /^\/_next\/static\/(?:[\w~-][\w.~-]*\/)*[\w~-][\w.~-]*\.(?:js|css|woff2?)$/.test(pathname)
      || /^\/api\/mobility\/operator\/(?:dashboard|analytics|memberships|host-applications|driver-onboarding|cash-disputes|dbms\/health|trips\/\d+)$/.test(pathname)
      || /^\/api\/admin\/support\/tickets\/\d+$/.test(pathname);
  }
  return method === 'POST' && (
    /^\/api\/mobility\/operator\/(?:login|logout|memberships\/\d+\/decision|driver-onboarding\/\d+\/review)$/.test(pathname)
    || /^\/api\/admin\/support\/tickets\/\d+\/(?:assign-me|resolve)$/.test(pathname)
  );
}

function studentCookie(value, maxAge) {
  return `${STUDENT_COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;
}
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
async function studentSession(cookie, secret, now = Date.now()) {
  const match = cookie.match(/(?:^|;\s*)__Host-campuspool_student=(\d+)\.([a-f0-9]{64})\.([a-f0-9]{64})(?:;|$)/);
  if (!match || Number(match[1]) <= now || Number(match[1]) > now + STUDENT_MAX_AGE * 1000) return null;
  const [, expiry, token, mac] = match;
  return await equal(mac, await signature(`student:${expiry}:${token}`, secret)) ? token : null;
}
function accessPage(invalidKey = false) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Preview access | CampusPool</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #142b25;
      background: #f7f6ef;
      font: 1rem/1.55 system-ui, sans-serif;
    }
    .layout {
      width: min(100% - 2rem, 32rem);
      margin-inline: auto;
      padding-block: clamp(1.75rem, 8vh, 6rem) 2rem;
    }
    header {
      display: flex;
      align-items: center;
      gap: .65rem;
      font-size: 1.15rem;
      font-weight: 750;
      letter-spacing: -.035em;
      margin-bottom: clamp(1.5rem, 6vh, 4rem);
    }
    .mark {
      display: grid;
      place-items: center;
      width: 2rem;
      height: 2rem;
      border-radius: .6rem;
      color: white;
      background: #165b48;
      letter-spacing: 0;
    }
    main {
      padding: clamp(1.25rem, 6vw, 2.75rem);
      border: 1px solid #d9ded3;
      border-radius: 1.4rem;
      background: #fff;
      box-shadow: 0 1rem 2.5rem #142b250a;
    }
    h1 {
      margin: 0;
      font-size: clamp(1.8rem, 6vw, 2.45rem);
      line-height: 1.1;
      letter-spacing: -.045em;
    }
    p { margin-block: .8rem 0; color: #485d55; }
    form { display: grid; gap: .55rem; margin-top: 1.6rem; }
    label { font-size: .9rem; font-weight: 680; }
    input, button { min-height: 3rem; width: 100%; border-radius: .65rem; font: inherit; }
    input {
      padding: .6rem .8rem;
      border: 1px solid #84988d;
      background: white;
      color: inherit;
    }
    button {
      margin-top: .55rem;
      padding: .65rem 1rem;
      border: 0;
      background: #165b48;
      color: white;
      font-weight: 700;
      cursor: pointer;
    }
    button:hover { background: #104936; }
    :focus-visible { outline: .18rem solid #165b48; outline-offset: .2rem; }
    .error { margin: 0; color: #9d291c; font-size: .9rem; }
    [aria-invalid="true"] { border-color: #9d291c; }
    .note { font-size: .875rem; margin-top: 1.1rem; }
  </style>
</head>
<body>
  <div class="layout">
    <header><span class="mark" aria-hidden="true">C</span>CampusPool</header>
    <main>
      <h1>Join the campus preview</h1>
      <p>Enter the access key from your CampusPool invitation.</p>
      <form method="post" action="/_tester">
        <label for="access-key">Preview access key</label>
        <input id="access-key" name="password" type="password" required autocomplete="current-password"${invalidKey ? ' aria-invalid="true" aria-describedby="key-error"' : ''}>
        ${invalidKey ? '<p class="error" id="key-error" role="alert">That key did not match. Check your invitation and try again.</p>' : ''}
        <button type="submit">Continue to CampusPool</button>
      </form>
      <p class="note">After opening the preview, sign in with your PES student email or SRN.</p>
    </main>
  </div>
</body>
</html>`;
}
function reply(body, status, headers={}) {
  return new Response(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...headers}});
}
function accessReply(status) {
  return reply(accessPage(status === 403),status,{
    'Content-Type':'text/html; charset=utf-8',
    // Native form submissions need a same-origin Origin header for the POST check.
    'Referrer-Policy':'same-origin',
    'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
  });
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!env.TESTER_PASSWORD || !env.SESSION_SECRET || !env.ORIGIN_TOKEN || !env.ORIGIN_URL) return reply('Preview unavailable',503);
    if (url.pathname === '/_tester') {
      if (request.method === 'GET') return accessReply(200);
      if (request.method !== 'POST' || request.headers.get('Origin') !== url.origin) return reply('Forbidden',403);
      if (Number(request.headers.get('Content-Length')||0)>1024) return reply('Request too large',413);
      const body = await request.text();
      if (body.length>1024) return reply('Request too large',413);
      const password = new URLSearchParams(body).get('password')||'';
      if (!await equal(password,env.TESTER_PASSWORD)) return accessReply(403);
      const expiry = String(Date.now()+8*3600000);
      return reply(null,303,{'Location':'/','Set-Cookie':`${COOKIE}=${expiry}.${await signature(expiry,env.SESSION_SECRET)}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=28800`});
    }
    const cookies = request.headers.get('Cookie') || '';
    const isSession = url.pathname === STUDENT_SESSION_PATH;
    const student = await studentSession(cookies, env.SESSION_SECRET);
    if (isSession) {
      if (!['GET', 'POST', 'DELETE'].includes(request.method)) return reply(null, 405);
      if (['POST', 'DELETE'].includes(request.method) && request.headers.get('Origin') !== url.origin) return reply(null, 403);
      if (!student && request.method !== 'POST') return reply(null, request.method === 'GET' ? 401 : 204);
    }
    if (!isAdminIngress(url.pathname, request.method) && !student && !await validSession(cookies, env.SESSION_SECRET)) {
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
    headers.delete(STUDENT_HEADER);
    if (isSession && student) headers.set(STUDENT_HEADER, student);
    headers.set('X-Forwarded-Host',url.host); headers.set('X-Forwarded-Proto','https');
    let upstream;
    try { upstream = await fetch(origin, {method:request.method, headers, body:['GET','HEAD'].includes(request.method)?undefined:request.body, redirect:'manual'}); }
    catch { return reply('CampusPool origin unavailable',502, isSession && request.method === 'DELETE' ? {'Set-Cookie': studentCookie('', 0)} : {}); }
    const responseHeaders=new Headers(upstream.headers);
    responseHeaders.set('Cache-Control','no-store');
    responseHeaders.set('X-Content-Type-Options','nosniff');
    responseHeaders.set('Referrer-Policy','strict-origin-when-cross-origin');
    responseHeaders.set('Strict-Transport-Security','max-age=31536000');
    const location=responseHeaders.get('Location');
    if(location) {
      const target=new URL(location,origin);
      if(target.origin===origin.origin) { target.host=url.host; responseHeaders.set('Location',target.toString()); }
    }
    if (isSession && (request.method === 'DELETE' || upstream.status === 401)) {
      responseHeaders.append('Set-Cookie', studentCookie('', 0));
    }
    if ([STUDENT_VERIFY_PATH, STUDENT_PASSWORD_LOGIN_PATH, STUDENT_SESSION_PATH].includes(url.pathname) && request.method === 'POST' && upstream.ok) {
      let result;
      try { result = await upstream.json(); }
      catch { return reply('Sign-in response unavailable', 502); }
      if (result && /^[a-f0-9]{64}$/.test(result.browser_session)) {
        const token = result.browser_session;
        const expiry = String(Date.now() + STUDENT_MAX_AGE * 1000);
        const mac = await signature(`student:${expiry}:${token}`, env.SESSION_SECRET);
        responseHeaders.append('Set-Cookie', studentCookie(`${expiry}.${token}.${mac}`, STUDENT_MAX_AGE));
      }
      if (result && typeof result === 'object') delete result.browser_session;
      responseHeaders.delete('Content-Length');
      responseHeaders.delete('Content-Encoding');
      return new Response(JSON.stringify(result), {status: upstream.status, headers: responseHeaders});
    }
    return new Response(upstream.body,{status:upstream.status,headers:responseHeaders});
  }
};
