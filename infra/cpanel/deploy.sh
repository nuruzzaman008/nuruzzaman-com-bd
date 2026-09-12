#!/usr/bin/env bash
set -euo pipefail
umask 077
fail() { printf 'DEPLOY FAILED: %s\n' "$1" >&2; exit 1; }
SOURCE="$(cd "${NB_DEPLOY_SOURCE:-$PWD}" && pwd -P)"
CONFIG="${NB_DEPLOY_CONFIG:-$HOME/.nb-deploy.conf}"
[ -f "$CONFIG" ] || fail 'Create ~/.nb-deploy.conf from the example first.'
. "$CONFIG"
DRY_RUN="${NB_DRY_RUN:-0}"
DEPLOY_API="${NB_DEPLOY_API:-1}"
DEPLOY_WEB="${NB_DEPLOY_WEB:-1}"
BUILD_WEB="${NB_BUILD_WEB:-1}"
RUN_MIGRATIONS="${NB_RUN_MIGRATIONS:-0}"
for flag in "$DRY_RUN" "$DEPLOY_API" "$DEPLOY_WEB" "$BUILD_WEB" "$RUN_MIGRATIONS"; do
  [[ "$flag" = 0 || "$flag" = 1 ]] || fail 'Flags must be 0 or 1.'
done
for tool in git realpath tar flock; do command -v "$tool" >/dev/null || fail "Missing $tool"; done
# Copies the contents of one directory into another, excluding what it is
# told to. cPanel accounts often have no rsync, and this is the whole of what
# the deployment asked rsync for, so tar stands in rather than the deployment
# refusing to run on an ordinary shared host.
sync_tree() {
  sync_src=$1; sync_dest=$2; shift 2
  if command -v rsync >/dev/null 2>&1; then
    rsync -a "$@" "$sync_src" "$sync_dest"
    return
  fi
  sync_excludes=()
  for sync_arg in "$@"; do
    case "$sync_arg" in --exclude=*) sync_excludes+=("--exclude=${sync_arg#--exclude=}") ;; esac
  done
  mkdir -p "$sync_dest"
  (cd "$sync_src" && tar -cf - "${sync_excludes[@]}" .) | (cd "$sync_dest" && tar -xf -)
}

