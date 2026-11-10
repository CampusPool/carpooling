#!/bin/sh
# Reproducible private stage bootstrap. No destructive data reset and no public ingress.
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$root"
python3 deploy/one-box/init-private-env.py
test "$(stat -c %a .local/one-box/private.env)" = 600 || {
  echo "Refusing insecure permissions on private.env" >&2; exit 2;
}
sh scripts/prepare-carpoolear.sh
(cd frontend-next && npm ci --no-audit --no-fund &&
 MOBILITY_API_ORIGIN=http://127.0.0.1:18083 NEXT_TELEMETRY_DISABLED=1 npm run build)
compose() {
  if docker info >/dev/null 2>&1; then docker_cmd=docker; else docker_cmd="sudo -n docker"; fi
  $docker_cmd compose --env-file "$root/.local/one-box/private.env" -f "$root/deploy/one-box/compose.yml" "$@"
}
compose config --quiet
compose up -d mysql mongo mailpit
compose build backend activity
compose run --rm --no-deps backend php artisan migrate --force
python3 deploy/one-box/provision-reader.py
compose up -d backend activity frontend
printf '%s\n' 'Private one-box stage started. Do not publish it to the internet.'
