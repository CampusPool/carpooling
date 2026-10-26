import {api} from '@/server/core';
import {me} from '@/server/auth';
export const runtime='nodejs';
export async function GET(request:Request){return api(request,()=>me(request));}
