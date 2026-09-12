#!/usr/bin/env bash
# Reports the account's disk and inode headroom, and refuses a run that cannot
# finish.
#
# Called by deploy.sh after the prune, so the space just reclaimed counts, and
# before the first byte is written, so a run that would die halfway through a
# tar says so instead and leaves nothing behind. That is not hypothetical: it
# is how the deployment learned to prune.
#
# `df` is the wrong tool here. CloudLinux gives the account its own quota, and
# df reports the filesystem underneath it - it will cheerfully show terabytes
# free while the account has none left. cPanel's UAPI is the one that knows.
#
# Inodes are reported as well as megabytes. A Next.js release and a node_modules
# tree are hundreds of thousands of small files, so this account can run out of
# inodes with gigabytes to spare, and that failure looks like a disk error with
# plenty of disk left.
#
# Exit 0: checked and fine, or could not check. Exit 1: not enough room.
#
# Usage: NB_MIN_FREE_MB=4096 infra/cpanel/check-quota.sh
set -uo pipefail

MIN_FREE_MB="${NB_MIN_FREE_MB:-4096}"

# A non-interactive SSH session gets a thin PATH, so uapi is looked for where
# cPanel installs it as well as on PATH.
UAPI_BIN=''
for candidate in uapi /usr/local/cpanel/bin/uapi /usr/bin/uapi; do
  if command -v "$candidate" >/dev/null 2>&1; then UAPI_BIN="$candidate"; break; fi
done

QUOTA_RAW=''

# Works against both renderings UAPI produces, quoted or bare, and takes the
# whole number from a decimal. Anchored on a word boundary so megabytes_limit
# cannot be answered by megabytes_remain.
quota_number() {
  printf '%s\n' "$QUOTA_RAW" | sed -n "s/.*\b$1\b[^0-9-]*\([0-9][0-9]*\).*/\1/p" | head -1
}

if [ -n "$UAPI_BIN" ]; then
  # stderr is kept: when this cannot answer, its complaint is the diagnosis.
  QUOTA_RAW="$("$UAPI_BIN" --output=json Quota get_quota_info 2>&1)"
  # Older cPanel builds do not take --output; the default rendering parses too.
  if [ -z "$(quota_number megabytes_limit)" ]; then
    QUOTA_RAW="$("$UAPI_BIN" Quota get_quota_info 2>&1)"
  fi
fi

MB_LIMIT="$(quota_number megabytes_limit)"
MB_USED="$(quota_number megabytes_used)"
INODES_LIMIT="$(quota_number inodes_limit)"
INODES_USED="$(quota_number inodes_used)"

# Every path below says something. An earlier version of this check could take
# a branch that printed nothing at all, which reads exactly like a healthy run
# while telling you the quota was never looked at.
if [ -z "$UAPI_BIN" ]; then
  printf 'Quota: cPanel UAPI not found; disk headroom not checked.\n' >&2
  exit 0
fi

if [ -z "$MB_LIMIT" ] && [ -z "$INODES_LIMIT" ]; then
  printf 'Quota: UAPI answered but no figures could be read; disk headroom not checked.\n' >&2
  printf 'Quota: it said: %.300s\n' "$QUOTA_RAW" >&2
  exit 0
fi

status=0

# A limit of zero means unlimited; there is no headroom to check.
if [ -n "$MB_LIMIT" ] && [ -n "$MB_USED" ] && [ "$MB_LIMIT" -gt 0 ]; then
  MB_FREE=$((MB_LIMIT - MB_USED))
  printf 'Disk: %s MB of %s MB used, %s MB free.\n' "$MB_USED" "$MB_LIMIT" "$MB_FREE"

  if [ "$MB_FREE" -lt "$MIN_FREE_MB" ]; then
    printf 'Only %s MB free; this run needs at least %s MB. Lower NB_BACKUP_KEEP or NB_RELEASE_KEEP, or clear space, then run again.\n' \
      "$MB_FREE" "$MIN_FREE_MB" >&2
    status=1
  fi
elif [ -n "$MB_LIMIT" ] && [ "$MB_LIMIT" = 0 ]; then
  printf 'Disk: the account has no megabyte quota.\n'
fi

if [ -n "$INODES_LIMIT" ] && [ -n "$INODES_USED" ] && [ "$INODES_LIMIT" -gt 0 ]; then
  printf 'Inodes: %s of %s used.\n' "$INODES_USED" "$INODES_LIMIT"

  # A warning, never a refusal: what a run costs in inodes is not known ahead
  # of time, and refusing on a guess would block a deployment that would have
  # succeeded.
  if [ "$((INODES_USED * 100 / INODES_LIMIT))" -ge 85 ]; then
    printf 'WARNING: inodes are above 85%%. Keeping fewer releases or backups is the cheapest way down.\n' >&2
  fi
fi

exit "$status"
