#!/bin/sh
# Real application SQL/Mongo integration in one newly owned disposable stack.
# No host database ports, no pilot data, no writes to the experiment's .env.
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"
. "$root/scripts/mobility-runtime.sh"
for tool in docker python3 git; do mobility_require_command "$tool"; done
if [ -n "${MOBILITY_DBMS_COMPOSE_OVERRIDE:-}" ]; then
  case "$MOBILITY_DBMS_COMPOSE_OVERRIDE" in /*) ;; *) printf '%s\n' 'Compose override must be an absolute local file.' >&2; exit 2;; esac
  test -f "$MOBILITY_DBMS_COMPOSE_OVERRIDE" || exit 2
fi
export MOBILITY_DOCKER_CONTEXT=${MOBILITY_DOCKER_CONTEXT:-default}
instance=$(date +%s)-$$
project="mobility-dbms-proof-$instance"
export MOBILITY_SMOKE_DB_VOLUME="$project-db"
runtime="$root/.local/dbms-application/$instance"
artifacts=${MOBILITY_DBMS_ARTIFACTS_DIR:-"$root/output/dbms-application-verification"}
mkdir -p "$runtime" "$artifacts"
chmod 700 "$runtime"
python3 - "$artifacts" <<'PY'
import pathlib,sys
p=pathlib.Path(sys.argv[1])
for phase in ('journey','ready','replay','scope','outage','verification'):
    (p/(phase+'.json')).unlink(missing_ok=True)
PY
if docker --context "$MOBILITY_DOCKER_CONTEXT" volume inspect "$MOBILITY_SMOKE_DB_VOLUME" >/dev/null 2>&1; then
  printf '%s\n' 'Refusing existing disposable database volume.' >&2
  exit 2
fi
if [ "${MOBILITY_DBMS_SKIP_PREPARE:-0}" != 1 ]; then sh scripts/prepare-carpoolear.sh; fi
test -f research/vendor/carpoolear_backend/composer.lock
test -f research/vendor/carpoolear_hardened/artisan
export MOBILITY_PATCH_DIGEST=$(mobility_sha256 research/experiments/carpoolear/patches/critical-invariants.patch)
mobility_init_test_env "$runtime/test.env"
python3 - "$runtime" <<'PY'
import json, pathlib, secrets, sys
p = pathlib.Path(sys.argv[1])
keys = {name: secrets.token_hex(32) for name in (
    'MOBILITY_ACTIVITY_SERVICE_KEY', 'MOBILITY_MONGO_ROOT_PASSWORD', 'MOBILITY_MONGO_APP_PASSWORD')}
with (p / 'compose.env').open('w') as f:
    for key, value in keys.items(): f.write(f'{key}={value}\n')
with (p / 'runtime.yml').open('w') as f:
    f.write('services:\n')
    for service in ('deps', 'migrate', 'app'):
        f.write(f'  {service}:\n')
        if service != 'deps': f.write(f'    env_file: !override\n      - {json.dumps(str(p / "test.env"))}\n')
        f.write(f'    volumes:\n      - {json.dumps(str(p / "test.env") + ":/var/www/.env:ro")}\n')
PY
chmod 600 "$runtime/test.env" "$runtime/compose.env"
compose_base() {
  mobility_compose "$project" -f "$root/research/experiments/carpoolear/compose.smoke.yml" \
    -f "$root/research/experiments/carpoolear/compose.journey.yml" \
    -f "$root/research/experiments/carpoolear/compose.hardened.yml" \
    -f "$root/research/experiments/carpoolear/compose.lifecycle.yml" \
    -f "$root/research/experiments/carpoolear/compose.routing-fixture.yml" \
    -f "$root/research/experiments/carpoolear/compose.analytics.yml" \
    -f "$runtime/runtime.yml" "$@"
}
compose() {
  if [ -n "${MOBILITY_DBMS_COMPOSE_OVERRIDE:-}" ]; then
    # File list must precede subcommand; reconstruct with the override last.
    # The local override is intended for cached images/vendor volume only.
    compose_base -f "$MOBILITY_DBMS_COMPOSE_OVERRIDE" --env-file "$runtime/compose.env" "$@"
  else
    compose_base --env-file "$runtime/compose.env" "$@"
  fi
}
up() {
  if [ "${MOBILITY_DBMS_SKIP_BUILD:-0}" = 1 ]; then compose up -d --no-build "$@";
  else compose up -d --build "$@"; fi
}
probe() {
  # Capture first so a failing PHP process cannot be hidden by a tee pipeline.
  compose exec -T app php /opt/mobility/dbms-application.php "$1" >"$artifacts/$1.json" || {
    cat "$artifacts/$1.json" >&2; return 1;
  }
  cat "$artifacts/$1.json"
}
cleanup() {
  proof_status=$?
  if [ "$proof_status" -ne 0 ]; then
    compose logs --no-color --tail=80 app migrate activity mongo >&2 || true
  fi
  compose down -v --remove-orphans >/dev/null 2>&1 || true
  rm -f "$runtime/compose.env" "$runtime/test.env" "$runtime/runtime.yml" "$runtime/denied.log"
  rmdir "$runtime" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
compose config --quiet
up mysql deps routing-fixture
mysql_container=$(compose ps -q mysql)
mysql_ip=$(docker --context "$MOBILITY_DOCKER_CONTEXT" inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$mysql_container")
routing_ip=$(docker --context "$MOBILITY_DOCKER_CONTEXT" inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$(compose ps -q routing-fixture)")
case "$mysql_ip:$routing_ip" in *[!0-9.:]*|:|:*) printf '%s\n' 'Invalid disposable service IP.' >&2; exit 1;; esac
export MOBILITY_ROUTING_FIXTURE_HOST="$routing_ip" MOBILITY_ANALYTICS_MYSQL_HOST="$mysql_ip"
python3 - "$runtime/test.env" "$mysql_ip" <<'PY'
import pathlib, sys
p = pathlib.Path(sys.argv[1])
p.write_text('\n'.join('DB_HOST='+sys.argv[2] if line.startswith('DB_HOST=') else line for line in p.read_text().splitlines())+'\n')
PY
up mysql migrate app
ready=0
for attempt in $(seq 1 40); do
  if compose exec -T app php -r '$b=@file_get_contents("http://127.0.0.1:8000/api/health", false, stream_context_create(["http"=>["timeout"=>2]])); $j=json_decode($b?:"",true); exit(($j["database"]??null)==="up" ? 0 : 1);' >/dev/null 2>&1; then ready=1; break; fi
  sleep 2
done
[ "$ready" -eq 1 ] || { printf '%s\n' 'Application did not become healthy.' >&2; exit 1; }
compose exec -T mysql mysql -uroot -psmoke-root-password -e "CREATE USER 'activity_reader'@'%' IDENTIFIED BY 'synthetic-read-only'; GRANT SELECT ON carpoolear.mobility_trip_events TO 'activity_reader'@'%';" >/dev/null
for statement in 'DELETE FROM mobility_trip_events WHERE 1=0' 'SELECT id FROM users LIMIT 0'; do
  if compose exec -T -e MYSQL_PWD=synthetic-read-only mysql mysql -uactivity_reader carpoolear -e "$statement" >"$runtime/denied.log" 2>&1; then
    printf '%s\n' 'Projection account unexpectedly has excessive SQL privileges.' >&2
    exit 1
  fi
  grep 'ERROR 1142' "$runtime/denied.log" >/dev/null || { cat "$runtime/denied.log" >&2; exit 1; }
done
rm -f "$runtime/denied.log"
printf '%s\n' 'PASS: projection SQL account cannot delete events or read user records.'
up mongo activity
probe journey
probe ready
sleep 5
probe replay
probe scope
compose stop mongo >/dev/null
probe outage
python3 - "$artifacts" <<'PY'
import json, pathlib, subprocess, sys
p=pathlib.Path(sys.argv[1])
reports={phase:json.loads((p/(phase+'.json')).read_text()) for phase in ('journey','ready','replay','scope','outage')}
if not all(r.get('completed') is True for r in reports.values()): raise SystemExit('An integration phase failed')
summary={'completed':True, 'method':'Actual Laravel HTTP + MySQL routines/triggers + authenticated Mongo service; synthetic actors and route metrics',
         'source_revision':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),
         'source_dirty':bool(subprocess.check_output(['git','status','--porcelain'],text=True).strip()),
         'phases':list(reports), 'checks':sum(len(r['checks']) for r in reports.values()),
         'sql_privileges':'SELECT mobility_trip_events only; DELETE and users SELECT denied with MySQL 1142'}
(p/'verification.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary,indent=2))
PY
