#!/usr/bin/env bash
# Exercises infra/cpanel/check-quota.sh against every account it has to survive,
# with a stub standing in for cPanel's uapi. This is how a nearly full account
# gets tested without filling one up.
#
# The bug worth guarding against is silence. The first version of this check
# could take a branch that printed nothing at all, which reads exactly like a
# healthy run while telling you the quota was never looked at - and it did
# exactly that on the first real deployment.
#
# Usage: infra/cpanel/tests/quota-parse.test.sh
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CHECK="$ROOT/infra/cpanel/check-quota.sh"
[ -f "$CHECK" ] || { echo "FAIL: $CHECK is missing" >&2; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
EMPTY="$WORK/no-uapi"
mkdir -p "$EMPTY"

fail=0

# Runs the check with a stub uapi that prints $1 and exits $2. Captures both
# streams and the exit status.
with_uapi() {
  local payload=$1 code=${2:-0} stub="$WORK/stub"
  mkdir -p "$stub"
  {
    printf '#!/bin/sh\n'
    printf 'cat <<%s\n%s\n%s\n' 'PAYLOAD' "$payload" 'PAYLOAD'
    printf 'exit %s\n' "$code"
  } > "$stub/uapi"
  chmod +x "$stub/uapi"

  OUT="$(PATH="$stub:$PATH" NB_MIN_FREE_MB="${MIN_FREE:-4096}" bash "$CHECK" 2>&1)"
  STATUS=$?
}

# Runs it on a host with no uapi anywhere.
without_uapi() {
  # A PATH with the ordinary tools but no uapi. /usr/bin holds sed and head,
  # which the check needs, and no cPanel is installed in this container.
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

# --- A healthy account, with the figures this host actually reported -------
# 30,720 MB quota, ~10 GB used, 450,000 inodes.
with_uapi '{"result":{"data":{"inodes_limit":"450000","inodes_remain":"438204","inodes_used":"11796","megabytes_limit":"30720","megabytes_remain":"20457.75","megabytes_used":"10262.25"}}}'
expect 'json: reports disk in the units the host quoted' 'Disk: 10262 MB of 30720 MB used, 20458 MB free.'
expect 'json: reports inodes'                            'Inodes: 11796 of 450000 used.'
allow_expected 'json: a healthy account is allowed to proceed'

# --- The default (non-JSON) rendering, for an older cPanel ----------------
with_uapi '---
apiversion: 3
func: get_quota_info
module: Quota
result:
  data:
    inodes_limit: 450000
    inodes_remain: 438204
    inodes_used: 11796
    megabytes_limit: 30720
    megabytes_remain: 20457.75
    megabytes_used: 10262.25
  errors: ~
  status: 1'
expect 'plain: reports disk'   'Disk: 10262 MB of 30720 MB used, 20458 MB free.'
expect 'plain: reports inodes' 'Inodes: 11796 of 450000 used.'
allow_expected 'plain: allowed to proceed'

# megabytes_used must not be read off the megabytes_remain line, and a prefix
# match must not let inodes_limit answer for megabytes_limit.
with_uapi '{"megabytes_limit":"30720","megabytes_remain":"1.5","megabytes_used":"30718.5","inodes_limit":"450000","inodes_used":"11796"}'
expect 'a nearly full account reads as nearly full' 'Disk: 30718 MB of 30720 MB used, 2 MB free.'
refuse_expected 'a nearly full account is refused before anything is written'
expect 'and says what to do about it' 'Lower NB_BACKUP_KEEP'

# --- Inodes exhausted with disk to spare ----------------------------------
with_uapi '{"megabytes_limit":"30720","megabytes_used":"10262","inodes_limit":"450000","inodes_used":"430000"}'
expect 'inode pressure is warned about' 'WARNING: inodes are above 85%'
# Never a refusal: what a run costs in inodes is not known ahead of time.
allow_expected 'inode pressure warns without blocking the deployment'

# --- An unlimited account -------------------------------------------------
with_uapi '{"megabytes_limit":"0","megabytes_used":"10262","inodes_limit":"0","inodes_used":"11796"}'
expect 'an unlimited account says so' 'no megabyte quota'
allow_expected 'an unlimited account is allowed to proceed'

# --- UAPI answers, but not with figures. This is the silence bug. ---------
with_uapi 'Execution of Quota::get_quota_info failed: permission denied' 1
expect 'an unreadable answer says so'          'no figures could be read'
expect 'and repeats what UAPI complained'      'permission denied'
allow_expected 'an unreadable answer does not block the deployment'

# --- No uapi at all -------------------------------------------------------
without_uapi
expect 'a host without UAPI says so' 'UAPI not found'
allow_expected 'a host without UAPI is allowed to proceed'

# --- Whatever happens, it must never be silent ----------------------------
for payload in \
  '{"megabytes_limit":"30720","megabytes_used":"10262","inodes_limit":"450000","inodes_used":"11796"}' \
  'nonsense' \
  ''; do
  with_uapi "$payload"
  label="$(printf '%.28s' "${payload:-<empty answer>}")"
  if [ -n "$OUT" ]; then
    printf 'PASS never silent: %s\n' "$label"
  else
    printf 'FAIL silent for: %s\n' "$label"; fail=1
  fi
done

[ "$fail" = 0 ] || exit 1
printf '\nAll checks passed.\n'
