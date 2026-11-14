#!/bin/sh
# Fresh, isolated InstaBox host only. Never resets or seeds an existing database.
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$root"
python3 deploy/one-box/init-private-env.py
sh scripts/prepare-carpoolear.sh
compose() { docker compose --env-file "$root/.local/one-box/private.env" -f "$root/deploy/one-box/compose.yml" "$@"; }
compose config --quiet
compose up -d mysql mongo mailpit
compose build backend activity
if [ ! -f research/vendor/carpoolear_backend/vendor/autoload.php ]; then
  docker run --rm --network host -v "$root/research/vendor/carpoolear_backend:/var/www" \
    -w /var/www campuspool-pes-box3-backend composer install --no-interaction --prefer-dist --no-scripts
fi
compose run --rm --no-deps backend php artisan migrate --force
python3 deploy/one-box/provision-reader.py
(cd frontend-next && npm ci --no-audit --no-fund && \
 MOBILITY_API_ORIGIN=http://127.0.0.1:18083 NEXT_PUBLIC_STUDENT_ONLY=1 NEXT_TELEMETRY_DISABLED=1 npm run build)
compose up -d backend activity frontend
compose ps
