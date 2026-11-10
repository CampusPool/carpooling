// A minimal, read-only Academy timetable client. No passwords or cookies are persisted.
const ORIGIN = 'https://www.pesuacademy.com';
const BASE = ORIGIN + '/Academy';
const LIMIT = 2_000_000;
export class PesError extends Error { constructor(code, reason) { super(code); this.code = code; this.reason = reason; } }
function csrf(html) {
  for (const tag of html.match(/<(?:meta|input)\b[^>]*>/gi) || []) {
    const a = Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*["']([^"']*)["']/g)].map(m => [m[1].toLowerCase(), m[2]]));
    if (['_csrf','csrf-token','csrf_token'].includes(a.name?.toLowerCase())) return a.content || a.value || null;
  }
  return null;
}
function extractJSON(html,name) {
  const match = new RegExp('\\b(?:var|let|const)\\s+'+name+'\\s*=\\s*([\\[{])').exec(html);
  if(!match) throw new PesError('TIMETABLE_FORMAT_CHANGED',name+'_missing');
  const start=match.index+match[0].length-1, stack=[], close={'[':']','{':'}'};
  let str=false, esc=false;
  for(let i=start;i<html.length;i++) {
    const c=html[i];
    if(str){if(esc)esc=false;else if(c==='\\')esc=true;else if(c==='"')str=false;continue;}
    if(c==='"'){str=true;continue;}
    if(close[c])stack.push(close[c]);
    else if(c===']'||c==='}') {if(stack.pop()!==c)throw new PesError('TIMETABLE_FORMAT_CHANGED',name+'_brackets');if(!stack.length){try{return JSON.parse(html.slice(start,i+1));}catch{throw new PesError('TIMETABLE_FORMAT_CHANGED',name+'_invalid_json')}}}
  }
  throw new PesError('TIMETABLE_FORMAT_CHANGED',name+'_incomplete');
}
function time(s) {
 const m=String(s||'').trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
 if(!m)throw new PesError('TIMETABLE_FORMAT_CHANGED','time_syntax'); let h=Number(m[1]), min=Number(m[2]);
 if(min>59 || (m[3] ? h<1||h>12 : h>23))throw new PesError('TIMETABLE_FORMAT_CHANGED','time_range');
 if(m[3])h=(h%12)+(m[3].toUpperCase()==='PM'?12:0);
 return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
}
export function parseTimetable(html) {
 if(typeof html!=='string'||html.length>LIMIT)throw new PesError('TIMETABLE_FORMAT_CHANGED');
 const days=extractJSON(html,'days'),template=extractJSON(html,'timeTableTemplateDetailsJson'),data=extractJSON(html,'timeTableJson');
 if(!Array.isArray(days)||!days.length||days.length>7||!Array.isArray(template)||!data||Array.isArray(data)||typeof data!=='object')throw new PesError('TIMETABLE_FORMAT_CHANGED','invalid_structure');
 const usedSlots=new Set(Object.entries(data).flatMap(([key,parts])=>{const m=/^ttDivText_(\d+)_(\d+)_(\d+)$/.exec(key);return m&&Array.isArray(parts)&&parts.some(x=>typeof x==='string'&&x.startsWith('ttSubject_')&&x.includes('&&'))?[Number(m[2])]:[]}));
 const times=new Map();
 for(const row of template)if(Number(row.day)===0&&row.orderedBy!=null&&row.startTime&&row.endTime){const slot=Number(row.orderedBy);if(!usedSlots.has(slot))continue;if(!Number.isSafeInteger(slot)||slot<1||slot>100)throw new PesError('TIMETABLE_FORMAT_CHANGED','invalid_slot'); const x={start:time(row.startTime),end:time(row.endTime)};if(x.start>=x.end)throw new PesError('TIMETABLE_FORMAT_CHANGED','slot_time_order');if(times.has(slot)&&JSON.stringify(times.get(slot))!==JSON.stringify(x))throw new PesError('TIMETABLE_FORMAT_CHANGED','slot_time_conflict');times.set(slot,x);}
 const entries=[];
 for(const [key,parts] of Object.entries(data)) {
  const m=/^ttDivText_(\d+)_(\d+)_(\d+)$/.exec(key);if(!m)continue;
  const day=Number(m[1]),slot=Number(m[2]),option=Number(m[3]);if(day<1||day>days.length||!times.has(slot)||!Array.isArray(parts))throw new PesError('TIMETABLE_FORMAT_CHANGED','invalid_entry_reference');
  const s=parts.find(x=>typeof x==='string'&&x.startsWith('ttSubject_')&&x.includes('&&'));if(!s)continue;
  const title=s.slice(s.indexOf('&&')+2).trim(); if(!title||title.length>300)throw new PesError('TIMETABLE_FORMAT_CHANGED','invalid_entry_title');
  entries.push({day,dayName:String(days[day-1]),slot,option,...times.get(slot),title});
 }
 if(!times.size)throw new PesError('TIMETABLE_FORMAT_CHANGED','no_slot_times');
 if(!entries.length)throw new PesError('EMPTY_OR_UNRECOGNIZED_TIMETABLE');
 return {days:days.map(String),entries:entries.sort((a,b)=>a.day-b.day||a.slot-b.slot||a.option-b.option)};
}
export async function fetchTimetable(username,password,fetcher=fetch) {
 if(typeof username!=='string'||typeof password!=='string'||!username.trim()||!password||username.length>128||password.length>256)throw new PesError('INVALID_INPUT');
 const jar=new Map();let controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);
 async function request(url,options={}) {
  let current=new URL(url), method=options.method||'GET',body=options.body;
  for(let i=0;i<8;i++) {
   if(current.origin!==ORIGIN||current.username||current.password)throw new PesError('UNSAFE_REDIRECT');
   const headers={Accept:'text/html,application/xhtml+xml',...(options.headers||{})};if(jar.size)headers.Cookie=[...jar].map(([k,v])=>`${k}=${v}`).join('; ');
   let response;try{response=await fetcher(current,{method,body,headers,redirect:'manual',signal:controller.signal,cache:'no-store'});}catch{throw new PesError('PES_UNAVAILABLE');}
   for(const c of response.headers.getSetCookie?.()||[]) {const p=c.split(';',1)[0],i=p.indexOf('=');if(i>0)jar.set(p.slice(0,i),p.slice(i+1));}
   if(response.status>=300&&response.status<400){const target=response.headers.get('location');if(!target)throw new PesError('PES_UNEXPECTED_RESPONSE');const next=new URL(target,current);if(next.origin!==ORIGIN)throw new PesError('UNSAFE_REDIRECT');if(response.status===303||((response.status===301||response.status===302)&&method==='POST')){method='GET';body=undefined;}current=next;continue;}
   if(!response.ok)throw new PesError('PES_UNAVAILABLE');const text=await response.text();if(text.length>LIMIT)throw new PesError('PES_UNEXPECTED_RESPONSE');return text;
  }throw new PesError('PES_UNEXPECTED_RESPONSE');
 }
 try {
  const home=await request(BASE+'/'); const token=csrf(home);if(!token)throw new PesError('PES_LOGIN_CHANGED');
  const form=new URLSearchParams({_csrf:token,j_username:username.trim(),j_password:password});
  await request(BASE+'/j_spring_security_check',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form.toString()});
  const profile=await request(BASE+'/s/studentProfilePESU');
  if(/j_spring_security_check|j_password/i.test(profile)||!/studentProfilePESU|logout|dashboard/i.test(profile))throw new PesError('PES_SIGN_IN_FAILED');
  const current=csrf(profile)||token;
  const html=await request(BASE+'/s/studentProfilePESUAdmin?menuId=669&url=studentProfilePESUAdmin&controllerMode=6415&actionType=5&id=0&selectedData=0',{headers:{'X-Requested-With':'XMLHttpRequest','x-csrf-token':current}});
  if(/j_spring_security_check|j_password/i.test(html))throw new PesError('PES_SESSION_EXPIRED');
  return parseTimetable(html);
 } finally {clearTimeout(timer);jar.clear();}
}