ACCOUNT="$(realpath "$HOME")"
check_target() {
  [[ "$(realpath -m "$1")" = "$ACCOUNT/$2" && ! -L "$1" ]] || fail "Unsafe target: $1"
  [[ "$SOURCE/" != "$(realpath -m "$1")/"* ]] || fail 'Source overlaps target.'
}
check_target "${NB_API_ROOT:?Set NB_API_ROOT}" api.nuruzzaman.com.bd
check_target "${NB_WEB_ROOT:?Set NB_WEB_ROOT}" nuruzzaman-web
NB_API_ROOT="$(realpath -m "$NB_API_ROOT")"
NB_WEB_ROOT="$(realpath -m "$NB_WEB_ROOT")"
[ -z "$(git -C "$SOURCE" status --porcelain)" ] || fail 'Commit reviewed changes first; repository must be clean.'
COMMIT="$(git -C "$SOURCE" rev-parse HEAD)"
if git -C "$SOURCE" ls-files | grep -Eq '(^|/)(\.env($|\.(production|local)$)|secrets/)|\.(pfx|p12|pem|key|nbk|nbrk|lsp|vlx|fas)$'; then fail 'Tracked private files detected.'; fi
if [ "$DEPLOY_API" = 1 ]; then
  PHP_BIN="${NB_PHP_BIN:-}"
  if [ -z "$PHP_BIN" ]; then
    for candidate in /opt/cpanel/ea-php84/root/usr/bin/php /opt/alt/php84/usr/bin/php /opt/cpanel/ea-php85/root/usr/bin/php /opt/alt/php85/usr/bin/php; do
      if [ -x "$candidate" ] && "$candidate" -r 'exit(PHP_VERSION_ID >= 80401 ? 0 : 1);'; then PHP_BIN="$candidate"; break; fi
    done
    PHP_BIN="${PHP_BIN:-$(command -v php || true)}"
  fi
  [ -x "$PHP_BIN" ] || fail 'Set NB_PHP_BIN.'
  "$PHP_BIN" -r 'exit(PHP_VERSION_ID >= 80401 ? 0 : 1);' || fail 'composer.lock requires PHP >=8.4.1.'
  "$PHP_BIN" -r 'echo "PHP ",PHP_VERSION,PHP_EOL; exit(extension_loaded("pdo_mysql") ? 0 : 1);' || fail 'Enable pdo_mysql.'
  "$PHP_BIN" -r 'exit(is_callable("proc_open") ? 0 : 1);' || fail 'Composer requires proc_open in CLI PHP. Ask the host to enable it for the selected CLI runtime; do not bypass platform checks.'
  COMPOSER_FILE="${NB_COMPOSER_PHAR:-}"
  if [ -z "$COMPOSER_FILE" ]; then
    if [ -f "$HOME/composer.phar" ]; then COMPOSER_FILE="$HOME/composer.phar"; else COMPOSER_FILE="$(command -v composer || true)"; fi
  fi
  [ -f "$COMPOSER_FILE" ] || fail 'Set NB_COMPOSER_PHAR to a Composer PHP script/phar.'
  "$PHP_BIN" "$COMPOSER_FILE" check-platform-reqs --working-dir="$SOURCE/apps/api" --lock --no-dev
  [ -f "$NB_API_ROOT/.env" ] || fail 'Production API .env is missing; configure it securely first.'
  [ -w "$NB_API_ROOT" ] || fail 'API root is not writable.'
  for dir in storage bootstrap/cache; do
    [ ! -e "$NB_API_ROOT/$dir" ] || [ -w "$NB_API_ROOT/$dir" ] || fail "$dir is not writable."
  done
  if [ -e "$NB_API_ROOT/public/storage" ] && [ ! -L "$NB_API_ROOT/public/storage" ]; then fail 'Preserve and reconcile existing public/storage directory first.'; fi
  if [ "$RUN_MIGRATIONS" = 1 ]; then
    [ "${NB_MIGRATIONS_REVIEWED_COMMIT:-}" = "$COMMIT" ] || fail 'Set NB_MIGRATIONS_REVIEWED_COMMIT after reviewing pending migrations.'
    [ -s "${NB_DATABASE_BACKUP:-}" ] || fail 'Set NB_DATABASE_BACKUP to a verified nonempty database backup.'
  fi
