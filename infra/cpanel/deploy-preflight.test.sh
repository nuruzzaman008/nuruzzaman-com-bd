#!/usr/bin/env bash
# Isolated guard tests. Mocked tools are never used to deploy a real application.
set -euo pipefail
SCRIPT="$(cd "$(dirname "$0")" && pwd)/deploy.sh"
FIXTURE="$(mktemp -d)"
export HOME="$FIXTURE/account"
mkdir -p "$HOME" "$FIXTURE/repo" "$FIXTURE/bin"
for tool in rsync flock; do printf '#!/usr/bin/env bash\nexit 0\n' > "$FIXTURE/bin/$tool"; chmod +x "$FIXTURE/bin/$tool"; done
export PATH="$FIXTURE/bin:$PATH"
git -C "$FIXTURE/repo" init -q
printf 'fixture\n' > "$FIXTURE/repo/file"
git -C "$FIXTURE/repo" add file
git -C "$FIXTURE/repo" -c user.name=Test -c user.email=test@example.invalid commit -qm fixture
export NB_DEPLOY_SOURCE="$FIXTURE/repo"
export NB_DEPLOY_CONFIG="$HOME/.nb-deploy.conf"
export NB_DRY_RUN=1
cat > "$NB_DEPLOY_CONFIG" <<'CONFIG'
NB_API_ROOT="$HOME/api.nuruzzaman.com.bd"
NB_WEB_ROOT="$HOME/nuruzzaman-web"
NB_DEPLOY_API=0
NB_DEPLOY_WEB=0
CONFIG
bash "$SCRIPT" > "$FIXTURE/output"
grep -q 'Dry run: no writes' "$FIXTURE/output"
test ! -e "$HOME/nb-deploy-backups"
test ! -e "$HOME/.nb-deploy.lock"
printf 'NB_API_ROOT="$HOME"\n' >> "$NB_DEPLOY_CONFIG"
if bash "$SCRIPT" > "$FIXTURE/output" 2>&1; then echo 'Unsafe root accepted'; exit 1; fi
grep -q 'Unsafe target' "$FIXTURE/output"
printf 'NB_API_ROOT="$HOME/api.nuruzzaman.com.bd"\nNB_RUN_MIGRATIONS=invalid\n' >> "$NB_DEPLOY_CONFIG"
if bash "$SCRIPT" > "$FIXTURE/output" 2>&1; then echo 'Invalid flag accepted'; exit 1; fi
grep -q 'Flags must be' "$FIXTURE/output"
printf 'NB_RUN_MIGRATIONS=0\n' >> "$NB_DEPLOY_CONFIG"
printf 'dirty\n' >> "$FIXTURE/repo/file"
if bash "$SCRIPT" > "$FIXTURE/output" 2>&1; then echo 'Dirty source accepted'; exit 1; fi
grep -q 'repository must be clean' "$FIXTURE/output"
echo "PASS: dry-run makes no writes; unsafe targets, invalid flags and dirty source blocked. Isolated fixture: $FIXTURE"
