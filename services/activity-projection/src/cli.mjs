import mysql from 'mysql2/promise';
import { MongoClient } from 'mongodb';
import { ensureCollection, syncSqlToMongo, dailyAggregation } from './projection.mjs';
import { databaseConfig } from './config.mjs';

const command = process.argv[2] ?? 'sync';
const config = databaseConfig();
if (!/^(sync|daily)$/.test(command)) throw new Error('Usage: npm run sync|daily');

const sql = await mysql.createConnection(config.mysql);
const mongo = new MongoClient(config.mongoUri, { connectTimeoutMS: 3000, serverSelectionTimeoutMS: 3000, socketTimeoutMS: 5000, timeoutMS: 8000 });
try {
  await mongo.connect();
  const collection = await ensureCollection(mongo.db(config.mongoDb), config.collectionName);
  if (command === 'sync') {
    console.log(JSON.stringify(await syncSqlToMongo({ sql, collection, pageSize: process.env.MOBILITY_ACTIVITY_PAGE_SIZE, sourceTimezone: config.sourceTimezone })));
  } else {
    console.log(JSON.stringify(await collection.aggregate(dailyAggregation()).toArray()));
  }
} finally {
  await sql.end();
  await mongo.close();
}
