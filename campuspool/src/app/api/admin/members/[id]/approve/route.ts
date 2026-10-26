import {api,json} from '@/server/core';
import {approveMember} from '@/server/foundation';
export const runtime='nodejs';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){return api(request,async()=>json(await approveMember(request,(await context.params).id)));}
