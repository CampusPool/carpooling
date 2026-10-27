import {api,json} from '@/server/core';
import {decideBooking} from '@/server/bookings';
export const runtime='nodejs';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){return api(request,async()=>json(await decideBooking(request,(await context.params).id)));}
