# cPanel production deployment — safe release procedure

এই নির্দেশনা বর্তমান `infra/cpanel/deploy.sh`-এর জন্য। Server preflight ছাড়া deploy চালাবেন না।
Local build সফল হওয়া server PHP, memory, Passenger বা database configuration প্রমাণ করে না।

## cPanel values

| Setting | Value |
|---|---|
| Node.js | 22, latest patch offered by host (minimum app requirement 20.9) |
| Application mode | Production |
| Application root | `nuruzzaman-web` |
| Application URL | `https://nuruzzaman.com.bd/` |
| Startup file | `server.js` |
| API domain | `api.nuruzzaman.com.bd` |
| API document root | `/home/nbconsultant/api.nuruzzaman.com.bd/public` |
| API web PHP and CLI PHP | **8.4.1+**, matching required extensions |

Existing `/home/nbconsultant/nuruzzaman.com.bd`, its SSL and domain configuration must be preserved.
Back up its `.htaccess` privately before registering the Passenger app. Do not replace it wholesale.
Do not use the API root itself as a public document root.

Node runtime variables:

```dotenv
NODE_ENV=production
INTERNAL_API_URL=https://api.nuruzzaman.com.bd/api/v1
```

Also configure `NEXT_REVALIDATE_SECRET` privately to match Laravel. Never use a NEXT_PUBLIC prefix for secrets.
The deploy script supplies build-time URLs, API base `/api/v1`, cookie `nuruzzaman_session` and media host.

## Inspect the actual server

```bash
cd /home/nbconsultant/repositories/nuruzzaman-com-bd
git status --short
git log -1 --format='%H %s'
bash -n infra/cpanel/deploy.sh
command -v php composer node npm rsync flock realpath
for binary in /opt/cpanel/ea-php84/root/usr/bin/php /opt/alt/php84/usr/bin/php /opt/cpanel/ea-php85/root/usr/bin/php /opt/alt/php85/usr/bin/php; do
  if [ -x "$binary" ]; then "$binary" -r 'echo PHP_BINARY," ",PHP_VERSION,PHP_EOL;'; fi
done
for binary in "$HOME"/nodevenv/nuruzzaman-web/22/bin/node /opt/alt/alt-nodejs22/root/usr/bin/node /opt/cpanel/ea-nodejs22/bin/node; do
  if [ -x "$binary" ]; then "$binary" --version; fi
done
free -m
ulimit -a
df -h "$HOME"
for entry in "$HOME/.nb-deploy.conf" "$HOME/api.nuruzzaman.com.bd/.env" "$HOME/nuruzzaman-web/node_modules"; do
  if [ -e "$entry" ] || [ -L "$entry" ]; then ls -ld "$entry"; fi
done
```

Do not print `.env` contents. cPanel Resource Usage/LVE limits override `free -m`; verify memory, processes, CPU and disk quota there. Composer checks the **locked production extensions**, plus deployment checks `pdo_mysql`. Selecting PHP in the terminal does not select the domain's PHP handler: configure that separately in MultiPHP Manager/PHP Selector.

## Server configuration

Create roots only if missing. Copy the template only if no configuration exists:

```bash
mkdir -p "$HOME/api.nuruzzaman.com.bd/public" "$HOME/nuruzzaman-web"
if [ ! -e "$HOME/.nb-deploy.conf" ]; then
  (umask 077; set -C; cat infra/cpanel/deploy.conf.example > "$HOME/.nb-deploy.conf")
fi
```

`infra/cpanel/deploy.conf.example` contains the exact domain values for this account. Set binary overrides only to paths actually verified above. `NB_COMPOSER_PHAR` is a **file path**, replacing the old `NB_COMPOSER` command string. Before editing an existing config, make a private dated copy:

```bash
(umask 077; cp -p "$HOME/.nb-deploy.conf" "$HOME/.nb-deploy.conf.backup.$(date -u +%Y%m%dT%H%M%SZ)")
```

Configure Laravel `.env` privately. Preserve any existing `APP_KEY`, database, uploads and integration secrets. Required public settings:

```dotenv
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.nuruzzaman.com.bd
FRONTEND_URL=https://nuruzzaman.com.bd
DB_CONNECTION=mysql
SESSION_COOKIE=nuruzzaman_session
SESSION_DOMAIN=nuruzzaman.com.bd
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=lax
SANCTUM_STATEFUL_DOMAINS=nuruzzaman.com.bd
CORS_ALLOWED_ORIGINS=https://nuruzzaman.com.bd
NEXT_REVALIDATE_URL=https://nuruzzaman.com.bd/api/revalidate
```

Use actual cPanel DB host/database/user/password. For a new installation only, generate an APP_KEY securely; never regenerate an existing production key. Choose database session/cache/queue drivers if Redis is unavailable, and ensure their tables are migrated. Configure mail/payment/storage secrets from the owner's accounts. Do not run general `db:seed` on an existing database.

## Check and deploy

Commit/push reviewed repository changes normally, then update the cPanel clone from GitHub. Never reset or force-push to clean it.

```bash
cd /home/nbconsultant/repositories/nuruzzaman-com-bd
bash -n infra/cpanel/deploy.sh
NB_DRY_RUN=1 bash infra/cpanel/deploy.sh
```

Dry run verifies paths, tools, extensions and prerequisite files; it does **not** build or prove database connectivity. The real job builds in a private staging directory, checks the DB and production config before replacing live API code, and stops if unapplied migrations have not been approved.

