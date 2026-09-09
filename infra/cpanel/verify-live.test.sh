#!/usr/bin/env bash
set -euo pipefail
script="$(cd "$(dirname "$0")" && pwd)/verify-live.sh"
fixture="$(mktemp -d)"
mkdir "$fixture/bin"
cat > "$fixture/bin/curl" <<'MOCK'
#!/usr/bin/env bash
while [ "$#" -gt 0 ]; do
  case "$1" in --output) out="$2"; shift;; https://*) url="$1";; esac
  shift
done
case "$url" in
  */sanctum/csrf-cookie) : > "$out"; printf '%s' "${CSRF_CODE:-204}";;
  https://nuruzzaman.com.bd/|https://nuruzzaman.com.bd/en)
    if [ "${PLACEHOLDER:-0}" = 1 ]; then printf 'It works! NodeJS 22.23.2' > "$out"; else printf '<script src="/_next/static/app.js"></script>' > "$out"; fi
    printf 200;;
  *) printf '{}' > "$out"; printf 200;;
esac
MOCK
chmod +x "$fixture/bin/curl"
PATH="$fixture/bin:$PATH" bash "$script" > "$fixture/result"
if PATH="$fixture/bin:$PATH" PLACEHOLDER=1 bash "$script" > "$fixture/result"; then echo 'Placeholder accepted'; exit 1; fi
grep -q placeholder "$fixture/result"
if PATH="$fixture/bin:$PATH" CSRF_CODE=200 bash "$script" > "$fixture/result"; then echo 'Invalid CSRF response accepted'; exit 1; fi
grep -q 'FAIL CSRF' "$fixture/result"
echo 'PASS: healthy endpoints accepted; placeholder and incorrect CSRF status rejected.'
