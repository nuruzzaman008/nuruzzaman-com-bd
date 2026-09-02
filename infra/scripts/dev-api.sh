#!/usr/bin/env bash
# Runs the real Laravel API against a local SQLite file, so the Next.js app can
# be previewed against genuine data without standing up MySQL, Redis and PHP-FPM.
#
# Development convenience only. The production topology is compose.yaml.
#
# `artisan serve` handles one request at a time. That is fine for browsing, but
# it means the Playwright suite must be run with --workers=1 against this server,
# or the parallel workers queue behind PHP and time out. The suite's own default
# (the Node mock API on port 3100) is concurrent and is what CI uses.
#
#   infra/scripts/dev-api.sh             # serve on 8001, keep the database
#   infra/scripts/dev-api.sh 8001 fresh  # rebuild and re-seed first
#
# Set TTY_FLAG= (empty) to run without a terminal, e.g. from a script.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/_root.sh"
ROOT="$(_repo_root)"
PORT="${1:-8001}"
MODE="${2:-keep}"
DB="apps/api/database/dev.sqlite"

[ -f "${ROOT}/${DB}" ] || : > "${ROOT}/${DB}"

# `artisan serve` forwards only an allowlist of variables to the PHP process it
# spawns per request, and DB_DATABASE is not on it — passing -e would migrate one
# database and then serve another. So the settings go in an env file that every
# process reads for itself. APP_ENV *is* forwarded, and that is what makes
# Laravel load this file ahead of .env. APP_ENV=local also lets the admin seeder
# generate and print a development password, which it refuses to do in any
# other environment.
APP_KEY_VALUE="$(grep -E '^APP_KEY=' "${ROOT}/apps/api/.env" | cut -d= -f2-)"

cat > "${ROOT}/apps/api/.env.local" <<ENV
APP_ENV=local
APP_DEBUG=true
APP_KEY=${APP_KEY_VALUE}
APP_URL=http://localhost:${PORT}
DB_CONNECTION=sqlite
DB_DATABASE=/repo/${DB}
CACHE_STORE=file
SESSION_DRIVER=file
SESSION_DOMAIN=localhost
QUEUE_CONNECTION=sync
MAIL_MAILER=log
SANCTUM_STATEFUL_DOMAINS=localhost:3200,127.0.0.1:3200
FRONTEND_URL=http://localhost:3200
ENV

MIGRATE="php artisan migrate --force -q"
if [ "${MODE}" = "fresh" ]; then
  MIGRATE="php artisan migrate:fresh --force -q && php artisan db:seed --force"
fi

MSYS_NO_PATHCONV=1 docker run --rm ${TTY_FLAG--it} \
  -v "${ROOT}:/repo" -w /repo/apps/api \
  -p "${PORT}:8000" \
  -e APP_ENV=local \
  --entrypoint sh composer:2 -c \
  "${MIGRATE} && php artisan serve --host=0.0.0.0 --port=8000"
