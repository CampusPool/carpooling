#!/bin/sh
# Static Compose acceptance: no road crop, OSRM image, Docker daemon startup or paid API calls.
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
exp="$root/research/experiments/carpoolear"
. "$root/scripts/mobility-runtime.sh"
mobility_require_command docker
tmp=$(mktemp -d)
created_env=0
cleanup() {
  if [ "$created_env" = 1 ]; then rm -f "$exp/.env"; fi
  rm -rf "$tmp"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
if [ ! -f "$exp/.env" ]; then
  mobility_init_test_env "$exp/.env"
  created_env=1
else
  mobility_validate_test_env "$exp/.env"
fi
umask 077
printf 'OLA_MAPS_API_KEY=%s\n' AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA > "$tmp/ola.env"
export MOBILITY_OLA_ENV_FILE="$tmp/ola.env"
export MOBILITY_OLA_HTTPS_PROXY=''
export MOBILITY_DEMO_INSTANCE='ci-ola-compose'
export MOBILITY_SMOKE_DB_VOLUME='ci-ola-compose-db'
export MOBILITY_PATCH_DIGEST='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
export MOBILITY_FRONTEND_URL='http://127.0.0.1:3012'
set -- docker compose --project-name mobility-core-ola-cicheck \
  -f "$exp/compose.smoke.yml" \
  -f "$exp/compose.journey.yml" \
  -f "$exp/compose.hardened.yml" \
  -f "$exp/compose.lifecycle.yml" \
  -f "$exp/compose.disposable-demo.yml" \
  -f "$exp/compose.core-ola.yml" \
  --env-file "$exp/.env"
"$@" config --quiet
services=$("$@" config --services)
for service in mysql deps migrate app gateway; do
  printf '%s\n' "$services" | grep -qx "$service" || { echo "Missing service: $service" >&2; exit 1; }
done
if printf '%s\n' "$services" | grep -Eiq '(osrm|road|routing-fixture)'; then
  echo "Ola Compose unexpectedly requires a router service." >&2
  exit 1
fi
echo 'Ola Compose validates with no OSRM, local road graph or Bengaluru PBF.'
