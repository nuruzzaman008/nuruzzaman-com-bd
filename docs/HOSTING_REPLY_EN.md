# Reply to ticket — nuruzzaman.com.bd

**Account:** `nbconsultant`
**Server:** `bdix4.ebnserver.com` (115.187.18.57)
**Date:** 12 September 2026
**Re:** your reply on the three items (glibc, rsync, EP/NPROC)

Dear Asif Khan,

Thank you for checking all three so quickly. The figures you sent settled two of
them — and one turned out to be our own fault rather than a server limitation.
Taking them in turn.

---

## 1. glibc 2.28 — no migration needed after all

Thank you for confirming the version, and for offering to look at migration
options. **Please do not migrate the account.**

We originally asked because we wanted to build the Next.js application on the
server. Since then we have moved the build to GitHub Actions: it compiles there
and uploads the finished application, so the server never builds anything and
glibc 2.28 no longer limits us.

Against that, a migration would mean downtime, possibly new IP addresses, and
re-verifying every setting on a site that is currently working. That is not a
trade worth making for a capability we no longer use.

Please keep the option on file. If we ever do need to build on the server, we
will come back to you about it.

---

## 2. rsync — installed on the server, but not visible inside our account

This is the one item we would still like, and we think the two checks
disagreed because they were run from different places.

`command -v rsync` does return `/bin/rsync` as root. Our account cannot see that
file at all. From an SSH session as `nbconsultant`:

```
$ whoami
nbconsultant

$ command -v rsync
                          <- no output

$ ls -l /bin/rsync /usr/bin/rsync
ls: cannot access '/bin/rsync': No such file or directory
ls: cannot access '/usr/bin/rsync': No such file or directory

$ rsync --version
bash: rsync: command not found

$ echo $PATH
/usr/local/cpanel/3rdparty/lib/path-bin:/usr/share/Modules/bin:/usr/local/cpanel/3rdparty/lib/path-bin:/usr/local/bin:/usr/bin:/usr/local/sbin:/usr/sbin
```

The PATH already includes `/usr/bin` and `/usr/local/bin`, so this is not a PATH
problem — the binary is genuinely absent from the account's environment. That is
the usual signature of a binary present on the host but not mapped into the
account's CageFS skeleton, which would explain why a check as root and a check
as the user disagree.

If it is a small change, adding rsync to the skeleton for this account (a
`paths=/usr/bin/rsync` entry under `/etc/cagefs/conf.d/` followed by
`cagefsctl --force-update`, or however you normally do it) would let us use it.

**This is not blocking.** Our deployment now falls back to `tar` when rsync is
missing, so nothing is broken either way. Please treat it as low priority.

---

## 3. Entry processes and NPROC — our fault, now fixed, and no increase needed

Thank you for the numbers: EP 100, NPROC 200. They are what let us find the real
problem, and the problem was ours.

Our Node application was not shutting down its previous instance when we
redeployed it. Seventeen `next-server` processes had accumulated, each holding
about eleven threads. Because NPROC counts threads rather than processes, those
seventeen were consuming roughly **187 of the 200** available — which is why
`node` started failing with `pthread_create: Resource temporarily unavailable`
and why every site on the account went to HTTP 503, the PHP application
included even though it was not at fault.

Our deployment now retires the previous instance once the new one is confirmed to
be serving. Measured from inside the account after the latest deployment:

```
$ ps -u nbconsultant --no-headers | wc -l      # processes
7

$ ps -u nbconsultant -L --no-headers | wc -l   # threads
37
```

So **please do not raise NPROC or EP.** The limits were never the problem, and we
would rather stay comfortably inside them than have room to leak into. We are
sorry for the earlier request that said otherwise — it was written before we
understood our own bug.

---

## 4. One small question: the account's disk quota

This was not in your reply, and we cannot read it from inside the account:

```
$ quota -s
bash: quota: command not found
```

We recently filled the account to 100% — again our own doing. Our deployment was
keeping every backup it had ever taken, 23 GB of them, including files it could
rebuild from scratch. That is fixed: it now keeps the last three and excludes
what is reproducible, and the account currently sits at:

```
$ du -sh $HOME
9.9G
```

**Could you tell us the disk quota set for this account?** Knowing the figure
lets us size our backups to stay well inside it, rather than finding the ceiling
by hitting it as we did.

---

## Summary of what we are asking for

| Item | What we need from you |
|---|---|
| 1. glibc 2.28 | **Nothing.** Please do *not* migrate; keep the option on file. |
| 2. rsync | Add it to this account's CageFS skeleton, if that is easy. Low priority, not blocking. |
| 3. NPROC / EP | **Nothing.** The cause was ours and is fixed. Please leave the limits as they are. |
| 4. Disk quota | Please tell us the figure set for the account. |

Two of the four need no action at all, and the remaining two are small. Thank you
for the detail in your reply — the NPROC figure in particular is what pointed us
at our own fault.

Kind regards,
**Engr. Md. Nuruzzaman, RSE**
nuruzzaman.com.bd
