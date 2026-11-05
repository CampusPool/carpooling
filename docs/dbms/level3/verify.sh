#!/bin/sh
# Disposable supplementary DBMS proof. Requires only Docker and POSIX utilities.
set -eu
umask 077
here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
dbms=$(dirname "$here")
command -v docker >/dev/null 2>&1 || { echo 'FAIL: Docker is required' >&2; exit 1; }
for file in evidence.sql actual-analytics-fixture.sql actual-analytics.sql; do
  test -r "$dbms/$file" || { echo "FAIL: missing $file" >&2; exit 1; }
done
docker_cmd() {
  if [ -n "${MOBILITY_DOCKER_CONTEXT:-}" ]; then
    docker --context "$MOBILITY_DOCKER_CONTEXT" "$@"
  else
    docker "$@"
  fi
}
scratch=$(mktemp -d "${TMPDIR:-/tmp}/dbms-level3.XXXXXX")
name="dbms-level3-$(basename "$scratch" | tr '[:upper:]' '[:lower:]')-$$"
sql_id=
mongo_id=
diagnostics() {
  # These containers contain only synthetic fixtures and deliberately have no
  # generated credentials. Do not dump host settings or container environments.
  for id in "$sql_id" "$mongo_id"; do
    if [ -n "$id" ]; then
      docker_cmd inspect --format 'DIAGNOSTIC {{.Name}}: status={{.State.Status}} exit={{.State.ExitCode}} oom={{.State.OOMKilled}} error={{.State.Error}}' "$id" 2>&1 || true
      docker_cmd logs --tail 60 "$id" 2>&1 || true
    fi
  done
  for probe in "$scratch/sql-probe.log" "$scratch/mongo-probe.log"; do
    if [ -f "$probe" ]; then
      echo "DIAGNOSTIC $(basename "$probe"):"
      tail -n 10 "$probe"
    fi
  done
}
cleanup() {
  status=$?
  trap - 0 INT TERM
  if [ "$status" -ne 0 ]; then diagnostics; fi
  # Only IDs created by this invocation are eligible for removal.
  for id in "$sql_id" "$mongo_id"; do
    if [ -n "$id" ] && ! docker_cmd rm -f -v "$id" >/dev/null 2>&1; then
      echo 'FAIL: could not remove a disposable verifier container' >&2
      status=1
    fi
  done
  rm -rf "$scratch"
  exit "$status"
}
trap cleanup 0
trap 'exit 130' INT
trap 'exit 143' TERM
echo 'Scope: supplementary course model and minimal-column analytics fixture; no application integration claim.'
docker_cmd info >/dev/null 2>&1 || { echo 'FAIL: Docker daemon unavailable' >&2; exit 1; }
# Explicit tmpfs overrides image-declared data volumes. No ports, host mounts,
# application networks or persistent database volumes are created or reused.
sql_id=$(docker_cmd create --name "$name-sql" --network none \
  --tmpfs /var/lib/mysql:rw,size=1024m \
  -e MYSQL_ALLOW_EMPTY_PASSWORD=yes -e MYSQL_DATABASE=dbms_evidence_level3 mysql:8.0 \
  --innodb-buffer-pool-size=64M --innodb-redo-log-capacity=64M --skip-log-bin)
mongo_id=$(docker_cmd create --name "$name-mongo" --network none \
  --tmpfs /data/db:rw,size=1024m --tmpfs /data/configdb:rw,size=32m mongo:8.0)
docker_cmd start "$sql_id" "$mongo_id" >/dev/null
echo "MySQL image: $(docker_cmd inspect --format '{{.Image}}' "$sql_id")"
echo "MongoDB image: $(docker_cmd inspect --format '{{.Image}}' "$mongo_id")"
sql() { docker_cmd exec -i "$sql_id" mysql --connect-timeout=2 --protocol=TCP -h127.0.0.1 -uroot --batch --raw --skip-column-names dbms_evidence_level3 "$@"; }
attempt=0
ready=0
while [ "$attempt" -lt 90 ]; do
  for id in "$sql_id" "$mongo_id"; do
    if [ "$(docker_cmd inspect --format '{{.State.Running}}' "$id")" != true ]; then
      echo 'FAIL: a database container exited before readiness' >&2
      exit 1
    fi
  done
  sql_ready=0
  mongo_ready=0
  if sql -e 'SELECT 1' > "$scratch/sql-probe.log" 2>&1; then sql_ready=1; fi
  if docker_cmd exec "$mongo_id" mongosh --quiet 'mongodb://127.0.0.1:27017/?serverSelectionTimeoutMS=2000&connectTimeoutMS=2000' --eval 'quit(db.runCommand({ping:1}).ok === 1 ? 0 : 1)' > "$scratch/mongo-probe.log" 2>&1; then mongo_ready=1; fi
  if [ "$sql_ready" = 1 ] && [ "$mongo_ready" = 1 ]; then
    ready=1
    break
  fi
  attempt=$((attempt + 1))
  sleep 2
