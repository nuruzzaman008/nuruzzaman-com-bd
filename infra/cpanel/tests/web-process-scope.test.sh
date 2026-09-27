#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
eval "$(sed -n '/^web_process_pids() {/,/^}/p' "$ROOT/infra/cpanel/deploy.sh")"
WORK="$(mktemp -d)"
trap 'rm -rf -- "$WORK"' EXIT
mkdir -p "$WORK/site/releases/old/apps/web" "$WORK/other/releases/current" "$WORK/site-other/releases/current" "$WORK/proc/101" "$WORK/proc/102" "$WORK/proc/103"
ln -s "$WORK/site/releases/old/apps/web" "$WORK/proc/101/cwd"
ln -s "$WORK/other/releases/current" "$WORK/proc/102/cwd"
ln -s "$WORK/site-other/releases/current" "$WORK/proc/103/cwd"
actual="$(printf '101\n102\n103\n404\ninvalid\n' | web_process_pids "$WORK/site" "$WORK/proc")"
[ "$actual" = 101 ] || { echo 'FAIL: process selection escaped the intended website'; exit 1; }
echo 'PASS: only the intended website process is selected; other sites and stale PIDs are excluded.'
