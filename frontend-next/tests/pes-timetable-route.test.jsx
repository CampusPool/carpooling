import {afterEach,expect,it,vi} from 'vitest';
vi.mock('../lib/pesu-client.mjs',()=>({fetchTimetable:vi.fn(async()=>({entries:[{title:'Synthetic class'}]}))}));
import {POST} from '../app/api/pes-timetable/route.js';
import {fetchTimetable} from '../lib/pesu-client.mjs';
const request=(origin,token,body={username:'student',password:'synthetic-password'})=>new Request('http://localhost:3000/api/pes-timetable',{method:'POST',headers:{host:'localhost:3000',origin,authorization:token,'content-type':'application/json'},body:JSON.stringify(body)});
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks()});
it('rejects cross-origin requests before accepting credentials',async()=>{const res=await POST(request('https://attacker.example','Bearer mock-cross-origin'));expect(res.status).toBe(403);expect(fetchTimetable).not.toHaveBeenCalled()});
it('checks the app session before accessing Academy',async()=>{vi.stubGlobal('fetch',vi.fn(async()=>new Response('',{status:401})));const res=await POST(request('http://localhost:3000','Bearer mock-invalid-session'));expect(res.status).toBe(401);expect(fetchTimetable).not.toHaveBeenCalled()});
it('imports for a valid same-origin app session without returning credentials',async()=>{vi.stubGlobal('fetch',vi.fn(async()=>new Response('{}',{status:200})));const res=await POST(request('http://localhost:3000','Bearer mock-valid-session'));expect(res.status).toBe(200);expect(res.headers.get('cache-control')).toBe('no-store');const body=await res.text();expect(body).toContain('Synthetic class');expect(body).not.toContain('synthetic-password')});