done
[ "$ready" = 1 ] || { echo 'FAIL: databases did not become ready within 90 attempts' >&2; exit 1; }
echo 'PASS: bounded readiness'
DBMS_EVIDENCE_ALLOW_DISPOSABLE=1 sql < "$dbms/evidence.sql"
sql < "$here/walkthrough.sql" > "$scratch/sql.tsv"
awk -F '\t' '
  NF != 2 || $2 != "1" || seen[$1]++ { print "FAIL: SQL assertion " $1; bad=1 }
  END { if (NR != 18) { print "FAIL: expected 18 SQL assertions, got " NR; bad=1 }; exit bad }
' "$scratch/sql.tsv"
echo 'PASS: 18 SQL assertions (join, nested/correlated queries, recursive CTE, function, index, view, transactional capacity rejection/rollback, DML)'
reject_sql() {
  label=$1 code=$2 detail=$3 statement=$4
  if printf '%s\n' "$statement" | sql > "$scratch/rejection.log" 2>&1; then
    echo "FAIL: SQL $label unexpectedly succeeded" >&2
    exit 1
  fi
  if ! grep -F "ERROR $code " "$scratch/rejection.log" >/dev/null || \
     ! grep -F "$detail" "$scratch/rejection.log" >/dev/null; then
    echo "FAIL: SQL $label returned an unexpected rejection" >&2
    exit 1
  fi
  echo "PASS: SQL $label rejected (error $code)"
}
reject_sql foreign_key 1452 fk_dbms_rides_driver \
  "INSERT INTO dbms_rides(driver_id,travel_date,origin_stop,destination_stop,seats_total) VALUES(999,CURRENT_DATE,'A','B',1);"
reject_sql check_constraint 3819 ck_dbms_rides_seats \
  "INSERT INTO dbms_rides(driver_id,travel_date,origin_stop,destination_stop,seats_total) VALUES(1,CURRENT_DATE,'A','B',0);"
reject_sql unique_constraint 1062 uq_dbms_users_display_name \
  "INSERT INTO dbms_users(display_name) VALUES('Demo Driver');"
reject_sql trigger_self_booking 1644 'driver cannot book own ride' \
  'INSERT INTO dbms_bookings(ride_id,rider_id,fare_minor) VALUES(10,1,7500);'
reject_sql procedure_unavailable 1644 'ride is unavailable' \
  'START TRANSACTION; CALL dbms_book_ride(999,3,7500); ROLLBACK;'
test "$(sql -e 'SELECT (SELECT COUNT(*) FROM dbms_users)=3 AND (SELECT COUNT(*) FROM dbms_rides)=1 AND (SELECT COUNT(*) FROM dbms_bookings)=1;')" = 1
echo 'PASS: rejected writes preserve fixture row counts'

# This fixture supplies only report columns: it is deliberately not a Laravel
# migration or evidence that application services have run.
sql < "$dbms/actual-analytics-fixture.sql"
sql < "$dbms/actual-analytics.sql" > "$scratch/analytics.tsv"
# Expiry is time-dependent; assert its range, then normalize only that field.
awk -F '\t' 'BEGIN { OFS="\t" }
  $1 == "CAMPUS" { if (NF != 4 || $3 !~ /^[012]$/) exit 1; $3="TIME_DEPENDENT" }
  { print }
' "$scratch/analytics.tsv" > "$scratch/analytics-normalized.tsv"
cat > "$scratch/analytics-expected.tsv" <<'EXPECTED'
10	1	2099-01-01 09:00:00	3	2	1	planned
11	1	2099-01-02 09:00:00	car	inbound	500	planned
10	0	1
10	1	2
10	accepted	1	2028-01-01 00:01:00	2028-01-01 00:01:00
10	published	1	2028-01-01 00:00:00	2028-01-01 00:00:00
10	100	INR	1000	capture:100	1000	1000	0	balanced
10	101	INR	700	capture:101	700	600	100	unbalanced
10	102	INR	500	NULL	0	0	0	missing
CAMPUS	2	TIME_DEPENDENT	1
EXPECTED
if ! cmp -s "$scratch/analytics-expected.tsv" "$scratch/analytics-normalized.tsv"; then
  echo 'FAIL: analytics report rows differ from seeded expectations' >&2
  exit 1
fi
echo 'PASS: six analytics reports match 10 seeded rows, including balanced/unbalanced/missing posting groups'
docker_cmd cp "$here/mongo.js" "$mongo_id:/tmp/dbms-level3.js" >/dev/null
docker_cmd exec "$mongo_id" mongosh --quiet --file /tmp/dbms-level3.js
echo 'PASS: DBMS Level 3 supplementary verifier complete'
