#!/usr/bin/env bash
#
# Deploys this repository on a cPanel account.
#
# Called by .cpanel.yml on "Deploy HEAD Commit", and safe to run by hand over
# SSH to see what it does:
#
#   cd ~/repositories/nuruzzaman-com-bd && bash infra/cpanel/deploy.sh
#   NB_DRY_RUN=1 bash infra/cpanel/deploy.sh      # print the plan, change nothing
#
# WHAT IT DOES NOT DO, ON PURPOSE
#
#   - It never writes the Laravel .env. Credentials live on the server, outside
#     the repository, and a deployment that could overwrite them would make a
#     bad push a credential incident.
#   - It never touches storage/ or public/storage. Those hold uploaded media and
#     logs; syncing them from a Git clone would delete them.
#   - It refuses to run at all if a signing key, a recovery file or any other
#     forbidden artefact has found its way into the tree. Those must never reach
#     a web server, and a deployment is the last place to catch it.
#
set -euo pipefail

SOURCE="${NB_DEPLOY_SOURCE:-$PWD}"
DRY_RUN="${NB_DRY_RUN:-0}"

say() { printf '\n== %s\n' "$1"; }
note() { printf '   %s\n' "$1"; }
fail() { printf '\nDEPLOY FAILED: %s\n' "$1" >&2; exit 1; }

run() {
  if [ "${DRY_RUN}" = "1" ]; then
    printf '   would run: %s\n' "$*"
  else
    "$@"
  fi
}

# ---------------------------------------------------------------------------
# 1. Configuration
#
# Host-specific paths come from ~/.nb-deploy.conf, which is not in the
# repository. infra/cpanel/deploy.conf.example is the template. Nothing is
# guessed: if the file is missing, the deployment stops and says what to write.
# ---------------------------------------------------------------------------
CONFIG="${NB_DEPLOY_CONFIG:-$HOME/.nb-deploy.conf}"

if [ ! -f "${CONFIG}" ]; then
  fail "no ${CONFIG}. Copy infra/cpanel/deploy.conf.example to it and fill in
  the paths for this account, then deploy again. See docs/DEPLOY_CPANEL_BN.md."
fi

# shellcheck disable=SC1090
. "${CONFIG}"

: "${NB_API_ROOT:?NB_API_ROOT is not set in ${CONFIG}}"
: "${NB_WEB_ROOT:?NB_WEB_ROOT is not set in ${CONFIG}}"

# This script mirrors directories and removes what is no longer in the
# commit. Pointed at the wrong place that is destructive, so the obvious
# wrong places are refused outright.
check_target() {
  case "$1" in
    "" | "/" | "${HOME}" | "${HOME}/" | "${HOME}/public_html")
      fail "$2 is set to '$1'. That is the account root or the live document
  root, and this script removes files under it. Point it at a directory of
  its own." ;;
  esac
}

check_target "${NB_API_ROOT}" NB_API_ROOT
check_target "${NB_WEB_ROOT}" NB_WEB_ROOT

DEPLOY_WEB="${NB_DEPLOY_WEB:-1}"
DEPLOY_API="${NB_DEPLOY_API:-1}"
BUILD_WEB="${NB_BUILD_WEB:-1}"
RUN_MIGRATIONS="${NB_RUN_MIGRATIONS:-1}"

say "nuruzzaman.com.bd deployment"
note "source     ${SOURCE}"
note "api root   ${NB_API_ROOT}"
note "web root   ${NB_WEB_ROOT}"
note "commit     $(git -C "${SOURCE}" rev-parse --short HEAD 2>/dev/null || echo unknown)"
[ "${DRY_RUN}" = "1" ] && note "DRY RUN - nothing will be written"

# ---------------------------------------------------------------------------
# 2. Refuse to deploy anything that must never reach a web server
#
# The NB Engineering Tools signing material, the vendor recovery files and the
# LSP sources are not part of this site and have no reason to be in the tree.
# If one is here, something has gone wrong upstream and copying it onto a public
# document root would be the worst possible outcome, so this stops first.
# ---------------------------------------------------------------------------
say "checking for files that must never be published"

FORBIDDEN=$(cd "${SOURCE}" && git ls-files -- \
  '*.pfx' '*.p12' '*.pem' '*.key' '*.nbk' '*.nbrk' '*.lsp' '*.vlx' '*.fas' \
  'SecurityBuild/*' 'DeveloperBackup/*' 'VendorTools/*' 'secrets/*' \
  2>/dev/null | grep -v '^public/' || true)

