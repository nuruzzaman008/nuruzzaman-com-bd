# NB Engineering Tools online wallet pilot

Status: local implementation; not activated in production. Target: v6.0.19, AutoCAD 2024 / .NET Framework 4.8.

## ব্যবহার

1. নিজের website email দিয়ে login করুন। Payment admin যাচাই ও approve করবেন।
2. License-এ online wallet চালু হওয়ার পরে online runtime ব্যবহার করুন। AutoCAD-এ `NBONLINECONNECT` দিলে browser খুলবে। কেনা license নির্বাচন করে Confirm করুন। Software-এ password লাগে না।
3. `NBONLINESYNC` দিলে server balance পাওয়া যায়। AutoCAD idle থাকলে প্রায় ৩০ সেকেন্ড অন্তর refresh হয়; payment fulfillment queue-ও সচল থাকতে হবে।
4. নতুন token purchase approve ও fulfill হলে balance server-এ একবার বাড়ে। Generator/signing worker লাগে না। Paid কাজের preflight ও charge server যাচাই করে।
5. Internet/API unavailable হলে paid কাজ বন্ধ। অনিশ্চিত charge DPAPI-protected retry record-এ থাকে; server operation ID duplicate debit আটকায়।

## Windows reinstall এবং সীমা

Balance license ID-এর সঙ্গে server-এ থাকে। Local wallet, PC clock, পুরোনো NB2A/NB2T key দিয়ে reset হয় না। Reinstall-এর পরে reconnect করতে হবে। বর্তমান fingerprint-এ Windows MachineGuid আছে: ID বদলালে admin-কে পুরোনো binding release করে নতুন PC confirm করতে হবে। Balance reset হবে না।

আগের সম্পূর্ণ offline DLL remotely revoke করা সম্ভব নয়। Online edition বিতরণ ও offline generation বন্ধ করার operational সিদ্ধান্ত দরকার। Signing key মুছে বা বদলে এই সমস্যা সমাধান করা হয়নি। Modified/patched client আটকানোর নিশ্চয়তা দেওয়া হচ্ছে না।

Existing tools success-এর পরে commit করে। Drawing হয়ে যাওয়ার ঠিক পরে connection হারালে usage pending হতে পারে। Drawing outcome এবং retry বাস্তব AutoCAD-এ পরীক্ষা করতে হবে। সেই end-to-end test হয়নি; এটি production-ready installer নয়।

## Build

`infra/licensing/BuildOnlineRuntime.ps1`-কে audited private `NBCommercialSecurity.cs` এবং একটি নতুন output directory দিন। Script SHA-256 মিলিয়ে মূল source অক্ষত রেখে offline WalletStore বাদ দিয়ে online implementation compile করে। Output `.private.cs` developer-only; customer-কে দেবেন না।

AutoCAD 2024 DLL compile হয়েছে। AutoCAD 2025–2027 compatibility দাবি করা হচ্ছে না। Installer signing ও actual AutoCAD QA বাকি।

## Server rollout

Existing GitHub/cPanel workflow অপরিবর্তিত। Main push production deploy শুরু করে; reviewed release ছাড়া push নয়। Fresh database/API/web backup এবং approved migration rollout লাগবে। New migration শুধু `nb_online_wallets`, `nb_wallet_entries` তৈরি করে। বর্তমান CI migration changes পেলে থামে; review ছাড়া bypass নয়।

API ও migration rollout-এর পরে pilot configuration:

```dotenv
NB_ONLINE_LICENSING=true
NB_ONLINE_WALLET=true
```

`NB_ONLINE_LICENSE_SKUS` existing product allowlist। প্রথমে `NB_ONLINE_WALLET_CUTOVER_AT` unset রাখুন। পুরোনো balance নিজের records থেকে যাচাই করে one-time provisioning template:

```bash
php artisan nb:enable-online-wallet 'ACTUAL_LICENSE_CODE' REVIEWED_REMAINING_TOKENS --reason='Verified migration reference' --acknowledge-offline-version
```

এটি template, literal command নয়। Existing wallet থাকলে reset হবে না। Opening balance-এ পুরোনো purchase সমন্বয় করতে হবে; পুরোনো order আবার credit হবে না। New purchase approval নতুন ledger entry তৈরি করবে।

Pilot সফল হলে নতুন licenses-এর জন্য `NB_ONLINE_WALLET_CUTOVER_AT`-এ সম্মত ISO-8601 UTC timestamp সেট করা যায়। ওই সময়ের পরে তৈরি eligible, never-issued license প্রথম pairing-এ একবার ৫০ starter tokens পায় (existing allowance)। পুরোনো licenses review ছাড়া migrate হবে না। Cutover-এর পর offline activation দেবেন না।

## Acceptance tests before live

- Pending payment: no credit; admin approval + fulfillment: one credit; repeated approval/job: no extra credit.
- Usage retry: no second debit. Footing: ২ units × ১ token = ২; original policy preserved.
- Internet loss before gate এবং after drawing/commit; AutoCAD restart ও pending recovery.
- Reinstall/new machine binding: same remaining balance, no new starter grant.
- Revoked license, suspended account, released device, superseded secret: blocked.
- Credited refund/partial refund: wallet blocked pending manual reconciliation.
- সব ২৬ VLX command, free/edit commands, daily-charge tools, success/cancel flows actual AutoCAD-এ পরীক্ষা।

## Rollback

Ledger tables drop করবেন না; paid/consumed usage-এর উপর পুরোনো database snapshot restore নয়। `NB_ONLINE_WALLET=false` online use বন্ধ করে; migrated license-এর offline delivery ফিরিয়ে দেয় না। Wallet guards-এর আগের API code-এ rollback করলে accounting bypass হতে পারে। Ledger/guards রেখে fix forward অথবা online use pause করুন। Migrated customer-কে offline DLL ফিরিয়ে দেওয়া নিরাপদ rollback নয়।
