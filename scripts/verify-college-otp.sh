#!/bin/sh
# Disposable Laravel + MySQL student OTP test harness.
# Unique Compose project and database volume; existing teacher/demo data untouched.
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
. "$root/scripts/mobility-runtime.sh"
for tool in docker git; do mobility_require_command "$tool"; done
export MOBILITY_DOCKER_CONTEXT="${MOBILITY_DOCKER_CONTEXT:-default}"
id="$(date +%s)-$$"
project="campuspool-otp-check-$id"
export MOBILITY_SMOKE_DB_VOLUME="$project-db"
base="$root/research/experiments/carpoolear"
runtime="$root/.local/otp-tests/$id"
mkdir -p "$runtime"
chmod 700 "$runtime"
if [ -e "$base/.env" ]; then
  printf '%s\n' 'Refusing to overwrite an existing backend .env.' >&2
  exit 2
fi
mobility_init_test_env "$base/.env"
export MOBILITY_PATCH_DIGEST="$(mobility_sha256 "$base/patches/critical-invariants.patch")"
compose() {
  if [ -n "${MOBILITY_OTP_COMPOSE_OVERRIDE:-}" ]; then
    case "$MOBILITY_OTP_COMPOSE_OVERRIDE" in /*) ;; *) echo "Override must be an absolute path" >&2; exit 2 ;; esac
    mobility_compose "$project" -f "$base/compose.smoke.yml" \
      -f "$base/compose.journey.yml" -f "$base/compose.hardened.yml" \
      -f "$base/compose.lifecycle.yml" -f "$MOBILITY_OTP_COMPOSE_OVERRIDE" \
      --env-file "$base/.env" "$@"
  else
    mobility_compose "$project" -f "$base/compose.smoke.yml" \
      -f "$base/compose.journey.yml" -f "$base/compose.hardened.yml" \
      -f "$base/compose.lifecycle.yml" --env-file "$base/.env" "$@"
  fi
}
cleanup() {
  code=$?
  if [ "$code" -ne 0 ]; then compose logs --tail=35 mysql deps migrate app >&2 || :; fi
  compose down -v --remove-orphans >/dev/null 2>&1 || :
  rm -f "$base/.env"
  rmdir "$runtime" 2>/dev/null || :
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
sh "$root/scripts/prepare-carpoolear.sh" >/dev/null
compose config --quiet
compose up -d --build mysql deps
compose up -d --build migrate app
compose exec -T mysql mysql -uroot -psmoke-root-password -e "CREATE DATABASE IF NOT EXISTS otp_testing"
compose run --rm --no-deps \
  -e APP_ENV=testing -e CACHE_STORE=array -e SESSION_DRIVER=array \
  -e MAIL_MAILER=array -e DB_DATABASE=otp_testing \
  -e DB_USERNAME=root -e DB_PASSWORD=smoke-root-password \
  app php artisan test --compact \
  tests/Feature/Mobility/CollegeEmailAuthRegistrationTest.php \
  tests/Feature/Mobility/CollegeEmailOtpSecurityTest.php \
  tests/Feature/Mobility/LocalAccountAuthTest.php