if [ -n "${FORBIDDEN}" ]; then
  printf '%s\n' "${FORBIDDEN}" >&2
  fail "the files above are tracked in Git and must not be deployed.
  Remove them from the repository and its history before deploying."
fi

note "none found"

# ---------------------------------------------------------------------------
# 3. Toolchain
#
# cPanel keeps its interpreters outside PATH, and the version that answers
# `php` on a shared account is often not the one the site runs on. So each
# binary is resolved explicitly and its version checked, rather than assuming.
# ---------------------------------------------------------------------------
find_php() {
  if [ -n "${NB_PHP_BIN:-}" ]; then
    printf '%s' "${NB_PHP_BIN}"
    return
  fi

  for candidate in /opt/cpanel/ea-php84/root/usr/bin/php \
                   /opt/cpanel/ea-php83/root/usr/bin/php; do
    [ -x "${candidate}" ] && { printf '%s' "${candidate}"; return; }
  done

  command -v php || true
}

find_node() {
  if [ -n "${NB_NODE_BIN:-}" ]; then
    printf '%s' "${NB_NODE_BIN}"
    return
  fi

  # "Setup Node.js App" installs into ~/nodevenv/<app>/<major>/bin.
  for candidate in "${HOME}"/nodevenv/*/2*/bin/node; do
    [ -x "${candidate}" ] && { printf '%s' "${candidate}"; return; }
  done

  for candidate in /opt/cpanel/ea-nodejs22/bin/node /opt/cpanel/ea-nodejs20/bin/node; do
    [ -x "${candidate}" ] && { printf '%s' "${candidate}"; return; }
  done

  command -v node || true
}

PHP_BIN="$(find_php)"
NODE_BIN="$(find_node)"

if [ "${DEPLOY_API}" = "1" ]; then
  [ -n "${PHP_BIN}" ] || fail "no PHP binary found. Set NB_PHP_BIN in ${CONFIG}."

  PHP_VERSION="$("${PHP_BIN}" -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"
  say "PHP ${PHP_VERSION} at ${PHP_BIN}"

  case "${PHP_VERSION}" in
    8.3 | 8.4 | 8.5) : ;;
    *) fail "this application needs PHP 8.3 or newer; ${PHP_BIN} is ${PHP_VERSION}.
  Pick the right binary with NB_PHP_BIN in ${CONFIG}." ;;
  esac

  COMPOSER="${NB_COMPOSER:-}"

  if [ -z "${COMPOSER}" ]; then
    if [ -f "${HOME}/composer.phar" ]; then
      COMPOSER="${PHP_BIN} ${HOME}/composer.phar"
    elif command -v composer >/dev/null 2>&1; then
      COMPOSER="${PHP_BIN} $(command -v composer)"
    else
      fail "Composer not found. Put composer.phar in ${HOME} or set NB_COMPOSER
  in ${CONFIG}."
    fi
  fi

  note "composer   ${COMPOSER}"
fi

if [ "${DEPLOY_WEB}" = "1" ]; then
  [ -n "${NODE_BIN}" ] || fail "no Node binary found. Set NB_NODE_BIN in ${CONFIG}."

  NODE_VERSION="$("${NODE_BIN}" -p 'process.versions.node')"
  NODE_MAJOR="${NODE_VERSION%%.*}"

  say "Node ${NODE_VERSION} at ${NODE_BIN}"

  [ "${NODE_MAJOR}" -ge 20 ] || fail "Next.js 16 needs Node 20.9 or newer; this is ${NODE_VERSION}."

  NPM_BIN="${NB_NPM_BIN:-$(dirname "${NODE_BIN}")/npm}"
  [ -x "${NPM_BIN}" ] || NPM_BIN="$(command -v npm || true)"
  [ -n "${NPM_BIN}" ] || fail "npm not found next to ${NODE_BIN}. Set NB_NPM_BIN in ${CONFIG}."

  export PATH="$(dirname "${NODE_BIN}"):${PATH}"
fi

