import {api} from '@/server/core';
import {logout} from '@/server/auth';
export const runtime='nodejs';
export async function POST(request:Request){return api(request,()=>logout(request));}
