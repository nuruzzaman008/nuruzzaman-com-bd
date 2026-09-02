#!/usr/bin/env bash
# Runs Composer inside Docker so a local PHP/Composer install is not required.
# The whole repository is mounted so the API can reach /content while seeding.
# Usage: infra/scripts/composer.sh require vendor/package
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/_root.sh"
ROOT="$(_repo_root)"
MSYS_NO_PATHCONV=1 docker run --rm \
  -v "${ROOT}:/repo" -w /repo/apps/api \
  -e COMPOSER_MEMORY_LIMIT=-1 \
  composer:2 "$@"
