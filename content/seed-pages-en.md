<!--
  nuruzzaman.com.bd — seed pages (English)

  Same format as seed-pages-bn.md: front matter between two `---` fences,
  documents separated by a line containing only `@@@`.

  Every slug here is its Bengali counterpart plus `-en`. That suffix is what
  CmsPage looks for when the reader is on an /en URL; when no `-en` document
  exists the Bengali one is rendered with a visible "not translated yet" notice.

  DELIBERATELY ABSENT: the six legal documents (privacy-policy, terms,
  refund-policy, software-eula, course-terms, engineering-disclaimer). Those are
  policy. An unreviewed English rendering of them would read as the owner's
  terms while never having been checked by anyone qualified, so /en shows the
  Bengali text with the untranslated notice instead. Add them here only once a
  professional has reviewed an English version.
-->

---
slug: about-en
title: About
template: default
meta_title: Engr. Md. Nuruzzaman, RSE — About
meta_description: Practical engineering education, reviewed technical articles, and NB Engineering Tools for AutoCAD — in one place.
---

## What this site is

This is the personal teaching and digital-product platform of Engr. Md. Nuruzzaman, RSE.
It brings three things together for civil and structural engineers, students, drafters and
AutoCAD users in Bangladesh:

- **Practical tutorials** — written in Bangla, step by step through the actual work.
- **Reviewed technical articles** — stating units, assumptions and the code edition used.
- **NB Engineering Tools** — a structural and engineering design toolset built for AutoCAD.

## How the work is done

What gets written here gets checked before it is written. No article is published without
an engineer's review. No claim is made about a tool's accuracy, speed or code compliance
that has not been tested.

The software is a productivity aid. Final checking of any design, and the professional
responsibility for it, rest with the qualified user.

## How this relates to nbconsultant.com.bd

`nbconsultant.com.bd` is the company and consultancy site.
`nuruzzaman.com.bd` is the personal authority, education, tools and commerce site.
The same writing is never published on both domains.

@@@

---
slug: resources-en
title: Resources
template: default
meta_title: Engineering resources
meta_description: Checklists, templates and references, added here once they are ready to publish.
---

## What is here now

This page is being built gradually. Only resources that are finished and checked get added
to it. Nothing is listed as "coming soon".

Planned:

- An RCC footing design checklist
- AutoCAD layer and drawing standard templates
- A site visit and construction quality checklist
- A Mouza map workflow reference

If you need something specific, say so from the support page.

@@@

---
slug: support-en
title: Support
template: support
meta_title: Support and help
meta_description: Installation, activation, licence recovery, release notes and system requirements.
---

## Where to start

| What you need | Page |
|---|---|
| Installing for the first time | [Installation guide](/en/support/installation) |
| Machine activation | [Activation](/en/support/activation) |
| You have lost a licence | [Licence recovery](/en/support/license-recovery) |
| What changed in which version | [Release notes](/en/support/release-notes) |
| Whether your PC will run it | [System requirements](/en/support/system-requirements) |

## Getting in touch

Signing in and opening a support ticket links it to your order, which gets a faster answer.
To write without an account, use the [contact](/en/contact) page.

The support email address and hours will appear here once they are set in the site settings.

@@@

---
slug: support-installation-en
title: Installation guide
template: support
meta_title: NB Engineering Tools installation guide
meta_description: Installing, upgrading, repairing and uninstalling NB Engineering Tools v6.0.
---

## Before you install

1. Close AutoCAD completely.
2. Make sure you have administrator rights in Windows.
3. Download the installer from the **Downloads** page in your account.
4. Check the file's SHA-256 checksum once the download finishes — the checksum is published
   on the release notes page.

The command to read the checksum in Windows PowerShell:

```
Get-FileHash .\NB_Engineering_Tools_Setup.exe -Algorithm SHA256
```

## Installing

One setup supports AutoCAD 2024, 2025, 2026 and 2027.

1. Run the installer, read the EULA and accept it.
2. Select which AutoCAD versions to install into.
3. When it finishes, open AutoCAD — you get both an NB tab on the Ribbon and the classic
   pull-down menu.

## Upgrade, repair and uninstall

The same installer runs upgrade, repair, uninstall and rollback.
It keeps its own log of each step; attach that log file when you write to support.

## If the menu does not appear

- Run `MENULOAD` in AutoCAD and check whether the partial menu is loaded.
- Check that the NB folder is listed under `OPTIONS → Files → Support File Search Path`.
- If that does not fix it, run **Repair** from the installer.

@@@

