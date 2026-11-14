#!/bin/sh
# Validate both Docker layouts without starting containers or calling Ola.
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
umask 077
: > "$tmp/mysql.env"
: > "$tmp/laravel.env"
: > "$tmp/frontend.env"
export CAMPUSPOOL_MYSQL_ENV="$tmp/mysql.env"
export CAMPUSPOOL_LARAVEL_ENV="$tmp/laravel.env"
export CAMPUSPOOL_FRONTEND_ENV="$tmp/frontend.env"
export CAMPUSPOOL_STAGE_PORT=3040
export CAMPUSPOOL_DOMAIN=invalid.example
docker compose -f "$root/deploy/ola/compose.yml" config --quiet
docker compose -f "$root/deploy/ola/compose.yml" -f "$root/deploy/ola/compose.simular-host.yml" config --quiet
printf 'Both private VPS and Simular loopback Compose configurations validated (no providers called).\n'
