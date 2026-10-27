import { api, HttpError, json, requireUser } from '@/server/core';
import { pool, rows } from '@/server/db';
import { databaseEvidence } from '@/server/mongo';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  return api(request, async () => {
    const user = await requireUser(request, true);
    if (user.role !== 'ADMIN') throw new HttpError(403, 'FORBIDDEN', 'Admin access required');
    const connection = await pool().getConnection();
    try {
      const [views, routines, triggers, indexes] = await Promise.all([
        rows<{ table_name: string }>(connection,
          `SELECT TABLE_NAME AS table_name FROM information_schema.VIEWS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'driver_ride_summary'`),
        rows<{ routine_name: string; routine_type: string }>(connection,
          `SELECT ROUTINE_NAME AS routine_name, ROUTINE_TYPE AS routine_type
             FROM information_schema.ROUTINES
            WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_NAME = 'ride_capacity_report'`),
        rows<{ trigger_name: string; event_manipulation: string; event_object_table: string }>(connection,
          `SELECT TRIGGER_NAME AS trigger_name, EVENT_MANIPULATION AS event_manipulation,
                  EVENT_OBJECT_TABLE AS event_object_table
             FROM information_schema.TRIGGERS
            WHERE TRIGGER_SCHEMA = DATABASE()
              AND (TRIGGER_NAME LIKE 'rides_%' OR TRIGGER_NAME LIKE 'ledger_%' OR TRIGGER_NAME LIKE 'bookings_%')`),
        rows<{ table_name: string; index_name: string; column_name: string }>(connection,
          `SELECT TABLE_NAME AS table_name, INDEX_NAME AS index_name, COLUMN_NAME AS column_name
             FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME IN ('rides','bookings','outbox')
              AND INDEX_NAME NOT IN ('PRIMARY')
            ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`),
      ]);
      const mongo = await databaseEvidence();
      return json({ sql: { views, routines, triggers, indexes }, mongo });
    } finally {
      connection.release();
    }
  });
}
