import { pool } from '@/server/db';
import { publishOutboxBatch } from '@/server/outbox';
import { closeMongo } from '@/server/mongo';

const batchSize = Number(process.env.ACTIVITY_BATCH_SIZE || 25);
const intervalMs = Number(process.env.ACTIVITY_WORKER_INTERVAL_MS || 5_000);
let stopping = false;
let timer: NodeJS.Timeout | undefined;
let wake: (() => void) | undefined;

async function runBatch(): Promise<{ published: number; failed: number }> {
  const connection = await pool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await publishOutboxBatch(connection, batchSize);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    // Do not print connection strings or row payloads.
    console.error('activity worker batch failed', error instanceof Error && error.name === 'MongoServerSelectionError' ? 'MongoDB unavailable' : 'activity publish failed');
    return { published: 0, failed: 1 };
  } finally {
    connection.release();
  }
}

async function main(): Promise<void> {
  const once = process.env.ACTIVITY_WORKER_ONCE === '1';
  do {
    const result = await runBatch();
    console.log(`activity worker: published=${result.published} failed=${result.failed}`);
    if (once || stopping) { process.exitCode = result.failed > 0 ? 1 : 0; break; }
    await new Promise<void>((resolve) => {
      wake = resolve;
      timer = setTimeout(() => { timer = undefined; wake = undefined; resolve(); }, result.failed > 0 ? Math.min(intervalMs * 2, 60_000) : intervalMs);
    });
  } while (true);
  await closeMongo();
  await pool().end();
  process.exitCode = 0;
}

function stop(): void {
  stopping = true;
  if (timer) { clearTimeout(timer); timer = undefined; }
  const resume = wake; wake = undefined; resume?.();
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

main().catch((error) => {
  console.error('activity worker stopped', error instanceof Error ? error.message : 'unknown error');
  process.exitCode = 1;
});