fi
if [ "$DEPLOY_WEB" = 1 ]; then
  NODE_BIN="${NB_NODE_BIN:-}"
  if [ -z "$NODE_BIN" ]; then
    for candidate in "$HOME"/nodevenv/nuruzzaman-web/22/bin/node /opt/alt/alt-nodejs22/root/usr/bin/node /opt/cpanel/ea-nodejs22/bin/node; do
      if [ -x "$candidate" ]; then NODE_BIN="$candidate"; break; fi
    done
    NODE_BIN="${NODE_BIN:-$(command -v node || true)}"
  fi
  [ -x "$NODE_BIN" ] || fail 'Configure cPanel Node.js 22 App or set NB_NODE_BIN.'
  "$NODE_BIN" -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>20 || (a===20 && b>=9) ? 0 : 1)' || fail 'Node >=20.9 required; use Node 22.'
  export PATH="$(dirname "$NODE_BIN"):$PATH"
  : "${NB_PUBLIC_SITE_URL:?Set NB_PUBLIC_SITE_URL}"
  : "${NB_INTERNAL_API_URL:?Set NB_INTERNAL_API_URL}"
  : "${NB_API_PROXY:?Set NB_API_PROXY}"
  : "${NB_MEDIA_HOST:?Set NB_MEDIA_HOST}"
  [ -d "$NB_WEB_ROOT" ] && [ -w "$NB_WEB_ROOT" ] || fail 'Configure the cPanel Node application root first.'
  for entry in releases server.js; do [ ! -L "$NB_WEB_ROOT/$entry" ] || fail "Unexpected symlink: $entry"; done
  if [ -L "$NB_WEB_ROOT/current" ]; then
    [[ "$(realpath "$NB_WEB_ROOT/current")" = "$NB_WEB_ROOT/releases/"* ]] || fail 'current points outside releases.'
  elif [ -e "$NB_WEB_ROOT/current" ]; then fail 'current is not a release symlink.'; fi
  if [ "$BUILD_WEB" = 1 ]; then
    NPM_BIN="${NB_NPM_BIN:-$(command -v npm || true)}"
    [ -x "$NPM_BIN" ] || fail 'npm unavailable in selected Node environment.'
  else
    : "${NB_WEB_BUILD_ROOT:?Set NB_WEB_BUILD_ROOT to a matching Linux build workspace}"
    "$NODE_BIN" "$SOURCE/infra/cpanel/verify-web-build.cjs" "$NB_WEB_BUILD_ROOT" "$NB_API_PROXY" "$COMMIT"
  fi
fi
printf 'Preflight passed for %s. Web PHP handler, SSL, DB and hosting limits still need verification.\n' "$COMMIT"
if [ "$DRY_RUN" = 1 ]; then echo 'Dry run: no writes, build, migrations or restart.'; exit 0; fi
exec 9>"$HOME/.nb-deploy.lock"
flock -n 9 || fail 'Another deployment is running.'
RELEASE="$(date -u +%Y%m%dT%H%M%SZ)-${COMMIT:0:12}-$$"
BACKUP="$HOME/nb-deploy-backups/$RELEASE"
[ ! -L "$HOME/nb-deploy-backups" ] || fail 'Backup directory must not be a symlink.'

# Deletes all but the newest $retain timestamped directories in $dir. Names
# given after $retain are kept whatever their age, which is how the live
# release and the one it would roll back to are protected.
#
# Written to survive `set -euo pipefail`: on a first deploy the directory does
# not exist yet and both ls and grep exit non-zero, which would abort the run
# at the one moment when there is nothing to prune at all.
prune_timestamped() {
  local dir="$1" retain="$2" listing stale target protected
  shift 2
  case "$retain" in ''|*[!0-9]*) fail "Retention for $dir must be a whole number." ;; esac
  [ -d "$dir" ] && [ ! -L "$dir" ] || return 0
  listing="$(ls -1 "$dir" 2>/dev/null | grep -E '^20[0-9]{6}T[0-9]{6}Z-' |
    sort -r | tail -n +"$((retain + 1))" || true)"
  while IFS= read -r stale; do
    [ -n "$stale" ] || continue
    for protected in "$@"; do
      [ "$stale" != "$protected" ] || continue 2
    done
    target="$dir/$stale"
    # Never follow a symlink out of the directory being pruned.
    [ ! -L "$target" ] && [ -d "$target" ] || continue
    printf 'Pruning %s\n' "$target"
    rm -rf -- "$target"
  done <<< "$listing"
}

# Complete backups precede builds, staging and live changes, and the old ones
# go *before* the new one is written. This account is quota-limited: an
# unpruned run filled it and then died on the tar below, so the space has to
# be reclaimed before it is needed rather than once the run is over. One slot
# is left free for the backup this run is about to add.
NB_BACKUP_KEEP="${NB_BACKUP_KEEP:-3}"
case "$NB_BACKUP_KEEP" in ''|*[!0-9]*) fail 'NB_BACKUP_KEEP must be a whole number.' ;; esac
[ "$NB_BACKUP_KEEP" -ge 1 ] || fail 'NB_BACKUP_KEEP must be at least 1.'
prune_timestamped "$HOME/nb-deploy-backups" "$((NB_BACKUP_KEEP - 1))"

