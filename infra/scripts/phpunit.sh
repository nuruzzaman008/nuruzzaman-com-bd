#!/usr/bin/env bash
# Runs the Laravel test suite inside Docker (SQLite in-memory, see phpunit.xml).
# Usage: infra/scripts/phpunit.sh --filter=CheckoutTest
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/_root.sh"
ROOT="$(_repo_root)"
MSYS_NO_PATHCONV=1 docker run --rm \
  -v "${ROOT}:/repo" -w /repo/apps/api \
  --entrypoint php \
  composer:2 vendor/bin/phpunit "$@"
