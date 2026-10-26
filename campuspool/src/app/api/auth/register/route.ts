import {api} from '@/server/core';
import {register} from '@/server/auth';
export const runtime='nodejs';
export async function POST(request:Request){return api(request,()=>register(request));}
