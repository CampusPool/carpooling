import mysql from 'mysql2/promise';
import { MongoClient } from 'mongodb';
import { ensureCollection, syncSqlToMongo, dailyAggregation } from './projection.mjs';

const command = process.argv[2] ?? 'sync';
const mysqlUrl = process.env.MOBILITY_ACTIVITY_MYSQL_URL;
const mongoUrl = process.env.MOBILITY_ACTIVITY_MONGODB_URI;
const mongoDbName = process.env.MOBILITY_ACTIVITY_MONGODB_DB;
const mysqlTimezone = process.env.MOBILITY_ACTIVITY_MYSQL_TIMEZONE;
const collectionName = process.env.MOBILITY_ACTIVITY_MONGODB_COLLECTION ?? 'mobility_activity_events';
function mysqlOptions(rawUrl, timezone) {
  if (!/^(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(timezone)) {
    throw new Error('MOBILITY_ACTIVITY_MYSQL_TIMEZONE must be Z or a fixed offset such as +05:30');
  }
  const url = new URL(rawUrl);
  if (url.protocol !== 'mysql:') throw new Error('MOBILITY_ACTIVITY_MYSQL_URL must use mysql://');
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    timezone
  };
}
if (!mysqlUrl || !mongoUrl || !mongoDbName || !mysqlTimezone) {
  throw new Error('Set MOBILITY_ACTIVITY_MYSQL_URL, MOBILITY_ACTIVITY_MYSQL_TIMEZONE, MOBILITY_ACTIVITY_MONGODB_URI, and MOBILITY_ACTIVITY_MONGODB_DB');
}
if (!/^(sync|daily)$/.test(command)) throw new Error('Usage: npm run sync|daily');

const sql = await mysql.createConnection(mysqlOptions(mysqlUrl, mysqlTimezone));
const mongo = new MongoClient(mongoUrl);
try {
  await mongo.connect();
  const collection = await ensureCollection(mongo.db(mongoDbName), collectionName);
  if (command === 'sync') {
    console.log(JSON.stringify(await syncSqlToMongo({ sql, collection, pageSize: process.env.MOBILITY_ACTIVITY_PAGE_SIZE, sourceTimezone: mysqlTimezone })));
  } else {
    console.log(JSON.stringify(await collection.aggregate(dailyAggregation()).toArray()));
  }
} finally {
  await sql.end();
  await mongo.close();
}
