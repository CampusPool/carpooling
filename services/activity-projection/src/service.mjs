import mysql from 'mysql2/promise';
import { MongoClient } from 'mongodb';
import { serviceConfig } from './config.mjs';
import { ensureCollection, syncSqlToMongo } from './projection.mjs';
import { createWorker } from './worker.mjs';
import { createActivityServer } from './server.mjs';

async function main() {
  const config = serviceConfig();
  const mongo = new MongoClient(config.mongoUri, { connectTimeoutMS: 3000, serverSelectionTimeoutMS: 3000, socketTimeoutMS: 5000, timeoutMS: 8000 });
  const db = mongo.db(config.mongoDb);
  const collection = db.collection(config.collectionName);
  let prepared = false;
  const worker = createWorker({ intervalSeconds: config.intervalSeconds, staleAfterSeconds: config.staleAfterSeconds,
    sync: async () => {
      if (!prepared) { await mongo.connect(); await ensureCollection(db, config.collectionName); prepared = true; }
      const connection = await mysql.createConnection(config.mysql);
      // Timeouts apply to each actual network operation, in addition to run budget.
      const sql = {
        query: (statement) => connection.query({ sql: statement, timeout: 5000 }),
        execute: (statement, values) => connection.execute({ sql: statement, timeout: 5000 }, values)
      };
      try { return await syncSqlToMongo({ sql, collection, sourceTimezone: config.sourceTimezone }); }
      finally { connection.destroy(); }
    }
  });
  const server = createActivityServer({ key: config.key, worker, collection });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(config.port, '0.0.0.0', resolve); });
  worker.start();
  console.log(JSON.stringify({ service: 'mobility-activity', status: 'started' }));
  let closing = false;
  const stop = async () => {
    if (closing) return;
    closing = true;
    server.close();
    server.closeIdleConnections();
    await worker.stop();
    await mongo.close();
  };
  process.once('SIGTERM', () => void stop());
  process.once('SIGINT', () => void stop());
}

main().catch(() => { console.error('Analytics service startup failed. Check its private configuration.'); process.exitCode = 1; });