# ---------------------------------------------------------------------------
# 4. Laravel API
# ---------------------------------------------------------------------------
if [ "${DEPLOY_API}" = "1" ]; then
  say "deploying the API to ${NB_API_ROOT}"

  [ -d "${NB_API_ROOT}" ] || fail "${NB_API_ROOT} does not exist. Create it, or fix
  NB_API_ROOT in ${CONFIG}."

  if [ ! -f "${NB_API_ROOT}/.env" ]; then
    fail "${NB_API_ROOT}/.env is missing. Create it on the server first - the
  deployment never writes it, so credentials cannot be pushed from Git.
  apps/api/.env.example lists every key; docs/CONFIGURATION_CHECKLIST_BN.md
  says which ones the owner has to supply."
  fi

  # Maintenance mode, so nobody hits a half-updated application. `|| true`
  # because `down` fails when the app is already down, which is not an error.
  run "${PHP_BIN}" "${NB_API_ROOT}/artisan" down --render="errors::503" || true

  # --delete keeps the target a mirror of the commit, so a file removed in Git
  # is removed on the server too. Everything excluded below either belongs to
  # the server (env, storage, uploaded media) or has no business on it.
  if command -v rsync >/dev/null 2>&1; then
    run rsync -a --delete \
      --exclude '.env' \
      --exclude '.env.*' \
      --exclude 'storage/' \
      --exclude 'public/storage' \
      --exclude 'vendor/' \
      --exclude 'node_modules/' \
      --exclude 'tests/' \
      --exclude '.phpunit.cache/' \
      "${SOURCE}/apps/api/" "${NB_API_ROOT}/"
  else
    # Shared accounts sometimes have no rsync. tar keeps the exclusions -
    # plain cp would carry a stray .env from the clone onto the server - but
    # it cannot mirror deletions, so say so rather than let the operator
    # assume a removed file is gone from the server too.
    note "rsync not available - copying with tar; files deleted in this commit"
    note "will remain on the server and have to be removed by hand"

    if [ "${DRY_RUN}" = "1" ]; then
      note "would copy apps/api -> ${NB_API_ROOT} (tar, same exclusions)"
    else
      tar -C "${SOURCE}/apps/api" \
        --exclude='./.env' \
        --exclude='./.env.*' \
        --exclude='./storage' \
        --exclude='./public/storage' \
        --exclude='./vendor' \
        --exclude='./node_modules' \
        --exclude='./tests' \
        --exclude='./.phpunit.cache' \
        -cf - . | tar -C "${NB_API_ROOT}" -xf -
    fi
  fi

  say "installing PHP dependencies"
  run env COMPOSER_ALLOW_SUPERUSER=1 ${COMPOSER} install \
    --working-dir="${NB_API_ROOT}" \
    --no-dev --no-interaction --prefer-dist --optimize-autoloader

  if [ "${RUN_MIGRATIONS}" = "1" ]; then
    say "running migrations"
    # --force because there is no terminal to confirm at; --step so a failure
    # can be rolled back one migration at a time.
    run "${PHP_BIN}" "${NB_API_ROOT}/artisan" migrate --force --step
  else
    note "migrations skipped (NB_RUN_MIGRATIONS=0)"
  fi

  say "rebuilding the Laravel caches"
  # Cleared first: a cached config from the previous release survives the file
  # copy and would keep the old values live.
  run "${PHP_BIN}" "${NB_API_ROOT}/artisan" optimize:clear
  run "${PHP_BIN}" "${NB_API_ROOT}/artisan" config:cache
  run "${PHP_BIN}" "${NB_API_ROOT}/artisan" route:cache
  run "${PHP_BIN}" "${NB_API_ROOT}/artisan" view:cache
  run "${PHP_BIN}" "${NB_API_ROOT}/artisan" event:cache

  [ -L "${NB_API_ROOT}/public/storage" ] || \
    run "${PHP_BIN}" "${NB_API_ROOT}/artisan" storage:link

  run "${PHP_BIN}" "${NB_API_ROOT}/artisan" up

  note "API deployed"
fi

