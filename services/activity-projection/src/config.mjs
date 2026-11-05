export function mysqlOptions(rawUrl, timezone) {
  if (!/^(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(timezone ?? '') || /^[-+]14:(?!00)/.test(timezone)) {
    throw new Error('MOBILITY_ACTIVITY_MYSQL_TIMEZONE must be Z or a fixed offset');
  }
  let url;
  try { url = new URL(rawUrl); } catch { throw new Error('Invalid analytics SQL configuration'); }
  if (url.protocol !== 'mysql:' || !url.hostname || !url.username || !/^\/[A-Za-z0-9_-]+$/.test(url.pathname)) {
    throw new Error('Invalid analytics SQL configuration');
  }
  return { host: url.hostname, port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
    database: url.pathname.slice(1), timezone, connectTimeout: 5000 };
}

export function databaseConfig(env = process.env) {
  if (!env.MOBILITY_ACTIVITY_MYSQL_URL || !env.MOBILITY_ACTIVITY_MYSQL_TIMEZONE
      || !env.MOBILITY_ACTIVITY_MONGODB_URI || !env.MOBILITY_ACTIVITY_MONGODB_DB) {
    throw new Error('Analytics database configuration is incomplete');
  }
  const collectionName = env.MOBILITY_ACTIVITY_MONGODB_COLLECTION ?? 'mobility_activity_events';
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(collectionName) || !/^[A-Za-z0-9_-]{1,64}$/.test(env.MOBILITY_ACTIVITY_MONGODB_DB)) {
    throw new Error('Invalid analytics Mongo configuration');
  }
  return { mysql: mysqlOptions(env.MOBILITY_ACTIVITY_MYSQL_URL, env.MOBILITY_ACTIVITY_MYSQL_TIMEZONE),
    mongoUri: env.MOBILITY_ACTIVITY_MONGODB_URI, mongoDb: env.MOBILITY_ACTIVITY_MONGODB_DB,
    collectionName, sourceTimezone: env.MOBILITY_ACTIVITY_MYSQL_TIMEZONE };
}

export function serviceConfig(env = process.env) {
  const key = env.MOBILITY_ACTIVITY_SERVICE_KEY;
  if (typeof key !== 'string' || key.length < 32 || key.length > 4096 || /[\r\n]/.test(key)) {
    throw new Error('MOBILITY_ACTIVITY_SERVICE_KEY requires at least 32 characters');
  }
  const integer = (value, fallback, min, max) => {
    const text = String(value ?? fallback);
    if (!/^\d+$/.test(text) || !Number.isSafeInteger(Number(text)) || Number(text) < min || Number(text) > max) {
      throw new Error('Invalid analytics service limit');
    }
    return Number(text);
  };
  const intervalSeconds = integer(env.SYNC_INTERVAL_SECONDS, 60, 1, 86400);
  return { ...databaseConfig(env), key, port: integer(env.PORT, 8090, 1, 65535), intervalSeconds,
    staleAfterSeconds: Math.max(120, intervalSeconds * 3) };
}
