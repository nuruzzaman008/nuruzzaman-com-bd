import type { Locale } from './locale';

/**
 * Interface strings, in both languages.
 *
 * The `Dictionary` type is derived from the Bengali entry, so TypeScript fails
 * the build when an English string is missing. English cannot quietly fall back
 * to Bengali — a half-translated interface is worse than an untranslated one,
 * because the reader cannot tell which parts they are missing.
 *
 * SCOPE: interface chrome only. Articles, courses and product copy are written
 * by hand in the language they are published in and are never machine
 * translated here — a mistranslated bar spacing or load figure is not a
 * cosmetic problem.
 */

const bn = {
  brand: {
    role: 'RSE · nuruzzaman.com.bd',
    statement: 'প্রকৌশল শিখুন। কাজ দ্রুত করুন। আত্মবিশ্বাসের সঙ্গে ডিজাইন করুন।',
    heroSupport:
      'Engr. Md. Nuruzzaman, RSE-এর practical engineering tutorials, verified technical articles এবং AutoCAD-এর জন্য NB Engineering Tools—এক জায়গায়।',
  },

  nav: {
    home: 'হোম',
    courses: 'কোর্স',
    tools: 'ইঞ্জিনিয়ারিং টুলস',
    blog: 'ব্লগ',
    resources: 'রিসোর্স',
    about: 'পরিচিতি',
    support: 'সাপোর্ট',
    primary: 'প্রধান মেনু',
    mobile: 'মোবাইল মেনু',
    openMenu: 'মেনু খুলুন',
    closeMenu: 'মেনু বন্ধ করুন',
    skipToContent: 'মূল কনটেন্টে যান',
  },

  /** One-line descriptions shown under each item in the mobile menu. */
  navDescription: {
    courses: 'বাংলায় প্র্যাকটিক্যাল ইঞ্জিনিয়ারিং কোর্স',
    tools: 'AutoCAD-এর জন্য NB Engineering Tools',
    blog: 'যাচাই করা টেকনিক্যাল আর্টিকেল',
    resources: 'চেকলিস্ট ও টেমপ্লেট',
    support: 'ইনস্টলেশন, অ্যাক্টিভেশন ও লাইসেন্স',
  },

  actions: {
    search: 'সার্চ',
    cart: 'কার্ট',
    signIn: 'সাইন ইন',
    signOut: 'সাইন আউট',
    signingOut: 'সাইন আউট হচ্ছে…',
    account: 'অ্যাকাউন্ট',
    adminPanel: 'অ্যাডমিন প্যানেল',
    adminSignIn: 'অ্যাডমিন সাইন ইন',
    myAccount: 'আমার অ্যাকাউন্ট',
    readMore: 'বিস্তারিত',
    viewAll: 'সব দেখুন',
  },

  language: {
    label: 'ভাষা',
    current: 'বর্তমান ভাষা',
  },

  account: {
    signedInAs: 'সাইন ইন করেছেন',
    navigation: 'অ্যাকাউন্ট নেভিগেশন',
    emailUnverified:
      'ইমেইল যাচাই করা হয়নি। ডাউনলোড ও অ্যাক্টিভেশনের জন্য যাচাই করা প্রয়োজন।',
    signOutFailed:
      'সার্ভারে পৌঁছানো যায়নি, তাই সেশন এখনো বন্ধ নাও হতে পারে। নিরাপত্তার জন্য ব্রাউজার বন্ধ করুন বা আবার চেষ্টা করুন।',
  },


  /* ---- Home page ---- */
  home: {
    metaTitle: 'প্র্যাকটিক্যাল ইঞ্জিনিয়ারিং শিক্ষা ও টুলস',
    heroCtaTools: 'NB Engineering Tools দেখুন',
    heroCtaBlog: 'আর্টিকেল পড়ুন',
    trustReviewed: 'ইঞ্জিনিয়ার-রিভিউ করা লেখা',
    trustReviewedDetail: 'ইউনিট, অ্যাজাম্পশন ও কোড এডিশন উল্লেখ করে',
    trustTested: 'পরীক্ষিত',
    trustPlatform: 'Windows 10 / 11, 64-bit',
    trustDownload: 'সুরক্ষিত ডাউনলোড',
    trustDownloadDetail: 'SHA-256 চেকসাম ও অ্যাকাউন্ট-ভিত্তিক অ্যাক্সেস',
    blogEyebrow: 'সর্বশেষ',
    blogTitle: 'ব্লগ থেকে',
    blogDescription:
      'প্রতিটি লেখায় একটি বাস্তব উদাহরণ, ব্যবহৃত অ্যাজাম্পশন এবং সীমাবদ্ধতা স্পষ্ট করে লেখা থাকে।',
    blogEmptyTitle: 'এখনো কোনো আর্টিকেল প্রকাশ হয়নি',
    blogEmptyDescription: 'ইঞ্জিনিয়ার-রিভিউ শেষ হলে লেখা এখানে দেখা যাবে।',
    blogAll: 'সব আর্টিকেল',
    toolsTitle: 'AutoCAD-এর জন্য স্ট্রাকচারাল ও ইঞ্জিনিয়ারিং টুলসেট',
    toolsDescription:
      '২৬টি compiled VLX application, সাতটি feature group-এ সাজানো। Ribbon এবং classic pull-down menu — দুইভাবেই কাজ করে।',
    compatibilityLabel: 'সামঞ্জস্য:',
    compatibilityBody: 'মালিকের প্রকাশিত নথি অনুযায়ী বর্তমান commercial build',
    compatibilitySuffix: ', Windows 10/11 64-bit-এর জন্য প্রস্তুত।',
    compatibilityTested: 'রানটাইম-টেস্ট করা',
    compatibilityUntested: 'ভিন্ন ভার্সনের সামঞ্জস্য আলাদাভাবে নিশ্চিত করতে হবে।',
    productivityAid:
      'সফটওয়্যারটি একটি productivity aid। চূড়ান্ত যাচাই ও পেশাগত দায়িত্ব যোগ্য ব্যবহারকারীর।',
    toolsCta: 'টুলস সম্পর্কে বিস্তারিত',
    productsAll: 'সব প্রোডাক্ট',
    coursesEyebrow: 'কোর্স',
    coursesTitle: 'বাংলায় প্র্যাকটিক্যাল কোর্স',
    coursesDescription:
      'হিসাব থেকে ড্রয়িং পর্যন্ত — প্রতিটি ধাপে ইউনিট, অ্যাজাম্পশন ও যাচাইয়ের পদ্ধতি সহ।',
    coursesEmptyTitle: 'কোর্স এখনো প্রকাশিত হয়নি',
    coursesEmptyDescription:
      'প্রথম কোর্সগুলো তৈরি হচ্ছে। প্রকৃত লেসন যুক্ত না হওয়া পর্যন্ত কোনো কোর্স তালিকাভুক্ত করা হয় না।',
    coursesEmptyCta: 'ততক্ষণে ব্লগ পড়ুন',
    coursesAll: 'সব কোর্স',
    supportEyebrow: 'সহায়তা',
    supportTitle: 'ইনস্টলেশন থেকে অ্যাক্টিভেশন — ধাপে ধাপে',
    supportDescription: 'সবচেয়ে বেশি দরকার হয় এমন সহায়তা পাতাগুলো এক জায়গায়।',
  },


  /**
   * Per-route title and description, keyed by the Bengali path.
   *
   * The English routes reuse the Bengali page implementations, so without this
   * an English page would carry a Bengali <title> into search results. Any path
   * missing here keeps the page's own metadata rather than inventing one.
   */
  meta: {
    '/': {
      title: 'প্র্যাকটিক্যাল ইঞ্জিনিয়ারিং শিক্ষা ও টুলস',
      description:
        'Engr. Md. Nuruzzaman, RSE-এর practical engineering tutorials, verified technical articles এবং AutoCAD-এর জন্য NB Engineering Tools—এক জায়গায়।',
    },
    '/blog': {
      title: 'ব্লগ — যাচাই করা টেকনিক্যাল আর্টিকেল',
      description:
        'RCC ডিজাইন, ফাউন্ডেশন, BNBC ও AutoCAD নিয়ে বাংলায় লেখা, প্রতিটিতে বাস্তব উদাহরণ ও অ্যাজাম্পশন সহ।',
    },
    '/courses': {
      title: 'কোর্স — বাংলায় প্র্যাকটিক্যাল ইঞ্জিনিয়ারিং',
      description:
        'ফাউন্ডেশন, RCC ডিজাইন, কোয়ান্টিটি এস্টিমেট ও AutoCAD নিয়ে ধাপে ধাপে বাংলা কোর্স।',
    },
    '/engineering-tools': {
      title: 'NB Engineering Tools — AutoCAD-এর জন্য স্ট্রাকচারাল টুলসেট',
      description:
        'Footing, pile cap, beam, slab, column ও grid workflow-এর জন্য ২৬টি compiled VLX মডিউল।',
    },
    '/shop': {
      title: 'প্রোডাক্ট',
      description: 'NB Engineering Tools লাইসেন্স, NB Credit ও কোর্স।',
    },
    '/resources': {
      title: 'রিসোর্স',
      description: 'চেকলিস্ট, টেমপ্লেট ও রেফারেন্স।',
    },
    '/support': {
      title: 'সাপোর্ট',
      description: 'ইনস্টলেশন, অ্যাক্টিভেশন, লাইসেন্স রিকভারি ও সিস্টেম রিকোয়ারমেন্ট।',
    },
    '/about': {
      title: 'পরিচিতি',
      description: 'Engr. Md. Nuruzzaman, RSE — অভিজ্ঞতা, কাজের ধরন ও যোগাযোগ।',
    },
    '/contact': {
      title: 'যোগাযোগ',
      description: 'প্রশ্ন, সাপোর্ট বা লাইসেন্স সংক্রান্ত যোগাযোগ।',
    },
    '/faq': {
      title: 'সাধারণ জিজ্ঞাসা',
      description: 'সফটওয়্যার, লাইসেন্স, টোকেন ও কোর্স নিয়ে সবচেয়ে বেশি জিজ্ঞাসিত প্রশ্ন।',
    },
    '/search': {
      title: 'সার্চ',
      description: 'সাইটের প্রকাশিত কনটেন্টের মধ্যে খুঁজুন।',
    },
    '/verify': {
      title: 'সার্টিফিকেট যাচাই',
      description: 'একটি সার্টিফিকেটের verification ID যাচাই করুন।',
    },
    '/support/installation': {
      title: 'ইনস্টলেশন গাইড',
      description: 'NB Engineering Tools ইনস্টল করার ধাপ, প্রয়োজনীয় শর্ত ও সাধারণ সমস্যা।',
    },
    '/support/activation': {
      title: 'অ্যাক্টিভেশন',
      description: 'মেশিন অ্যাক্টিভেশন কীভাবে কাজ করে এবং রিকোয়েস্ট কীভাবে পাঠাবেন।',
    },
    '/support/license-recovery': {
      title: 'লাইসেন্স রিকভারি',
      description: 'কম্পিউটার বদলালে বা Windows পুনরায় ইনস্টল করলে লাইসেন্স ফিরে পাওয়ার ধাপ।',
    },
    '/support/release-notes': {
      title: 'রিলিজ নোট',
      description: 'প্রতিটি রিলিজে কী আছে, SHA-256 চেকসাম এবং code-signing অবস্থা।',
    },
    '/support/system-requirements': {
      title: 'সিস্টেম রিকোয়ারমেন্ট',
      description: 'কোন AutoCAD সংস্করণ ও কোন Windows কনফিগারেশনে চলে।',
    },
    '/privacy-policy': {
      title: 'গোপনীয়তা নীতি',
      description: 'কোন তথ্য সংগ্রহ করা হয়, কেন করা হয় এবং কতদিন রাখা হয়।',
    },
    '/terms': {
      title: 'ব্যবহারের শর্তাবলি',
      description: 'এই সাইট ও এর সেবা ব্যবহারের শর্ত।',
    },
    '/refund-policy': {
      title: 'রিফান্ড নীতি',
      description: 'ডিজিটাল পণ্য ও কোর্সে রিফান্ড কখন প্রযোজ্য।',
    },
    '/software-eula': {
      title: 'সফটওয়্যার লাইসেন্স চুক্তি (EULA)',
      description: 'NB Engineering Tools ব্যবহারের লাইসেন্স শর্ত।',
    },
    '/course-terms': {
      title: 'কোর্স শর্তাবলি',
      description: 'এনরোলমেন্ট, অ্যাক্সেসের মেয়াদ ও সার্টিফিকেট সংক্রান্ত শর্ত।',
    },
    '/engineering-disclaimer': {
      title: 'ইঞ্জিনিয়ারিং দাবিত্যাগ',
      description: 'সফটওয়্যার ও কনটেন্টের সীমা এবং পেশাগত দায়িত্ব কার।',
    },
  },


  /* ---- Shared page furniture ---- */
  common: {
    home: 'হোম',
    all: 'সব',
    filterByTopic: 'বিষয় অনুযায়ী ছাঁকুন',
  },

  /** Strings inside shared interface primitives - cards, lists, forms. */
  ui: {
    pagination: 'পেজিনেশন',
    previousPage: 'আগের পাতা',
    nextPage: 'পরের পাতা',
    page: 'পাতা',
    loading: 'লোড হচ্ছে',
    breadcrumb: 'ব্রেডক্রাম্ব',
    tableOfContents: 'এই লেখায় যা আছে',
    close: 'বন্ধ করুন',
    required: '(আবশ্যক)',
    formHasErrors: 'ফর্মে কিছু সমস্যা আছে',
    discount: 'ছাড়',
    priceOnRequest: 'দাম জানতে যোগাযোগ করুন',
    certificate: 'সার্টিফিকেট',
    technicalReview: 'টেকনিক্যাল রিভিউ',
    lastUpdated: 'সর্বশেষ হালনাগাদ',
    reviewedBy: 'পর্যালোচনা করেছেন',
    legalDraftBody:
      'এই নীতিটি এখনো আইনজীবী বা যোগ্য পেশাজীবীর পর্যালোচনা পায়নি। চূড়ান্ত পর্যালোচনার পরে এই নোটিশটি সরে যাবে এবং পর্যালোচকের নাম ও তারিখ এখানে দেখানো হবে।',
  },

  /*
    Unit words appended to a formatted number.

    Bengali does not inflect these for number, so the singular and the plural
    are the same word; English needs both, and "1 minutes read" is exactly the
    kind of thing that makes a translated page read like a translated page.
  */
  units: {
    hour: 'ঘণ্টা',
    hours: 'ঘণ্টা',
    minute: 'মিনিট',
    minutes: 'মিনিট',
    read: 'পড়া',
    lesson: 'টি লেসন',
    lessons: 'টি লেসন',
  },

  /** Catalogue vocabulary. Fixed taxonomies, not authored prose. */
  productType: {
    software_license: 'সফটওয়্যার লাইসেন্স',
    credit_refill: 'ক্রেডিট রিফিল',
    course: 'কোর্স',
    bundle: 'বান্ডেল',
    digital_resource: 'ডিজিটাল রিসোর্স',
  },

  level: {
    beginner: 'শুরুর স্তর',
    intermediate: 'মাঝারি স্তর',
    advanced: 'উন্নত স্তর',
  },

  /*
    Course tracks and blog categories share one slug space (App\Support    CourseTracks and BlogSeeder::CLUSTERS). These values are the fallback only:
    on the Bengali site the name the API returns wins, so editing a category in
    the admin changes what a reader sees. On the English site the API has no
    English name to give, so these are what render.
  */
  taxonomy: {
    trackFilter: 'সব ট্র্যাক',
    filterLabel: 'বিষয় অনুযায়ী ফিল্টার',
    'foundation-geotechnical': 'ফাউন্ডেশন ও জিওটেকনিক্যাল',
    'rcc-design-detailing': 'RCC ডিজাইন ও ডিটেইলিং',
    'structural-engineering': 'স্ট্রাকচারাল ইঞ্জিনিয়ারিং',
    'steel-design': 'স্টিল স্ট্রাকচার ডিজাইন',
    'autocad-productivity': 'AutoCAD ও ড্রাফটিং',
    'engineering-software': 'ইঞ্জিনিয়ারিং সফটওয়্যার',
    'bnbc-code-application': 'BNBC ও কোড প্রয়োগ',
    'construction-quality': 'নির্মাণ মান ও সাইট প্র্যাকটিস',
    'quantity-estimation': 'কোয়ান্টিটি ও এস্টিমেট',
    'mouza-drawing-workflow': 'মৌজা ম্যাপ ও ল্যান্ড ড্রয়িং',
  },

  /* ---- Blog ---- */
  blog: {
    heading: 'ব্লগ',
    intro:
      'প্রতিটি লেখায় একটি সরাসরি উত্তর, একটি বাস্তব উদাহরণ, ব্যবহৃত অ্যাজাম্পশন এবং সীমাবদ্ধতা স্পষ্ট করে দেওয়া থাকে।',
    emptyTitle: 'এখানে এখনো কোনো লেখা নেই',
    emptyDescription: 'নতুন আর্টিকেল প্রকাশিত হলে এই তালিকায় যুক্ত হবে।',
  },

  /* ---- Courses ---- */
  courses: {
    heading: 'কোর্স',
    intro:
      'প্রতিটি কোর্স একটি বাস্তব কাজের ক্রম ধরে সাজানো। কোনো কোর্স প্রকৃত লেসন যুক্ত না হওয়া পর্যন্ত তালিকাভুক্ত করা হয় না।',
    emptyTrackTitle: 'এই ট্র্যাকে এখনো কোর্স নেই',
    emptyTitle: 'কোর্স এখনো প্রকাশিত হয়নি',
    emptyTrackDescription: 'অন্য ট্র্যাক দেখুন, অথবা ব্লগে এই বিষয়ের লেখা পড়ুন।',
    emptyDescription: 'কোনো কোর্স প্রকৃত লেসন যুক্ত না হওয়া পর্যন্ত এখানে দেখানো হয় না।',
    seeAll: 'সব কোর্স দেখুন',
    readBlog: 'ততক্ষণে ব্লগ পড়ুন',
    allTracks: 'সব ট্র্যাক',
    filterLabel: 'বিষয় অনুযায়ী ফিল্টার',
  },

  /* ---- Shop ---- */
  shop: {
    heading: 'শপ',
    intro:
      'সব পণ্য ডিজিটাল। ক্রয়ের পরে ডাউনলোড ও কোর্স অ্যাক্সেস আপনার অ্যাকাউন্টের সঙ্গে যুক্ত থাকে।',
    priceNotice:
      'যে পণ্যের দাম এখনো প্রকাশ করা হয়নি, সেখানে “দাম জানতে যোগাযোগ করুন” দেখানো হয় — কোনো অনুমানভিত্তিক দাম দেখানো হয় না।',
    emptyTitle: 'এখনো কোনো পণ্য প্রকাশ করা হয়নি',
    emptyDescription: 'পণ্য প্রকাশিত হলে এখানে দেখা যাবে।',
    chooseVariant: 'ভ্যারিয়েন্ট বেছে নিন',
    noVariants: 'এই পণ্যের কোনো ভ্যারিয়েন্ট এখনো প্রকাশ করা হয়নি।',
    addToCart: 'কার্টে যোগ করুন',
    adding: 'যোগ করা হচ্ছে…',
    addFailed: 'কার্টে যোগ করা যায়নি। আবার চেষ্টা করুন।',
    added: 'কার্টে যোগ হয়েছে।',
    viewCart: 'কার্ট দেখুন',
    variantUnpriced: 'এই ভ্যারিয়েন্টের দাম এখনো প্রকাশ করা হয়নি। দাম জানতে সাপোর্টে যোগাযোগ করুন।',
  },

  /* ---- Search ---- */
  search: {
    heading: 'সার্চ',
    label: 'কী খুঁজছেন?',
    placeholder: 'যেমন: ফুটিং, ল্যাপ লেংথ, লেয়ার স্ট্যান্ডার্ড',
    submit: 'খুঁজুন',
    tooShort: 'অন্তত দুইটি অক্ষর লিখে খুঁজুন।',
    noResultsDescription: 'অন্য শব্দ দিয়ে চেষ্টা করুন, অথবা ব্লগের বিষয়ভিত্তিক তালিকা দেখুন।',
    nothingFound: 'কিছু পাওয়া যায়নি',
    articles: 'আর্টিকেল',
    courses: 'কোর্স',
    products: 'প্রোডাক্ট',
  },

  /* ---- Contact ---- */
  contact: {
    heading: 'যোগাযোগ',
    intro:
      'অ্যাকাউন্ট থাকলে সাপোর্ট টিকিট খুললে সেটি আপনার অর্ডারের সঙ্গে যুক্ত থাকে এবং উত্তর দ্রুত হয়। অ্যাকাউন্ট ছাড়াও এই ফর্ম থেকে লিখতে পারেন।',
    direct: 'সরাসরি',
    noDirectContact: 'সরাসরি যোগাযোগের তথ্য এখনো প্রকাশ করা হয়নি; এই ফর্মটি ব্যবহার করুন।',
    checkFirst: 'আগে দেখে নিন',
    securityNotice:
      'কার্ড নম্বর, পাসওয়ার্ড বা লাইসেন্স ফাইল কখনো ইমেইলে পাঠাবেন না। আমরা কখনো সেগুলো চাইব না।',
    name: 'আপনার নাম',
    email: 'ইমেইল',
    subject: 'বিষয়',
    message: 'বার্তা',
    messageHint: 'অর্ডার নম্বর বা AutoCAD ভার্সন উল্লেখ করলে উত্তর দ্রুত হয়।',
    send: 'বার্তা পাঠান',
    sending: 'পাঠানো হচ্ছে…',
    sentTitle: 'বার্তা পৌঁছেছে',
    sentBody: 'ধন্যবাদ। আপনার বার্তা গ্রহণ করা হয়েছে; উত্তর ইমেইলে পাঠানো হবে।',
    failed: 'বার্তা পাঠানো যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।',
  },


  /* ---- Engineering tools product page ---- */
  tools: {
    heading: 'ইঞ্জিনিয়ারিং টুলস',
    productTitle: 'Structural & Engineering Design Tools for AutoCAD',
    lede:
      'Footing, combined footing, pile cap, beam, slab, column, grid ও geotechnical workflow-এর জন্য একটি professional AutoCAD automation suite। Ribbon এবং classic pull-down menu — দুইভাবেই কাজ করে।',
    compatibilityLabel: 'সামঞ্জস্য:',
    compatibilityBody: 'মালিকের প্রকাশিত নথি অনুযায়ী বর্তমান commercial build',
    compatibilitySuffix: ', Windows 10/11 64-bit-এর জন্য প্রস্তুত।',
    testedVersions: 'রানটাইম-টেস্ট করা ভার্সন',
    untested:
      'ভিন্ন AutoCAD ভার্সনের সামঞ্জস্য আলাদাভাবে নিশ্চিত করতে হবে। রানটাইম-টেস্টের প্রমাণ ছাড়া কোনো ভার্সনকে পরীক্ষিত বলা হয় না।',
    verifiedFacts: 'যাচাই করা তথ্য',
    moduleList: 'মডিউল তালিকা',
    moduleIntro:
      'টি compiled মডিউল, কাজ অনুযায়ী সাজানো। নিচে প্রতিটি মডিউলের ঘোষিত ব্যবহার লেখা আছে — ভেতরের কমান্ডের নির্ভুলতা, গতি বা কোড-সামঞ্জস্য নিয়ে এমন কোনো দাবি করা হচ্ছে না যা পরীক্ষা করা হয়নি।',
    moduleNote: 'মডিউলের কার্যকারিতা ভার্সন অনুযায়ী পরিবর্তিত ও উন্নত হতে পারে।',
    licensing: 'লাইসেন্স, Machine ID ও টোকেন',
    machineActivation: 'Machine activation',
    machineActivationBody:
      'প্রতিটি সমর্থিত কম্পিউটার একটি Machine ID তৈরি করে এবং লাইসেন্স তার সাথে bind হয়।',
    tokenCredit: 'Token / credit',
    tokenCreditBody:
      'Activation ব্যবহারের অনুমতি দেয়; token নির্দিষ্ট paid operation চালানোর ক্রেডিট। সক্রিয় লাইসেন্স থাকলেও paid operation-এর জন্য পর্যাপ্ত token লাগতে পারে।',
    tokenSpendHeading: 'টোকেন কীভাবে খরচ হয়',
    tokenSpend1: 'প্রতিটি টুলের token cost এক নয়।',
    tokenSpend2: 'কিছু টুল সফল command session অনুযায়ী charge করে।',
    tokenSpend3Prefix: 'কিছু design টুল সফল',
    tokenSpend3Strong: 'unique design',
    tokenSpend3Suffix:
      'অনুযায়ী charge করে — যেমন ২৪টি ফুটিং নির্বাচন করেও unique design ২টি হলে ২টিই গোনা হয়।',
    tokenSpend4:
      'বাতিল বা ব্যর্থ operation-এ প্রযোজ্য টুলের যুক্তি অনুযায়ী charge না-ও হতে পারে।',
    reinstallLabel: 'Windows reinstall বা format:',
    reinstallBody:
      'স্থানীয় license/token ডেটা মুছে যেতে পারে। Token শূন্য হয়ে গেলে আগের token স্বয়ংক্রিয়ভাবে ফিরে পাওয়ার নিশ্চয়তা নেই।',
    screenshotBody:
      'Windows setup-এর সর্বোচ্চ ৩০ মিনিট আগে তোলা স্পষ্ট screenshot থাকলে ভেন্ডর যাচাইয়ের পর অবশিষ্ট balance পুনরায় issue করা যেতে পারে। বিস্তারিত শর্ত ও ব্যতিক্রম',
    recoveryLink: 'লাইসেন্স রিকভারি পাতায়',
    screenshotSuffix: 'দেখুন।',
    installation: 'ইনস্টলেশন',
    installationBody:
      'ইনস্টল শেষে AutoCAD চালু করলে NB Engineering Tools Ribbon পাওয়া যায়। এরপর:',
    faq: 'সাধারণ জিজ্ঞাসা',
    responsibilityLabel: 'ইঞ্জিনিয়ারিং দায়িত্ব:',
    responsibilityBody:
      'সফটওয়্যারটি design ও drawing automation দেয়, কিন্তু চূড়ান্ত engineering সিদ্ধান্ত, ডিজাইন যাচাই, কোড সঙ্গতি, কাঠামোগত নিরাপত্তা ও ড্রয়িংয়ের নির্ভুলতার দায়িত্ব যোগ্য প্রকৌশলীর। কোনো স্বয়ংক্রিয় ফলাফল স্বাধীন engineering review ছাড়া চূড়ান্ত নির্মাণ-সিদ্ধান্ত হিসেবে ব্যবহার করা উচিত নয়।',
    loadFailed: 'পণ্যের তথ্য লোড করা যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।',
    version: 'ভার্সন',
    platform: 'প্ল্যাটফর্ম',
    modules: 'মডিউল',
    checksumPending: 'ফাইল প্রকাশের পর দেওয়া হবে',
    supportLine: 'টেকনিক্যাল ও লাইসেন্স সাপোর্ট:',
    verifiedFactsList: [
      'NB Engineering Tools v6.0',
      'Structural & Engineering Design Tools for AutoCAD',
      'Windows 10 / 11, 64-bit',
      '২৫টি engineering/productivity মডিউল + ১টি core/security মডিউল = মোট ২৬টি compiled VLX মডিউল',
      'AutoCAD Ribbon এবং classic pull-down menu',
      'Machine activation, token/credit licensing, signed activation ও refill workflow',
      'Professional Windows Setup EXE',
      'Vendor-verified license recovery',
      'ডেভেলপার: Engr. Md. Nuruzzaman, RSE',
    ],
    installSteps: [
      'Machine ID নিন',
      'লাইসেন্স ক্রয় ও অ্যাক্টিভেশন সম্পন্ন করুন',
      'Signed activation key প্রয়োগ করুন',
      'প্রয়োজন অনুযায়ী token refill নিন',
      'ইঞ্জিনিয়ারিং টুল ব্যবহার শুরু করুন',
    ],
  },

  /** Article page. */
  post: {
    published: 'প্রকাশ',
    updated: 'হালনাগাদ',
    reviewPending: 'টেকনিক্যাল রিভিউ এখনো বাকি — হিসাব নিজে যাচাই করে ব্যবহার করুন।',
    educationalNotice:
      'এই লেখাটি শিক্ষামূলক। কোনো নির্দিষ্ট প্রকল্পে প্রয়োগের আগে সেই প্রকল্পের জিওটেকনিক্যাল রিপোর্ট, লোড এবং প্রযোজ্য কোড অনুযায়ী স্বাধীনভাবে যাচাই করুন।',
    moreDetail: 'বিস্তারিত',
    readMore: 'আরও পড়ুন',
    topicMetaSuffix: 'বিষয়ভিত্তিক আর্টিকেল',
    topicEmptyTitle: 'এই বিষয়ে এখনো লেখা প্রকাশ হয়নি',
    topicEmptyDescription: 'নতুন আর্টিকেল যুক্ত হলে এখানে দেখা যাবে।',
    authorWorks: 'প্রকাশিত লেখা',
    authorEmpty: 'এখনো কোনো প্রকাশিত লেখা নেই',
  },

  /** Course detail page and the free lesson preview. */
  course: {
    sequential: 'ধারাবাহিক',
    lastReviewed: 'সর্বশেষ পর্যালোচনা',
    outcomes: 'কী শিখবেন',
    audience: 'কাদের জন্য',
    prerequisites: 'পূর্বশর্ত',
    requiredSoftware: 'প্রয়োজনীয় সফটওয়্যার',
    curriculum: 'কারিকুলাম',
    freePreview: 'ফ্রি প্রিভিউ',
    noLessons: 'এই মডিউলের লেসন এখনো যুক্ত করা হয়নি।',
    reviewsHeading: 'শিক্ষার্থীদের রিভিউ',
    reviewsNote: 'শুধু যাচাইকৃত এনরোলমেন্ট থেকে দেওয়া রিভিউ প্রকাশ করা হয়।',
    reviewFallbackTitle: 'রিভিউ',
    reviewFallbackAuthor: 'শিক্ষার্থী',
    verifiedEnrollment: 'যাচাইকৃত এনরোলমেন্ট',
    enroll: 'কোর্সে ভর্তি হন',
    enrollClosed:
      'এই কোর্সের এনরোলমেন্ট এখনো খোলা হয়নি। দাম ও ভর্তির তারিখ প্রকাশিত হলে এখানে দেখা যাবে।',
    watchPreview: 'ফ্রি প্রিভিউ দেখুন',
    access: 'অ্যাক্সেস',
    days: 'দিন',
    accessUnpublished: 'মেয়াদ প্রকাশিত হয়নি',
    certificateOnCompletion: 'কোর্স সম্পূর্ণ করলে',
    certificateNone: 'নেই',
    support: 'সাপোর্ট',
    refund: 'রিফান্ড',
    certificateNote: 'সার্টিফিকেট কেবল কোর্স সম্পন্ন হওয়ার প্রমাণ; এটি কোনো পেশাগত লাইসেন্স নয়।',
    previewMetaSuffix: 'ফ্রি প্রিভিউ',
    previewMetaDescription: 'কোর্সের ফ্রি প্রিভিউ লেসন।',
    previewNoVideo: 'এই লেসনের ভিডিও এখনো যুক্ত করা হয়নি।',
    previewMoreHeading: 'সম্পূর্ণ কোর্সে আরও কী আছে',
    previewMoreBody: 'বাকি লেসন, অনুশীলন ফাইল, কুইজ ও সার্টিফিকেট পেতে কোর্সে ভর্তি হতে হবে।',
    previewSeeCourse: 'কোর্সের বিস্তারিত দেখুন',
  },

  /** Product detail page. */
  product: {
    featureGroups: 'ফিচার গ্রুপ',
    specifications: 'স্পেসিফিকেশন',
    digitalDelivery: 'ডিজিটাল ডেলিভারি — অ্যাকাউন্ট থেকে ডাউনলোড',
    checksumPublished: 'SHA-256 চেকসাম প্রকাশ করা হয়',
    paymentHosted: 'পেমেন্ট SSLCOMMERZ-এর hosted page-এ',
    beforeBuying: 'কেনার আগে',
    and: 'এবং',
    readThem: 'পড়ে নিন।',
    productivityAid:
      'সফটওয়্যারটি একটি productivity aid। চূড়ান্ত যাচাই ও পেশাগত দায়িত্ব যোগ্য ব্যবহারকারীর।',
  },

  /** Certificate verification page. */
  verify: {
    metaDescription: 'একটি সার্টিফিকেটের verification ID যাচাই করুন।',
    notFoundTitle: 'এই আইডির কোনো সার্টিফিকেট পাওয়া যায়নি',
    notFoundBody: 'আইডিটি আবার মিলিয়ে দেখুন। সন্দেহ হলে সাপোর্টে জানান।',
    valid: 'বৈধ সার্টিফিকেট',
    recipient: 'প্রাপক',
    course: 'কোর্স',
    issuedOn: 'ইস্যুর তারিখ',
    revokedTitle: 'এই সার্টিফিকেটটি আর বৈধ নয়',
    revokedBody: 'সার্টিফিকেটটি প্রত্যাহার করা হয়েছে।',
    note:
      'সার্টিফিকেট কেবল কোর্স সম্পন্ন হওয়ার প্রমাণ। এটি কোনো পেশাগত লাইসেন্স নয় এবং প্রকৌশল দায়িত্ব হস্তান্তর করে না।',
  },

  /** Release notes page. */
  release: {
    metaDescription:
      'NB Engineering Tools-এর প্রতিটি রিলিজে কী আছে, SHA-256 চেকসাম এবং code-signing অবস্থা।',
    intro:
      'ডাউনলোডের পরে সবসময় SHA-256 চেকসাম মিলিয়ে নিন। চেকসাম না মিললে ফাইলটি ব্যবহার করবেন না — সাপোর্টে জানান।',
    checksumHowTo: 'Windows PowerShell-এ চেকসাম বের করতে:',
    emptyTitle: 'এখনো কোনো রিলিজ প্রকাশ করা হয়নি',
    emptyDescription: 'রিলিজ প্রস্তুত হলে ভার্সন, চেকসাম ও সাইনিং অবস্থা এখানে দেখানো হবে।',
    published: 'প্রকাশ',
    available: 'ডাউনলোডের জন্য প্রস্তুত',
    notAvailable: 'এখনো প্রকাশিত হয়নি',
    fileSize: 'ফাইল সাইজ',
    sizeUnknown: 'নির্ধারিত হয়নি',
    checksumPending: 'ফাইল আপলোডের পর প্রকাশ করা হবে',
    signedTimestamped: 'ডিজিটালি সাইনড (টাইমস্ট্যাম্প সহ)',
    signed: 'ডিজিটালি সাইনড',
    unsigned: 'সাইন করা হয়নি',
    signingUnknown: 'সাইনিং অবস্থা নিশ্চিত করা হয়নি',
    releaseTested: 'রিলিজ টেস্ট সম্পন্ন',
    internalTested: 'অভ্যন্তরীণ টেস্ট সম্পন্ন',
    untested: 'রানটাইম টেস্ট রেকর্ড করা হয়নি',
  },

  footer: {
    explore: 'ঘুরে দেখুন',
    help: 'সহায়তা',
    contact: 'যোগাযোগ',
    legal: 'আইনি',
    useContactForm: 'যোগাযোগ ফর্ম ব্যবহার করুন',
    disclaimer:
      'সফটওয়্যার ও কনটেন্ট প্রকৌশল সহায়ক উপকরণ; চূড়ান্ত যাচাই ও পেশাগত দায়িত্ব যোগ্য ব্যবহারকারীর।',
  },

  /** Page names, used in breadcrumbs and in the footer link lists. */
  pageTitle: {
    about: 'পরিচিতি',
    resources: 'রিসোর্স',
    support: 'সাপোর্ট',
    supportInstallation: 'ইনস্টলেশন গাইড',
    supportActivation: 'অ্যাক্টিভেশন',
    supportLicenseRecovery: 'লাইসেন্স রিকভারি',
    supportSystemRequirements: 'সিস্টেম রিকোয়ারমেন্ট',
    supportReleaseNotes: 'রিলিজ নোট',
    faq: 'সাধারণ জিজ্ঞাসা',
    contact: 'যোগাযোগ',
    privacy: 'গোপনীয়তা নীতি',
    terms: 'ব্যবহারের শর্তাবলি',
    refund: 'রিফান্ড নীতি',
    eula: 'সফটওয়্যার লাইসেন্স চুক্তি (EULA)',
    courseTerms: 'কোর্স শর্তাবলি',
    disclaimer: 'ইঞ্জিনিয়ারিং দাবিত্যাগ',
    verify: 'সার্টিফিকেট যাচাই',
    topics: 'বিষয়',
    authors: 'লেখক',
  },

  /*
    Shown when an English reader lands on a page whose body has not been
    translated. The Bengali original is rendered underneath rather than hidden:
    a missing page would be worse than one the reader can at least run through
    a translator or ask about.
  */
  /** Error and empty shells that sit outside any one page. */
  errors: {
    notFoundTitle: 'পাতাটি খুঁজে পাওয়া যায়নি',
    notFoundBody: 'লিংকটি পুরোনো হতে পারে, অথবা কনটেন্টটি সরিয়ে নেওয়া হয়েছে।',
    backHome: 'হোমে ফিরুন',
    seeBlog: 'ব্লগ দেখুন',
    genericTitle: 'কিছু একটা ভুল হয়েছে',
    genericBody: 'পাতাটি লোড করা যায়নি। আবার চেষ্টা করুন, সমস্যা থাকলে সাপোর্টে জানান।',
    retry: 'আবার চেষ্টা করুন',
  },

  cms: {
    untranslatedTitle: 'এই পেজটি এখনো ইংরেজিতে নেই',
    untranslatedBody:
      'নিচের লেখাটি বাংলায় দেখানো হচ্ছে। ইংরেজি সংস্করণ প্রকাশ হলে এই নোটিশটি সরে যাবে।',
  },
};