---
slug: support-activation-en
title: Activation
template: support
meta_title: Machine activation and credit refill
meta_description: The steps for machine activation tied to an order, and for an NB Credit refill request.
---

## How activation works

NB Engineering Tools activates per machine. The process is currently a manual vendor
review:

1. You need a **paid order**.
2. Collect your **Machine ID** from the License & System tool in the software.
3. Sign in to your account and send an **activation request** with the order number and the
   Machine ID.
4. After review, a secure response is placed in your account and an email is sent.

## Privacy

Your Machine ID is stored **encrypted** on this site and is always shown masked in the
interface and in logs (for example `A1B2****9F3C`).
No signing key, token or recovery file is ever kept on this website.

## NB Credit refill

When credit runs out, order a refill package, then send a refill request the same way with
the Machine ID. Once it is approved, the instructions for refilling the wallet appear in
your account.

@@@

---
slug: support-license-recovery-en
title: Licence recovery
template: support
meta_title: Licence recovery
meta_description: Recovering a licence after a hardware change or a Windows reinstall.
---

## When recovery is needed

- You have reinstalled Windows
- You have changed the motherboard or the disk
- You are moving from an old PC to a new one

## The process

Recovery is vendor-verified — every request is checked by hand.

1. Sign in to your account, open a recovery request and state the reason.
2. Give the Machine ID of the new machine.
3. Confirm that the old machine will no longer be used.
4. After verification, a secure response appears in your account.

## What we will never ask for

We will never ask you to upload a recovery file, a `.nbk`/`.nbrk` file, or any private key.
Uploads of that kind are deliberately disabled on this website. If somebody asks you for
one, it is not us.

@@@

---
slug: support-system-requirements-en
title: System requirements
template: support
meta_title: System requirements
meta_description: The Windows and AutoCAD versions needed to run NB Engineering Tools v6.0.
---

## Minimum requirements

- **Operating system:** Windows 10 or Windows 11, 64-bit
- **AutoCAD:** 2024, 2025, 2026 or 2027 — the full desktop version
- **Rights:** administrator access during installation
- **Internet:** during activation and token refill

## An honest word about compatibility

The software is designed for AutoCAD 2024, 2025, 2026 and 2027.

> Designed for AutoCAD 2024-2027.
> Tested compatibility: confirmed separately by the owner for each release.

**Designed for and tested on are not the same thing.** A version that has had no runtime
testing will not be described as "fully tested". AutoCAD 2020–2023 and earlier are not
supported.

## What is not supported

- AutoCAD LT (it cannot run LISP/VLX)
- 32-bit Windows
- The browser-based AutoCAD Web

@@@

---
slug: support-release-notes-en
title: Release notes
template: support
meta_title: Release notes
meta_description: What each NB Engineering Tools release contains, with its checksum and signing status.
---

## How to read this

Each release's name, version, publication date, file size, SHA-256 checksum and
code-signing status are shown automatically in the release list.

Always check the checksum after downloading. If it does not match, do not use the file.

## v6.0

- One-setup architecture for AutoCAD 2024, 2025, 2026 and 2027
- 25 engineering/productivity modules plus 1 core/security module — 26 compiled VLX modules
  in total
- An AutoCAD Ribbon tab and the classic pull-down menu
- Machine activation, signed token refill, protected token wallet
- Vendor-verified licence recovery
- Upgrade, repair, uninstall, rollback and log workflows in the installer

@@@

---
slug: faq-en
title: Frequently asked questions
template: support
meta_title: Frequently asked questions
meta_description: The questions asked most about licensing, downloads, courses and payment.
---

## NB Engineering Tools

### Will it run on AutoCAD LT?

No. The LT version cannot run LISP/VLX applications.

### How many PCs does one licence cover?

Licensing is per machine. How many machines are allowed is stated on the variant you buy
and shown on the licence page in your account.

### Are the tool's calculations guaranteed to be code-compliant?

No. It is a productivity aid. Every output needs checking by a qualified engineer, and the
professional responsibility is the user's.

## Courses

### How long does course access last?

The access period is stated separately on each course page.

### Will I get a certificate?

On courses that include one, completing the course issues a certificate with a verification
ID that anyone can check.

## Payment and downloads

### How does payment work?

Payment happens on the SSLCOMMERZ hosted page. Card details never reach this site and are
never stored here.

### Why does my order still say "confirming" after I have paid?

An order becomes paid only after the server-to-server confirmation arrives from the gateway.
That usually takes a few seconds; if something goes wrong, the reconciliation process checks
again on its own.
