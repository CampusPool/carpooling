import {test} from 'node:test';import assert from 'node:assert/strict';import {parseTimetable,fetchTimetable} from '../lib/pesu-client.mjs';
const html=`<script>var days=["Monday","Tuesday"];var timeTableTemplateDetailsJson=[{"day":0,"orderedBy":1,"startTime":"08:00:00 AM","endTime":"09:00:00 AM"},{"day":0,"orderedBy":4,"startTime":"01:15 PM","endTime":"02:15 PM"}];var timeTableJson={"ttDivText_1_1_1":["ttSubject_&&A-Example 1"],"ttDivText_1_1_2":["ttSubject_&&B-Example 2"],"ttDivText_2_4_1":["ttSubject_&&C-Class with ]; } quoted"]};</script>`;
test('parses single-line scripts, alternatives, gaps and quoted braces',()=>{const t=parseTimetable(html);assert.equal(t.entries.length,3);assert.equal(t.entries[1].option,2);assert.equal(t.entries[2].start,'13:15');assert.equal(t.entries[2].title,'C-Class with ]; } quoted')});
test('rejects empty, broken, unknown-slot and invalid time data',()=>{for(const x of ['',html.replace('ttDivText_2_4_1','ttDivText_2_9_1'),html.replace('01:15 PM','25:77 PM'),html.replace('var timeTableJson=','var missing='),html.replace(/"ttDivText_1_1_1"[\s\S]*?(?=};<\/script>)/,'')])assert.throws(()=>parseTimetable(x));});
function network(mode='ok'){let calls=[];return {calls,async fetch(url,opts){const u=new URL(url);calls.push({url:u.toString(),method:opts.method,cookie:opts.headers.Cookie||'',body:opts.body||''});if(u.pathname==='/Academy/')return new Response('<meta name="_csrf" content="token">',{headers:{'set-cookie':'sid=fake; Path=/; Secure'}});if(u.pathname.endsWith('j_spring_security_check')){if(mode==='redirect')return new Response('',{status:307,headers:{location:'https://example.invalid/'}});return new Response('',{status:302,headers:{location:'/Academy/s/studentProfilePESU'}});}if(u.pathname.endsWith('studentProfilePESU'))return new Response(mode==='bad-login'?'<form name="j_password">':'<div>studentProfilePESU</div><meta name="_csrf" content="new">');if(u.pathname.endsWith('studentProfilePESUAdmin'))return new Response(html);throw Error('unexpected');}}}
test('performs bounded login and only requests timetable',async()=>{const net=network(), x=await fetchTimetable('test-user','fake-password',net.fetch);assert.equal(x.entries.length,3);assert.ok(net.calls.every(c=>new URL(c.url).origin==='https://www.pesuacademy.com'));assert.equal(net.calls.filter(c=>c.url.includes('studentProfilePESUAdmin')).length,1)});
test('rejects cross-origin redirect before forwarding credentials',async()=>{const net=network('redirect');await assert.rejects(()=>fetchTimetable('test-user','fake-password',net.fetch),{code:'UNSAFE_REDIRECT'});assert.ok(net.calls.every(c=>new URL(c.url).origin==='https://www.pesuacademy.com'));});
test('rejects failed authentication and does not fetch timetable',async()=>{const net=network('bad-login');await assert.rejects(()=>fetchTimetable('test','fake',net.fetch),{code:'PES_SIGN_IN_FAILED'});assert.equal(net.calls.some(c=>c.url.includes('studentProfilePESUAdmin')),false)});
test('network errors do not disclose credential values',async()=>{await assert.rejects(()=>fetchTimetable('test','superfake',async()=>{throw Error('superfake')}),e=>e.code==='PES_UNAVAILABLE'&&!e.message.includes('superfake'))});
test('ignores non-class template slots but validates actual class slots',()=>{const extra=html.replace('];var timeTableJson=',',{"day":0,"orderedBy":3,"startTime":"06:00 PM","endTime":"05:00 PM"}];var timeTableJson=');assert.equal(parseTimetable(extra).entries.length,3);assert.throws(()=>parseTimetable(extra.replace('08:00:00 AM','10:00 AM')),{reason:'slot_time_order'})});
test('bounds actual streamed response bytes without Content-Length',async()=>{
 const oversized=new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(2_000_001));c.close();}}));
 await assert.rejects(()=>fetchTimetable('synthetic','synthetic',async()=>oversized),{code:'PES_UNEXPECTED_RESPONSE'});
});

test('recognizes an active Academy verification challenge and does not fetch the timetable', async () => {
  const calls = [];
  const fetch = async (url) => {
    calls.push(url.pathname);
    if (url.pathname === '/Academy/') return new Response('<meta name="csrf-token" content="token"><div id="postPasswordOtpModal"></div>');
    return new Response('<input name="j_password" type="password"><script>openPostPasswordOtpModal("a masked contact");</script>');
  };
  await assert.rejects(() => fetchTimetable('test-user', 'synthetic', fetch), { code: 'PES_VERIFICATION_REQUIRED' });
  assert.deepEqual(calls, ['/Academy/', '/Academy/j_spring_security_check']);
});

test('ignores timetable placeholders in unused slots and rejects invalid alternatives', () => {
  const withPlaceholder = html.replace('"ttDivText_1_1_1"', '"ttDivText_1_97_1":[], "ttDivText_1_1_1"');
  assert.equal(parseTimetable(withPlaceholder).entries.length, 3);
  assert.throws(() => parseTimetable(html.replace('ttDivText_1_1_2', 'ttDivText_1_1_101')), { reason: 'invalid_entry_reference' });
});
