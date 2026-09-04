# ডকুমেন্টেশন সূচি

| ডকুমেন্ট | কী আছে |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | কেন দুইটি অ্যাপ্লিকেশন, রাউটিং, রেন্ডারিং কৌশল, ক্যাশ invalidation, ডোমেইন সার্ভিস |
| [DATA_MODEL.md](DATA_MODEL.md) | সব টেবিল, সম্পর্ক ও ডেটার অপরিবর্তনীয় শর্ত (invariants) |
| [API_BN.md](API_BN.md) | অথেনটিকেশন, এরর ফরম্যাট, রেট লিমিট, idempotency, endpoint সারফেস |
| [COMMERCE_PAYMENT_BN.md](COMMERCE_PAYMENT_BN.md) | অর্ডার স্টেট মেশিন, দাম নির্ধারণ, SSLCOMMERZ প্রবাহ, রিফান্ড |
| [LMS_BN.md](LMS_BN.md) | কোর্স কাঠামো, অ্যাক্সেস নিয়ম, অগ্রগতি, কুইজ, সার্টিফিকেট |
| [BILINGUAL_BN.md](BILINGUAL_BN.md) | বাংলা ও ইংরেজি সাইট, কোনটা অনুবাদ হয় কোনটা হয় না, /en রুট তৈরি |
| [SEO_SPEC_BN.md](SEO_SPEC_BN.md) | ইনডেক্স নীতি, structured data, পারফরম্যান্স বাজেট |
| [PRODUCT_FILE_SECURITY_BN.md](PRODUCT_FILE_SECURITY_BN.md) | ইনস্টলার কোথায় থাকে, ডাউনলোড নিয়ন্ত্রণ, চেকসাম |
| [LICENSE_SERVICE_PHASE2_BN.md](LICENSE_SERVICE_PHASE2_BN.md) | আলাদা লাইসেন্স সার্ভিসের নকশা (পরিকল্পনা) |
| [THREAT_MODEL.md](THREAT_MODEL.md) | হুমকি, প্রতিকার, কোডে কোথায় — এবং জানা সীমাবদ্ধতা |
| [ADMIN_GUIDE_BN.md](ADMIN_GUIDE_BN.md) | রোল, প্রকাশের ধাপ, দাম, রিলিজ, অ্যাক্টিভেশন রিভিউ |
| [DEPLOYMENT_BN.md](DEPLOYMENT_BN.md) | টপোলজি, Docker, মাইগ্রেশন, রোলব্যাক, Redis ছাড়া চালানো |
| [DEPLOY_CPANEL_BN.md](DEPLOY_CPANEL_BN.md) | Docker ছাড়া cPanel হোস্টিং-এ ডিপ্লয়: .cpanel.yml, Node অ্যাপ, /api proxy |
| [BACKUP_RESTORE_BN.md](BACKUP_RESTORE_BN.md) | কী ব্যাকআপ, কত ঘন ঘন, restore drill |
| [CONFIGURATION_CHECKLIST_BN.md](CONFIGURATION_CHECKLIST_BN.md) | **মালিকের করণীয়** — দাম, ক্রেডেনশিয়াল, আইনি অনুমোদন |
| [MEDIA_REQUIREMENTS_BN.md](MEDIA_REQUIREMENTS_BN.md) | কোন ছবি, কী মাপে দরকার |
| [DEPENDENCY_VERSIONS.md](DEPENDENCY_VERSIONS.md) | পরীক্ষিত সংস্করণ, কী ব্যবহার করা হয়নি, আপগ্রেড নোট |
| [TEST_REPORT.md](TEST_REPORT.md) | কী পরীক্ষা করা হয়েছে, কী পাওয়া গেছে, কী বাকি |
| [LAUNCH_CHECKLIST_BN.md](LAUNCH_CHECKLIST_BN.md) | লঞ্চের আগে প্রতিটি গেট |

## কোথা থেকে শুরু করবেন

- **মালিক** → [CONFIGURATION_CHECKLIST_BN.md](CONFIGURATION_CHECKLIST_BN.md), তারপর
  [LAUNCH_CHECKLIST_BN.md](LAUNCH_CHECKLIST_BN.md)
- **ডেভেলপার** → [ARCHITECTURE.md](ARCHITECTURE.md), তারপর [API_BN.md](API_BN.md)
- **সম্পাদক / সাপোর্ট** → [ADMIN_GUIDE_BN.md](ADMIN_GUIDE_BN.md)
- **ডিপ্লয় করছেন যিনি** → [DEPLOYMENT_BN.md](DEPLOYMENT_BN.md) ও
  [BACKUP_RESTORE_BN.md](BACKUP_RESTORE_BN.md)