# ---------------------------------------------------------------------------
# 5. Next.js
#
# `output: standalone` means the server that runs in production is
# .next/standalone/apps/web/server.js plus two directories it does not bundle:
# .next/static and public. All three have to be copied, or the pages render
# without CSS and every image 404s.
# ---------------------------------------------------------------------------
if [ "${DEPLOY_WEB}" = "1" ]; then
  say "building the front end"

  [ -d "${NB_WEB_ROOT}" ] || fail "${NB_WEB_ROOT} does not exist. Create it, or fix
  NB_WEB_ROOT in ${CONFIG}."

  if [ "${BUILD_WEB}" = "1" ]; then
    : "${NB_PUBLIC_SITE_URL:?NB_PUBLIC_SITE_URL is not set in ${CONFIG}}"
    : "${NB_INTERNAL_API_URL:?NB_INTERNAL_API_URL is not set in ${CONFIG}}"
    : "${NB_API_PROXY:?NB_API_PROXY is not set in ${CONFIG}. On cPanel there is
  no Nginx to route /api and /sanctum to Laravel, so Next has to do it. Without
  it the browser leaves the origin, the session cookie is not sent, and every
  sign-in fails with a CSRF error that looks like a wrong password.}"

    note "site url   ${NB_PUBLIC_SITE_URL}"
    note "api url    ${NB_INTERNAL_API_URL}"
    note "api proxy  ${NB_API_PROXY}"

    # Both of these are read at BUILD time, not at run time: the site URL is
    # baked into the client bundle and the API URL into the generated pages.
    # Changing either later means building again, not restarting.
    # Deliberately not NODE_ENV=production: that makes npm skip
    # devDependencies, and the build needs them. `next build` sets its own
    # production mode regardless.
    run "${NPM_BIN}" --prefix "${SOURCE}" ci --include=dev --no-audit --no-fund

    # All three are read at build time and baked in: the site URL into the
    # client bundle, the API URL into the generated pages, the proxy target
    # into the routes manifest.
    run env \
      NEXT_PUBLIC_SITE_URL="${NB_PUBLIC_SITE_URL}" \
      INTERNAL_API_URL="${NB_INTERNAL_API_URL}" \
      NB_API_PROXY="${NB_API_PROXY}" \
      "${NPM_BIN}" --prefix "${SOURCE}" run build
  else
    note "build skipped (NB_BUILD_WEB=0) - deploying whatever is in .next/"
  fi

  STANDALONE="${SOURCE}/apps/web/.next/standalone/apps/web"

  [ -f "${STANDALONE}/server.js" ] || fail "no build output at ${STANDALONE}/server.js.
  The build did not produce a standalone server. Run it again with NB_BUILD_WEB=1,
  or build locally and upload apps/web/.next before deploying."

  say "deploying the front end to ${NB_WEB_ROOT}"

  # The standalone tree carries its own node_modules, so it replaces the old one
  # wholesale rather than merging with it.
  # The standalone tree is self-contained, down to its own node_modules, so
  # the previous release is removed rather than merged with. Only the paths
  # the build produces are touched: anything else at the application root -
  # a .env, a Passenger log - belongs to the server and stays.
  run rm -rf "${NB_WEB_ROOT}/apps" "${NB_WEB_ROOT}/node_modules" \
             "${NB_WEB_ROOT}/server.js" "${NB_WEB_ROOT}/package.json"

  run cp -R "${SOURCE}/apps/web/.next/standalone/." "${NB_WEB_ROOT}/"

  # `cp -R src dst` nests when dst already exists, and the standalone output
  # already contains an (empty) apps/web/public - which is how a deployment ends
  # up serving nothing from public/apps/web/public/public. The `src/.` form
  # copies the CONTENTS into the directory either way.
  run mkdir -p "${NB_WEB_ROOT}/apps/web/.next/static" "${NB_WEB_ROOT}/apps/web/public"
  run cp -R "${SOURCE}/apps/web/.next/static/." "${NB_WEB_ROOT}/apps/web/.next/static/"
  run cp -R "${SOURCE}/apps/web/public/." "${NB_WEB_ROOT}/apps/web/public/"

  # Passenger looks for the entry point at the application root, so the server
  # the standalone build nests two levels down is re-exported from the top.
  if [ "${DRY_RUN}" != "1" ]; then
    cat > "${NB_WEB_ROOT}/server.js" <<'ENTRY'
// Passenger's entry point. The standalone build puts the real server two
// directories down; this re-exports it so "Setup Node.js App" can point at the
// application root and stay pointed there across deployments.
process.chdir(__dirname + '/apps/web');
require('./apps/web/server.js');
ENTRY
  else
    note "would write ${NB_WEB_ROOT}/server.js"
  fi

  # The proxy is the difference between a site people can sign in to and one
  # they cannot, and it is baked into the build rather than set at run time -
  # so it is worth confirming it actually made it in.
  MANIFEST="${NB_WEB_ROOT}/apps/web/.next/routes-manifest.json"

  if [ "${DRY_RUN}" != "1" ] && [ -f "${MANIFEST}" ]; then
    if grep -q '"/sanctum/:path' "${MANIFEST}"; then
      note "/api and /sanctum are proxied to Laravel"
    else
      fail "the build has no /api or /sanctum rewrite, so the browser would
  leave the origin and sign-in would fail with a CSRF error. Set NB_API_PROXY
  in ${CONFIG} and deploy again."
    fi
  fi

  # Passenger restarts on the next request when this file's mtime changes.
  run mkdir -p "${NB_WEB_ROOT}/tmp"
  run touch "${NB_WEB_ROOT}/tmp/restart.txt"

  note "front end deployed; Passenger will restart on the next request"
fi

say "done"
note "check https://nuruzzaman.com.bd/up for the API"
note "and the home page in both languages: / and /en"
