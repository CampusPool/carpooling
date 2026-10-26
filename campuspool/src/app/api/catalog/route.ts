import {api,json} from '@/server/core';
import {catalog} from '@/server/foundation';
export const runtime='nodejs';
export async function GET(request:Request){return api(request,async()=>json(await catalog(request)));}
