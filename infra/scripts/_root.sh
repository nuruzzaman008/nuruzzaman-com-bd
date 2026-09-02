# Resolves the monorepo root as a Windows/Docker-friendly absolute path.
_repo_root() {
  local d
  d="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -m "$d"
  else
    printf '%s' "$d"
  fi
}
