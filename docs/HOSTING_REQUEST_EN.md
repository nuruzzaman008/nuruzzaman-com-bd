# Hosting support request — nuruzzaman.com.bd

**Account:** `nbconsultant`
**Server:** `bdix4.ebnserver.com` (115.187.18.57)
**Domains on the account:** nuruzzaman.com.bd, api.nuruzzaman.com.bd, productreview.com.bd, nuruzzaman.nbconsultant.com.bd
**Date:** 11 September 2026

Dear Support Team,

The site `nuruzzaman.com.bd` is a Node.js (Next.js) application served through
Passenger, with a Laravel/PHP API on `api.nuruzzaman.com.bd`. Both are now
deployed and working.

While deploying I ran into three limitations of the current server. The site is
live in spite of them, but each one costs us something, and two of them briefly
took **every site on the account offline**. I would be grateful if you could look
at the three items below.

---

## 1. glibc is too old for Next.js to build on the server — *highest priority*

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

## 2. `rsync` is not installed

```
$ command -v rsync
(not found)
```

`rsync` is a standard part of a hosting toolchain and is what deployment scripts
normally use to copy application files. We have worked around it with `tar`, but
it makes deployments slower and less safe, because `tar` cannot copy
incrementally or remove files that were deleted upstream.

**Request:** please install `rsync` for this account (`yum install rsync` /
`dnf install rsync`).

---

## 3. The account's process limit (LVE NPROC) is too low

This is the one that caused real downtime. During ordinary work — one build, a
few SSH sessions, a deployment — the account ran out of process slots. At that
point **nothing on the account could start a process**:

```
bash: fork: retry: Resource temporarily unavailable
/etc/profile.d/cpanel-user-commands.sh: fork: Resource temporarily unavailable
ssh: Connection closed by remote host
```

Every site returned **HTTP 503**, including `api.nuruzzaman.com.bd`, which is a
PHP application and unrelated to the Node app. It only recovered after the
Node.js application was restarted manually from cPanel.

Note that `ulimit -u` reports `771057`, so the limit being hit is the **LVE
NPROC limit**, which is not visible through `ulimit` and can only be changed by
you.

**Request:** please review and raise the **NPROC** (and, if it is also tight,
**EP** — entry processes) limit for this account, and let us know the values you
set so we can size our builds accordingly.

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

---

## Summary of what we are asking for

1. **glibc 2.29+** (server migration, if available) — so the site can be built on the server
2. **Install `rsync`** — standard deployment tooling
3. **Raise the LVE NPROC / entry-process limit** — to stop account-wide 503 outages

Items 2 and 3 are small changes. Item 1 is the one that decides whether we can
use cPanel's own Git deployment, or must keep building elsewhere and uploading.

If a server meeting item 1 is not available on this plan, please tell us — we
will keep building off-server permanently and will not raise it again.

Thank you for your help.

Kind regards,
**Engr. Md. Nuruzzaman, RSE**
nuruzzaman.com.bd
