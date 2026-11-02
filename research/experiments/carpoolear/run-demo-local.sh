#!/bin/sh
set -eu
cd "$(dirname "$0")"
. "../../../scripts/mobility-runtime.sh"
mobility_require_command docker
mobility_require_command curl
mobility_require_command jq
mobility_require_command python3

instance=${MOBILITY_DEMO_INSTANCE:-$(date +%s)-$$}
case "$instance" in *[!A-Za-z0-9_-]*|'') echo 'Invalid demo instance.' >&2; exit 2;; esac
project="mobility-carpoolear-demo-$instance"
context=${MOBILITY_DOCKER_CONTEXT:-colima-mobility}
export MOBILITY_DEMO_INSTANCE="$instance"
export MOBILITY_SMOKE_DB_VOLUME="mobility-carpoolear-demo-$instance-db"
if docker --context "$context" volume inspect "$MOBILITY_SMOKE_DB_VOLUME" >/dev/null 2>&1; then
  printf '%s\n' 'Refusing to reuse an existing demo database volume.' >&2
  exit 2
fi
compose() { docker --context "$context" compose --project-name "$project" -f compose.smoke.yml -f compose.journey.yml -f compose.hardened.yml -f compose.lifecycle.yml -f compose.routing-fixture.yml -f compose.disposable-demo.yml --env-file .env "$@"; }

# Prepare the pinned hardened worktree and synthetic environment without touching a pilot checkout.
sh ../../../scripts/prepare-carpoolear.sh
export MOBILITY_PATCH_DIGEST=$(mobility_sha256 patches/critical-invariants.patch)
mobility_init_test_env .env
compose config --quiet
cleanup() { status=$?; compose down -v --remove-orphans >/dev/null 2>&1 || true; exit "$status"; }
trap cleanup EXIT INT TERM
if ! compose up -d --build; then
  compose logs --no-color --tail=120 mysql deps migrate app gateway >&2 || true
  exit 1
fi
mapping=$(compose port gateway 8080)
case "$mapping" in 127.0.0.1:*) :;; *) echo "Gateway was not bound to loopback: $mapping" >&2; exit 1;; esac
port=${mapping##*:}
ready=0
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS --max-time 5 "http://127.0.0.1:$port/api/health" >/dev/null 2>&1; then ready=1; break; fi
  sleep 2
done
[ "$ready" = 1 ] || {
  echo 'Disposable gateway did not become ready.' >&2
  compose logs --no-color --tail=120 mysql migrate app gateway >&2 || true
  exit 1
}
driver_session=$(curl -sS -X POST "http://127.0.0.1:$port/api/mobility/commute/demo-session" -H 'Content-Type: application/json' --data '{"role":"driver","scenario":"campus-route"}')
driver_token=$(printf '%s' "$driver_session" | jq -er '.token')
tomorrow=$(python3 -c 'from datetime import date,timedelta; print(date.today()+timedelta(days=1))')
profile_result=$(curl -sS -w '\n%{http_code}' -X PUT "http://127.0.0.1:$port/api/mobility/commute/profile" -H "Authorization: Bearer $driver_token" -H 'Content-Type: application/json' --data '{"role":"driver","vehicle_preference":"both","schedule_mode":"fixed","weekdays":[1,2,3,4,5,6,7],"home":{"label":"Demo home","lat":12.9716,"lng":77.5946},"campus":{"label":"Demo campus","lat":12.9352,"lng":77.6200},"outbound_time":"10:00","return_time":"17:30","max_walk_meters":999}')
profile_status=$(printf '%s' "$profile_result" | tail -n1); [ "$profile_status" -ge 200 ] && [ "$profile_status" -lt 300 ] || { printf 'profile failed (status %s): %s\n' "$profile_status" "$(printf '%s' "$profile_result" | sed '$d' | cut -c1-500)" >&2; exit 1; }
offer=$(curl -sS -w '\n%{http_code}' -X POST "http://127.0.0.1:$port/api/mobility/commute/offers" -H "Authorization: Bearer $driver_token" -H 'Content-Type: application/json' -H "Idempotency-Key: demo-$instance" --data "{\"date\":\"$tomorrow\",\"direction\":\"outbound\",\"vehicle_type\":\"car\",\"choice\":\"DIRECT_RIDER_PICKUP\",\"max_detour_meters\":10000,\"max_detour_seconds\":1800}")
offer_status=$(printf '%s' "$offer" | tail -n1); [ "$offer_status" -ge 200 ] && [ "$offer_status" -lt 300 ] || { printf 'offer failed (status %s): %s\n' "$offer_status" "$(printf '%s' "$offer" | sed '$d' | cut -c1-500)" >&2; exit 1; }
offer=$(printf '%s' "$offer" | sed '$d')
printf '%s' "$offer" | jq -e . >/dev/null
unset driver_session driver_token offer
printf 'Disposable gateway ready at http://127.0.0.1:%s\n' "$port"
printf '%s\n' 'Start the client separately: cd frontend-next && MOBILITY_API_ORIGIN=http://127.0.0.1:'"$port"' npm start -- --hostname 127.0.0.1 --port 3012'
printf '%s\n' 'Press Ctrl-C here to tear down this demo and its dedicated volume.'
while :; do sleep 3600; done
