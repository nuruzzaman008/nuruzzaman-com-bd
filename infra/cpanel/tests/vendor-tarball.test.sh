#!/usr/bin/env bash
# Proves that deploy.sh accepts a CI-built vendor tree only for the exact
# composer.lock being deployed.
#
# This host cannot run Composer, so when the lock moves the deployment relies
# on a vendor tree built elsewhere. A tree built from another lock would put
# packages on the server that the lock does not name, and nothing downstream
# would notice; so that is the one thing this check has to refuse.
#
# Usage: infra/cpanel/tests/vendor-tarball.test.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

# The function under test, lifted verbatim from the deployment.
eval "$(sed -n '/^vendor_lock_matches() {/,/^}/p' "$ROOT/infra/cpanel/deploy.sh")"
declare -f vendor_lock_matches >/dev/null || { echo 'FAIL: could not read vendor_lock_matches out of deploy.sh' >&2; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$WORK/build/vendor/acme" "$WORK/other/vendor"
printf '{"content-hash": "aaa"}\n' > "$WORK/build/composer.lock"
printf '<?php\n' > "$WORK/build/vendor/acme/Lib.php"
tar -czf "$WORK/vendor.tar.gz" -C "$WORK/build" composer.lock vendor

printf '{"content-hash": "aaa"}\n' > "$WORK/same.lock"
printf '{"content-hash": "bbb"}\n' > "$WORK/different.lock"

tar -czf "$WORK/no-lock.tar.gz" -C "$WORK/other" vendor
printf 'not a tarball' > "$WORK/broken.tar.gz"

fails=0
expect() { # description, expected (yes|no), tarball, lock
  if vendor_lock_matches "$3" "$4"; then got=yes; else got=no; fi
  if [ "$got" = "$2" ]; then echo "ok   $1"; else echo "FAIL $1 (expected $2, got $got)"; fails=$((fails + 1)); fi
}

expect 'the lock it was built from'   yes "$WORK/vendor.tar.gz"  "$WORK/same.lock"
expect 'a different lock'             no  "$WORK/vendor.tar.gz"  "$WORK/different.lock"
expect 'a tarball without a lock'     no  "$WORK/no-lock.tar.gz" "$WORK/same.lock"
expect 'something that is not a tar'  no  "$WORK/broken.tar.gz"  "$WORK/same.lock"

[ "$fails" = 0 ] || exit 1
echo 'vendor tarball check: all passed'
