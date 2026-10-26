import {api} from '@/server/core';
import {login} from '@/server/auth';
export const runtime='nodejs';
export async function POST(request:Request){return api(request,()=>login(request));}
