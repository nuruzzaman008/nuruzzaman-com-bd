#!/usr/bin/env bash
# Read-only inventory. No environment values, credentials or source contents.
set -euo pipefail
repo="${NB_DEPLOY_SOURCE:-$HOME/repositories/nuruzzaman-com-bd}"
cd "$repo"
printf 'Branch: '; git branch --show-current
printf 'Commit: '; git rev-parse HEAD
git status --short
for tool in php composer node npm git rsync flock; do command -v "$tool" || true; done
php -r 'echo "PHP ",PHP_VERSION,"; proc_open=",is_callable("proc_open")?"yes":"no",PHP_EOL;' || true
node --version || true
npm --version || true
df -h "$HOME"
printf 'Verify account quota and LVE memory/CPU limits in cPanel, not just host free memory.\n'
for folder in "$repo" "$HOME/api.nuruzzaman.com.bd" "$HOME/nuruzzaman-web" "$HOME/nuruzzaman.com.bd"; do
  if [ -d "$folder" ]; then du -sh "$folder"; else printf 'MISSING %s\n' "$folder"; fi
done
for file in "$HOME/.nb-deploy.conf" "$HOME/api.nuruzzaman.com.bd/.env" "$HOME/nuruzzaman-web/server.js" "$HOME/nuruzzaman-web/current/apps/web/server.js"; do
  if [ -e "$file" ]; then printf 'EXISTS %s\n' "$file"; else printf 'MISSING %s\n' "$file"; fi
done
for folder in storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache; do
  if [ -d "$HOME/api.nuruzzaman.com.bd/$folder" ] && [ -w "$HOME/api.nuruzzaman.com.bd/$folder" ]; then printf 'WRITABLE %s\n' "$folder"; else printf 'MISSING/NOT WRITABLE %s\n' "$folder"; fi
done
# Compare tracked API code, never .env/storage contents. A mismatch is drift,
# not proof of which version should win. Review against private backups.
git ls-files -z apps/api | while IFS= read -r -d '' file; do
  case "$file" in */.env*|*/storage/*|*/bootstrap/cache/*) continue;; esac
  deployed="$HOME/api.nuruzzaman.com.bd/${file#apps/api/}"
  if [ ! -f "$deployed" ]; then printf 'API MISSING %s\n' "$file";
  elif ! cmp -s "$file" "$deployed"; then printf 'API DIFFERS %s\n' "$file"; fi
done
printf 'Inspect Node Selector Application Root/URL/startup and domain document roots in cPanel.\n'
printf 'Frontend build files cannot be compared directly with Next.js source; inspect release commit and build manifests.\n'
