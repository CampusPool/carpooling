import {api,json} from '@/server/core';
import {dashboard} from '@/server/foundation';
export const runtime='nodejs';
export async function GET(request:Request){return api(request,async()=>json(await dashboard(request)));}
