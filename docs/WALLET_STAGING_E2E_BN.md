# NBOnlineWallet staging end-to-end প্রস্তুতি

তারিখ: 20 September 2026। অবস্থা: **BLOCKED — approved staging origin ও isolated database নিশ্চিত নয়**।

## যাচাইকৃত তথ্য

- Repository deployment example-এ production website/API origin পাওয়া গেছে; কোনো approved staging deployment/configuration পাওয়া যায়নি। এটি staging কোথাও নেই—এমন দাবি নয়; বর্তমানে তার পরিচয়/অনুমোদনের প্রমাণ নেই।
- Pilot package তৈরি আছে: `infra/licensing/NBOnlineWallet/artifacts/pilot-20260920/pilot/NB_Online_Wallet_Pilot_AutoCAD2024.zip`।
- কোনো remote account login, device pair, reserve, debit, license block, database write বা deployment এই প্রস্তুতিতে করা হয়নি।
- Staging website URL: **অজানা / confirmation প্রয়োজন**। Staging API origin: **অজানা / confirmation প্রয়োজন**।
- Test user email/ID, selected test license code/ID: **দেয়া হয়নি; তৈরি করা হয়নি**।
- আগের 24 client tests, 168 backend regression tests, 1 payment concurrency test এবং 6 frontend tests local verification। এগুলো staging E2E actual result নয়।

## Test শুরু করার আগে deployment/configuration

1. Administrator-approved HTTPS website এবং API origin নিশ্চিত করুন। DNS/SSL এবং `/api/*`, `/sanctum/*` routing যাচাই করতে হবে। Existing frontend login ও `/connect-autocad` page একই staging environment-এ deploy থাকতে হবে; শুধু API deploy যথেষ্ট নয়।
2. আলাদা staging database ও আলাদা database user প্রয়োজন। সেই user-এর production database-এ কোনো privilege থাকবে না। Production `.env`, database dump, payment credentials, session store, uploads, queue বা cache share করা যাবে না। Synthetic fixtures ব্যবহার করুন।
3. Reviewed Phase 1–4 backend এবং Phase 5 authenticated `balance.identity` response staging-এ থাকতে হবে। Wallet table migrations ও prerequisite migrations শুধু ওই isolated staging database-এ review করে চালাতে হবে। এই নথি কোনো production migration নির্দেশ নয়।
4. Staging deployment-এর জন্য production-targeted `.nb-deploy.conf`, production default roots বা production push-trigger workflow চালাবেন না। Separate roots এবং explicitly staging-only deployment job প্রয়োজন; exact paths এখন জানা নেই।
5. Existing configuration names:

```dotenv
APP_ENV=staging
APP_DEBUG=false
NB_ONLINE_LICENSING=true
NB_ONLINE_WALLET=true
NB_OFFLINE_WALLET_ENABLED=true
NB_OFFLINE_WALLET_POLICY_VERSION=1
NB_OFFLINE_WALLET_MAX_ALLOWANCE=100
NB_OFFLINE_WALLET_LEASE_SECONDS=86400
NB_OFFLINE_WALLET_SYNC_SECONDS=21600
NB_OFFLINE_WALLET_MAX_BATCH=100
SESSION_COOKIE=nb_wallet_staging_session
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=lax
```

এগুলো template, কোনো environment-এ প্রয়োগ করা হয়নি। `APP_URL`, `DB_*`, `APP_KEY`, `SANCTUM_STATEFUL_DOMAINS`, `CORS_ALLOWED_ORIGINS`, session/cache/queue storage এবং mail sink verified staging values অনুযায়ী আলাদা হবে। Same-origin browser proxy হলে host-only session cookie ব্যবহার করুন; `.nuruzzaman.com.bd` parent-domain cookie দিয়ে production/staging session মেশাবেন না। Build-time `NB_PUBLIC_SITE_URL`, `NB_INTERNAL_API_URL`, `NB_API_PROXY` অবশ্যই staging নির্দেশ করবে।

6. `NB_OFFLINE_WALLET_SIGNING_KEY_PATH` ও `NB_OFFLINE_WALLET_SIGNING_KEY_ID`-তে approved staging lease signer দরকার। Trusted administrator তার matching **public-only** RSA XML ও key ID দেবেন। Production key পরিবর্তন/কপি বা নতুন key তৈরি এই প্রস্তুতিতে করা হয়নি। Existing original NB offline token signing key ও wallet lease signing key একই বলে ধরে নেয়া যাবে না।
7. Existing authentication ব্যবহার করে controlled test email-এর active/verified user প্রয়োজন। Multiple-license test-এর জন্য একই test user-এর **দুটি usable synthetic licenses** প্রয়োজন, existing allowed SKU এবং synthetic paid/fulfilled order fixture-সহ। কোনো real payment নয়। Selected license-এর managed wallet-এ documented opening ledger দিয়ে 500 test tokens; দ্বিতীয়টির balance অপরিবর্তিত থাকবে। Normal admin credentials/password রিপোর্টে থাকবে না।
8. Automatic provisioning/cutover দিয়ে accidental extra opening grant এড়াতে administrator staging fixtures-এর wallet আগে provision করবেন। Existing `nb:enable-online-wallet` command ব্যবহার করা যেতে পারে কেবল inspected test license-এর জন্য; command existing wallet reset করে না। Blank key বা disabled flags হলে API usable ধরে নেয়া যাবে না।
9. **বর্তমান pilot limitation:** `NBWPILOTUSAGE` production domain ও তার সব subdomain reject করে। Approved staging যদি `*.nuruzzaman.com.bd` হয়, test শুরু করার আগে exact staging origin-এর narrowly scoped allowlist code change, tests এবং নতুন pilot build লাগবে। এখন guard কমানো হয়নি। অন্য domain হলেও production DB isolation আলাদাভাবে যাচাই করতে হবে; hostname একা প্রমাণ নয়।

