import { api, HttpError, json, requireUser } from '@/server/core';
import { getActivity } from '@/server/activity';
import { isMongoUnavailable } from '@/server/mongo';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  return api(request, async () => {
    const user = await requireUser(request, true);
    const rawLimit = Number(new URL(request.url).searchParams.get('limit') || 50);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, Math.trunc(rawLimit))) : 50;
    try { return json(await getActivity(user.id, limit)); }
    catch (error) { if (isMongoUnavailable(error)) throw new HttpError(503, 'ACTIVITY_UNAVAILABLE', 'Activity is temporarily unavailable.'); throw error; }
  });
}
