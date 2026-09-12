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
MAIL_MAILER=smtp
MAIL_HOST=bdix4.ebnhost.com
MAIL_PORT=25
MAIL_SCHEME=smtp
MAIL_FROM_ADDRESS="no-reply@nuruzzaman.com.bd"
```

Mail must be `smtp`. This PHP disables `proc_open`, which both the `sendmail`
transport and PHP's `mail()` require, so either of those fails with
`Call to undefined function proc_open` and no account can verify its address.
SMTP speaks over a socket and needs neither.

`MAIL_HOST` must be the mail server's certificate name, not `localhost`. Exim
answers on localhost, but STARTTLS verifies the hostname against the
certificate and `localhost` fails that check. Addressing it by the certificate
name keeps the connection encrypted; disabling verification would not.

Confirm delivery before trusting it - an accepted message is not a delivered
one:

```bash
php artisan tinker --execute="Mail::raw('test', fn(\$m) => \$m->to('you@example.com')->subject('test'));"
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
  nb-deploy-backups/<release>/    # private repository/API/web/domain archives and build/config backups
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

Do not bypass TLS checks. Then test login/logout, account switching, course pages, paid access, public media and authorized downloads. Upload limits must agree across PHP, Apache and the app's 110 MB proxy limit.

## Cron: the scheduler and the queue

**Without these two lines the site takes money and gives nothing back.** An
order is paid, the customer is charged, and `FulfillOrder` sits in the queue
for ever - so the course never appears on their account and no receipt is
sent. Nothing on the site reports it. This happened on 12 September 2026 and
was only found because a customer said the course was missing.

Add both to the account's crontab (`crontab -e`, or cPanel -> Cron Jobs):

```cron
* * * * * cd /home/nbconsultant/api.nuruzzaman.com.bd && /opt/cpanel/ea-php84/root/usr/bin/php artisan schedule:run >/dev/null 2>&1
* * * * * cd /home/nbconsultant/api.nuruzzaman.com.bd && /usr/bin/flock -n /tmp/nb-queue.lock /opt/cpanel/ea-php84/root/usr/bin/php artisan queue:work --stop-when-empty --max-time=55 --tries=3 >/dev/null 2>&1
```

The queue carries `FulfillOrder` (courses, licences, downloads),
`SendOrderReceipt`, `IssueCertificate`, `ProcessRefund` and
`RevalidateFrontend`. The scheduler runs `content:publish-due`,
`ReconcilePayments` and `platform:housekeeping`.

`flock` stops one minute's run from overlapping the next. `--stop-when-empty`
lets the worker exit while idle rather than holding a process against the
account's NPROC limit, at the cost of up to a minute before a job starts.

`deploy.sh` warns when either line is missing. To check by hand:

```bash
crontab -l | grep -E 'queue:work|schedule:run'
```

After deploying code, running workers are told to finish and exit
(`queue:restart`); the cron starts a fresh one within a minute.

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

First deployment has no previous release. If a legacy startup file was replaced, its backup is `server.js` inside the printed backup folder; inspect before restoring it. API backup is `api.nuruzzaman.com.bd.tar`, including confidential `.env`/uploads. Extract it into a **new private recovery directory**, inspect, then restore only reviewed code compatible with the current database. Never extract it blindly over production, never run `migrate:rollback` blindly, and never restore an old DB over new orders. On API failure maintenance may intentionally remain enabled until recovery is verified.

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


## September 2026 audit changes

Deployment now backs up the entire repository (including Git), API, Node application,
and existing domain folder before building or modifying live code. It verifies each tar
archive is readable. These backups contain secrets: keep them outside document roots
and never upload them to GitHub. Full backups and staged dependencies can consume
substantial quota; check cPanel disk/inode usage before each deployment. No backups or
old releases are deleted automatically.

The selected CLI PHP must support `proc_open` for Composer. Do not attempt to bypass
this with `--ignore-platform-reqs`. The host must provide a compatible CLI runtime.
Composer runs with `--no-scripts`; framework/cache directories are prepared first,
and Laravel package discovery runs explicitly after installation. Stale generated
configuration/provider/route/event caches are moved into the private backup before
rebuilding caches. Queue workers receive `queue:restart` after code/cache changes;
a host-supported worker/cron configuration is still required to resume processing.

Use `bash infra/cpanel/audit-server.sh` for a read-only inventory and tracked API drift
report. It does not print environment values or source diffs. A difference does not
establish which file is correct. Reconcile intentional server changes locally before
replacing code. Untracked extra deployed files must also be reviewed privately.

After deployment run `bash infra/cpanel/verify-live.sh`. HTTP 200 alone is insufficient:
the check rejects the CloudLinux placeholder, checks for Next.js assets, and requires
204 from the same-origin CSRF endpoint. It does not replace real login, payment approval,
queue, upload, or course-access testing.

Do not configure `PORT=3200` in production. That is the local development port.
Passenger manages the listening socket; preserve any host-provided PORT. The startup
file is the deployed root `server.js`, which loads `current/apps/web/server.js`.
Use the npm lockfile through `npm ci --include=dev`, then `npm run build`; installing
only within apps/web misses workspace dependencies. This deployment uses the generated
standalone server rather than invoking `next start` inside the release.


## Passenger launcher (repository-managed)

`infra/cpanel/server.cjs` is the authoritative launcher. Deploy copies it to
`~/nuruzzaman-web/server.js` after backing up any existing startup file. It loads
`current/apps/web/server.js`, generated by Next.js, and fails clearly if the build,
static assets or public directory is missing. Never upload this launcher alone as
a replacement for a complete application build.

There is no Express app.listen to change. The installed Next.js build generator
already uses `parseInt(process.env.PORT, 10) || 3000`; the launcher preserves PORT.
The root npm start forwards to apps/web's next start for a conventional installed
workspace. Passenger standalone deployment starts the generated server directly,
so changing npm start is unnecessary. No dependencies are removed or added.

For this server, the last supplied diagnostics show a dirty Git clone, missing
current release, unavailable rsync in PATH, and proc_open disabled in CLI PHP.
Resolve those prerequisites and reconcile/back up server changes before pulling
and deploying. Do not bypass the existing deployment guards.

Deployment order after the audit gates pass:
1. Commit local changes and push to GitHub; update the clean cPanel clone using
   git pull --ff-only. Do not upload Windows node_modules or .next artifacts.
2. Set Node Selector root nuruzzaman-web, URL https://nuruzzaman.com.bd/,
   startup server.js, Node 22.23.2 and mode Production.
3. Run the repository deploy script. It runs npm ci --include=dev and npm run
   build in an isolated workspace, then copies standalone, public and static
   assets. Do not use cPanel Run NPM Install in the release root: the required
   workspace package.json is in the source/build workspace.
4. The script activates current and touches tmp/restart.txt. Use the cPanel
   Restart action if needed, then run verify-live.sh and test login.

Runtime: NODE_ENV=production, INTERNAL_API_URL=https://api.nuruzzaman.com.bd/api/v1,
and the existing private NEXT_REVALIDATE_SECRET matching Laravel. Build-time
public values are supplied by deploy.conf.example and deploy.sh, including
NB_API_PROXY=https://api.nuruzzaman.com.bd. Never expose server secrets with a
NEXT_PUBLIC prefix. localhost:3200 references in smoke-test tools are local test
defaults; application source does not hardcode that production origin.
