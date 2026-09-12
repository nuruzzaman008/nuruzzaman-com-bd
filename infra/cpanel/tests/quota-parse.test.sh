#!/usr/bin/env bash
# Checks that the deployment reads cPanel's quota numbers correctly.
#
# The parser has to survive both renderings UAPI produces (the YAML-ish default
# and --output=json), values quoted as strings, and decimal megabytes. Getting
# this wrong in the unsafe direction would refuse every deployment; getting it
# wrong in the safe direction would let a run start that cannot finish.
#
# Usage: infra/cpanel/tests/quota-parse.test.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

# The parser under test, lifted out of the deployment so the two cannot drift.
eval "$(sed -n '/^quota_number() {/,/^}/p' "$ROOT/infra/cpanel/deploy.sh")"
declare -f quota_number >/dev/null || { echo 'FAIL: could not read quota_number out of deploy.sh' >&2; exit 1; }

fail=0
check() {
  if [ "$2" = "$3" ]; then
    printf 'PASS %-52s %s\n' "$1" "$2"
  else
    printf 'FAIL %-52s got %s, expected %s\n' "$1" "${2:-<empty>}" "$3"
    fail=1
  fi
}

# What `uapi --output=json Quota get_quota_info` returns, with the real numbers
# this account reported: 30,720 MB limit, ~10 GB used, 450,000 inodes.
QUOTA_RAW='{"result":{"data":{"inodes_limit":"450000","inodes_remain":"438204","inodes_used":"11796","megabytes_limit":"30720","megabytes_remain":"20457.75","megabytes_used":"10262.25"},"errors":null,"status":1}}'
check 'json: megabytes_limit' "$(quota_number megabytes_limit)" '30720'
check 'json: megabytes_used'  "$(quota_number megabytes_used)"  '10262'
check 'json: inodes_limit'    "$(quota_number inodes_limit)"    '450000'
check 'json: inodes_used'     "$(quota_number inodes_used)"     '11796'

# The default rendering, which is what a bare `uapi Quota get_quota_info` gives.
QUOTA_RAW='---
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
check 'plain: megabytes_limit' "$(quota_number megabytes_limit)" '30720'
check 'plain: megabytes_used'  "$(quota_number megabytes_used)"  '10262'
check 'plain: inodes_limit'    "$(quota_number inodes_limit)"    '450000'
check 'plain: inodes_used'     "$(quota_number inodes_used)"     '11796'

# `megabytes_used` must not be read off the `megabytes_remain` line, and the
# prefix match must not let inodes_limit answer for megabytes_limit.
QUOTA_RAW='{"megabytes_limit":"30720","megabytes_remain":"1.5","megabytes_used":"30718.5"}'
check 'a nearly full account reads as nearly full' "$(quota_number megabytes_used)" '30718'

# An unlimited quota. The deployment treats a zero limit as "no limit to check",
# so the parser has only to report it faithfully rather than as empty.
QUOTA_RAW='{"megabytes_limit":"0","megabytes_used":"10262.25","inodes_limit":"0","inodes_used":"11796"}'
check 'unlimited: limit reads as zero' "$(quota_number megabytes_limit)" '0'

# Nothing to parse: every field must come back empty rather than as a stray
# number, because the deployment's guards key off emptiness.
QUOTA_RAW=''
check 'empty input yields nothing' "$(quota_number megabytes_limit)" ''
QUOTA_RAW='execution failed'
check 'garbage input yields nothing' "$(quota_number megabytes_limit)" ''

# The headroom arithmetic the deployment does with these numbers.
MB_LIMIT=30720; MB_USED=10262
check 'free space from the reported figures' "$((MB_LIMIT - MB_USED))" '20458'
INODES_LIMIT=450000; INODES_USED=11796
check 'inode percentage from the reported figures' "$((INODES_USED * 100 / INODES_LIMIT))" '2'

[ "$fail" = 0 ] || exit 1
printf '\nAll checks passed.\n'
