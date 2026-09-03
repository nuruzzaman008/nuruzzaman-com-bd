#!/usr/bin/env bash
# Runs the whole site locally with one command: Laravel API + Next.js.
#
#   npm run serve                # http://localhost:3200
#   npm run serve -- 4000 8002   # different ports
#   SEED=fresh npm run serve     # rebuild and re-seed the database first
#   REBUILD=1 npm run serve      # force a front-end rebuild
#
# Ctrl+C stops both. Needs Docker Desktop running (the API runs in a container
# so no local PHP install is required).
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/_root.sh"
ROOT="$(_repo_root)"

WEB_PORT="${1:-3200}"
API_PORT="${2:-8001}"
SEED="${SEED:-keep}"
API_URL="http://127.0.0.1:${API_PORT}/api/v1"
MARKER="${ROOT}/apps/web/.next/.serve-ports"

cleanup() {
  echo ""
  echo "stopping..."
  docker rm -f nb-dev-api >/dev/null 2>&1 || true
  [ -n "${WEB_PID:-}" ] && kill "${WEB_PID}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

if ! docker version --format '{{.Server.Version}}' >/dev/null 2>&1; then
  echo "Docker is not running. Start Docker Desktop and try again." >&2
  exit 1
fi

# A server left running from an earlier session keeps the port and answers
# every request, so a new one starts, fails to bind, and is never noticed -
# you end up debugging a build that is not the one being served. Refuse
# instead of stacking a second listener on the same port.
port_owner() {
  command -v powershell.exe >/dev/null 2>&1 || return 0
  powershell.exe -NoProfile -Command "(Get-NetTCPConnection -LocalPort $1 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess" 2>/dev/null | tr -cd '0-9'
}

for port in "${WEB_PORT}" "${API_PORT}"; do
  owner="$(port_owner "${port}")"
  if [ -n "${owner}" ]; then
    echo "Port ${port} is already in use by process ${owner}." >&2
    echo "Stop it, or use other ports: npm run serve -- <web-port> <api-port>" >&2
    exit 1
  fi
done

echo "starting the API on ${API_PORT}..."
TTY_FLAG= bash "${ROOT}/infra/scripts/dev-api.sh" "${API_PORT}" "${SEED}" &

# The API is not usable the moment the container starts: migrations and, on a
# fresh run, the seeders have to finish first.
echo -n "waiting for the API"
for _ in $(seq 1 90); do
  if curl -fsS --max-time 3 "${API_URL}/site/settings" >/dev/null 2>&1; then
    echo " - ready"
    break
  fi
  echo -n "."
  sleep 2
done

if ! curl -fsS --max-time 3 "${API_URL}/site/settings" >/dev/null 2>&1; then
  echo ""
  echo "The API did not come up. Run 'npm run api:dev' on its own to see why." >&2
  exit 1
fi

# NEXT_PUBLIC_SITE_URL is baked into the client bundle at build time, so the
# build has to be redone when the web port changes, not only when it is
# missing. The API is reached through the same-origin proxy, so its port is
# a runtime value - except that Next evaluates rewrites() at build time and
# bakes them into the routes manifest, so the proxy target is set here too.
PORTS="${WEB_PORT}:${API_PORT}"
NEEDS_BUILD=0
[ -f "${ROOT}/apps/web/.next/standalone/apps/web/server.js" ] || NEEDS_BUILD=1
[ "$(cat "${MARKER}" 2>/dev/null || echo)" = "${PORTS}" ] || NEEDS_BUILD=1
[ "${REBUILD:-0}" = "1" ] && NEEDS_BUILD=1

if [ "${NEEDS_BUILD}" = "1" ]; then
  echo "building the front end..."
  (
    cd "${ROOT}/apps/web"
    NEXT_PUBLIC_SITE_URL="http://localhost:${WEB_PORT}" \
    INTERNAL_API_URL="${API_URL}" \
    NEXT_DEV_API_PROXY="http://127.0.0.1:${API_PORT}" \
      npx next build
  )
  printf '%s' "${PORTS}" > "${MARKER}"
else
  echo "reusing the existing build (REBUILD=1 to force a rebuild)"
fi

echo ""
echo "  site  http://localhost:${WEB_PORT}"
echo "  api   http://127.0.0.1:${API_PORT}/api/v1"
echo ""

node "${ROOT}/apps/web/tools/preview-real.mjs" "${WEB_PORT}" "${API_PORT}" &
WEB_PID=$!

# Confirm the server answering on this port is the one we just started.
# Another process can claim the port between the check above and now - a stray
# `next dev`, an editor's preview - and then every request is served by a build
# with no /api proxy, so sign-in fails with a CSRF error that looks like bad
# credentials. Probing a route only our build serves catches that.
(
  sleep 12
  probe="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20     "http://127.0.0.1:${WEB_PORT}/sanctum/csrf-cookie" 2>/dev/null || echo 000)"

  if [ "${probe}" != "204" ] && [ "${probe}" != "200" ]; then
    echo "" >&2
    echo "WARNING: /sanctum/csrf-cookie returned ${probe}, so the API proxy is" >&2
    echo "not in place and sign-in will fail. Another server is probably holding" >&2
    echo "port ${WEB_PORT}. Check with:" >&2
    echo "  powershell -NoProfile -Command \"Get-NetTCPConnection -LocalPort ${WEB_PORT} -State Listen\"" >&2
    echo "" >&2
  fi
) &

wait "${WEB_PID}"
