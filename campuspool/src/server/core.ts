import { createHash, randomUUID } from 'node:crypto';
import { z, ZodError, type ZodType } from 'zod';
import type { PoolConnection } from 'mysql2/promise';
import { exec, pool, rows, transaction } from './db';
import type { EventInput, User } from './types';
export class HttpError extends Error {
  constructor(public status:number,public code:string,message?:string){super(message||code.toLowerCase().replaceAll('_',' '));}
}
export function applicationOrigin(requestUrl?:string):string {
  const configured=process.env.APP_ORIGIN;
  if(!configured&&process.env.NODE_ENV==='production')throw new HttpError(503,'CONFIGURATION_REQUIRED');
  let url:URL;try{url=new URL(configured||requestUrl||'http://127.0.0.1:3000');}catch{throw new HttpError(503,'CONFIGURATION_REQUIRED');}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw new HttpError(503,'CONFIGURATION_REQUIRED');
  if(configured&&url.pathname!=='/')throw new HttpError(503,'CONFIGURATION_REQUIRED');
  if(process.env.NODE_ENV==='production'&&url.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new HttpError(503,'HTTPS_REQUIRED');
  return url.origin;
}
export function json(data:unknown,status=200):Response {return Response.json({data},{status,headers:{'Cache-Control':'private, no-store'}});}
export async function api(request:Request,handler:()=>Promise<Response>):Promise<Response> {
  try {
    if (!['GET','HEAD','OPTIONS'].includes(request.method)) {
      const origin=request.headers.get('origin');
      const expected=applicationOrigin(request.url);
      if (origin!==expected) throw new HttpError(403,'ORIGIN_REJECTED','Use the application from its configured origin.');
    }
    return await handler();
  } catch(error) {
    if (error instanceof ZodError) return Response.json({error:{code:'VALIDATION_FAILED',message:'Check the highlighted fields.',fields:error.flatten().fieldErrors}},{status:422});
    if (error instanceof HttpError) return Response.json({error:{code:error.code,message:error.message}},{status:error.status});
    const databaseError=error as {errno?:number;code?:string};
    if ([1062,1451,1452,3819,1644,1265].includes(databaseError.errno||0)) return Response.json({error:{code:'DATABASE_CONSTRAINT',message:'This operation conflicts with a database rule.'}},{status:409});
    if ([1205,1213].includes(databaseError.errno||0)) return Response.json({error:{code:'BUSY_RETRY',message:'Another update is in progress. Retry with the same request key.'}},{status:409});
    console.error('Request failed', {code:databaseError.code||'INTERNAL'});
    return Response.json({error:{code:'INTERNAL_ERROR',message:'The request could not be completed.'}},{status:500});
  }
}
export async function body<T>(request:Request,schema:ZodType<T>):Promise<T> {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new HttpError(415,'JSON_REQUIRED');
  if (Number(request.headers.get('content-length')||0)>32768) throw new HttpError(413,'BODY_TOO_LARGE');
  const reader=request.body?.getReader(); const chunks:Uint8Array[]=[];let size=0;
  if (reader) { for (;;) { const part=await reader.read(); if(part.done)break; size+=part.value.length; if(size>32768){await reader.cancel();throw new HttpError(413,'BODY_TOO_LARGE');} chunks.push(part.value); } }
  try { const value=Buffer.concat(chunks).toString('utf8');return schema.parse(JSON.parse(value||'{}')); }
  catch(error) {if(error instanceof ZodError)throw error;throw new HttpError(400,'INVALID_JSON');}
}
export function id(value:string|number):number {const number=Number(value);if(!Number.isSafeInteger(number)||number<1)throw new HttpError(422,'INVALID_ID');return number;}
export function key(request:Request):string {const value=request.headers.get('Idempotency-Key')||'';if(!/^[A-Za-z0-9._:-]{8,100}$/.test(value))throw new HttpError(422,'IDEMPOTENCY_KEY_REQUIRED');return value;}
export function hash(value:string):string{return createHash('sha256').update(value).digest('hex');}
export function canonical(value:unknown):string {
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value!==null&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}';
  return JSON.stringify(value) ?? 'null';
}
export async function requireUser(request:Request,approved=true):Promise<User> {
  const cookie=(request.headers.get('cookie')||'').split(';').map(p=>p.trim()).find(p=>p.startsWith('cp_session='))?.slice(11);
  if(!cookie||!/^[a-f0-9]{64}$/.test(cookie))throw new HttpError(401,'SIGN_IN_REQUIRED');
  const user=(await rows<User>(pool(),"SELECT u.id,u.name,u.email,u.role,u.status,u.credits FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP(3)",[hash(cookie)]))[0];
  if(!user)throw new HttpError(401,'SIGN_IN_REQUIRED');
  if(approved&&user.status!=='APPROVED')throw new HttpError(403,'MEMBERSHIP_REQUIRED','Your account needs administrator approval.');
  return user;
}
export async function idempotent<T>(actorId:number,value:string,scope:string,payload:unknown,fn:(cx:PoolConnection)=>Promise<T>):Promise<T> {
  const requestHash=hash(canonical({scope,payload}));const keyHash=hash(value);
  try {
    return await transaction(async cx=>{
      try {await exec(cx,"INSERT INTO idempotency_records(actor_id,key_hash,scope,payload_hash) VALUES(?,?,?,?)",[actorId,keyHash,scope,requestHash]);}
      catch(error) {if((error as {errno?:number}).errno===1062)throw new HttpError(409,'REPLAY_RECORD');throw error;}
      const actor=(await rows<{status:string}>(cx,'SELECT status FROM users WHERE id=? FOR SHARE',[actorId]))[0];
      if(actor?.status!=='APPROVED')throw new HttpError(403,'MEMBERSHIP_REQUIRED');
      const result=await fn(cx);
      await exec(cx,'UPDATE idempotency_records SET response_json=? WHERE actor_id=? AND key_hash=?',[JSON.stringify(result),actorId,keyHash]);
      return result;
    });
  } catch(error) {
    if(!(error instanceof HttpError)||error.code!=='REPLAY_RECORD')throw error;
    const row=(await rows<{payload_hash:string;response_json:unknown}>(pool(),'SELECT payload_hash,response_json FROM idempotency_records WHERE actor_id=? AND key_hash=?',[actorId,keyHash]))[0];
    if(!row||row.payload_hash!==requestHash)throw new HttpError(409,'IDEMPOTENCY_CONFLICT','This request key was already used for different input.');
    if(row.response_json===null)throw new HttpError(409,'BUSY_RETRY');
    return (typeof row.response_json==='string'?JSON.parse(row.response_json):row.response_json) as T;
  }
}
function safeData(value:unknown):void {
  if(!value||typeof value!=='object')return;
  for(const [name,child] of Object.entries(value)) {
    if(/password|token|secret|credential|email|phone|address|registration/i.test(name))throw new Error('Private data is not an activity payload');
    safeData(child);
  }
}
export async function emit(cx:PoolConnection,event:EventInput):Promise<void> {
  safeData(event.data);const audience=[...new Set([event.actorId,...event.audienceIds])];
  await exec(cx,'INSERT INTO outbox(event_id,type,actor_id,audience_ids,ride_id,booking_id,data) VALUES(?,?,?,?,?,?,?)',[randomUUID(),event.type,event.actorId,JSON.stringify(audience),event.rideId??null,event.bookingId??null,JSON.stringify(event.data)]);
}
export const reasonInput=z.object({reason:z.string().trim().max(200).optional()}).strict();
