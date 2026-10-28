#!/bin/sh
set -eu

# Deliberately uses non-pilot ports and a throwaway Compose project.
# Nothing here can connect to the Laravel pilot database unless the caller
# overrides the script itself; the service receives this script's own URL.
if [ "${MOBILITY_ACTIVITY_ALLOW_DISPOSABLE:-0}" != 1 ]; then
  echo 'Refusing disposable SQL/Mongo proof; set MOBILITY_ACTIVITY_ALLOW_DISPOSABLE=1.' >&2
  exit 2
fi
service_dir=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
root=$(CDPATH= cd -- "$service_dir/.." && pwd)
resolved_root=$(CDPATH= cd -P "$root" && pwd)
context="${MOBILITY_DOCKER_CONTEXT:-colima-mobility}"
project="mobility-activity-projection-$$"
data_root="${MOBILITY_ACTIVITY_DATA_ROOT:-$root/.local/activity-projection-disposable/$project}"
mkdir -p "$data_root"
resolved_data_root=$(CDPATH= cd -P "$data_root" && pwd)
case "$resolved_data_root" in "$resolved_root"/*) :;; *) echo 'Refusing data root outside this disposable checkout.' >&2; exit 2;; esac
data_root="$resolved_data_root"
if [ ! -d "$service_dir/node_modules/mysql2" ] || [ ! -d "$service_dir/node_modules/mongodb" ]; then
  echo 'Installing locked projection dependencies (node_modules is absent)' >&2
  npm --prefix "$service_dir" ci --ignore-scripts --no-audit --no-fund
fi
mkdir -p "$data_root/mysql" "$data_root/mongo"
mysql_port=$((23000 + ($$ % 500)))
mongo_port=$((23500 + ($$ % 500)))
compose="$(mktemp -t mobility-activity-compose.XXXXXX.yml)"
dc() { docker --context "$context" compose -p "$project" -f "$compose" "$@"; }
cleanup() { dc down --remove-orphans >/dev/null 2>&1 || true; rm -f "$compose"; }
trap cleanup EXIT INT TERM

cat >"$compose" <<'YAML'
services:
  mysql:
    image: mysql:8.4
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: mobility_test
    ports: ["127.0.0.1:${MYSQL_PORT}:3306"]
    volumes: ["${MYSQL_DATA}:/var/lib/mysql"]
    healthcheck: { test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-proot"], interval: 2s, timeout: 2s, retries: 30 }
  mongo:
    image: mongo:8.0
    ports: ["127.0.0.1:${MONGO_PORT}:27017"]
    volumes: ["${MONGO_DATA}:/data/db"]
YAML

sed -i '' -e "s|\${MYSQL_PORT}|$mysql_port|g" -e "s|\${MONGO_PORT}|$mongo_port|g" -e "s|\${MYSQL_DATA}|$data_root/mysql|g" -e "s|\${MONGO_DATA}|$data_root/mongo|g" "$compose"
dc up -d
deadline=$(( $(date +%s) + 120 ))
until dc exec -T mysql mysqladmin ping -h 127.0.0.1 -proot >/dev/null 2>&1; do
  [ "$(date +%s)" -lt "$deadline" ] || { echo 'MySQL health timeout' >&2; exit 1; }
  sleep 2
done
until dc exec -T mongo mongosh --quiet --eval 'db.runCommand({ping:1})' >/dev/null 2>&1; do
  [ "$(date +%s)" -lt "$deadline" ] || { echo 'MongoDB health timeout' >&2; exit 1; }
  sleep 2
done

dc exec -T mysql mysql -uroot -proot mobility_test <<'SQL'
CREATE TABLE mobility_trip_events (
  id INT PRIMARY KEY, trip_id INT NOT NULL, actor_id INT NOT NULL,
  action VARCHAR(32) NOT NULL, passenger_id INT NULL, version INT NOT NULL,
  response_status SMALLINT NOT NULL, response_body JSON NOT NULL,
  request_fingerprint CHAR(64) NOT NULL, idempotency_key VARCHAR(100) NOT NULL,
  created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL
);
INSERT INTO mobility_trip_events VALUES
(1, 101, 7, 'publish', NULL, 1, 200, '{"phone":"must-not-copy"}', REPEAT('x',64), 'secret-1', '2026-10-27 10:00:00', '2026-10-27 10:00:00'),
(2, 101, 8, 'arrive', 9, 2, 200, '{"email":"must-not-copy"}', REPEAT('y',64), 'secret-2', '2026-10-27 11:00:00', '2026-10-27 11:00:00'),
(4, 101, 8, 'arrive', 9, 3, 200, '{}', REPEAT('w',64), 'secret-4', '2026-10-27 11:30:00', '2026-10-27 11:30:00');
CREATE USER IF NOT EXISTS 'readonly'@'%' IDENTIFIED BY 'readonly';
GRANT SELECT ON mobility_test.mobility_trip_events TO 'readonly'@'%';
SQL

# Prove the account cannot mutate the source schema/data before using it.
if dc exec -T mysql mysql -ureadonly -preadonly mobility_test -e 'DELETE FROM mobility_trip_events' >/dev/null 2>&1; then
  echo 'readonly account unexpectedly has DELETE permission' >&2
  exit 1
fi

export MOBILITY_ACTIVITY_MYSQL_URL="mysql://readonly:readonly@127.0.0.1:$mysql_port/mobility_test"
export MOBILITY_ACTIVITY_MYSQL_TIMEZONE='+05:30'
export MOBILITY_ACTIVITY_MONGODB_URI="mongodb://127.0.0.1:$mongo_port"
export MOBILITY_ACTIVITY_MONGODB_DB='mobility_activity_test'
npm run sync

# A later SQL commit must be visible on the next replay, without any cursor
# state carried by the projection process.
dc exec -T mysql mysql -uroot -proot mobility_test -e \
  "INSERT INTO mobility_trip_events VALUES (3, 102, 7, 'cancel', NULL, 1, 200, '{\\\"token\\\":\\\"must-not-copy\\\"}', REPEAT('z',64), 'secret-3', '2026-10-27 12:00:00', '2026-10-27 12:00:00')"
npm run sync
count="$(dc exec -T mongo mongosh --quiet mobility_activity_test --eval 'db.mobility_activity_events.countDocuments()')"
[ "$(printf '%s' "$count" | tr -d '\r\n ')" = 4 ] || { echo "expected 4 documents after replay and new event, got $count" >&2; exit 1; }
occurred="$(dc exec -T mongo mongosh --quiet mobility_activity_test --eval 'db.mobility_activity_events.findOne({sourceEventId:1}).occurredAt.toISOString()')"
[ "$(printf '%s' "$occurred" | tr -d '\r\n ')" = '2026-10-27T04:30:00.000Z' ] || { echo "timezone conversion failed: $occurred" >&2; exit 1; }
docs="$(dc exec -T mongo mongosh --quiet mobility_activity_test --eval 'JSON.stringify(db.mobility_activity_events.findOne({}, {responseBody:1,response_body:1,request_fingerprint:1,idempotency_key:1}))')"
case "$docs" in *responseBody*|*response_body*|*request_fingerprint*|*idempotency_key*) echo 'sensitive field leaked' >&2; exit 1;; esac
daily="$(npm run daily)"
printf '%s\n' "$daily" | tail -n 1 | node -e '
  const assert = require("node:assert/strict");
  let input = "";
  process.stdin.on("data", chunk => input += chunk);
  process.stdin.on("end", () => {
    const rows = JSON.parse(input);
    assert.deepEqual(rows, ["arrive", "cancel", "publish"].map(action => ({
      day: "2026-10-27", action, eventCount: action === "arrive" ? 2 : 1, uniqueTripCount: 1
    })));
  });
'
dc exec -T mongo mongosh --quiet mobility_activity_test --eval '
  const indexes = db.mobility_activity_events.getIndexes();
  const unique = indexes.find(i => i.name === "uniq_activity_source_event");
  if (!unique || !unique.unique || unique.key.sourceEventId !== 1) quit(1);
  for (const name of ["activity_occurred_action", "activity_actor_occurred"]) {
    if (!indexes.some(i => i.name === name)) quit(1);
  }
'
echo 'disposable SQL/Mongo integration passed: replay count=4, daily grouping and indexes checked, readonly SQL, sensitive columns absent'
