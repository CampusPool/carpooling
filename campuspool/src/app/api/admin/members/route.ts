import {api,json} from '@/server/core';
import {members} from '@/server/foundation';
export const runtime='nodejs';
export async function GET(request:Request){return api(request,async()=>json(await members(request)));}
