import {fetchTimetable} from '../../../lib/pesu-client.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const reply=(body,status)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const attempts=new Map();
export async function POST(req){
 const origin=req.headers.get('origin'),host=req.headers.get('host');let sameOrigin=false;try{const o=new URL(origin||'');sameOrigin=(o.protocol==='http:'||o.protocol==='https:')&&o.host===host}catch{}if(!sameOrigin||req.headers.get('sec-fetch-site')==='cross-site')return reply({error:'Forbidden'},403);
 const auth=req.headers.get('authorization')||''; if(!/^Bearer [^\s]{8,2048}$/.test(auth))return reply({error:'Sign in to CampusPool first'},401);
 const backend=process.env.MOBILITY_API_ORIGIN||'http://127.0.0.1:18080';
 try {const r=await fetch(`${backend}/api/mobility/commute/me`,{headers:{Authorization:auth},signal:AbortSignal.timeout(5000),cache:'no-store',redirect:'error'});if(!r.ok)return reply({error:'CampusPool session invalid'},401);}catch{return reply({error:'CampusPool service unavailable'},503)}
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(auth))),b=>b.toString(16).padStart(2,'0')).join('');const now=Date.now();for(const [k,v] of attempts)if(v.until<=now)attempts.delete(k);const a=attempts.get(hash)||{count:0,until:now+300000};if(a.count>=3)return reply({error:'Please wait before trying again'},429);a.count++;attempts.set(hash,a);
 if(Number(req.headers.get('content-length')||0)>4096)return reply({error:'Invalid request'},400);
 let payload;try{payload=await req.json()}catch{return reply({error:'Invalid request'},400)}
 try{const data=await fetchTimetable(payload?.username,payload?.password);return reply({data},200)}catch(e){const code=e?.code||'PES_UNAVAILABLE';const map={INVALID_INPUT:[400,'Enter your PES SRN and password.'],PES_SIGN_IN_FAILED:[401,'PES sign-in failed. Check your details or sign in to Academy directly.'],PES_SESSION_EXPIRED:[401,'PES session expired. Please try again.'],PES_UNAVAILABLE:[503,'PES Academy is temporarily unavailable.'],UNSAFE_REDIRECT:[502,'PES returned an unexpected redirect.'],PES_LOGIN_CHANGED:[502,'The PES login page has changed.'],EMPTY_OR_UNRECOGNIZED_TIMETABLE:[422,'No timetable could be verified.'],TIMETABLE_FORMAT_CHANGED:[502,'The PES timetable format has changed.']};const [status,message]=map[code]||[502,'PES timetable could not be retrieved.'];return reply({error:message,code},status)}
}