## Run record

প্রতিটি run-এ staging build commit/hash, origin, isolated DB identity confirmation, test user/license IDs, device ID, baseline ledger/balance/version, lease ID, request/transaction UUID, timestamps এবং sanitized HTTP status/body summary রাখতে হবে। Password, device bearer secret, private key বা পূর্ণ machine fingerprint report/log-এ নয়।

### Expected numeric baseline

Selected TEST license: balance 500, reserve 0, available 500। Connect allowance 100 হলে available 400, reserve 100। Offline-এ তিনটি `PCM` × 1 usage হলে local allowance 97, pending 3; server ledger এখনও debit দেখাবে না। Sync শেষে total balance 497, reserve 97, available 400, pending 0, তিনটি unique 1-token debit। Daily-fee command দিয়ে এই fixed arithmetic test করবেন না।

## Scenario report — expected বনাম actual

| ID | Test | Expected result | Actual result |
|---|---|---|---|
| A | Online login | Existing staging website login/CSRF/session সফল; addon password নেয় না | NOT RUN — approved staging/account নেই |
| B | License selection | Test user-এর দুটি license dropdown; নির্বাচিত license-ই addon identity-তে, অন্য license অপরিবর্তিত | NOT RUN |
| C | Device pairing | Pair code browser-এ confirm; server binding/device ID নির্বাচিত test license-এর | NOT RUN |
| D | Initial balance sync | Authenticated 200; email/license/device identity সঠিক; 500→400 available, reserve 100 after connect | NOT RUN |
| E | Internet disconnect | শুধু pilot PC-এর network বিচ্ছিন্ন; server বন্ধ নয়; valid cached allowance থাকে | NOT RUN |
| F | Offline usage | Staging-only pilot usage একটি durable UUID/sequence entry লিখে; local allowance 99 | NOT RUN |
| G | Multiple offline transactions | আরও দুইটি আলাদা UUID, contiguous sequence; allowance 97, pending 3; restart-এ retained | NOT RUN |
| H | Internet reconnect | Pending entries না হারিয়ে same test origin/device-এ যোগাযোগ ফেরে | NOT RUN |
| I | Automatic sync | Monotonic scheduler প্রায় 30 সেকেন্ডে retry; exact payload/ID; তিনটি debit একবার করে | NOT RUN |
| J | Website history | Staging admin wallet history এবং device history-তে একই তিন UUID; balance 497, reserve 97 | NOT RUN |
| K | Duplicate sync retry | Captured successful request-এর exact replay: 200, same receipt/IDs; ledger/balance আর বদলায় না | NOT RUN |
| L | Server unavailable / timeout | Staging-only proxy/fault injection-এ 503 বা lost response; pending durable; recovered retry double debit করে না | NOT RUN |
| M | Blocked test license | Existing licensing rule দিয়ে selected test license unusable; API rejects, addon offline spending বন্ধ; journal retained | NOT RUN |

সব actual result block হওয়ায় কোনো pass/fail fabricated করা হয়নি। L-এর জন্য production web/API process বন্ধ করবেন না। Timeout-after-commit test-এ proxy দিয়ে শুধু response drop করুন; server commit হয়েছে কি না ledger দিয়ে মিলিয়ে নিন। Rejected request-কে নতুন ID দিয়ে অন্ধভাবে আবার debit পাঠাবেন না। M-এর আগে license-এর original status/audit record সংরক্ষণ করুন; পরে test-only state documentedভাবে restore করুন।

## API response summary

**Actual remote responses: none; staging request পাঠানো হয়নি।** Expected:

| Endpoint | Expected response / invariant |
|---|---|
| POST `/api/v1/licensing/pair` | 200, secret/code; secret report-এ নয় |
| POST `/api/v1/account/connect-device` | Existing authenticated owner + CSRF; connected=true; wrong ownership rejected |
| GET `/api/wallet/balance` | 200, wallet/version, server time, authenticated identity |
| POST `/api/wallet/connect` | 200, signed lease + reserved wallet; identical retry same reservation |
| POST `/api/wallet/sync` | 200 accepted IDs/sequence/remaining; identical retry no second debit |
| GET `/api/wallet/history` | 200, selected wallet entries + next_cursor; অন্য license history নয় |

