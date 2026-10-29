#!/bin/sh
set -eu
cd "$(dirname "$0")"
. "../../../scripts/mobility-runtime.sh"
mobility_require_command git
mode=${1:-baseline}
case "$mode" in baseline|journey|hardened|lifecycle|mobility|commute|race) ;; *) printf '%s\n' 'Usage: sh run-smoke.sh [baseline|journey|hardened|lifecycle|mobility|commute|race]' >&2; exit 2 ;; esac
if [ ! -f ../../vendor/carpoolear_backend/composer.lock ]; then
  printf '%s\n' 'Missing pinned vendor checkout; follow README.md first.' >&2
  exit 2
fi
expected_revision=6ba3d8913a8f77e664e848a526f196690a03c1e8
if [ "$(git -C ../../vendor/carpoolear_backend rev-parse HEAD)" != "$expected_revision" ]; then
  printf '%s\n' 'Vendor revision differs from the pinned experiment; see README.md.' >&2
  exit 2
fi
instance=$(date +%s)-$$
project="mobility-carpoolear-smoke-$instance"
export MOBILITY_SMOKE_DB_VOLUME="${project}-db"
context=${MOBILITY_DOCKER_CONTEXT:-colima-mobility}
if docker --context "$context" volume inspect "$MOBILITY_SMOKE_DB_VOLUME" >/dev/null 2>&1; then
  printf '%s\n' 'Refusing to reuse an existing database volume.' >&2
  exit 2
fi
# Compose's application env otherwise overrides phpunit.xml's non-forced
# cache/mail/session defaults and persists rate-limit state across test runs.
compose() {
  case "$mode" in
    baseline)
      mobility_compose "$project" -f compose.smoke.yml --env-file .env "$@" ;;
    journey)
      mobility_compose "$project" -f compose.smoke.yml -f compose.journey.yml --env-file .env "$@" ;;
    hardened|lifecycle|mobility|commute|race)
      mobility_compose "$project" -f compose.smoke.yml -f compose.journey.yml -f compose.hardened.yml --env-file .env "$@" ;;
  esac
}
if [ "$mode" != baseline ]; then
  mkdir -p raw
fi
if [ "$mode" = hardened ] || [ "$mode" = lifecycle ] || [ "$mode" = mobility ] || [ "$mode" = commute ] || [ "$mode" = race ]; then
  if [ "$(git -C ../../vendor/carpoolear_hardened rev-parse HEAD)" != "$expected_revision" ]; then
    printf '%s\n' 'Prepare the pinned hardened evaluation checkout as documented in README.md.' >&2
    exit 2
  fi
  sh ../../../scripts/prepare-carpoolear.sh >/dev/null
  MOBILITY_PATCH_DIGEST=$(mobility_sha256 patches/critical-invariants.patch)
  export MOBILITY_PATCH_DIGEST
fi
if [ "$mode" = lifecycle ]; then
  : # Complete patch stack already verified above, including overlapping integration hooks.
fi
compose_lifecycle() {
  mobility_compose "$project" -f compose.smoke.yml -f compose.journey.yml -f compose.hardened.yml -f compose.lifecycle.yml --env-file .env "$@"
}
if [ "$mode" = lifecycle ] || [ "$mode" = mobility ]; then
  compose() { compose_lifecycle "$@"; }
fi
compose_commute() {
  mobility_compose "$project" -f compose.smoke.yml -f compose.journey.yml -f compose.hardened.yml -f compose.lifecycle.yml -f compose.routing-fixture.yml --env-file .env "$@"
}
if [ "$mode" = commute ] || [ "$mode" = race ]; then
  compose() { compose_commute "$@"; }
fi
compose_race() {
  mobility_compose "$project" -f compose.smoke.yml -f compose.journey.yml -f compose.hardened.yml -f compose.lifecycle.yml -f compose.routing-fixture.yml -f compose.race.yml --env-file .env "$@"
}
if [ "$mode" = race ]; then
  compose() { compose_race "$@"; }
