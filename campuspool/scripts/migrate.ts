import { readFile } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { RowDataPacket } from 'mysql2/promise';
import mysql, { type Connection } from 'mysql2/promise';
import { existsSync } from 'node:fs';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');

function migrationUrl(): string {
  const value = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!value) throw new Error('MIGRATION_DATABASE_URL or DATABASE_URL is required');
  return value;
}

async function migrationConnection(): Promise<Connection> {
  const url = new URL(migrationUrl());
  return mysql.createConnection({ host: url.hostname, port: Number(url.port || 3306),
    user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
    database: url.pathname.slice(1), timezone: 'Z', dateStrings: true, multipleStatements: false });
}

function statements(source: string): string[] {
  let delimiter = ';';
  let buffer = '';
  const result: string[] = [];
  for (const line of source.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const directive = line.trim().match(/^DELIMITER\s+(\S+)$/i);
    if (directive) { delimiter = directive[1]; continue; }
    buffer += `${line}\n`;
    while (buffer.includes(delimiter)) {
      const index = buffer.indexOf(delimiter);
      const statement = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + delimiter.length);
      const executable = statement.replace(/^\s*(?:(?:--|#)[^\n]*(?:\n|$))+/g, '').trim();
      if (executable) result.push(executable);
    }
  }
  const executable = buffer.replace(/^\s*(?:(?:--|#)[^\n]*(?:\n|$))+/g, '').trim();
  if (executable) result.push(executable);
  return result;
}

async function main(): Promise<void> {
  const connection = await migrationConnection();
  const lockName = 'campuspool-schema-migrate';
  let lockHeld = false;
  try {
    const [lockRows] = await connection.query<Array<RowDataPacket & { acquired: number }>>(
      'SELECT GET_LOCK(?, 60) AS acquired', [lockName]);
    if (Number(lockRows[0]?.acquired) !== 1) throw new Error('Could not acquire migration lock');
    lockHeld = true;
    await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(120) NOT NULL PRIMARY KEY, applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB`);
    const [applied] = await connection.query<Array<RowDataPacket & { version: string }>>('SELECT version FROM schema_migrations');
    const seen = new Set(applied.map((row) => row.version));
    const directory = join(process.cwd(), 'sql', 'migrations');
    const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort();
    for (const file of files) {
      if (seen.has(file)) continue;
      for (const statement of statements(await readFile(join(directory, file), 'utf8'))) await connection.query(statement);
      await connection.query('INSERT INTO schema_migrations(version) VALUES (?)', [file]);
      console.log(`applied ${file}`);
    }
  } catch (error) {
    throw error;
  } finally {
    if (lockHeld) await connection.query('SELECT RELEASE_LOCK(?)', [lockName]);
    await connection.end();
  }
}

main().catch((error) => {
  console.error('migration failed; DDL is not transactional, inspect schema_migrations before retrying', error instanceof Error ? error.message : 'unknown error');
  process.exitCode = 1;
});
