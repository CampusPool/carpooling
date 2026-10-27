import { api, HttpError, json, requireUser } from '@/server/core';
import { pool } from '@/server/db';
import { getActivity, syncActivity } from '@/server/activity';
import { isMongoUnavailable } from '@/server/mongo';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  return api(request, async () => {
    const user = await requireUser(request, true);
    if (user.role !== 'ADMIN') throw new HttpError(403, 'FORBIDDEN', 'Admin access required');
    const connection = await pool().getConnection();
    try {
      await connection.beginTransaction();
      let sync;
      try { sync = await syncActivity(connection); }
      catch (error) {
        await connection.rollback();
        if (isMongoUnavailable(error)) throw new HttpError(503, 'ACTIVITY_UNAVAILABLE', 'Activity is temporarily unavailable.');
        throw error;
      }
      await connection.commit();
      if (sync.failed > 0) throw new HttpError(503, 'ACTIVITY_UNAVAILABLE', 'Activity is temporarily unavailable.');
      return json({ ...(await getActivity(user.id)), sync });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });
}
