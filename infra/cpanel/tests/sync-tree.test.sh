#!/usr/bin/env bash
# Proves that sync_tree copies the same tree whether rsync is present or not.
#
# The host had no rsync when the deployment was written, so only the tar branch
# has ever run there. rsync has since been enabled, which means the other branch
# is about to run for the first time against the live application - and the
# excludes it carries are the ones protecting the live .env and the uploaded
# media under storage/. A pattern the two tools read differently would not
# announce itself; it would quietly overwrite credentials or delete uploads.
#
# So both branches are run over the same fixture and the results compared.
#
# Usage: infra/cpanel/tests/sync-tree.test.sh
set -euo pipefail

command -v rsync >/dev/null 2>&1 || { echo 'SKIP: no rsync here; run this in a container that has one.' >&2; exit 2; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

# The function under test, lifted verbatim from the deployment so the two
# cannot drift apart without this failing.
eval "$(sed -n '/^sync_tree() {/,/^}/p' "$ROOT/infra/cpanel/deploy.sh")"
declare -f sync_tree >/dev/null || { echo 'FAIL: could not read sync_tree out of deploy.sh' >&2; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# A stand-in for the API tree, carrying one of everything the excludes name.
SRC="$WORK/src"
mkdir -p "$SRC"/{app,storage/app,bootstrap/cache,public,tests,vendor/acme/storage,config}
printf 'staged\n'      > "$SRC/.env"
printf 'staged\n'      > "$SRC/.env.example"
printf 'staged\n'      > "$SRC/app/Kernel.php"
printf 'staged\n'      > "$SRC/storage/app/placeholder.txt"
printf 'staged\n'      > "$SRC/bootstrap/cache/packages.php"
printf 'staged\n'      > "$SRC/public/index.php"
printf 'staged\n'      > "$SRC/public/.htaccess"
printf 'staged\n'      > "$SRC/tests/ExampleTest.php"
printf 'staged\n'      > "$SRC/vendor/acme/storage/Driver.php"
printf 'staged\n'      > "$SRC/config/app.php"
mkdir -p "$SRC/public/storage"
printf 'staged\n'      > "$SRC/public/storage/decoy.txt"

# A stand-in for the live tree, carrying what must survive untouched.
seed_live() {
  local live=$1
  mkdir -p "$live"/{storage/app,bootstrap/cache,public/storage}
  printf 'LIVE SECRET\n'  > "$live/.env"
  printf 'LIVE\n'         > "$live/.env.production"
  printf 'UPLOADED\n'     > "$live/storage/app/customer-upload.bin"
  printf 'LIVE\n'         > "$live/bootstrap/cache/packages.php"
  printf 'LIVE\n'         > "$live/public/.htaccess"
  printf 'UPLOADED\n'     > "$live/public/storage/customer-upload.bin"
}

EXCLUDES=(--exclude='.env' --exclude='.env.*' --exclude='storage/'
          --exclude='public/storage' --exclude='bootstrap/cache/'
          --exclude='tests/' --exclude='public/.htaccess')

WITH="$WORK/with-rsync"
WITHOUT="$WORK/without-rsync"
seed_live "$WITH"
seed_live "$WITHOUT"

sync_tree "$SRC/" "$WITH/" "${EXCLUDES[@]}"

# Re-run as a host without rsync, so the tar branch is taken.
#
# The lookup is shadowed rather than PATH being edited: on a merged-/usr system
# /bin and /usr/bin are the same directory, so dropping one changes nothing,
# and dropping both would take tar and sed with it. Failing the one lookup
# sync_tree makes is exactly the condition being modelled.
(
  command() {
    if [ "$1" = '-v' ] && [ "$2" = 'rsync' ]; then return 1; fi
    builtin command "$@"
  }
  command -v rsync >/dev/null 2>&1 && { echo 'FAIL: rsync lookup not shadowed' >&2; exit 1; }
  sync_tree "$SRC/" "$WITHOUT/" "${EXCLUDES[@]}"
)

fail=0
check() {
  if [ "$1" = "$2" ]; then
    printf 'PASS %s\n' "$3"
  else
    printf 'FAIL %s\n     rsync: %s\n     tar:   %s\n' "$3" "$1" "$2"
    fail=1
  fi
}

# 1. The two branches must produce byte-identical trees.
if diff -r "$WITH" "$WITHOUT" >"$WORK/diff.txt" 2>&1; then
  printf 'PASS %s\n' 'rsync and tar produce identical trees'
else
  printf 'FAIL %s\n' 'rsync and tar differ:'
  sed 's/^/     /' "$WORK/diff.txt"
  fail=1
fi

# 2. The excludes actually protected what they name. Checked per tree rather
#    than only against each other: two identically wrong trees would pass (1).
for tree in "$WITH" "$WITHOUT"; do
  name="$(basename "$tree")"
  check "$(cat "$tree/.env")" 'LIVE SECRET' "$name: live .env untouched"
  check "$(cat "$tree/.env.production")" 'LIVE' "$name: live .env.production untouched"
  check "$(cat "$tree/storage/app/customer-upload.bin")" 'UPLOADED' "$name: uploads under storage/ kept"
  check "$(cat "$tree/public/storage/customer-upload.bin")" 'UPLOADED' "$name: public/storage kept"
  check "$(cat "$tree/bootstrap/cache/packages.php")" 'LIVE' "$name: bootstrap/cache kept"
  check "$(cat "$tree/public/.htaccess")" 'LIVE' "$name: public/.htaccess kept"
  check "$([ -e "$tree/tests" ] && echo present || echo absent)" 'absent' "$name: tests/ not shipped"

  # And that it still copied the application itself.
  check "$(cat "$tree/app/Kernel.php")" 'staged' "$name: application files copied"
  check "$(cat "$tree/config/app.php")" 'staged' "$name: config copied"
  check "$(cat "$tree/public/index.php")" 'staged' "$name: public/index.php copied"
done

[ "$fail" = 0 ] || exit 1
printf '\nAll checks passed.\n'
