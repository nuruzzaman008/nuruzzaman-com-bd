# cPanel-এ ডিপ্লয়

Docker/Nginx ছাড়া, সাধারণ cPanel হোস্টিং-এ এই সাইট চালানোর ধাপগুলো।
রিপোজিটরির `.cpanel.yml` cPanel-এর **Git Version Control** থেকে চলে এবং
`infra/cpanel/deploy.sh` কাজটা করে।

> এই সাইটে **দুটি** অ্যাপ্লিকেশন চলে — Laravel (PHP) ও Next.js (Node)।
> হোস্টিং-এ **Node.js অ্যাপ্লিকেশন সাপোর্ট** (cPanel-এর "Setup Node.js App",
> অর্থাৎ Passenger) না থাকলে এই আর্কিটেকচার সেখানে চলবে না — কারণ Next.js
> সার্ভার-সাইড রেন্ডারিং করে। সেক্ষেত্রে হোস্ট বদলাতে হবে অথবা ফ্রন্টএন্ড আলাদা
> Node-সক্ষম সার্ভারে রাখতে হবে ([DEPLOYMENT_BN.md](DEPLOYMENT_BN.md))।

---

## ১. যে টপোলজিটি ব্যবহার করা হয়

```
                    ব্রাউজার
                       │
                       ▼
      nuruzzaman.com.bd  ──►  Passenger ──► Next.js (Node)
                                              │
                    /api/*  ও  /sanctum/*  ────┘  (Next নিজে forward করে)
                                              │
                                              ▼
                              api.nuruzzaman.com.bd ──► Laravel
                                (document root: .../public)
```

**সবচেয়ে গুরুত্বপূর্ণ কথা:** ব্রাউজার সবসময় `nuruzzaman.com.bd`-এই থাকে।
`/api` ও `/sanctum` Next নিজে Laravel-এ পাঠায় (`NB_API_PROXY`)।

কেন — সাইন ইন Sanctum-এর same-origin session cookie ব্যবহার করে। ব্রাউজারকে
সরাসরি `api.nuruzzaman.com.bd`-এ পাঠালে কুকি যায় না, `/sanctum/csrf-cookie`
404 দেয়, আর প্রতিটি লগইন 419 CSRF এরর দিয়ে ফেল করে — যা দেখতে ঠিক "ভুল
পাসওয়ার্ড"-এর মতো লাগে। Docker টপোলজিতে Nginx এই কাজ করে; cPanel-এ Nginx নেই,
তাই Next করে।

`api.nuruzzaman.com.bd` সাবডোমেইনটি শুধু Laravel-কে একটি document root দেওয়ার
জন্য। ব্রাউজার ওটায় সরাসরি যায় না।

---

## ২. একবারের সেটআপ

### ২.১ ডিরেক্টরি

SSH বা File Manager দিয়ে:

```bash
mkdir -p ~/api.nuruzzaman.com.bd      # Laravel
mkdir -p ~/nuruzzaman-web             # Next.js (public_html-এর বাইরে)
```

### ২.২ সাবডোমেইন (Laravel)

cPanel → **Domains** → Create A Domain

| ঘর | মান |
|---|---|
| Domain | `api.nuruzzaman.com.bd` |
| Document Root | `/home/<user>/api.nuruzzaman.com.bd/public` |

**`/public` অংশটি বাদ দেওয়া যাবে না।** বাদ দিলে `.env` ফাইলটি ওয়েব রুটের ভেতরে
পড়ে যায় এবং ডেটাবেস পাসওয়ার্ড ইন্টারনেটে খুলে যেতে পারে।

তারপর cPanel → **SSL/TLS Status** থেকে দুটি ডোমেইনেই সার্টিফিকেট নিন।
SSLCOMMERZ বৈধ TLS ছাড়া কাজ করবে না।

### ২.৩ Node.js অ্যাপ্লিকেশন (Next.js)

cPanel → **Setup Node.js App** → Create Application

| ঘর | মান |
|---|---|
| Node.js version | 20 বা তার বেশি (22 প্রস্তাবিত) |
| Application mode | Production |
| Application root | `nuruzzaman-web` |
| Application URL | `nuruzzaman.com.bd` |
| Application startup file | `server.js` |

Environment variables-এ যোগ করুন:

```
NODE_ENV=production
INTERNAL_API_URL=https://api.nuruzzaman.com.bd/api/v1
NEXT_REVALIDATE_SECRET=<২.৬-এ দেওয়া হুবহু একই স্ট্রিং>
```

`NEXT_PUBLIC_SITE_URL` বিল্ডের সময়েই বান্ডলে ঢুকে যায়, তাই সেটি এখানে নয় —
`.nb-deploy.conf`-এ (২.৭) দিতে হয়।

### ২.৪ PHP সংস্করণ

