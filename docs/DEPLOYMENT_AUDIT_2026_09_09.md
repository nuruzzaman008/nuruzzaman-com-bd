# Production deployment audit — 9 September 2026

## Result and limits

**Production is not fixed or redeployed yet. Server access is required.**

Verified from this workstation:
- Local branch was `main`, clean before this audit.
- Local HEAD and GitHub main both `4f7927171522e1f1fa27cf8f4ca2d5e579d63935` (`up`). Therefore no uncommitted local feature changes existed at audit start.
- HTTPS GET to the main domain returned the literal CloudLinux placeholder `It works! NodeJS 22.23.2`.
- HTTPS GET to the API `/up` returned 200. This does not prove DB, auth, migration, upload or queue health.
- No configured SSH files or connected cPanel browser session was available. Server Git state, manual code changes, Node Selector settings, deployed artifacts, .env, quota and web PHP handler remain unverified.
- Local backup: `D:/nuruzzaman.com.bd/deployment-audit-backup-20260909-160245/`. Complete Git bundle verified; deployment folder, .cpanel.yml and deployment documentation also copied before edits.

The placeholder is consistent with a sample startup file or wrong Node application root/routing. It is not evidence of a Next.js build failure by itself. Read actual Node Selector configuration and deployed startup file before choosing the repair.

## Verified architecture

Root npm workspaces and package-lock.json are authoritative for JS dependencies; use `npm ci --include=dev` in the repository build workspace. The pnpm workspace file does not make pnpm the deploy package manager.

Root build generates contracts then builds apps/web. Next config uses standalone output and build-time rewrites for /api and /sanctum. The script builds an isolated Git archive, copies standalone dependencies plus public and .next/static, and activates a versioned release through `current`.

Laravel installs the exact composer.lock production packages using `--no-dev --no-scripts`. It then explicitly discovers packages, conditionally migrates, builds caches, restarts workers and leaves maintenance mode.

composer.json alone understates the PHP requirement: locked Symfony Console and HttpFoundation v8.1.6 require **PHP >=8.4.1**. Locked Laravel is v13.30.1. Verify the exact offered PHP 8.4 patch, CLI and web handler independently. Locked direct/transitive extensions include ctype, dom, fileinfo, filter, hash, iconv, json, libxml, mbstring, openssl, pcre, session, simplexml and tokenizer; this application's database also requires pdo_mysql. Run the lockfile platform check; do not ignore requirements.

## Changes made locally

- `infra/cpanel/deploy.sh`: CLI proc_open preflight; full repository/API/web/existing-domain backups and config copy before builds; framework folders before Composer; retire stale generated config/provider/route/event caches into backups; queue restart; direct operator to functional live checks.
- `infra/cpanel/audit-server.sh`: read-only server inventory, prerequisite checks and tracked API file differences without printing secrets/content.
- `infra/cpanel/verify-live.sh`: TLS-verified API/frontend/CSRF checks; rejects the placeholder even when HTTP 200.
- `infra/cpanel/verify-live.test.sh`: isolated health-check regression fixtures.
- `docs/DEPLOY_CPANEL_BN.md`: updated backup naming, workflow and limitations.

No production files, databases, SSL, credentials or application settings were modified. No Git push was performed.

## cPanel settings to verify

| Field | Expected value |
|---|---|
| Node | 22.23.2 offered by host; compatible with project >=20.9 |
| Mode | Production |
| Application Root | `nuruzzaman-web` (under /home/nbconsultant) |
| Application URL | `https://nuruzzaman.com.bd/` |
| Startup file | `server.js` |
| Laravel root | `/home/nbconsultant/api.nuruzzaman.com.bd` |
| API document root | `/home/nbconsultant/api.nuruzzaman.com.bd/public` |

Preserve the existing domain folder `/home/nbconsultant/nuruzzaman.com.bd` and its host-managed .htaccess/SSL. Passenger routes that domain to the separate Node application root. Do not set the main document root to the Laravel folder or to .next. Do not run npm install in the deployed release or replace cPanel's node_modules link.

Runtime Node environment:
```
NODE_ENV=production
INTERNAL_API_URL=https://api.nuruzzaman.com.bd/api/v1
```
Configure NEXT_REVALIDATE_SECRET privately to match Laravel. Do not put secrets in Git or NEXT_PUBLIC variables. Do not force PORT=3200; preserve the Passenger/host listener configuration. The script supplies public build variables and rewrites; changing those requires a rebuild.