mkdir -p "$BACKUP"
chmod 700 "$HOME/nb-deploy-backups" "$BACKUP"
trap 'printf "Deployment failed. Backup: %s. Inspect maintenance state; never roll back migrations blindly.\n" "$BACKUP"' ERR
# node_modules and the build scratch under .git are excluded. Together they
# were 2.7G of the 2.8G each backup took, and neither is worth keeping:
# node_modules is reproducible from the lockfile, and .git/nb-deploy is
# leftover staging from the superseded server-side build.
tar -C "$SOURCE" -cpf "$BACKUP/repository.tar" \
  --exclude='./node_modules' --exclude='*/node_modules' \
  --exclude='./.git/nb-deploy' .
cp -p "$CONFIG" "$BACKUP/deploy.conf"
for folder in "$NB_API_ROOT" "$NB_WEB_ROOT" "$HOME/nuruzzaman.com.bd"; do
  if [ -d "$folder" ]; then
    tar -C "$folder" -cpf "$BACKUP/$(basename "$folder").tar" .
  fi
done
for archive in "$BACKUP"/*.tar; do tar -tf "$archive" >/dev/null; done
printf '%s\n' "$COMMIT" > "$BACKUP/source-commit"
# Prepare and validate the frontend before touching either live application.
if [ "$DEPLOY_WEB" = 1 ]; then
  if [ "$BUILD_WEB" = 1 ]; then
    BUILD_ROOT="$BACKUP/build"
    mkdir "$BUILD_ROOT"
    git -C "$SOURCE" archive HEAD | tar -x -C "$BUILD_ROOT"
    "$NPM_BIN" --prefix "$BUILD_ROOT" ci --include=dev --no-audit --no-fund
    env NEXT_PUBLIC_SITE_URL="$NB_PUBLIC_SITE_URL" NEXT_PUBLIC_API_BASE=/api/v1 NEXT_PUBLIC_SESSION_COOKIE=nuruzzaman_session NEXT_PUBLIC_MEDIA_HOST="$NB_MEDIA_HOST" INTERNAL_API_URL="$NB_INTERNAL_API_URL" NB_API_PROXY="$NB_API_PROXY" "$NPM_BIN" --prefix "$BUILD_ROOT" run build
    printf '%s\n' "$COMMIT" > "$BUILD_ROOT/apps/web/.next/nb-commit"
  else BUILD_ROOT="$NB_WEB_BUILD_ROOT"; fi
  "$NODE_BIN" "$SOURCE/infra/cpanel/verify-web-build.cjs" "$BUILD_ROOT" "$NB_API_PROXY" "$COMMIT"
  WEB_RELEASE="$NB_WEB_ROOT/releases/$RELEASE"
  mkdir -p "$WEB_RELEASE"
  sync_tree "$BUILD_ROOT/apps/web/.next/standalone/" "$WEB_RELEASE/" --exclude='.env' --exclude='.env.*'
  mkdir -p "$WEB_RELEASE/apps/web/.next/static" "$WEB_RELEASE/apps/web/public"
  sync_tree "$BUILD_ROOT/apps/web/.next/static/" "$WEB_RELEASE/apps/web/.next/static/"
  sync_tree "$BUILD_ROOT/apps/web/public/" "$WEB_RELEASE/apps/web/public/"
  chmod -R u+rwX "$WEB_RELEASE"
fi
if [ "$DEPLOY_API" = 1 ]; then
  API_STAGE="$BACKUP/api-stage"
  mkdir "$API_STAGE"
  git -C "$SOURCE" archive HEAD apps/api | tar -x -C "$API_STAGE" --strip-components=2
  mkdir -p "$API_STAGE/bootstrap/cache" "$API_STAGE/storage/framework/"{cache/data,sessions,views} "$API_STAGE/storage/logs"
  "$PHP_BIN" "$COMPOSER_FILE" install --working-dir="$API_STAGE" --no-dev --no-interaction --prefer-dist --no-scripts --optimize-autoloader
  mkdir -p "$API_STAGE/storage/framework/"{cache/data,sessions,views} "$API_STAGE/storage/logs"
  "$PHP_BIN" "$SOURCE/infra/cpanel/check-api.php" "$API_STAGE" "$NB_API_ROOT" "$RUN_MIGRATIONS"
  if [ -f "$NB_API_ROOT/artisan" ]; then "$PHP_BIN" "$NB_API_ROOT/artisan" down; fi
  sync_tree "$API_STAGE/" "$NB_API_ROOT/" --exclude='.env' --exclude='.env.*' --exclude='storage/' --exclude='public/storage' --exclude='bootstrap/cache/' --exclude='tests/' --exclude='public/.htaccess'
  if [ ! -e "$NB_API_ROOT/public/.htaccess" ]; then cp "$API_STAGE/public/.htaccess" "$NB_API_ROOT/public/.htaccess"; fi
  # The seed bundles live at the repository root, outside apps/api. Without
  # them a deployed server cannot be seeded at all, because the repository
  # relative path resolves outside the account.
  git -C "$SOURCE" archive HEAD content | tar -x -C "$NB_API_ROOT"
  mkdir -p "$NB_API_ROOT/bootstrap/cache" "$NB_API_ROOT/storage/framework/"{cache/data,sessions,views} "$NB_API_ROOT/storage/logs" "$NB_API_ROOT/storage/app/"{public,private-assets}
  # Apache must traverse the public upload link; private-assets stays private.
  chmod u+rwx,go+x "$NB_API_ROOT/storage" "$NB_API_ROOT/storage/app"
  chmod u+rwx,go+rx "$NB_API_ROOT/storage/app/public"
  # Retire cached provider manifests so removed development providers cannot boot.
  for cache in config.php packages.php services.php events.php routes-v7.php; do
    if [ -f "$NB_API_ROOT/bootstrap/cache/$cache" ]; then mv "$NB_API_ROOT/bootstrap/cache/$cache" "$BACKUP/$cache"; fi
  done
  "$PHP_BIN" "$NB_API_ROOT/artisan" config:clear
  "$PHP_BIN" "$NB_API_ROOT/artisan" package:discover
  if [ "$RUN_MIGRATIONS" = 1 ]; then "$PHP_BIN" "$NB_API_ROOT/artisan" migrate --force --step; fi
  for command in config:cache route:cache view:cache event:cache; do "$PHP_BIN" "$NB_API_ROOT/artisan" "$command"; done
  [ -L "$NB_API_ROOT/public/storage" ] || "$PHP_BIN" "$NB_API_ROOT/artisan" storage:link
  "$PHP_BIN" "$NB_API_ROOT/artisan" queue:restart
  "$PHP_BIN" "$NB_API_ROOT/artisan" up
fi
if [ "$DEPLOY_WEB" = 1 ]; then
  [ ! -e "$NB_WEB_ROOT/server.js" ] || cp -p "$NB_WEB_ROOT/server.js" "$BACKUP/server.js"
  if [ -L "$NB_WEB_ROOT/current" ]; then readlink "$NB_WEB_ROOT/current" > "$BACKUP/previous-web-release"; fi
  # Checked at its own path: node infers the module format from the extension,
  # and the staged copy is named server.js.<release>, which it cannot classify.
  "$NODE_BIN" --check "$SOURCE/infra/cpanel/server.cjs"
  cp "$SOURCE/infra/cpanel/server.cjs" "$NB_WEB_ROOT/server.js.$RELEASE"
  # Passenger starts the app with a bare environment. These are host settings,
  # so they come from the deploy config rather than the repository; the entry
  # script reads them back and refuses to start without INTERNAL_API_URL.
  # Written every deploy, so the setting cannot be lost by deploying again.
  cat > "$NB_WEB_ROOT/runtime.env.json.$RELEASE" <<JSON
{
  "INTERNAL_API_URL": "$NB_INTERNAL_API_URL",
  "NEXT_PUBLIC_SITE_URL": "$NB_PUBLIC_SITE_URL"
}
JSON
  mv -f "$NB_WEB_ROOT/runtime.env.json.$RELEASE" "$NB_WEB_ROOT/runtime.env.json"
  ln -s "$WEB_RELEASE" "$NB_WEB_ROOT/current.$RELEASE"
  mv -Tf "$NB_WEB_ROOT/current.$RELEASE" "$NB_WEB_ROOT/current"
  mv -f "$NB_WEB_ROOT/server.js.$RELEASE" "$NB_WEB_ROOT/server.js"
  mkdir -p "$NB_WEB_ROOT/tmp"

  # Noted before the restart is asked for, so what gets retired below is
  # exactly the set of app processes that predate this deploy - never the one
  # Passenger is about to start.
  STALE_APP_PIDS="$(pgrep -u "$(id -un)" -f 'next-server' 2>/dev/null || true)"

  touch "$NB_WEB_ROOT/tmp/restart.txt"

  # Passenger starts the app on the first request, and the new release has to
  # be serving before the old one is taken away.
  curl -fsS -o /dev/null --max-time 120 --retry 5 --retry-delay 6 \
    "$NB_PUBLIC_SITE_URL/" || echo 'Warning: the site did not answer; the previous app is being left alone.'

  # Passenger does not always reap the app it replaced. Seventeen next-server
  # processes had accumulated across eight deploys, eleven threads each, until
  # the account could not fork at all: node failed with "pthread_create:
  # Resource temporarily unavailable" and every route answered 503. Nothing in
  # the deploy noticed, because a restart signal is not evidence of a restart.
  #
  # Only retired once the new app has answered, so a failed deploy leaves the
  # running site exactly as it was.
  if curl -fsS -o /dev/null --max-time 60 "$NB_PUBLIC_SITE_URL/" 2>/dev/null; then
    for stale_pid in $STALE_APP_PIDS; do
      if kill -TERM "$stale_pid" 2>/dev/null; then
        printf 'Retired the previous app process %s\n' "$stale_pid"
      fi
    done

    # Long enough for those processes to write their exit lines, which are
    # always "Error: Server is not running." (ERR_SERVER_NOT_RUNNING): Next's
    # SIGTERM handler closing a listener Passenger owns. Expected, not a fault.
    sleep 5

    # The log is kept with the backup and then started empty, but only on a
    # deploy that served - a failed one must keep its evidence. Afterwards
    # "stderr.log is empty" means "this release has logged no error", which is
    # worth having as a health check, and the file stops growing for ever.
    if [ -s "$NB_WEB_ROOT/stderr.log" ]; then
      cp -p "$NB_WEB_ROOT/stderr.log" "$BACKUP/stderr.log" 2>/dev/null || true
    fi
    : > "$NB_WEB_ROOT/stderr.log" 2>/dev/null || true
  fi
  # Only now that current points at the new release, and never the release it
  # replaced: that one is the rollback target recorded in this backup. These
  # are 65M each and were never pruned, so they grew with every deploy.
  prune_timestamped "$NB_WEB_ROOT/releases" "${NB_RELEASE_KEEP:-5}" "$RELEASE" \
    "$(basename "$(cat "$BACKUP/previous-web-release" 2>/dev/null || echo none)")"
fi
printf 'Files deployed. Backup: %s\n' "$BACKUP"
echo 'Run: bash infra/cpanel/verify-live.sh. A restart signal alone does not prove deployment health.'
