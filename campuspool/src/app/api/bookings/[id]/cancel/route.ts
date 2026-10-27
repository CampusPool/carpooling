import {api,json} from '@/server/core';
import {cancelBooking} from '@/server/cancellations';
export const runtime='nodejs';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){return api(request,async()=>json(await cancelBooking(request,(await context.params).id)));}