// Derived from the Bengali entry, so a missing English string fails the build.
export type Dictionary = typeof bn;

const en: Dictionary = {
  brand: {
    role: 'RSE · nuruzzaman.com.bd',
    statement: 'Learn engineering. Work faster. Design with confidence.',
    heroSupport:
      'Practical engineering tutorials, verified technical articles, and NB Engineering Tools for AutoCAD — from Engr. Md. Nuruzzaman, RSE, in one place.',
  },

  nav: {
    home: 'Home',
    courses: 'Courses',
    tools: 'Engineering Tools',
    blog: 'Blog',
    resources: 'Resources',
    about: 'About',
    support: 'Support',
    primary: 'Primary menu',
    mobile: 'Mobile menu',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    skipToContent: 'Skip to main content',
  },

  navDescription: {
    courses: 'Practical engineering courses in Bangla',
    tools: 'NB Engineering Tools for AutoCAD',
    blog: 'Reviewed technical articles',
    resources: 'Checklists and templates',
    support: 'Installation, activation and licensing',
  },

  actions: {
    search: 'Search',
    cart: 'Cart',
    signIn: 'Sign in',
    signOut: 'Sign out',
    signingOut: 'Signing out…',
    account: 'Account',
    adminPanel: 'Admin panel',
    adminSignIn: 'Admin sign in',
    myAccount: 'My account',
    readMore: 'Read more',
    viewAll: 'View all',
  },

  language: {
    label: 'Language',
    current: 'Current language',
  },

  account: {
    signedInAs: 'Signed in as',
    navigation: 'Account navigation',
    emailUnverified:
      'Your email is not verified. Verification is required for downloads and activation.',
    signOutFailed:
      'We could not reach the server, so your session may still be open. Close your browser or try again.',
  },


  home: {
    metaTitle: 'Practical engineering education and tools',
    heroCtaTools: 'See NB Engineering Tools',
    heroCtaBlog: 'Read the articles',
    trustReviewed: 'Engineer-reviewed writing',
    trustReviewedDetail: 'States its units, assumptions and code edition',
    trustTested: 'Tested',
    trustPlatform: 'Windows 10 / 11, 64-bit',
    trustDownload: 'Secure downloads',
    trustDownloadDetail: 'SHA-256 checksums and account-based access',
    blogEyebrow: 'Latest',
    blogTitle: 'From the blog',
    blogDescription:
      'Every article carries a worked example, the assumptions it used, and where it stops being valid.',
    blogEmptyTitle: 'No articles published yet',
    blogEmptyDescription: 'Articles appear here once the engineering review is complete.',
    blogAll: 'All articles',
    toolsTitle: 'Structural and engineering toolset for AutoCAD',
    toolsDescription:
      '26 compiled VLX applications across seven feature groups. Works from the Ribbon and the classic pull-down menu alike.',
    compatibilityLabel: 'Compatibility:',
    compatibilityBody: "Per the owner's published document, the current commercial build targets",
    compatibilitySuffix: ' on Windows 10/11 64-bit.',
    compatibilityTested: 'Runtime-tested',
    compatibilityUntested: 'Compatibility with other versions must be confirmed separately.',
    productivityAid:
      'The software is a productivity aid. Final verification and professional responsibility remain with a qualified engineer.',
    toolsCta: 'More about the tools',
    productsAll: 'All products',
    coursesEyebrow: 'Courses',
    coursesTitle: 'Practical courses in Bangla',
    coursesDescription:
      'From the calculation to the drawing, with the units, assumptions and checks at every step.',
    coursesEmptyTitle: 'No courses published yet',
    coursesEmptyDescription:
      'The first courses are being written. A course is never listed until it has real lessons.',
    coursesEmptyCta: 'Read the blog meanwhile',
    coursesAll: 'All courses',
    supportEyebrow: 'Support',
    supportTitle: 'From installation to activation, step by step',
    supportDescription: 'The help pages people need most, in one place.',
  },


  meta: {
    '/': {
      title: 'Practical engineering education and tools',
      description:
        'Practical engineering tutorials, verified technical articles, and NB Engineering Tools for AutoCAD — from Engr. Md. Nuruzzaman, RSE.',
    },
    '/blog': {
      title: 'Blog — reviewed technical articles',
      description:
        'Writing on RCC design, foundations, BNBC and AutoCAD, each with a worked example and its assumptions stated.',
    },
    '/courses': {
      title: 'Courses — practical engineering',
      description:
        'Step-by-step courses on foundations, RCC design, quantity estimating and AutoCAD, taught in Bangla.',
    },
    '/engineering-tools': {
      title: 'NB Engineering Tools — structural toolset for AutoCAD',
      description:
        '26 compiled VLX modules for footing, pile cap, beam, slab, column and grid workflows.',
    },
    '/shop': {
      title: 'Products',
      description: 'NB Engineering Tools licences, NB Credit and courses.',
    },
    '/resources': {
      title: 'Resources',
      description: 'Checklists, templates and references.',
    },
    '/support': {
      title: 'Support',
      description: 'Installation, activation, licence recovery and system requirements.',
    },
    '/about': {
      title: 'About',
      description: 'Engr. Md. Nuruzzaman, RSE — experience, approach and contact.',
    },
    '/contact': {
      title: 'Contact',
      description: 'Questions, support, or anything to do with licensing.',
    },
    '/faq': {
      title: 'Frequently asked questions',
      description:
        'The questions people ask most about the software, licensing, tokens and courses.',
    },
    '/search': {
      title: 'Search',
      description: 'Search everything published on the site.',
    },
    '/verify': {
      title: 'Verify a certificate',
      description: 'Check a certificate against its verification ID.',
    },
    '/support/installation': {
      title: 'Installation guide',
      description:
        'The steps to install NB Engineering Tools, what it needs, and what usually goes wrong.',
    },
    '/support/activation': {
      title: 'Activation',
      description: 'How machine activation works and how to send an activation request.',
    },
    '/support/license-recovery': {
      title: 'Licence recovery',
      description:
        'Getting a licence back after changing computer or reinstalling Windows.',
    },
    '/support/release-notes': {
      title: 'Release notes',
      description:
        'What each release contains, its SHA-256 checksum and its code-signing status.',
    },
    '/support/system-requirements': {
      title: 'System requirements',
      description: 'Which AutoCAD versions and which Windows configurations it runs on.',
    },
    '/privacy-policy': {
      title: 'Privacy policy',
      description: 'What is collected, why it is collected, and how long it is kept.',
    },
    '/terms': {
      title: 'Terms of use',
      description: 'The terms for using this site and its services.',
    },
    '/refund-policy': {
      title: 'Refund policy',
      description: 'When a refund applies to a digital product or a course.',
    },
    '/software-eula': {
      title: 'Software licence agreement (EULA)',
      description: 'The licence terms for using NB Engineering Tools.',
    },
    '/course-terms': {
      title: 'Course terms',
      description: 'Terms covering enrolment, how long access lasts, and certificates.',
    },
    '/engineering-disclaimer': {
      title: 'Engineering disclaimer',
      description:
        'The limits of the software and the writing, and where professional responsibility sits.',
    },
  },


  common: {
    home: 'Home',
    all: 'All',
    filterByTopic: 'Filter by topic',
  },

  ui: {
    pagination: 'Pagination',
    previousPage: 'Previous page',
    nextPage: 'Next page',
    page: 'Page',
    loading: 'Loading',
    breadcrumb: 'Breadcrumb',
    tableOfContents: 'On this page',
    close: 'Close',
    required: '(required)',
    formHasErrors: 'There are problems with this form',
    discount: 'Discount',
    priceOnRequest: 'Contact us for pricing',
    certificate: 'Certificate',
    technicalReview: 'Technical review',
    lastUpdated: 'Last updated',
    reviewedBy: 'Reviewed by',
    legalDraftBody:
      'This policy has not yet been reviewed by a lawyer or other qualified professional. Once that review is complete this notice will disappear and the reviewer’s name and date will appear here instead.',
  },

  units: {
    hour: 'hour',
    hours: 'hours',
    minute: 'minute',
    minutes: 'minutes',
    read: 'read',
    lesson: 'lesson',
    lessons: 'lessons',
  },

  productType: {
    software_license: 'Software licence',
    credit_refill: 'Credit refill',
    course: 'Course',
    bundle: 'Bundle',
    digital_resource: 'Digital resource',
  },

  level: {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
  },

  taxonomy: {
    trackFilter: 'All tracks',
    filterLabel: 'Filter by subject',
    'foundation-geotechnical': 'Foundation & geotechnical',
    'rcc-design-detailing': 'RCC design & detailing',
    'structural-engineering': 'Structural engineering',
    'steel-design': 'Steel structure design',
    'autocad-productivity': 'AutoCAD & drafting',
    'engineering-software': 'Engineering software',
    'bnbc-code-application': 'BNBC & code application',
    'construction-quality': 'Construction quality & site practice',
    'quantity-estimation': 'Quantity & estimating',
    'mouza-drawing-workflow': 'Mouza map & land drawing',
  },

  blog: {
    heading: 'Blog',
    intro:
      'Every article gives a direct answer, a worked example, the assumptions it used, and where it stops being valid.',
    emptyTitle: 'Nothing here yet',
    emptyDescription: 'New articles will appear in this list as they are published.',
  },

  courses: {
    heading: 'Courses',
    intro:
      'Each course follows the order of a real job. A course is never listed until it has real lessons.',
    emptyTrackTitle: 'No courses in this track yet',
    emptyTitle: 'No courses published yet',
    emptyTrackDescription: 'Try another track, or read the blog on this subject.',
    emptyDescription: 'A course is not shown here until it has real lessons.',
    seeAll: 'See all courses',
    readBlog: 'Read the blog meanwhile',
    allTracks: 'All tracks',
    filterLabel: 'Filter by subject',
  },

  shop: {
    heading: 'Shop',
    intro:
      'Everything here is digital. After purchase, downloads and course access are tied to your account.',
    priceNotice:
      'Where a price has not been published, the page says “contact us for pricing” — no estimated figure is ever shown.',
    emptyTitle: 'No products published yet',
    emptyDescription: 'Products will appear here once they are published.',
    chooseVariant: 'Choose a variant',
    noVariants: 'No variant of this product has been published yet.',
    addToCart: 'Add to cart',
    adding: 'Adding\u2026',
    addFailed: 'It could not be added to the cart. Please try again.',
    added: 'Added to your cart.',
    viewCart: 'View cart',
    variantUnpriced:
      'No price has been published for this variant yet. Contact support to ask about pricing.',
  },

  search: {
    heading: 'Search',
    label: 'What are you looking for?',
    placeholder: 'e.g. footing, lap length, layer standard',
    submit: 'Search',
    tooShort: 'Type at least two characters to search.',
    noResultsDescription: 'Try different words, or browse the blog by topic.',
    nothingFound: 'nothing found',
    articles: 'Articles',
    courses: 'Courses',
    products: 'Products',
  },

  contact: {
    heading: 'Contact',
    intro:
      'If you have an account, opening a support ticket links it to your order and gets a faster answer. You can also write from this form without one.',
    direct: 'Direct',
    noDirectContact: 'Direct contact details have not been published yet; please use this form.',
    checkFirst: 'Check these first',
    securityNotice:
      'Never send a card number, a password or a licence file by email. We will never ask for them.',
    name: 'Your name',
    email: 'Email',
    subject: 'Subject',
    message: 'Message',
    messageHint: 'Quoting your order number or your AutoCAD version gets a faster answer.',
    send: 'Send message',
    sending: 'Sending\u2026',
    sentTitle: 'Message received',
    sentBody: 'Thank you. Your message has been received; the reply will come by email.',
    failed: 'The message could not be sent. Please try again in a little while.',
  },


  tools: {
    heading: 'Engineering Tools',
    productTitle: 'Structural & Engineering Design Tools for AutoCAD',
    lede:
      'A professional AutoCAD automation suite for footing, combined footing, pile cap, beam, slab, column, grid and geotechnical workflows. Works from the Ribbon and the classic pull-down menu alike.',
    compatibilityLabel: 'Compatibility:',
    compatibilityBody:
      'Per the published product document, the current commercial build targets',
    compatibilitySuffix: ' on Windows 10/11 64-bit.',
    testedVersions: 'Runtime-tested versions',
    untested:
      'Compatibility with other AutoCAD versions must be confirmed separately. No version is called tested without evidence of a runtime test.',
    verifiedFacts: 'Verified facts',
    moduleList: 'Module list',
    moduleIntro:
      ' compiled modules, grouped by the work they do. Each states its declared purpose — no claim is made about the accuracy, speed or code-compliance of what it produces, because none of that has been tested here.',
    moduleNote: 'Module behaviour may change and improve between versions.',
    licensing: 'Licensing, Machine ID and tokens',
    machineActivation: 'Machine activation',
    machineActivationBody:
      'Each supported computer generates a Machine ID, and the licence is bound to it.',
    tokenCredit: 'Token / credit',
    tokenCreditBody:
      'Activation grants the right to use the software; a token is credit for running a specific paid operation. An active licence still needs enough tokens for a paid operation.',
    tokenSpendHeading: 'How tokens are spent',
    tokenSpend1: 'Token cost is not the same for every tool.',
    tokenSpend2: 'Some tools charge per successful command session.',
    tokenSpend3Prefix: 'Some design tools charge per successful',
    tokenSpend3Strong: 'unique design',
    tokenSpend3Suffix:
      ' — selecting 24 footings that resolve to 2 unique designs is charged as 2.',
    tokenSpend4: 'A cancelled or failed operation may not be charged, depending on the tool.',
    reinstallLabel: 'Windows reinstall or format:',
    reinstallBody:
      'Local licence and token data may be erased. If the balance reaches zero there is no guarantee the previous tokens return automatically.',
    screenshotBody:
      'A clear screenshot taken no more than 30 minutes before the Windows setup may, after vendor verification, allow the remaining balance to be reissued. For the full conditions and exceptions see the',
    recoveryLink: 'licence recovery page',
    screenshotSuffix: '.',
    installation: 'Installation',
    installationBody:
      'After installing, opening AutoCAD gives you the NB Engineering Tools Ribbon. Then:',
    faq: 'Frequently asked questions',
    responsibilityLabel: 'Engineering responsibility:',
    responsibilityBody:
      'The software provides design and drawing automation, but the final engineering decision, design verification, code compliance, structural safety and drawing accuracy remain the responsibility of a qualified engineer. No automated result should be used as a final construction decision without independent engineering review.',
    loadFailed: 'Product information could not be loaded. Please try again shortly.',
    version: 'Version',
    platform: 'Platform',
    modules: 'Modules',
    checksumPending: 'Published once the file is released',
    supportLine: 'Technical and licence support:',
    verifiedFactsList: [
      'NB Engineering Tools v6.0',
      'Structural & Engineering Design Tools for AutoCAD',
      'Windows 10 / 11, 64-bit',
      '25 engineering/productivity modules + 1 core/security module = 26 compiled VLX modules',
      'AutoCAD Ribbon and classic pull-down menu',
      'Machine activation, token/credit licensing, signed activation and refill workflow',
      'Professional Windows Setup EXE',
      'Vendor-verified licence recovery',
      'Developer: Engr. Md. Nuruzzaman, RSE',
    ],
    installSteps: [
      'Get your Machine ID',
      'Complete the purchase and activation',
      'Apply the signed activation key',
      'Buy a token refill if you need one',
      'Start using the engineering tools',
    ],
  },

  post: {
    published: 'Published',
    updated: 'Updated',
    reviewPending:
      'Technical review is still outstanding \u2014 check the figures yourself before you rely on them.',
    educationalNotice:
      'This article is educational. Before applying any of it to a specific project, verify it independently against that project\u2019s geotechnical report, its loads and the codes that apply to it.',
    moreDetail: 'More detail',
    readMore: 'Read more',
    topicMetaSuffix: 'articles by topic',
    topicEmptyTitle: 'Nothing has been published on this topic yet',
    topicEmptyDescription: 'New articles will appear here as they are published.',
    authorWorks: 'Published articles',
    authorEmpty: 'Nothing published yet',
  },

  course: {
    sequential: 'Sequential',
    lastReviewed: 'Last reviewed',
    outcomes: 'What you will learn',
    audience: 'Who it is for',
    prerequisites: 'Prerequisites',
    requiredSoftware: 'Software you will need',
    curriculum: 'Curriculum',
    freePreview: 'Free preview',
    noLessons: 'No lessons have been added to this module yet.',
    reviewsHeading: 'Student reviews',
    reviewsNote: 'Only reviews from verified enrolments are published.',
    reviewFallbackTitle: 'Review',
    reviewFallbackAuthor: 'Student',
    verifiedEnrollment: 'verified enrolment',
    enroll: 'Enrol on this course',
    enrollClosed:
      'Enrolment for this course is not open yet. The price and the start date will appear here once they are published.',
    watchPreview: 'Watch the free preview',
    access: 'Access',
    days: 'days',
    accessUnpublished: 'Not published yet',
    certificateOnCompletion: 'On completing the course',
    certificateNone: 'None',
    support: 'Support',
    refund: 'Refund',
    certificateNote:
      'A certificate is evidence of course completion only; it is not a professional licence.',
    previewMetaSuffix: 'free preview',
    previewMetaDescription: 'A free preview lesson from the course.',
    previewNoVideo: 'The video for this lesson has not been added yet.',
    previewMoreHeading: 'What else the full course covers',
    previewMoreBody:
      'The remaining lessons, the practice files, the quizzes and the certificate all come with enrolment.',
    previewSeeCourse: 'See the course in full',
  },

  product: {
    featureGroups: 'Feature groups',
    specifications: 'Specifications',
    digitalDelivery: 'Digital delivery \u2014 download from your account',
    checksumPublished: 'A SHA-256 checksum is published',
    paymentHosted: 'Payment happens on the SSLCOMMERZ hosted page',
    beforeBuying: 'Before buying, read the',
    and: 'and the',
    readThem: '.',
    productivityAid:
      'The software is a productivity aid. Final checking and professional responsibility rest with the qualified user.',
  },

  verify: {
    metaDescription: 'Check a certificate against its verification ID.',
    notFoundTitle: 'No certificate was found for this ID',
    notFoundBody: 'Check the ID again. If you are still unsure, tell support.',
    valid: 'Valid certificate',
    recipient: 'Recipient',
    course: 'Course',
    issuedOn: 'Issued on',
    revokedTitle: 'This certificate is no longer valid',
    revokedBody: 'The certificate has been revoked.',
    note:
      'A certificate is evidence of course completion only. It is not a professional licence and it transfers no engineering responsibility.',
  },

  release: {
    metaDescription:
      'What each NB Engineering Tools release contains, its SHA-256 checksum and its code-signing status.',
    intro:
      'Always check the SHA-256 checksum after downloading. If the checksum does not match, do not use the file \u2014 tell support.',
    checksumHowTo: 'To read the checksum in Windows PowerShell:',
    emptyTitle: 'No release has been published yet',
    emptyDescription:
      'Once a release is ready its version, checksum and signing status will appear here.',
    published: 'Published',
    available: 'Ready to download',
    notAvailable: 'Not published yet',
    fileSize: 'File size',
    sizeUnknown: 'Not recorded',
    checksumPending: 'Published once the file has been uploaded',
    signedTimestamped: 'Digitally signed (with timestamp)',
    signed: 'Digitally signed',
    unsigned: 'Not signed',
    signingUnknown: 'Signing status not confirmed',
    releaseTested: 'Release testing complete',
    internalTested: 'Internal testing complete',
    untested: 'No runtime test recorded',
  },

  footer: {
    explore: 'Explore',
    help: 'Help',
    contact: 'Contact',
    legal: 'Legal',
    useContactForm: 'Use the contact form',
    disclaimer:
      'The software and the writing here are aids to engineering work; final checking and professional responsibility rest with the qualified user.',
  },

  pageTitle: {
    about: 'About',
    resources: 'Resources',
    support: 'Support',
    supportInstallation: 'Installation guide',
    supportActivation: 'Activation',
    supportLicenseRecovery: 'Licence recovery',
    supportSystemRequirements: 'System requirements',
    supportReleaseNotes: 'Release notes',
    faq: 'Frequently asked questions',
    contact: 'Contact',
    privacy: 'Privacy policy',
    terms: 'Terms of use',
    refund: 'Refund policy',
    eula: 'Software licence agreement (EULA)',
    courseTerms: 'Course terms',
    disclaimer: 'Engineering disclaimer',
    verify: 'Verify a certificate',
    topics: 'Topics',
    authors: 'Authors',
  },

  errors: {
    notFoundTitle: 'That page could not be found',
    notFoundBody: 'The link may be out of date, or the content may have been moved.',
    backHome: 'Back to the home page',
    seeBlog: 'Go to the blog',
    genericTitle: 'Something went wrong',
    genericBody: 'The page could not be loaded. Try again, and tell support if it keeps happening.',
    retry: 'Try again',
  },

  cms: {
    untranslatedTitle: 'This page is not available in English yet',
    untranslatedBody:
      'The text below is shown in Bengali. This notice will disappear once an English version is published.',
  },
};

const DICTIONARIES: Record<Locale, Dictionary> = { bn, en };

/** The dictionary for a locale. Never falls back across languages. */
export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
