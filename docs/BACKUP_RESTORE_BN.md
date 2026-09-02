# ব্যাকআপ ও পুনরুদ্ধার

## কী ব্যাকআপ করতে হবে

| জিনিস | কেন | কোথায় |
|---|---|---|
| MySQL ডেটাবেস | অর্ডার, লাইসেন্স, অগ্রগতি, অডিট — কিছুই পুনর্নির্মাণযোগ্য নয় | `mysql-data` ভলিউম |
| প্রাইভেট ডিস্ক | ইনস্টলার, লেসন ফাইল, অ্যাসাইনমেন্ট, সার্টিফিকেট, ইনভয়েস | `api-storage` ভলিউম বা S3 |
| পাবলিক মিডিয়া | আর্টিকেল ও কোর্সের ছবি | `storage/app/public` |
| `APP_KEY` | **এটি হারালে** এনক্রিপ্ট করা Machine ID ও MFA secret চিরতরে অপাঠ্য | `.env` (secrets manager-এ রাখুন) |
| `.env` ফাইলগুলো | সব ক্রেডেনশিয়াল | secrets manager |

> `APP_KEY` ডেটাবেস ব্যাকআপের **সঙ্গে একই জায়গায় রাখবেন না**। দুটোই এক জায়গায়
> ফাঁস হলে এনক্রিপশনের কোনো মূল্য থাকে না।

## ছন্দ

| কী | কত ঘন ঘন | কতদিন রাখা |
|---|---|---|
| MySQL সম্পূর্ণ ডাম্প | দৈনিক | ৩০ দিন |
| MySQL binlog / incremental | সম্ভব হলে | ৭ দিন |
| প্রাইভেট ডিস্ক | দৈনিক (পরিবর্তন হলে) | ৩০ দিন |
| অফ-সাইট কপি | দৈনিক | ৯০ দিন |

সব অফ-সাইট কপি **এনক্রিপ্ট করা** থাকবে।

## ব্যাকআপ

```bash
# MySQL — single-transaction যাতে সাইট বন্ধ করতে না হয়
docker compose exec -T mysql mysqldump \
  --single-transaction --quick --routines --triggers \
  -u root -p"$DB_ROOT_PASSWORD" nuruzzaman \
  | gzip > backup-$(date +%F).sql.gz

# প্রাইভেট ডিস্ক
docker run --rm -v nuruzzaman_api-storage:/data -v "$PWD":/backup alpine \
  tar czf /backup/storage-$(date +%F).tar.gz -C /data .

# এনক্রিপ্ট করে অফ-সাইটে পাঠান
gpg --symmetric --cipher-algo AES256 backup-$(date +%F).sql.gz
```

## পুনরুদ্ধার

```bash
docker compose exec api php artisan down
gunzip < backup-2026-09-01.sql.gz \
  | docker compose exec -T mysql mysql -u root -p"$DB_ROOT_PASSWORD" nuruzzaman

docker run --rm -v nuruzzaman_api-storage:/data -v "$PWD":/backup alpine \
  tar xzf /backup/storage-2026-09-01.tar.gz -C /data

docker compose exec api php artisan migrate --force
docker compose exec api php artisan config:cache
docker compose exec api php artisan up
```

## Restore drill (বাধ্যতামূলক)

**পরীক্ষা না করা ব্যাকআপ ব্যাকআপ নয়।** কমপক্ষে ত্রৈমাসিক:

1. একটি আলাদা staging পরিবেশে ব্যাকআপ restore করুন।
2. যাচাই করুন:
   - [ ] অর্ডার সংখ্যা ও সর্বশেষ অর্ডার নম্বর মিলছে
   - [ ] একজন গ্রাহক সাইন ইন করে নিজের ডাউনলোড দেখতে পাচ্ছেন
   - [ ] একটি ইনস্টলার ডাউনলোড হচ্ছে এবং SHA-256 মিলছে
   - [ ] কোর্সের অগ্রগতি ঠিক আছে
   - [ ] একটি অ্যাক্টিভেশন রিকোয়েস্টের masked Machine ID পড়া যাচ্ছে
     (অর্থাৎ `APP_KEY` সঠিক)
   - [ ] অডিট লগে সাম্প্রতিক সারি আছে
3. তারিখ, সময় ও ফলাফল লিখে রাখুন।

ধাপ ২-এর পঞ্চম আইটেমটি সবচেয়ে গুরুত্বপূর্ণ: এটিই প্রমাণ করে যে ব্যাকআপ ও
`APP_KEY` একসঙ্গে কাজ করে।

## লক্ষ্য

| মাপ | লক্ষ্য |
|---|---|
| RPO (কত তথ্য হারানো গ্রহণযোগ্য) | ২৪ ঘণ্টা; binlog থাকলে ১৫ মিনিট |
| RTO (কত দ্রুত ফিরতে হবে) | ৪ ঘণ্টা |

## পেমেন্ট পুনর্মিলন

restore-এর পরে গেটওয়ে ও ডেটাবেসের মধ্যে ফাঁক থাকতে পারে। সেক্ষেত্রে:

```bash
docker compose exec api php artisan tinker
>>> App\Jobs\ReconcilePayments::dispatchSync(0);
```

এটি pending পেমেন্টগুলো আবার গেটওয়ের সঙ্গে মিলিয়ে দেখে। যাচাই ও নিষ্পত্তি একই
idempotent পথে হয়, তাই দুইবার ফুলফিল হওয়ার ঝুঁকি নেই।