fi
cleanup() {
  mobility_smoke_status=$?
  if [ "$mobility_smoke_status" -ne 0 ]; then
    # Migration startup failures otherwise disappear with this disposable stack.
    compose logs --no-color --tail=100 mysql migrate >&2 || true
  fi
  compose down -v --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

mobility_init_test_env .env

compose config --quiet
compose up -d --build
ready=0
for i in 1 2 3 4 5 6 7 8 9 10; do
  if compose exec -T app php -r '$b=@file_get_contents("http://127.0.0.1:8000/api/health",false,stream_context_create(["http"=>["timeout"=>5]])); $j=json_decode($b?:"",true); if(($j["status"]??null)!=="ok"||($j["database"]??null)!=="up")exit(1); echo $b;'; then ready=1; break; fi
  sleep 2
done
if [ "$ready" -ne 1 ]; then exit 1; fi
printf '\n'
if [ "$mode" = journey ] || [ "$mode" = hardened ] || [ "$mode" = lifecycle ]; then
  compose exec -T app php /opt/mobility/journey-probe.php
elif [ "$mode" = baseline ]; then
  compose run --rm --no-deps -e CACHE_STORE=array -e SESSION_DRIVER=array -e MAIL_MAILER=array -e DB_USERNAME=root -e DB_PASSWORD=smoke-root-password app php artisan test
fi
if [ "$mode" = commute ]; then
  compose exec -T app php /opt/mobility/commute-http-probe.php
fi
if [ "$mode" = race ]; then
  compose exec -T app php /opt/mobility/commute-race-probe.php
fi
if [ "$mode" = mobility ]; then
  compose exec -T mysql mysql -uroot -psmoke-root-password -e "CREATE DATABASE IF NOT EXISTS testing; CREATE DATABASE IF NOT EXISTS testing_backup"
  compose run --rm --no-deps -e CACHE_STORE=array -e SESSION_DRIVER=array -e MAIL_MAILER=array -e DB_DATABASE=testing -e BACKUP_DB_DATABASE=testing_backup -e DB_USERNAME=root -e DB_PASSWORD=smoke-root-password app php artisan test --compact tests/Feature/Mobility
fi
if [ "$mode" = lifecycle ]; then
  compose exec -T app php /opt/mobility/lifecycle-probe.php
  compose run --rm --no-deps -e CACHE_STORE=array -e SESSION_DRIVER=array -e MAIL_MAILER=array -e DB_USERNAME=root -e DB_PASSWORD=smoke-root-password app php artisan test --compact tests/Feature/Mobility
  compose run --rm --no-deps -e CACHE_STORE=array -e SESSION_DRIVER=array -e MAIL_MAILER=array -e DB_USERNAME=root -e DB_PASSWORD=smoke-root-password app php artisan test --compact \
    tests/Feature/Http/SupportTicketApiTest.php \
    tests/Feature/Http/AdminSupportTicketControllerIntegrationTest.php \
    tests/Unit/Services/SupportTicketServiceTest.php \
    tests/Unit/Notifications/SupportTicketReplyNotificationTest.php
  compose run --rm --no-deps -e CACHE_STORE=array -e SESSION_DRIVER=array -e MAIL_MAILER=array -e DB_USERNAME=root -e DB_PASSWORD=smoke-root-password app php artisan test --compact \
    tests/Feature/Http/TripLiveShareControllerIntegrationTest.php \
    tests/Unit/Services/Logic/TripLiveShareManagerTest.php \
    tests/Unit/Repository/TripLiveShareRepositoryTest.php \
    tests/Feature/Http/TripControllerIntegrationTest.php
fi
if [ "$mode" = hardened ] || [ "$mode" = lifecycle ]; then
  compose run --rm --no-deps -e CACHE_STORE=array -e SESSION_DRIVER=array -e MAIL_MAILER=array -e DB_USERNAME=root -e DB_PASSWORD=smoke-root-password app php artisan test --compact \
    tests/Feature/Http/CriticalInvariantsEvaluationTest.php \
    tests/Feature/Http/PassengerControllerIntegrationTest.php \
    tests/Feature/Http/AuthControllerApiTest.php tests/Feature/ApiAuthTest.php \
    tests/Unit/Repository/PassengersRepositoryTest.php \
    tests/Unit/Services/Logic/PassengersManagerTest.php \
    tests/Unit/Services/Logic/UsersManagerTest.php \
    tests/Unit/Services/Logic/SocialManagerTest.php
fi