cPanel → **MultiPHP Manager** → `api.nuruzzaman.com.bd` → **PHP 8.3 বা 8.4**।
এক্সটেনশন লাগবে: `pdo_mysql`, `mbstring`, `openssl`, `bcmath`, `intl`, `fileinfo`,
`zip`, `gd` বা `imagick`।

### ২.৫ ডেটাবেস

cPanel → **MySQL Databases** → ডেটাবেস, ইউজার ও পাসওয়ার্ড তৈরি করে
ALL PRIVILEGES দিন। MySQL/MariaDB ছাড়া অন্য কিছু এই অ্যাপ্লিকেশন চালাবে না —
বুট করার সময়ই থেমে যাবে।

### ২.৬ Laravel-এর `.env`

`~/api.nuruzzaman.com.bd/.env` **সার্ভারে হাতে** তৈরি করুন।
ডিপ্লয় স্ক্রিপ্ট এটি কখনো লেখে না বা মোছে না — একটি ভুল push যেন ক্রেডেনশিয়াল
দুর্ঘটনা না হয়।

`apps/api/.env.example`-এ প্রতিটি কী আছে; কোনটি মালিককে দিতে হবে তা
[CONFIGURATION_CHECKLIST_BN.md](CONFIGURATION_CHECKLIST_BN.md)-এ।
এই টপোলজির জন্য যা অবশ্যই ঠিক থাকতে হবে:

```dotenv
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.nuruzzaman.com.bd

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_DATABASE=<cpanel_db>
DB_USERNAME=<cpanel_dbuser>
DB_PASSWORD=<password>

# কুকিটি মূল ডোমেইনের জন্য হতে হবে — সাবডোমেইনের জন্য নয়।
SESSION_DOMAIN=nuruzzaman.com.bd
SESSION_COOKIE=nuruzzaman_session
SANCTUM_STATEFUL_DOMAINS=nuruzzaman.com.bd
FRONTEND_URL=https://nuruzzaman.com.bd

# প্রকাশ বা মডারেশনের পরে Next.js-এর ক্যাশ ছাড়ার জন্য।
# এই দুটি না দিলে আর্টিকেল প্রকাশ করলে বা মন্তব্য অনুমোদন করলে ৫ মিনিট পর্যন্ত
# পুরোনো পাতাই দেখা যাবে — কাজটি হারিয়ে গেছে বলে মনে হবে।
NEXT_REVALIDATE_URL=https://nuruzzaman.com.bd/api/revalidate
NEXT_REVALIDATE_SECRET=<একটি লম্বা random স্ট্রিং>
```

`NEXT_REVALIDATE_SECRET`-এর মানটি Node.js অ্যাপের এনভায়রনমেন্টেও **হুবহু একই**
দিতে হবে (২.৩ দেখুন)। দুই পাশে আলাদা হলে Next.js অনুরোধটি ফিরিয়ে দেবে, আর
লারাভেলের লগে `Frontend revalidation failed` লেখা থাকবে।

`APP_KEY` না থাকলে একবার চালান:

```bash
cd ~/api.nuruzzaman.com.bd && php artisan key:generate
```

### ২.৭ ডিপ্লয় কনফিগ

```bash
cp infra/cpanel/deploy.conf.example ~/.nb-deploy.conf
nano ~/.nb-deploy.conf
chmod 600 ~/.nb-deploy.conf
```

এই ফাইলটি **রিপোজিটরির বাইরে**, কারণ পাথগুলো প্রতিটি অ্যাকাউন্টে আলাদা।
ফাইলটি না থাকলে ডিপ্লয় শুরুতেই থেমে বলে দেবে কী লিখতে হবে।

### ২.৮ Composer

```bash
cd ~ && curl -sS https://getcomposer.org/installer | php
```

`~/composer.phar` থাকলে ডিপ্লয় স্ক্রিপ্ট নিজেই খুঁজে নেবে।

### ২.৯ Git Version Control

cPanel → **Git™ Version Control** → Create

| ঘর | মান |
|---|---|
| Clone a Repository | ✅ |
| Clone URL | রিপোজিটরির URL |
| Repository Path | `/home/<user>/repositories/nuruzzaman-com-bd` |

---

## ৩. ডিপ্লয় করা

cPanel → Git Version Control → রিপোজিটরির **Manage** → **Pull or Deploy** →
**Deploy HEAD Commit**।

অথবা SSH থেকে:

```bash
cd ~/repositories/nuruzzaman-com-bd && git pull && bash infra/cpanel/deploy.sh
```

কী হবে দেখতে চাইলে, কিছু পরিবর্তন না করে:

```bash
NB_DRY_RUN=1 bash infra/cpanel/deploy.sh
```

প্রতিটি ডিপ্লয়ে যা হয়:

