#!/usr/bin/env bash
# Runs the Laravel test suite inside Docker against MySQL.
#
# The suite uses the same engine as production, so a migration or query that
# only works on another driver fails here rather than after deployment. The test
# database is separate from the development one and is safe to drop.
#
# Usage: infra/scripts/phpunit.sh --filter=CheckoutTest
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/_root.sh"
ROOT="$(_repo_root)"

bash "${ROOT}/infra/scripts/mysql.sh"

docker exec nb-dev-mysql mysql -uroot -pdevroot -e \
  "CREATE DATABASE IF NOT EXISTS nuruzzaman_test
     CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null

# Build the toolchain image on first use. It carries pdo_mysql, which the stock
# composer image does not - without it every database command fails with
# "could not find driver".
if [ -z "$(docker images -q nb-php-cli 2>/dev/null)" ]; then
  echo "building the PHP toolchain image (first run only)..." >&2
  MSYS_NO_PATHCONV=1 docker build -q -t nb-php-cli \
    -f "${ROOT}/infra/docker/php-cli/Dockerfile" "${ROOT}" >/dev/null
fi

MSYS_NO_PATHCONV=1 docker run --rm \
  -v "${ROOT}:/repo" -w /repo/apps/api \
  --add-host host.docker.internal:host-gateway \
  -e DB_HOST=host.docker.internal \
  -e DB_PORT=3307 \
  nb-php-cli php vendor/bin/phpunit "$@"
