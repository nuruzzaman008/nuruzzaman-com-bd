#!/usr/bin/env bash
# Runs `php artisan` inside Docker so a local PHP install is not required.
# Usage: infra/scripts/artisan.sh migrate --seed
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/_root.sh"
ROOT="$(_repo_root)"
MSYS_NO_PATHCONV=1 docker run --rm \
  -v "${ROOT}:/repo" -w /repo/apps/api \
  --entrypoint php \
  composer:2 artisan "$@"
