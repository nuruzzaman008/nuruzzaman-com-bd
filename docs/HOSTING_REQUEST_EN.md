# Hosting support request — nuruzzaman.com.bd

> **Answered. This is the original request, kept as the record.** Ebn Host
> replied on 12 September; the reply and our answer to it are in
> [HOSTING_REPLY_EN.md](HOSTING_REPLY_EN.md), which supersedes the requests
> below. In short: glibc 2.28 confirmed but we no longer need a migration,
> `rsync` is installed yet unreachable from this account, and the 503 outages
> were our own bug rather than the account's process limit.

**Account:** `nbconsultant`
**Server:** `bdix4.ebnserver.com` (115.187.18.57)
**Domains on the account:** nuruzzaman.com.bd, api.nuruzzaman.com.bd, productreview.com.bd, nuruzzaman.nbconsultant.com.bd
**Date:** 11 September 2026 (replied to 12 September)

Dear Support Team,

The site `nuruzzaman.com.bd` is a Node.js (Next.js) application served through
Passenger, with a Laravel/PHP API on `api.nuruzzaman.com.bd`. Both are now
deployed and working.

While deploying I ran into two limitations of the current server. The site is
live in spite of both, but each one costs us something, and I would be grateful
if you could look at them.

There is also a third item below. It was originally a request to raise the
account's process limit, after outages that took **every site on the account
offline**. I have since traced those to a fault in our own application and fixed
it, so that item now asks you for nothing — it is left in only so the earlier
request is not left standing.

---

## 1. glibc is too old for Next.js to build on the server — *withdrawn*

The server has **glibc 2.28**. Next.js ships a native compiler (SWC) that
requires **glibc 2.29 or newer**, so it cannot load:

```
Attempted to load @next/swc-linux-x64-gnu, but an error occurred:
/lib64/libm.so.6: version `GLIBC_2.29' not found
```

Next.js then falls back to a WebAssembly compiler. That fallback tries to create
one thread per visible CPU — the server reports **72 CPUs** — which immediately
exceeds the account's process allowance and aborts the build:

```
thread panicked at rayon-core/registry.rs:168
  The global thread pool has not been initialized.:
  IOError(Os { code: 11, "Resource temporarily unavailable" })
fatal runtime error: failed to initiate panic, aborting
Next.js build worker exited with signal: SIGABRT
```

**Request:** please move this account to a server with **glibc 2.29 or newer**
(CloudLinux 9 / AlmaLinux 9 ships glibc 2.34), or advise if a newer server is
available that we could migrate to.

**Why it matters:** without it, the site cannot be built on the server at all.
Every update has to be compiled on a separate machine and uploaded, which means
the normal cPanel “Git Version Control → Deploy” button can never work for us.

---

## 2. `rsync` is not reachable from this account

```
$ whoami
nbconsultant
$ command -v rsync
(not found)
$ ls -l /bin/rsync /usr/bin/rsync
ls: cannot access '/bin/rsync': No such file or directory
ls: cannot access '/usr/bin/rsync': No such file or directory
```

> **Update, 12 September:** support replied that `rsync` *is* installed, and
> `command -v rsync` does return `/bin/rsync` — when run as root. It is not
> visible inside this account, as above, which points at the CageFS skeleton
> rather than a missing package. The heading originally read "is not installed",
> which was the wrong diagnosis for the right symptom.

`rsync` is a standard part of a hosting toolchain and is what deployment scripts
normally use to copy application files. We have worked around it with `tar`, but
it makes deployments slower and less safe, because `tar` cannot copy
incrementally or remove files that were deleted upstream.

**Request:** please map `rsync` into this account's environment — typically a
`paths=/usr/bin/rsync` entry under `/etc/cagefs/conf.d/` followed by
`cagefsctl --force-update`. Low priority: the `tar` fallback means nothing is
blocked.

---

## 3. The 503 outages — our fault, not yours, and now fixed

An earlier draft of this letter asked you to raise the account's process limit.
**Please disregard that request.** We have since found the cause, and it was
ours.

The outages were real. The account repeatedly ran out of process slots, and
while it did, every site on it returned **HTTP 503** — including
`api.nuruzzaman.com.bd`, which is PHP and has nothing to do with our Node app:

```
node: pthread_create: Resource temporarily unavailable
bash: fork: retry: Resource temporarily unavailable
```

The reason was that our Node application's old instances were not being shut
down when we redeployed it. Seventeen `next-server` processes had built up, each
holding about eleven threads — 187 threads for an application that needs roughly
a dozen — until nothing on the account could fork. Our deployment now retires
the previous instance once the new one is confirmed to be serving, and the
process count has stayed normal since.

**No action needed.** One thing would help us, if it is easy for you: the
**NPROC** and **EP (entry processes)** values set for this account. Knowing them
lets us size our builds and deployments to stay inside them, instead of
discovering the ceiling by hitting it.

---

## For reference — what is already correct

These need no action; listed so you can see the account is otherwise healthy.

| Component | Version / state | Status |
|---|---|---|
| Node.js | 22.23.2 (cPanel Node selector) | fine |
| PHP | 8.4.24 (ea-php84) | fine |
| MySQL | 8.0.37 | fine |
| Passenger (Node app) | configured, app root `nuruzzaman-web` | fine |
| git, tar, curl, zip, unzip, composer, flock | present | fine |
| SSH access | working on port 57813 | fine |
| LVE limits | EP 100, NPROC 200 (confirmed by support, 12 Sep) | fine — NPROC counts threads, and the app now uses 37 |

---

## Summary of what we are asking for

1. ~~**glibc 2.29+** (server migration, if available)~~ — **withdrawn.** The build
   now runs in GitHub Actions and uploads the result, so the server never
   compiles anything. A migration is no longer worth its risk.
2. **Make `rsync` reachable from this account** — it is installed, but not
   visible inside the account. Low priority; the `tar` fallback works.
3. *Nothing.* The 503 outages turned out to be our own application not shutting
   down on redeploy, and are fixed. NPROC is 200 and counts threads; our leak was
   using 187 of them. The application now sits at 37.

Only item 2 is left, and it blocks nothing.

If a server meeting item 1 is not available on this plan, please tell us — we
will keep building off-server permanently and will not raise it again.

Thank you for your help.

Kind regards,
**Engr. Md. Nuruzzaman, RSE**
nuruzzaman.com.bd
