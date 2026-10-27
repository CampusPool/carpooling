import {api,json} from '@/server/core';
import {cancelOffer} from '@/server/cancellations';
export const runtime='nodejs';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){return api(request,async()=>json(await cancelOffer(request,(await context.params).id)));}
