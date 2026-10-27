import {api,json} from '@/server/core';
import {listBookings,requestBooking} from '@/server/bookings';
export const runtime='nodejs';
export async function GET(request:Request){return api(request,async()=>json(await listBookings(request)));}
export async function POST(request:Request){return api(request,async()=>json(await requestBooking(request),201));}
