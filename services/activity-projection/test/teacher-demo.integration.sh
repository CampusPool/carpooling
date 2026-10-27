#!/bin/sh
set -eu

if [ "${MOBILITY_ACTIVITY_ALLOW_TEACHER_DEMO:-0}" != 1 ]; then
  echo 'Refusing teacher-demo projection; set MOBILITY_ACTIVITY_ALLOW_TEACHER_DEMO=1.' >&2
  exit 2
fi
context="${MOBILITY_DOCKER_CONTEXT:-colima-mobility}"
project="${MOBILITY_TEACHER_DEMO_PROJECT:-}"
gateway="${MOBILITY_TEACHER_DEMO_GATEWAY:-}"
case "$project" in mobility-teacher-demo-[0-9]*) :;; *) echo 'Refusing a non-teacher-demo Compose project.' >&2; exit 2;; esac
case "$gateway" in http://127.0.0.1:*|http://localhost:*) :;; *) echo 'Refusing a non-loopback teacher-demo gateway.' >&2; exit 2;; esac
prepared="${MOBILITY_ACTIVITY_TEACHER_DEMO_PREPARED:-0}"
allow_mutation="${MOBILITY_ACTIVITY_ALLOW_TEACHER_DEMO_MUTATION:-0}"
[ "$prepared" = 1 ] || [ "$allow_mutation" = 1 ] || {
  echo 'Refusing teacher-demo API mutation; use a prepared stack or set MOBILITY_ACTIVITY_ALLOW_TEACHER_DEMO_MUTATION=1.' >&2
  exit 2
}
gateway_port=${gateway##*:}
root=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
repo_root=$(CDPATH= cd -- "$(dirname "$0")/../../.." && pwd)
resolved_root=$(CDPATH= cd -P "$root" && pwd)
resolved_repo_root=$(CDPATH= cd -P "$repo_root" && pwd)
data_root="${MOBILITY_ACTIVITY_TEACHER_DATA_ROOT:-$root/.local/activity-projection-teacher/$project}"
mkdir -p "$data_root"
resolved_data_root=$(CDPATH= cd -P "$data_root" && pwd)
case "$resolved_data_root" in "$resolved_root"/*) :;; *) echo 'Refusing teacher projection data outside this checkout.' >&2; exit 2;; esac
data_root="$resolved_data_root/run-$$"
mkdir -p "$data_root/mongo" "$data_root/evidence"
dc() { docker --context "$context" "$@"; }
services=$(dc ps -a --filter "label=com.docker.compose.project=$project" --format '{{.Label "com.docker.compose.service"}}' | sort -u)
for service in app mysql proof-gateway; do printf '%s\n' "$services" | grep -qx "$service" || { echo "Teacher demo service missing: $service" >&2; exit 1; }; done
mysql_container=$(dc ps --filter "label=com.docker.compose.project=$project" --filter label=com.docker.compose.service=mysql --format '{{.Names}}' | head -1)
app_container=$(dc ps --filter "label=com.docker.compose.project=$project" --filter label=com.docker.compose.service=app --format '{{.Names}}' | head -1)
[ -n "$app_container" ] || { echo 'Teacher demo app is not running.' >&2; exit 1; }
proof_gateway_container=$(dc ps --filter "label=com.docker.compose.project=$project" --filter label=com.docker.compose.service=proof-gateway --format '{{.Names}}' | head -1)
[ -n "$proof_gateway_container" ] || { echo 'Teacher demo proof gateway is not running.' >&2; exit 1; }
[ -n "$mysql_container" ] && [ -n "$app_container" ] || { echo 'Teacher demo app/mysql are not running.' >&2; exit 1; }
gateway_mapping=$(dc port "$proof_gateway_container" 8080/tcp)
printf '%s\n' "$gateway_mapping" | grep -Eq "^127\\.0\\.0\\.1:${gateway_port}$" || {
  echo 'Teacher-demo gateway URL does not match the named project proof-gateway port.' >&2
  exit 2
}
network=$(dc inspect "$mysql_container" --format '{{range $n, $_ := .NetworkSettings.Networks}}{{$n}}{{end}}')
[ "$network" = "${project}_appnet" ] || { echo 'Teacher demo mysql is on an unexpected network.' >&2; exit 2; }
db_name=$(dc inspect "$mysql_container" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^MYSQL_DATABASE=//p')
root_password=$(dc inspect "$mysql_container" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^MYSQL_ROOT_PASSWORD=//p')
[ "$db_name" = testing ] && [ -n "$root_password" ] || { echo 'Teacher demo database identity is not testing.' >&2; exit 2; }
dc exec -e MYSQL_PWD="$root_password" "$mysql_container" mysql -uroot -N -B -e 'SELECT 1' "$db_name" >/dev/null
before_events=$(dc exec -e MYSQL_PWD="$root_password" "$mysql_container" mysql -uroot -N -B -e 'SELECT COUNT(*) FROM mobility_trip_events' "$db_name" 2>/dev/null || printf '0')
run_id=$(date +%s)
evidence="$data_root/evidence/commute-$run_id.txt"
verifier_status=0
if [ "$prepared" = 1 ]; then
  printf 'prepared_teacher_demo=1\nproject=%s\n' "$project" >"$evidence"
  after_events="$before_events"
else
  # Seed dated synthetic offers only after explicit mutation opt-in.
  driver_session=$(curl -fsS -X POST "$gateway/api/mobility/commute/demo-session" -H 'Content-Type: application/json' --data '{"role":"driver","scenario":"campus-route"}')
  driver_token=$(printf '%s' "$driver_session" | jq -er '.token')
  tomorrow=$(python3 -c 'from datetime import date,timedelta; print(date.today()+timedelta(days=1))')
  driver_profile='{"role":"driver","vehicle_preference":"both","schedule_mode":"fixed","weekdays":[1,2,3,4,5,6,7],"home":{"label":"Demo home","lat":12.9716,"lng":77.5946},"campus":{"label":"Demo campus","lat":12.9352,"lng":77.6200},"outbound_time":"10:00","return_time":"17:30","max_walk_meters":999}'
  curl -fsS -X PUT "$gateway/api/mobility/commute/profile" -H "Authorization: Bearer $driver_token" -H 'Content-Type: application/json' --data "$driver_profile" >/dev/null
  for vehicle in car bike; do
    curl -fsS -X POST "$gateway/api/mobility/commute/offers" -H "Authorization: Bearer $driver_token" -H 'Content-Type: application/json' -H "Idempotency-Key: teacher-$run_id-$vehicle" --data "{\"date\":\"$tomorrow\",\"direction\":\"outbound\",\"vehicle_type\":\"$vehicle\",\"choice\":\"DIRECT_RIDER_PICKUP\",\"max_detour_meters\":10000,\"max_detour_seconds\":1800}" >/dev/null
  done
  unset driver_token driver_session driver_profile
  python3 "$resolved_repo_root/scripts/verify-commute-product.py" --base "$gateway" >"$evidence" 2>&1 || verifier_status=$?
  after_events=$(dc exec -e MYSQL_PWD="$root_password" "$mysql_container" mysql -uroot -N -B -e 'SELECT COUNT(*) FROM mobility_trip_events' "$db_name")
  [ "$after_events" -gt "$before_events" ] || { echo 'Teacher-demo API path emitted no mobility_trip_events; refusing to project fixture or inferred activity.' >&2; exit 1; }
fi
[ "$after_events" -gt 0 ] || { echo 'Prepared teacher demo contains no mobility_trip_events.' >&2; exit 1; }
reader="activity_reader_$$"; reader_password=$(openssl rand -hex 18)
mongo_name="mobility-activity-teacher-$project-$$"
cleanup() { set +e; dc rm -f "$mongo_name" >/dev/null 2>&1 || true; dc exec -e MYSQL_PWD="$root_password" "$mysql_container" mysql -uroot -e "DROP USER IF EXISTS '$reader'@'%'" >/dev/null 2>&1 || true; }
trap cleanup EXIT
trap 'exit 130' INT TERM
dc exec -i -e MYSQL_PWD="$root_password" "$mysql_container" mysql -uroot "$db_name" <<SQL >/dev/null
CREATE USER IF NOT EXISTS '$reader'@'%' IDENTIFIED BY '$reader_password';
ALTER USER '$reader'@'%' IDENTIFIED BY '$reader_password';
REVOKE ALL PRIVILEGES, GRANT OPTION FROM '$reader'@'%';
GRANT SELECT ON \`$db_name\`.\`mobility_trip_events\` TO '$reader'@'%';
FLUSH PRIVILEGES;
SQL
# Verify the dedicated account can read and cannot delete, using a no-op predicate.
dc exec -e MYSQL_PWD="$reader_password" "$mysql_container" mysql -h 127.0.0.1 -u "$reader" "$db_name" -e 'SELECT COUNT(*) FROM mobility_trip_events' >/dev/null
if dc exec -e MYSQL_PWD="$reader_password" "$mysql_container" mysql -h 127.0.0.1 -u "$reader" "$db_name" -e 'DELETE FROM mobility_trip_events WHERE 1=0' >/dev/null 2>&1; then
  echo 'Reader unexpectedly has DELETE permission.' >&2; exit 1
fi
dc run -d --name "$mongo_name" --network "$network" --network-alias "$mongo_name" -v "$data_root/mongo:/data/db" mongo:8.0 >/dev/null
for _ in $(seq 1 60); do dc exec "$mongo_name" mongosh --quiet --eval 'db.runCommand({ping:1})' >/dev/null 2>&1 && break; sleep 1; done
dc exec "$mongo_name" mongosh --quiet --eval 'db.runCommand({ping:1})' >/dev/null 2>&1 || { echo 'Dedicated teacher Mongo did not become ready.' >&2; exit 1; }
image=node:20-bookworm; mount="$resolved_root/activity-projection"
sync_log="$data_root/evidence/projection-sync-$run_id.txt"; daily_log="$data_root/evidence/projection-daily-$run_id.txt"
mysql_host=mysql
dc run --rm --network "$network" -v "$mount:/work:ro" -w /work -e "MOBILITY_ACTIVITY_MYSQL_URL=mysql://$reader:$reader_password@$mysql_host:3306/$db_name" -e MOBILITY_ACTIVITY_MYSQL_TIMEZONE=+05:30 -e "MOBILITY_ACTIVITY_MONGODB_URI=mongodb://$mongo_name:27017" -e MOBILITY_ACTIVITY_MONGODB_DB=mobility_teacher_activity "$image" node src/cli.mjs sync >"$sync_log"
dc run --rm --network "$network" -v "$mount:/work:ro" -w /work -e "MOBILITY_ACTIVITY_MYSQL_URL=mysql://$reader:$reader_password@$mysql_host:3306/$db_name" -e MOBILITY_ACTIVITY_MYSQL_TIMEZONE=+05:30 -e "MOBILITY_ACTIVITY_MONGODB_URI=mongodb://$mongo_name:27017" -e MOBILITY_ACTIVITY_MONGODB_DB=mobility_teacher_activity "$image" node src/cli.mjs sync >>"$sync_log"
dc run --rm --network "$network" -v "$mount:/work:ro" -w /work -e "MOBILITY_ACTIVITY_MYSQL_URL=mysql://$reader:$reader_password@$mysql_host:3306/$db_name" -e MOBILITY_ACTIVITY_MYSQL_TIMEZONE=+05:30 -e "MOBILITY_ACTIVITY_MONGODB_URI=mongodb://$mongo_name:27017" -e MOBILITY_ACTIVITY_MONGODB_DB=mobility_teacher_activity "$image" node src/cli.mjs daily >"$daily_log"
projected=$(dc exec "$mongo_name" mongosh --quiet mobility_teacher_activity --eval 'db.mobility_activity_events.countDocuments()' | tr -d '\r\n ')
[ "$projected" -eq "$after_events" ] || { echo 'Mongo projection count differs from the SQL lifecycle source after replay.' >&2; exit 1; }
sensitive=$(dc exec "$mongo_name" mongosh --quiet mobility_teacher_activity --eval 'db.mobility_activity_events.countDocuments({$or:[{response_body:{$exists:true}},{request_fingerprint:{$exists:true}},{idempotency_key:{$exists:true}}]})' | tr -d '\r\n ')
[ "$sensitive" = 0 ] || { echo 'Sensitive source fields appeared in Mongo.' >&2; exit 1; }
printf 'teacher_demo_project=%s\nsql_events_before=%s\nsql_events_after=%s\nmongo_projected_events=%s\nevidence_dir=%s\n' "$project" "$before_events" "$after_events" "$projected" "$data_root/evidence"
if [ "$verifier_status" -ne 0 ]; then
  printf 'verifier_status=%s (partial lifecycle evidence retained; inspect the sanitized verifier log)\n' "$verifier_status"
fi
