#!/usr/bin/env bash
# Starts the local MySQL server used by the dev API and the test suite, and waits
# until it actually accepts connections.
#
# The whole project targets MySQL/MariaDB, which is what the hosting runs, so
# development and the tests use the same engine as production. There is no
# second driver to fall back to.
#
#   infra/scripts/mysql.sh          # start and wait
#   infra/scripts/mysql.sh --reset  # destroy the data and start clean
set -euo pipefail

NAME=nb-dev-mysql
PORT="${MYSQL_PORT:-3307}"
ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-devroot}"

if [ "${1:-}" = "--reset" ]; then
  docker rm -f "${NAME}" >/dev/null 2>&1 || true
fi

if [ -z "$(docker ps -q --filter "name=^${NAME}$")" ]; then
  if [ -n "$(docker ps -aq --filter "name=^${NAME}$")" ]; then
    docker start "${NAME}" >/dev/null
  else
    MSYS_NO_PATHCONV=1 docker run -d --name "${NAME}" \
      -e MYSQL_ROOT_PASSWORD="${ROOT_PASSWORD}" \
      -e MYSQL_DATABASE=nuruzzaman \
      -e MYSQL_USER=nuruzzaman \
      -e MYSQL_PASSWORD=devpass \
      -p "${PORT}:3306" \
      mysql:8.4 \
      --character-set-server=utf8mb4 \
      --collation-server=utf8mb4_unicode_ci \
      --sql-mode=STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION \
      --authentication-policy=caching_sha2_password >/dev/null
  fi
fi

# A freshly created container reports "running" long before it accepts queries.
printf 'waiting for MySQL'
for _ in $(seq 1 90); do
  if docker exec "${NAME}" mysqladmin ping -h 127.0.0.1 -uroot -p"${ROOT_PASSWORD}" >/dev/null 2>&1; then
    echo ' - ready'
    exit 0
  fi
  printf '.'
  sleep 2
done

echo ''
echo "MySQL did not become ready. Check: docker logs ${NAME}" >&2
exit 1
