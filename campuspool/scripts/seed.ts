import { existsSync } from 'node:fs';
import type { RowDataPacket } from 'mysql2/promise';
import { passwordHash } from '@/server/auth';
import { pool, exec } from '@/server/db';

if (!process.env.DEMO_PASSWORD && existsSync('.env')) process.loadEnvFile('.env');

async function main(): Promise<void> {
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 12 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error('DEMO_PASSWORD must be set to at least 12 characters containing a letter and a number');
  }
  const cx = await pool().getConnection();
  try {
    await cx.beginTransaction();
    const users = [
      ['Demo Admin', 'admin@campuspool.test', 'ADMIN'],
      ['Demo Driver', 'driver@campuspool.test', 'DRIVER'],
      ['Demo Rider', 'rider@campuspool.test', 'RIDER'],
      ['Demo Rider Two', 'rider2@campuspool.test', 'RIDER'],
    ] as const;
    for (const [name, email, role] of users) {
      await exec(cx, `INSERT IGNORE INTO users(name,email,password_hash,role,status,credits)
        VALUES(?,?,?,?,'APPROVED',1000)`,
        [name, email, await passwordHash(password), role]);
    }
    const [driver] = await cx.query<Array<RowDataPacket & { id: number }>>('SELECT id FROM users WHERE email=?', ['driver@campuspool.test']);
    const driverId = driver[0].id;
    await exec(cx, `INSERT IGNORE INTO stops(name,lat,lng) VALUES
      ('Campus Gate',12.9352,77.5348),('Library Circle',12.9371,77.5321),('Hostel North',12.9390,77.5360)
      `, []);
    const vehicles = [
      ['CAR', 'CP-DEMO-CAR-05', 'Demo Hatchback', 5],
      ['CAR', 'CP-DEMO-CAR-03', 'Demo Sedan', 3],
      ['BIKE', 'CP-DEMO-BIKE-01', 'Demo Scooter', 1],
    ] as const;
    for (const [kind, registration, model, capacity] of vehicles) {
      await exec(cx, `INSERT IGNORE INTO vehicles(owner_id,kind,registration,model,passenger_capacity,status)
        VALUES(?,?,?,?,?,'APPROVED')`,
        [driverId, kind, registration, model, capacity]);
    }
    await cx.commit();
    console.log('seeded synthetic CampusPool users, stops, and three approved vehicles');
  } catch (error) { await cx.rollback(); throw error; }
  finally { cx.release(); }
  await pool().end();
}

main().catch((error) => { console.error('seed failed', error instanceof Error ? error.message : 'unknown error'); process.exitCode = 1; });