Feature flags off/signing unavailable হলে 503; invalid/revoked credential 401; unusable license/wallet 403; version/lease/conflicting reuse 409; invalid payload 422 হতে পারে। Actual code/message capture না করে এগুলো observed বলা যাবে না।

## Exact PC installation steps

1. Existing pilot ZIP extract করুন; AutoCAD বন্ধ করুন।
2. `NBOnlineWallet/compiled/NBOnlineWallet.bundle` copy করুন `%APPDATA%\Autodesk\ApplicationPlugins\NBOnlineWallet.bundle`-এ। একই addon থাকলে আগে আলাদা folder-এ backup; original NB Tools untouched।
3. Config example copy করুন bundle-এর `Contents\Win64\wallet.config.json` নামে। Confirmed staging `api_origin`/`website_origin`, trusted public key XML/ID, allowance 100 দিন। `allow_pilot_usage=true` শুধু isolated staging ও hostname guard compatibility নিশ্চিত হওয়ার পরে। URL/key না পাওয়া পর্যন্ত এই ধাপ পূরণ করা যাবে না।
4. AutoCAD 2024 চালু করুন। Auto-load না হলে `NETLOAD` → bundle-এর `Contents\Win64\NBOnlineWallet.dll`। Core DLL পাশে থাকবে। `SECURELOAD` globally বন্ধ নয়।
5. `RIBBON` চালু করে `NB ONLINE` দেখুন। `NBWACCOUNT` দিয়ে browser খুলুন; existing login এবং license dropdown ব্যবহার করুন; তারপর `NBWSYNC` ও `NBWWALLET`।
6. D-এর baseline screenshot/sanitized ledger capture করুন। Network disconnect করে `NBWPILOTUSAGE` → `YES` তিনবার। এটি PCM test debit journal করে; original engineering command execute/control করে না।
7. `NBWHISTORY`-তে local entries দেখুন। Reconnect করে auto-sync/`NBWSYNC`; staging website dashboard wallet history-তে UUID মিলিয়ে নিন।
8. Error দেখলে journal/delete/reset নয়; report-এ pending IDs ও status লিখুন। Client secret/DPAPI file সাধারণ report attachment করবেন না।

## Test wallet reset — safe procedure

1. Addon automatic sync থামাতে AutoCAD বন্ধ করুন; stale client request পুনরায় পাঠানো বন্ধ নিশ্চিত করুন। Sanitized before/after ledger ও test run evidence রেখে দিন।
2. শুধু test credential/device এবং পরীক্ষায় বদলানো test license status চিহ্নিত করুন। Production user/order/payment match না হওয়ার প্রমাণ যাচাই করুন।
3. Pending/expired/reserved allowance শূন্য না হলে **balance edit করে reset নয়**। বর্তমান server-এ safe general lease-release/reset endpoint নেই। তাই existing admin add/deduct দিয়ে reserve মুছে ফেলা যাবে না।
4. সবচেয়ে নিরাপদ repeatable ব্যবস্থা: dedicated disposable staging database-এর **pre-test snapshot** নতুন isolated test database-এ restore করে শুধুমাত্র staging app সেটিতে নির্দেশ করুন। পুরোনো test database evidence হিসেবে retain করুন; production database/user access ব্যবহার নয়। Exact DB/path জানার পরে environment-specific commands দেয়া যাবে; কোনো generic destructive reset command এখানে দেয়া হয়নি।
5. Snapshot ছাড়া একই wallet রাখতে হলে reserve/usage reconciliation-এর reviewed service প্রয়োজন। সব leases settled এবং pending শূন্য হলে existing admin ledger adjustment দিয়ে net test spending compensate করা যায়, reason/reference-এ run ID রেখে; direct SQL balance update বা ledger delete নয়। বর্তমান 100 allowance/3 usage example-এ reserve 97 থাকে, তাই এই shortcut প্রযোজ্য নয়।
6. Restored baseline-এর সঙ্গে পুরোনো addon journal আবার sync করবেন না। Evidence preserve করে নতুন isolated Windows test profile/device pairing ব্যবহার করুন, পুরোনো test device credential staging-এ invalidate করুন এবং existing device-limit procedure মানুন। Production profile/journal মুছবেন না।

## Known issues / remaining inputs

- Approved staging URL, DB isolation evidence, test identities এবং trusted public key এখনও নেই।
- Server deployment/flags/schema/SSL/browser routing remote-এ verify হয়নি।
- Current pilot rejects all production subdomains for test usage; exact staging origin জানা দরকার।
- Actual graphical AutoCAD/browser E2E execution হয়নি।
- Original compiled engineering commands-এর internal token deduction addon নিয়ন্ত্রণ করে না। Offline test addon-এর explicit test journal flow-এর।
- Expired/lost journal ও partially consumed lease-এর automated reset/release নেই। DPAPI/checkpoint সম্পূর্ণ OS snapshot rollback-এর বিরুদ্ধে absolute guarantee নয়।

এই report প্রস্তুতি ও truthful blocked-result record; production বা staging deploy approval হিসেবে ব্যবহার করবেন না।
