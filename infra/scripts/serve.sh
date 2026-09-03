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

# NEXT_PUBLIC_* values are baked into the client bundle at build time, so the
# build has to be redone whenever the ports change - not just when it is missing.
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
    NEXT_PUBLIC_API_BASE="${API_URL}" \
    INTERNAL_API_URL="${API_URL}" \
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
wait "${WEB_PID}"