The standalone root wrapper loads `current/apps/web/server.js`. It does not use a CloudLinux-generated sample app.js. See [Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) and [CloudLinux Node Selector settings](https://docs.cloudlinux.com/cloudlinuxos/lve_manager/).

## First server backup and reconciliation — before git pull

These commands have **not** been run on the server. First check cPanel quota/inodes and available space for complete copies plus build staging. A 30 GB package does not guarantee sufficient free space. Archives contain secrets and must remain private.

Run in the cPanel Bash terminal, as nbconsultant:
```bash
set -euo pipefail
umask 077
test "$HOME" = /home/nbconsultant
repo="$HOME/repositories/nuruzzaman-com-bd"
test -d "$repo/.git"
git -C "$repo" status --short
git -C "$repo" log -1 --format='%H %s'
df -h "$HOME"
du -sh "$repo" "$HOME/api.nuruzzaman.com.bd" "$HOME/nuruzzaman-web"
```

After confirming quota, make a new backup without overwriting any existing file:
```bash
backup="$HOME/nb-predeployment-$(date -u +%Y%m%dT%H%M%SZ)-$$"
mkdir -m 700 "$backup"
tar -C "$repo" -cpf "$backup/repository.tar" .
for folder in api.nuruzzaman.com.bd nuruzzaman-web nuruzzaman.com.bd; do
  if [ -d "$HOME/$folder" ]; then
    tar -C "$HOME/$folder" -cpf "$backup/$folder.tar" .
  fi
done
if [ -f "$HOME/.nb-deploy.conf" ]; then cp -p "$HOME/.nb-deploy.conf" "$backup/deploy.conf"; fi
for archive in "$backup"/*.tar; do tar -tf "$archive" >/dev/null; done
printf 'Private backup: %s\n' "$backup"
```
Also make and verify a cPanel database backup. Filesystem archives are not database dumps. Do not print credentials or put them in command arguments.

If the server repo is dirty or diverged: stop. Review the private Git diff and untracked files; transfer intentional code changes to the local checkout, reconcile/test/commit/push there. Never git reset --hard, git clean, force-push, or overwrite a server .env. Compare deployed API code against Git; distinguish host-managed config and runtime files from application code. Frontend compiled files cannot be compared directly with source. Existing extra API files need explicit review because the deployment script deliberately does not delete them.

## Server config

If missing, create ~/.nb-deploy.conf from the repository example using noclobber. Back up any existing config before editing it. Verified intended public values:
```bash
NB_API_ROOT="$HOME/api.nuruzzaman.com.bd"
NB_WEB_ROOT="$HOME/nuruzzaman-web"
NB_PUBLIC_SITE_URL="https://nuruzzaman.com.bd"
NB_INTERNAL_API_URL="https://api.nuruzzaman.com.bd/api/v1"
NB_API_PROXY="https://api.nuruzzaman.com.bd"
NB_MEDIA_HOST="api.nuruzzaman.com.bd"
NB_DEPLOY_API=1
NB_DEPLOY_WEB=1
NB_BUILD_WEB=1
NB_RUN_MIGRATIONS=0
```
Set NB_PHP_BIN, NB_COMPOSER_PHAR, NB_NODE_BIN and NB_NPM_BIN only after inspecting actual server paths. Never copy the development .env. Preserve production APP_KEY, DB and integration secrets. Production settings and cookie/Sanctum/CORS values are listed in DEPLOY_CPANEL_BN.md.

## Conditional deployment procedure

**Not cleared for production until server drift, backups, PHP/DB, Node Selector and migrations are checked.** Once reconciled, this is the recurring sequence:

Local PowerShell, from the repository, after reviewing the named changes:
```powershell
git diff --check
git add infra/cpanel/deploy.sh infra/cpanel/audit-server.sh infra/cpanel/verify-live.sh infra/cpanel/verify-live.test.sh docs/DEPLOY_CPANEL_BN.md docs/DEPLOYMENT_AUDIT_2026_09_09.md
git commit -m "Harden cPanel deployment backups and health checks"
git push origin main
```

Server Bash, with a clean main branch and backups already verified:
```bash
cd /home/nbconsultant/repositories/nuruzzaman-com-bd
test -z "$(git status --porcelain)"
test "$(git branch --show-current)" = main
git pull --ff-only origin main
bash infra/cpanel/audit-server.sh
bash -n infra/cpanel/deploy.sh
NB_DRY_RUN=1 bash infra/cpanel/deploy.sh
# Continue only after the audit gates above pass:
bash infra/cpanel/deploy.sh
bash infra/cpanel/verify-live.sh
```

Deploy HEAD Commit invokes the same script through .cpanel.yml. Do not npm update/composer update on cPanel. Normal no-schema updates use push + deployment; schema changes still require a fresh DB backup and explicit migration review. Set NB_RUN_MIGRATIONS=1, NB_MIGRATIONS_REVIEWED_COMMIT to the full reviewed commit and NB_DATABASE_BACKUP to a verified private dump only after that review. The script blocks pending migrations otherwise.

5 GB RAM is an account-wide limit, not a guaranteed build allowance. Monitor CloudLinux LVE faults during a test build; no Linux hosting build has been measured in this audit. If building exceeds the limit, use the documented Linux off-host build flow with matching Node/architecture/libc, exact commit and production build URLs. Never deploy Windows-built native modules. No arbitrary heap increase is a guarantee.

Configure Laravel scheduler and queue execution with the verified PHP binary. On shared hosting, use the host's supported worker mechanism or non-overlapping scheduled queue work; queue:restart alone does not start a stopped worker. Verify real manual-payment fulfillment and media uploads after deployment.

## Rollback and checks

Use the previous-web-release record and atomic symlink rollback in DEPLOY_CPANEL_BN.md. Restore a legacy startup file only from its reviewed backup. API rollback requires extracting the API archive into a new private recovery folder and selecting code compatible with the current DB; never blindly extract over uploads/.env or restore an old DB over new orders. No automatic migrations rollback is safe here.

Completed local checks:
- Git bundle verification.
- Bash syntax checks for deploy/audit/verify scripts.
- Existing deployment preflight guards passed.
- Standalone artifact verifier tests passed.
- New live verifier fixture tests passed.
- Live verifier correctly failed the actual placeholder; API health passed.
- git diff --check passed.

Not completed: server backups, server code comparison, production Composer install/build, database connectivity/migration review, Passenger settings and end-to-end login/payment/queue tests. Supply the SSH hostname/port with existing key access, or a logged-in cPanel Terminal, to finish these steps.
