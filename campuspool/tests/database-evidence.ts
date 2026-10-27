import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { existsSync } from 'node:fs';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const enabled = process.env.RUN_CAMPUSPOOL_INTEGRATION === '1';
type IdRow = RowDataPacket & { id: number };

describe.skipIf(!enabled)('CampusPool direct SQL DBMS evidence', () => {
  let db: Pool;
  beforeAll(() => {
    const value = process.env.DATABASE_URL;
    if (!value) throw new Error('DATABASE_URL is required for direct SQL evidence');
    const url = new URL(value);
    db = mysql.createPool({ host: url.hostname, port: Number(url.port || 3306),
      user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
      database: url.pathname.slice(1), timezone: 'Z', dateStrings: true });
  });
  afterAll(async () => { await db?.end(); });

  async function fixtureIds(cx: PoolConnection): Promise<{ driverId: number; riderId: number; vehicleId: number; originId: number; destinationId: number }> {
    const [drivers] = await cx.query<Array<IdRow>>("SELECT id FROM users WHERE email='driver@campuspool.test' AND role='DRIVER' AND status='APPROVED'");
    const [riders] = await cx.query<Array<IdRow>>("SELECT id FROM users WHERE email='rider@campuspool.test' AND role='RIDER' AND status='APPROVED'");
    const [vehicles] = await cx.query<Array<IdRow>>("SELECT id FROM vehicles WHERE owner_id=? AND status='APPROVED' ORDER BY id LIMIT 1", [drivers[0]?.id]);
    const [stops] = await cx.query<Array<IdRow>>('SELECT id FROM stops ORDER BY id LIMIT 2');
    expect(drivers[0]?.id).toBeDefined();
    expect(riders[0]?.id).toBeDefined();
    expect(vehicles[0]?.id).toBeDefined();
    expect(stops).toHaveLength(2);
    return { driverId: drivers[0].id, riderId: riders[0].id, vehicleId: vehicles[0].id, originId: stops[0].id, destinationId: stops[1].id };
  }

  it('enforces the named bike capacity check', async () => {
    const cx = await db.getConnection();
    try {
      const ids = await fixtureIds(cx);
      const registration = `DBMS-${Date.now().toString(36).slice(-10)}`.slice(0, 32);
      try {
        await cx.query(`INSERT INTO vehicles(owner_id,kind,registration,model,passenger_capacity,status)
          VALUES(?,'BIKE',?,'Invalid Bike',2,'PENDING')`, [ids.driverId, registration]);
        throw new Error('invalid bike insert unexpectedly succeeded');
      } catch (error) {
        const sqlError = error as { errno?: number; sqlMessage?: string };
        expect(sqlError.errno).toBe(3819);
        expect(sqlError.sqlMessage).toContain('ck_vehicles_capacity');
      }
    } finally { cx.release(); }
  });

  it('exposes the view and stored procedure evidence', async () => {
    const cx = await db.getConnection();
    try {
      const [view] = await cx.query<RowDataPacket[]>('SELECT ride_id, seats_committed FROM driver_ride_summary LIMIT 1');
      expect(Array.isArray(view)).toBe(true);
      const [procedure] = await cx.query<RowDataPacket[]>('CALL ride_capacity_report(CURDATE())');
      expect(Array.isArray(procedure)).toBe(true);
    } finally { cx.release(); }
  });

  it('keeps ledger rows append-only and permits service seat updates', async () => {
    const cx = await db.getConnection();
    try {
      await cx.beginTransaction();
      const ids = await fixtureIds(cx);
      const [ride] = await cx.query<ResultSetHeader>(
        `INSERT INTO rides(driver_id,vehicle_id,origin_stop_id,destination_stop_id,departure_at,total_seats,seats_available,credit_price,status)
         VALUES(?,?,?, ?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 2 HOUR),1,1,1,'PUBLISHED')`,
        [ids.driverId, ids.vehicleId, ids.originId, ids.destinationId]);
      let selfBookingError: { errno?: number } | undefined;
      try {
        await cx.query(`INSERT INTO bookings(ride_id,rider_id,status) VALUES(?,?,'REQUESTED')`, [ride.insertId, ids.driverId]);
      } catch (error) { selfBookingError = error as { errno?: number }; }
      expect(selfBookingError?.errno).toBe(1644);
      const [booking] = await cx.query<ResultSetHeader>(
        `INSERT INTO bookings(ride_id,rider_id,status) VALUES(?,?,'REQUESTED')`, [ride.insertId, ids.riderId]);
      await expect(cx.query('UPDATE rides SET seats_available=0 WHERE id=?', [ride.insertId])).resolves.toBeDefined();
      let immutableError: { errno?: number } | undefined;
      try {
        await cx.query('UPDATE rides SET departure_at=DATE_ADD(departure_at, INTERVAL 1 DAY) WHERE id=?', [ride.insertId]);
      } catch (error) { immutableError = error as { errno?: number }; }
      expect(immutableError?.errno).toBe(1644);
      let cancelError: { errno?: number } | undefined;
      try { await cx.query("UPDATE rides SET status='CANCELLED' WHERE id=?", [ride.insertId]); }
      catch (error) { cancelError = error as { errno?: number }; }
      expect(cancelError?.errno).toBe(1644);
      await cx.query("INSERT INTO ledger(user_id,booking_id,kind,amount) VALUES(?,?, 'HOLD',1)", [ids.riderId, booking.insertId]);
      await expect(cx.query('UPDATE ledger SET amount=2 WHERE booking_id=?', [booking.insertId])).rejects.toThrow();
      await expect(cx.query('DELETE FROM ledger WHERE booking_id=?', [booking.insertId])).rejects.toThrow();
    } finally { await cx.rollback(); cx.release(); }
  });

  it('shows the route index through both possible_keys and the chosen key', async () => {
    const [normal] = await db.query<Array<RowDataPacket & { possible_keys: string | null }>>(
      `EXPLAIN SELECT * FROM rides
        WHERE origin_stop_id=1 AND destination_stop_id=2 AND departure_at>=UTC_TIMESTAMP() AND status='PUBLISHED'`);
    expect(normal[0]?.possible_keys ?? '').toContain('idx_rides_route_time');
    const [forced] = await db.query<Array<RowDataPacket & { key: string | null }>>(
      `EXPLAIN SELECT * FROM rides FORCE INDEX (idx_rides_route_time)
        WHERE origin_stop_id=1 AND destination_stop_id=2 AND departure_at>=UTC_TIMESTAMP() AND status='PUBLISHED'`);
    expect(forced[0]?.key).toBe('idx_rides_route_time');
  });
});
