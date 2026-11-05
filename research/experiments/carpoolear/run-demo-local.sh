#!/bin/sh
set -eu
cd "$(dirname "$0")"
. "../../../scripts/mobility-runtime.sh"
mobility_require_command docker
mobility_require_command curl
mobility_require_command jq
mobility_require_command python3

demo_mode=${1:-commute}
case "$demo_mode" in
  commute|canonical) ;;
  *) printf '%s\n' 'Usage: sh run-demo-local.sh [commute|canonical]' >&2; exit 2 ;;
esac

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
if [ "$demo_mode" = canonical ]; then
  printf '%s\n' 'Seeding one-time synthetic members, approved vehicle capacity, and canonical pickup catalog.'
  seed_output=$(compose exec -T -e MOBILITY_PRINT_LOCAL_SEED_CREDENTIALS=false app php /opt/mobility-extension/tools/seed-local-routing.php)
  printf '%s\n' "$seed_output"
  unset seed_output
  base_url="http://127.0.0.1:$port"
  host_session=$(curl -fsS -X POST "$base_url/api/mobility/commute/demo-session" -H 'Content-Type: application/json' --data '{"role":"driver","scenario":"campus-route"}')
  rider_session=$(curl -fsS -X POST "$base_url/api/mobility/commute/demo-session" -H 'Content-Type: application/json' --data '{"role":"rider","scenario":"campus-route"}')
  host_token=$(printf '%s' "$host_session" | jq -er '.token')
  rider_token=$(printf '%s' "$rider_session" | jq -er '.token')
  host_identity=$(curl -fsS "$base_url/api/mobility/commute/me" -H "Authorization: Bearer $host_token")
  rider_identity=$(curl -fsS "$base_url/api/mobility/commute/me" -H "Authorization: Bearer $rider_token")
  [ "$(printf '%s' "$host_identity" | jq -r '.user.name')" = 'Synthetic Demo Host' ] || { echo 'Driver demo session did not bind to the seeded canonical host.' >&2; exit 1; }
  [ "$(printf '%s' "$rider_identity" | jq -r '.user.name')" = 'Synthetic Demo Rider' ] || { echo 'Rider demo session did not bind to the seeded canonical rider.' >&2; exit 1; }
  host_access=$(curl -fsS "$base_url/api/mobility/membership/me" -H "Authorization: Bearer $host_token")
  rider_access=$(curl -fsS "$base_url/api/mobility/membership/me" -H "Authorization: Bearer $rider_token")
  printf '%s' "$host_access" | jq -e '.capabilities.publish == true' >/dev/null || { echo 'Seeded synthetic host is not publish-ready.' >&2; exit 1; }
  printf '%s' "$rider_access" | jq -e '.capabilities.discover == true and .capabilities.request == true' >/dev/null || { echo 'Seeded synthetic rider is not request-ready.' >&2; exit 1; }
  onboarding=$(curl -fsS "$base_url/api/mobility/driver-onboarding/me" -H "Authorization: Bearer $host_token")
  printf '%s' "$onboarding" | jq -e '.data | any(.status == "approved" and .legal_passenger_capacity == 2)' >/dev/null || { echo 'Synthetic approved vehicle capacity is not available to the host UI.' >&2; exit 1; }
  cars=$(curl -fsS "$base_url/api/cars" -H "Authorization: Bearer $host_token")
  car_id=$(printf '%s' "$cars" | jq -er 'if type == "array" then .[0].id else .data[0].id end')
  points=$(curl -fsS "$base_url/api/mobility/pickup-points?page_size=50" -H "Authorization: Bearer $host_token")
  pickup=$(printf '%s' "$points" | jq -er '.data[] | select(.name == "Synthetic Routing Stop A") | .id' | head -n1)
  dropoff=$(printf '%s' "$points" | jq -er '.data[] | select(.name == "Synthetic Routing Stop B") | .id' | head -n1)
  trip_date=$(python3 -c 'from datetime import datetime,timedelta; from zoneinfo import ZoneInfo; print((datetime.now(ZoneInfo("Asia/Kolkata"))+timedelta(days=2)).strftime("%Y-%m-%dT10:00"))')
  quote=$(curl -fsS -X POST "$base_url/api/mobility/routes/quote" -H "Authorization: Bearer $host_token" -H 'Content-Type: application/json' --data "{\"stop_ids\":[$pickup,$dropoff],\"vehicle_type\":\"car\"}")
  quote_id=$(printf '%s' "$quote" | jq -er '.data.id')
  trip=$(curl -fsS -X POST "$base_url/api/mobility/pool-offers" -H "Authorization: Bearer $host_token" -H 'Content-Type: application/json' -H "Idempotency-Key: canonical-publish-$instance" --data "{\"quote_id\":\"$quote_id\",\"car_id\":$car_id,\"trip_date\":\"$trip_date\",\"total_seats\":2}")
  trip_id=$(printf '%s' "$trip" | jq -er '.data.id')
  search=$(curl -fsS -X POST "$base_url/api/mobility/pool-matches" -H "Authorization: Bearer $rider_token" -H 'Content-Type: application/json' --data "{\"service_date\":\"${trip_date%%T*}\",\"pickup_point_id\":$pickup,\"dropoff_point_id\":$dropoff,\"from_time\":\"09:00\",\"to_time\":\"11:00\",\"preferred_time\":\"10:00\",\"vehicle_type\":\"car\"}")
  match_id=$(printf '%s' "$search" | jq -er '.data[0].match_id')
  request=$(curl -fsS -X POST "$base_url/api/mobility/pool-matches/$match_id/requests" -H "Authorization: Bearer $rider_token" -H 'Content-Type: application/json' -H "Idempotency-Key: canonical-request-$instance" --data '{}')
  booking_id=$(printf '%s' "$request" | jq -er '.data.booking_id')
  rider_id=$(printf '%s' "$rider_session" | jq -er '.user.id')
  curl -fsS -X POST "$base_url/api/trips/$trip_id/requests/$rider_id/accept" -H "Authorization: Bearer $host_token" -H 'Content-Type: application/json' --data '{}' | jq -e '.data.request_state == 1' >/dev/null || { echo 'Host could not accept the canonical rider request.' >&2; exit 1; }
  curl -fsS -X POST "$base_url/api/trips/$trip_id/requests/$rider_id/cancel" -H "Authorization: Bearer $rider_token" -H 'Content-Type: application/json' --data '{}' | jq -e '.data.request_state == 3' >/dev/null || { echo 'Rider could not cancel the accepted canonical booking.' >&2; exit 1; }
  printf 'Canonical fixture verified through seeded demo sessions: ride #%s, booking #%s (accepted then cancelled).\n' "$trip_id" "$booking_id"
  unset host_session rider_session host_token rider_token host_identity rider_identity host_access rider_access onboarding cars points pickup dropoff trip_date quote quote_id trip trip_id search match_id request booking_id rider_id base_url
else
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
fi
printf 'Disposable gateway ready at http://127.0.0.1:%s\n' "$port"
printf '%s\n' 'Start the client separately: cd frontend-next && MOBILITY_API_ORIGIN=http://127.0.0.1:'"$port"' npm start -- --hostname 127.0.0.1 --port 3012'
if [ "$demo_mode" = canonical ]; then
  printf '%s\n' 'Canonical demo is explicitly synthetic; fixture credentials and preapproval are valid only for this disposable gateway.'
  printf '%s\n' 'The Next.js OTP sign-in flow remains a separate deferred gate; this mode prepares API-ready synthetic actors and canonical route/vehicle fixtures.'
fi
printf '%s\n' 'Press Ctrl-C here to tear down this demo and its dedicated volume.'
while :; do sleep 3600; done