Before enabling migrations:

1. Review all pending migration `up()` methods against the actual DB, including FK/orphan constraints.
2. Take a complete DB backup with cPanel Backup/phpMyAdmin or an existing secure credential configuration; verify the dump and restore procedure. A nonempty file alone is not proof of a valid backup.
3. Set `NB_RUN_MIGRATIONS=1`, `NB_MIGRATIONS_REVIEWED_COMMIT` to the **full deployed SHA**, and `NB_DATABASE_BACKUP` to the verified private backup path. A new commit requires a new review.

Only when those checks pass:

```bash
bash infra/cpanel/deploy.sh
```

The same script runs from **Deploy HEAD Commit**. Migrations default OFF and pending migrations block activation. Old code and dependencies are not deleted automatically; obsolete API files must be reviewed separately. This avoids deleting server-owned files but can leave removed files on disk.

Layout after deployment:

```text
/home/nbconsultant/
  repositories/nuruzzaman-com-bd/  # clean Git source
  api.nuruzzaman.com.bd/          # Laravel; .env/storage retained
    public/storage -> ../storage/app/public
  nuruzzaman-web/
    server.js                    # Passenger wrapper
    current -> releases/<release>
    releases/<release>/apps/web/server.js
    releases/<release>/node_modules/
    node_modules                 # cPanel-managed directory/symlink preserved
  nb-deploy-backups/<release>/    # private API archive/build/config backups
```

Keep API `storage` and `bootstrap/cache` writable by its PHP user. Use owner permissions, never 777. Confirm Apache can traverse/read public assets according to the hosting handler. `storage:link` runs only when no existing link is present; an existing real public/storage directory blocks deployment for review. Private course assets must remain outside the public link.

## Limited hosting memory

Build on a separate **Linux** environment matching host architecture, libc and Node major, from the exact clean commit. Never upload a Windows native dependency build. Supply all production build variables from the template, run `npm ci --include=dev` and `npm run build`, then write:

```bash
git rev-parse HEAD > apps/web/.next/nb-commit
```

Upload the build workspace's `apps/web/.next` (including standalone and static) and `apps/web/public` to a private build directory, without `.env` files. Set `NB_BUILD_WEB=0` and `NB_WEB_BUILD_ROOT` to that workspace root. The script verifies commit, standalone layout and exact API/CSRF rewrites. Architecture/native dependency compatibility still needs a Linux runtime smoke test. Do not increase the Node heap beyond the account's memory limit.

## Verify after deployment

```bash
curl --fail --silent --show-error -o /dev/null -w 'API HTTP %{http_code}\n' https://api.nuruzzaman.com.bd/up
curl --fail --silent --show-error -o /dev/null -w 'Web HTTP %{http_code}\n' https://nuruzzaman.com.bd/
curl --fail --silent --show-error -o /dev/null -w 'English HTTP %{http_code}\n' https://nuruzzaman.com.bd/en
curl --fail --silent --show-error -o /dev/null -w 'CSRF HTTP %{http_code}\n' https://nuruzzaman.com.bd/sanctum/csrf-cookie
```

Do not bypass TLS checks. Then test login/logout, account switching, course pages, paid access, public media and authorized downloads. Configure Laravel scheduler (`schedule:run` each minute) and a queue worker using the verified PHP binary; restart existing workers after code changes. Upload limits must agree across PHP, Apache and the app's 110 MB proxy limit.

## Rollback without deleting data

The script prints its private backup path. Frontend rollback after a previous release exists (replace RELEASE with that printed backup identifier):

```bash
backup="$HOME/nb-deploy-backups/RELEASE"
previous="$(cat "$backup/previous-web-release")"
case "$previous" in "$HOME/nuruzzaman-web/releases/"*) ;; *) echo 'Invalid previous release'; exit 1;; esac
test -f "$previous/apps/web/server.js" || exit 1
rollback_link="$HOME/nuruzzaman-web/current.rollback.$(date +%s)"
ln -s "$previous" "$rollback_link" && mv -Tf "$rollback_link" "$HOME/nuruzzaman-web/current"
touch "$HOME/nuruzzaman-web/tmp/restart.txt"
```

First deployment has no previous release. If a legacy startup file was replaced, its backup is `server.js` inside the printed backup folder; inspect before restoring it. API backup is `api.tar`, including confidential `.env`/uploads. Extract it into a **new private recovery directory**, inspect, then restore only reviewed code compatible with the current database. Never extract it blindly over production, never run `migrate:rollback` blindly, and never restore an old DB over new orders. On API failure maintenance may intentionally remain enabled until recovery is verified.

## Deploy HEAD troubleshooting

- Disabled button: tracked `.cpanel.yml`, clean tree, valid branch and updated origin.
- Missing config/tool: inspect actual paths; default PHP 7.4 is not suitable.
- Build failure: live apps remain unchanged; inspect the staging build log and LVE limits.
- DB check failure: inspect private configuration; the checker deliberately hides exception details that can reveal credentials.
- Pending migrations: review and back up before enabling, not a reason to bypass the guard.
- Passenger 503: confirm Node 22, Production, root, startup wrapper and runtime variables; inspect private Passenger logs.
- API 404: verify `/public` document root and Laravel `.htaccess` without replacing unrelated rules.
- CSRF 419/404: verify both proxy rewrites, HTTPS cookie domain, Sanctum and CORS settings.
- Failed API update: inspect maintenance state and the printed backup before retrying. No automatic database rollback occurs.