1. যেসব ফাইল কখনো প্রকাশ পাওয়া উচিত নয় (সাইনিং কী, রিকভারি ফাইল, LSP সোর্স)
   সেগুলো ট্র্যাক করা আছে কি না দেখে — থাকলে **কিছুই না করে থেমে যায়**।
2. PHP ও Node-এর সঠিক বাইনারি খুঁজে সংস্করণ যাচাই করে।
3. Laravel maintenance mode-এ যায়, ফাইল সিঙ্ক হয় (`.env` ও `storage/` বাদে),
   `composer install --no-dev`, মাইগ্রেশন, ক্যাশ রিবিল্ড, তারপর আবার চালু।
4. ফ্রন্টএন্ড বিল্ড হয়ে standalone আউটপুট Node অ্যাপ রুটে কপি হয়।
5. বিল্ডে `/api` ও `/sanctum` proxy আছে কি না **যাচাই করে** — না থাকলে ফেল করে,
   কারণ ওটা ছাড়া কেউ সাইন ইন করতে পারবে না।
6. `tmp/restart.txt` টাচ করে, যাতে পরের রিকোয়েস্টে Passenger নতুন কোড নেয়।

---

## ৪. ডিপ্লয়ের পরে যা দেখতে হবে

```bash
curl -sI https://nuruzzaman.com.bd/            | head -1   # 200
curl -sI https://nuruzzaman.com.bd/en          | head -1   # 200
curl -sI https://nuruzzaman.com.bd/up          | head -1   # 200 (API হেলথ)
curl -sI https://nuruzzaman.com.bd/sanctum/csrf-cookie | head -1   # 204
```

চারটির মধ্যে **`/sanctum/csrf-cookie` সবচেয়ে গুরুত্বপূর্ণ**। এটি 404 দিলে
proxy বসেনি, এবং সাইন ইন ভুল পাসওয়ার্ডের মতো এরর দেবে।

তারপর ব্রাউজারে: হোম পেজ দুই ভাষায়, একটি আর্টিকেল, একটি কোর্স, এবং
`/login` দিয়ে অ্যাডমিনে সাইন ইন।

---

## ৫. সাধারণ সমস্যা

| লক্ষণ | কারণ | সমাধান |
|---|---|---|
| সাইন ইন "কিছুক্ষণ পরে চেষ্টা করুন" দেয় | `/sanctum/csrf-cookie` 404 — proxy নেই | `~/.nb-deploy.conf`-এ `NB_API_PROXY` দিন, আবার ডিপ্লয় করুন (বিল্ড-টাইম মান) |
| সাইন ইন হয়, পরের পাতাতেই লগআউট | `SESSION_DOMAIN` সাবডোমেইনে সেট | `.env`-এ `SESSION_DOMAIN=nuruzzaman.com.bd` |
| পেজ আসে, CSS আসে না | `.next/static` কপি হয়নি | আবার ডিপ্লয়; স্ক্রিপ্ট তিনটি অংশই কপি করে |
| `next build` মেমরির অভাবে ফেল | শেয়ার্ড অ্যাকাউন্টের সীমা | `NB_BUILD_WEB=0` করে লোকালি বিল্ড করে `apps/web/.next` আপলোড করুন |
| `could not find driver` | PHP-তে `pdo_mysql` নেই | MultiPHP INI Editor থেকে চালু করুন |
| 500, লগে "No application encryption key" | `APP_KEY` নেই | `php artisan key:generate` |
| ডিপ্লয় বলে `.env` নেই | ইচ্ছাকৃত | সার্ভারে `.env` তৈরি করুন (ধাপ ২.৬) |

Laravel লগ: `~/api.nuruzzaman.com.bd/storage/logs/laravel.log`
Node লগ: cPanel → Setup Node.js App → অ্যাপের log ফাইল

---

## ৬. রোলব্যাক

```bash
cd ~/repositories/nuruzzaman-com-bd
git checkout <আগের-commit>
bash infra/cpanel/deploy.sh
```

মাইগ্রেশন আলাদা: কোড পিছিয়ে গেলে ডেটাবেস নিজে থেকে পিছোয় না।
`php artisan migrate:rollback --step=1` — এবং তার আগে ব্যাকআপ
([BACKUP_RESTORE_BN.md](BACKUP_RESTORE_BN.md))।

---

## ৭. যা এই ডিপ্লয় কখনো করে না

- `.env` লেখে না বা মোছে না।
- `storage/` বা `public/storage` স্পর্শ করে না — আপলোড করা মিডিয়া ওখানেই থাকে।
- কোনো সাইনিং কী, `.pfx`, `.nbk`/`.nbrk` বা LSP/VLX সোর্স কপি করে না; বরং
  সেগুলো রিপোজিটরিতে থাকলে ডিপ্লয় শুরুতেই থেমে যায়।
