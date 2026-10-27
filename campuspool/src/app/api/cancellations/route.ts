import {api,json} from '@/server/core';
import {cancellationHistory} from '@/server/cancellations';
export const runtime='nodejs';
export async function GET(request:Request){return api(request,async()=>json(await cancellationHistory(request)));}
