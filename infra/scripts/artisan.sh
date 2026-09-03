#!/usr/bin/env bash
# Runs `php artisan` inside Docker so a local PHP install is not required.
# Usage: infra/scripts/artisan.sh migrate --seed
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/_root.sh"
ROOT="$(_repo_root)"
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
  nb-php-cli php artisan "$@"
