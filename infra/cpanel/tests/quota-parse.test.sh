#!/usr/bin/env bash
# Exercises infra/cpanel/check-quota.sh against every account it has to survive,
# with a stub standing in for cPanel's uapi. This is how a nearly full account
# gets tested without filling one up.
#
# The fixtures start from what this server's uapi actually printed, captured
# from a deployment log. An earlier version of this file invented its fixtures
# instead, using plural key names cPanel does not use - so every test passed
# while the check read nothing at all on the real host. A test that shares its
# author's guess cannot catch the guess.
#
# The other failure worth guarding against is silence: a check that prints
# nothing reads exactly like a healthy run.
#
# Usage: infra/cpanel/tests/quota-parse.test.sh
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CHECK="$ROOT/infra/cpanel/check-quota.sh"
[ -f "$CHECK" ] || { echo "FAIL: $CHECK is missing" >&2; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

fail=0

# Runs the check with a stub uapi that prints $1 and exits $2. Captures both
# streams and the exit status. The stub ignores its arguments, so the check's
# --output=json attempt and its plain retry both see the same answer - which
# is what this host does, since it answered in the default rendering.
with_uapi() {
  local payload=$1 code=${2:-0} stub="$WORK/stub"
  mkdir -p "$stub"
  printf '%s\n' "$payload" > "$stub/answer"
  {
    printf '#!/bin/sh\n'
    printf 'cat "%s"\n' "$stub/answer"
    printf 'exit %s\n' "$code"
  } > "$stub/uapi"
  chmod +x "$stub/uapi"

  OUT="$(PATH="$stub:$PATH" NB_MIN_FREE_MB="${MIN_FREE:-4096}" bash "$CHECK" 2>&1)"
  STATUS=$?
}

# Runs it on a host with no uapi anywhere (none is installed in the container).
without_uapi() {
  OUT="$(NB_MIN_FREE_MB="${MIN_FREE:-4096}" bash "$CHECK" 2>&1)"
  STATUS=$?
}

expect() {
  local what=$1 needle=$2
  case "$OUT" in
    *"$needle"*) printf 'PASS %s\n' "$what" ;;
    *) printf 'FAIL %s\n     wanted: %s\n     got:    %s\n' "$what" "$needle" "${OUT:-<silence>}"; fail=1 ;;
  esac
}

refuse_expected() {
  if [ "$STATUS" -eq 1 ]; then printf 'PASS %s\n' "$1"
  else printf 'FAIL %s (exit %s)\n     %s\n' "$1" "$STATUS" "$OUT"; fail=1; fi
}

allow_expected() {
  if [ "$STATUS" -eq 0 ]; then printf 'PASS %s\n' "$1"
  else printf 'FAIL %s (exit %s)\n     %s\n' "$1" "$STATUS" "$OUT"; fail=1; fi
}

# --- Verbatim from this server, 2026-09-12 deployment log -----------------
REAL_ANSWER="$(cat <<'UAPI'
---
apiversion: 3
func: get_quota_info
module: Quota
result:
  data:
    backup_warning_threshold_pct: 90
    inode_limit: 450000
    inodes_remain: 220669
    inodes_used: 229331
    megabyte_limit: 30720
    megabytes_remain: '21124.74'
    megabytes_used: '9595.26'
    under_backup_threshold: 1
UAPI
)"

with_uapi "$REAL_ANSWER"
expect 'real host: disk read from megabyte_limit' 'Disk: 9595 MB of 30720 MB used, 21125 MB free.'
expect 'real host: inodes read from inode_limit'  'Inodes: 229331 of 450000 used (50%).'
allow_expected 'real host: allowed to proceed'
case "$OUT" in
  *'no figures could be read'*) printf 'FAIL %s\n' 'real host must not report unreadable figures'; fail=1 ;;
  *) printf 'PASS %s\n' 'real host is not reported as unreadable' ;;
esac

# The same answer with megabytes_remain placed first, so a sloppy match on
# "megabyte" would pick up the wrong number.
with_uapi 'megabytes_remain: 1.50
megabytes_used: 30718.50
megabyte_limit: 30720
inodes_used: 229331
inode_limit: 450000'
expect 'megabytes_remain is never read as the limit' 'Disk: 30718 MB of 30720 MB used, 2 MB free.'
refuse_expected 'a nearly full account is refused before anything is written'
expect 'and says what to do about it' 'Lower NB_BACKUP_KEEP'

# --- The JSON rendering, for a build that honours --output=json ------------
with_uapi '{"result":{"data":{"inode_limit":450000,"inodes_used":229331,"megabyte_limit":30720,"megabytes_remain":"21124.74","megabytes_used":"9595.26"}}}'
expect 'json: reports disk'   'Disk: 9595 MB of 30720 MB used, 21125 MB free.'
expect 'json: reports inodes' 'Inodes: 229331 of 450000 used (50%).'
allow_expected 'json: allowed to proceed'

# --- Plural key names, in case another cPanel build spells them that way ---
with_uapi '{"megabytes_limit":"30720","megabytes_used":"9595.26","inodes_limit":"450000","inodes_used":"229331"}'
expect 'plural names still read' 'Disk: 9595 MB of 30720 MB used, 21125 MB free.'

# --- Inodes nearly exhausted with disk to spare ----------------------------
with_uapi 'megabyte_limit: 30720
megabytes_used: 9595
inode_limit: 450000
inodes_used: 430000'
expect 'inode pressure is warned about' 'WARNING: inodes are above 85%'
# Never a refusal: what a run costs in inodes is not known ahead of time.
allow_expected 'inode pressure warns without blocking the deployment'

# --- An unlimited account --------------------------------------------------
with_uapi 'megabyte_limit: 0
megabytes_used: 9595
inode_limit: 0
inodes_used: 229331'
expect 'an unlimited account says so' 'no megabyte quota'
allow_expected 'an unlimited account is allowed to proceed'

# --- UAPI answers, but not with figures ------------------------------------
with_uapi 'Execution of Quota::get_quota_info failed: permission denied' 1
expect 'an unreadable answer says so'     'no figures could be read'
expect 'and repeats what UAPI complained' 'permission denied'
allow_expected 'an unreadable answer does not block the deployment'

# --- No uapi at all ----------------------------------------------------------
without_uapi
expect 'a host without UAPI says so' 'UAPI not found'
allow_expected 'a host without UAPI is allowed to proceed'

# --- Whatever happens, it must never be silent -----------------------------
for payload in "$REAL_ANSWER" 'nonsense' ''; do
  with_uapi "$payload"
  label="$(printf '%.20s' "${payload:-<empty answer>}" | tr '\n' ' ')"
  if [ -n "$OUT" ]; then
    printf 'PASS never silent: %s\n' "$label"
  else
    printf 'FAIL silent for: %s\n' "$label"; fail=1
  fi
done

[ "$fail" = 0 ] || exit 1
printf '\nAll checks passed.\n'
