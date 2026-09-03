#!/usr/bin/env bash
# Runs the real Laravel API against the local MySQL server, so the Next.js app
# can be previewed against genuine data on the same engine as production.
#
# Development convenience only. The production topology is compose.yaml.
#
#   infra/scripts/dev-api.sh             # serve on 8001, keep the database
#   infra/scripts/dev-api.sh 8001 fresh  # rebuild and re-seed first
#
# `artisan serve` handles one request at a time. That is fine for browsing, but
# the Playwright suite must be run with --workers=1 against this server, or the
# parallel workers queue behind PHP and time out.
#
# Set TTY_FLAG= (empty) to run without a terminal, e.g. from a script.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/_root.sh"
ROOT="$(_repo_root)"
PORT="${1:-8001}"
MODE="${2:-keep}"

bash "${ROOT}/infra/scripts/mysql.sh"

# `artisan serve` forwards only an allowlist of variables to the PHP process it
# spawns per request, and the database settings are not on it - passing -e would
# migrate one database and then serve another. So they go in an env file that
# every process reads for itself. APP_ENV *is* forwarded, and that is what makes
# Laravel load this file ahead of .env. APP_ENV=local also lets the admin seeder
# generate and print a development password, which it refuses to do in any other
# environment.
APP_KEY_VALUE="$(grep -E '^APP_KEY=' "${ROOT}/apps/api/.env" | cut -d= -f2-)"

cat > "${ROOT}/apps/api/.env.local" <<ENV
APP_ENV=local
APP_DEBUG=true
APP_KEY=${APP_KEY_VALUE}
APP_URL=http://localhost:${PORT}
DB_CONNECTION=mysql
DB_HOST=host.docker.internal
DB_PORT=3307
DB_DATABASE=nuruzzaman
DB_USERNAME=root
DB_PASSWORD=devroot
CACHE_STORE=file
SESSION_DRIVER=file
SESSION_DOMAIN=localhost
SESSION_COOKIE=nuruzzaman_session
QUEUE_CONNECTION=sync
MAIL_MAILER=log
SANCTUM_STATEFUL_DOMAINS=localhost:3200,127.0.0.1:3200
FRONTEND_URL=http://localhost:3200
ENV

# Pass a chosen admin password through when the caller set one, so
# `NB_ADMIN_PASSWORD=... SEED=fresh` behaves the way the docs describe instead of
# silently generating a random one.
if [ -n "${NB_ADMIN_PASSWORD:-}" ]; then
  echo "NB_ADMIN_PASSWORD=${NB_ADMIN_PASSWORD}" >> "${ROOT}/apps/api/.env.local"
fi

MIGRATE="php artisan migrate --force -q"
if [ "${MODE}" = "fresh" ]; then
  MIGRATE="php artisan migrate:fresh --force -q && php artisan db:seed --force"
fi

# Build the toolchain image on first use. It carries pdo_mysql, which the stock
# composer image does not - without it every database command fails with
# "could not find driver".
if [ -z "$(docker images -q nb-php-cli 2>/dev/null)" ]; then
  echo "building the PHP toolchain image (first run only)..." >&2
  MSYS_NO_PATHCONV=1 docker build -q -t nb-php-cli \
    -f "${ROOT}/infra/docker/php-cli/Dockerfile" "${ROOT}" >/dev/null
fi

# A fixed name so a wrapper script can stop it again on exit.
docker rm -f nb-dev-api >/dev/null 2>&1 || true

MSYS_NO_PATHCONV=1 docker run --rm --name nb-dev-api ${TTY_FLAG--it} \
  -v "${ROOT}:/repo" -w /repo/apps/api \
  -p "${PORT}:8000" \
  --add-host host.docker.internal:host-gateway \
  -e APP_ENV=local \
  nb-php-cli sh -c \
  "${MIGRATE} && php artisan serve --host=0.0.0.0 --port=8000"
