#!/usr/bin/env bash
# Read-only HTTPS checks; response bodies/cookies are never printed.
set -euo pipefail
for tool in curl grep mktemp; do command -v "$tool" >/dev/null || exit 1; done
body="$(mktemp)"
trap 'rm -f "$body"' EXIT
for url in https://api.nuruzzaman.com.bd/up https://nuruzzaman.com.bd/ https://nuruzzaman.com.bd/en https://nuruzzaman.com.bd/api/v1/site/settings https://nuruzzaman.com.bd/sanctum/csrf-cookie; do
  code="$(curl --silent --show-error --location --max-redirs 3 --max-time 30 --output "$body" --write-out '%{http_code}' "$url")"
  case "$url" in
    */sanctum/csrf-cookie) [ "$code" = 204 ] || { echo "FAIL CSRF: HTTP $code"; exit 1; } ;;
    *) [ "$code" = 200 ] || { echo "FAIL $url: HTTP $code"; exit 1; } ;;
  esac
  if grep -Eq 'It works!|NodeJS [0-9]' "$body"; then echo "FAIL $url still serves the hosting placeholder"; exit 1; fi
  case "$url" in
    https://nuruzzaman.com.bd/|https://nuruzzaman.com.bd/en)
      grep -q '/_next/' "$body" || { echo "FAIL $url has no Next.js assets"; exit 1; } ;;
  esac
  printf 'PASS %s HTTP %s\n' "$url" "$code"
done
