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

  /*
    The on-page SEO checks shown in the editor.

    Written as findings rather than commands, and deliberately plain: these
    catch a missing description or a keyword absent from the title. They are not
    a ranking prediction, and the panel says so.
  */
  seoCheck: {
    kind: { post: 'আর্টিকেল', course: 'কোর্স', product: 'প্রোডাক্ট' },

    groups: {
      basic: 'মৌলিক SEO',
      additional: 'অতিরিক্ত',
      title: 'টাইটেল ও ডেসক্রিপশন',
      readability: 'পাঠযোগ্যতা',
    },

    keywordInTitleYes: 'ফোকাস কিওয়ার্ড SEO টাইটেলে আছে।',
    keywordInTitleNo: 'ফোকাস কিওয়ার্ড SEO টাইটেলে নেই।',
    keywordInTitleHint: 'সার্চ ফলাফলে টাইটেলই সবচেয়ে বড় সংকেত।',

    keywordInDescriptionYes: 'ফোকাস কিওয়ার্ড মেটা ডেসক্রিপশনে আছে।',
    keywordInDescriptionNo: 'ফোকাস কিওয়ার্ড মেটা ডেসক্রিপশনে নেই।',
    keywordInDescriptionHint: 'সার্চ ফলাফলে কিওয়ার্ড মোটা অক্ষরে দেখায়, তাতে ক্লিক বাড়ে।',

    keywordInSlugYes: 'ফোকাস কিওয়ার্ড URL-এ আছে।',
    keywordInSlugNo: 'ফোকাস কিওয়ার্ড URL-এ নেই।',
    keywordInSlugHint: 'প্রকাশের পর slug বদলালে পুরোনো লিংক ভাঙে — এটি প্রকাশের আগেই ঠিক করুন।',

    keywordInOpeningYes: 'লেখার প্রথম ১০%-এ ফোকাস কিওয়ার্ড আছে।',
    keywordInOpeningNo: 'লেখার প্রথম ১০%-এ ফোকাস কিওয়ার্ড নেই।',
    keywordInOpeningHint: 'পাঠক ও ক্রলার দুজনেই শুরুতেই বোঝে লেখাটি কী নিয়ে।',

    keywordInContentYes: 'মূল লেখায় ফোকাস কিওয়ার্ড {count} বার আছে।',
    keywordInContentNo: 'মূল লেখায় ফোকাস কিওয়ার্ড নেই।',

    contentLength: '{noun}ের দৈর্ঘ্য {words} শব্দ (লক্ষ্য {target}+)।',
    contentLengthHint:
      'শব্দসংখ্যা নিজে কোনো র‍্যাঙ্কিং ফ্যাক্টর নয়; খুব ছোট লেখা সাধারণত প্রশ্নের উত্তর দেয় না।',

    keywordInHeadingYes: 'কোনো সাবহেডিংয়ে ফোকাস কিওয়ার্ড আছে।',
    keywordInHeadingNo: 'কোনো সাবহেডিংয়ে ফোকাস কিওয়ার্ড নেই।',

    keywordInAltYes: 'কোনো ছবির alt টেক্সটে ফোকাস কিওয়ার্ড আছে।',
    keywordInAltNo: 'কোনো ছবির alt টেক্সটে ফোকাস কিওয়ার্ড নেই।',
    keywordInAltHint:
      'alt টেক্সট প্রথমত স্ক্রিন রিডারের জন্য — ছবিতে যা আছে তাই লিখুন, কিওয়ার্ড জোর করে নয়।',

    density: 'কিওয়ার্ড ডেনসিটি {value}%।',
    densityHigh: 'অস্বাভাবিক বেশি — পাঠকের কাছে জোর করে বসানো মনে হতে পারে।',
    densityNormal: 'নির্দিষ্ট কোনো আদর্শ মান নেই; স্বাভাবিক ভাষাই যথেষ্ট।',

    slugMissing: 'URL slug দেওয়া হয়নি।',
    slugLength: 'URL {count} অক্ষর দীর্ঘ।',

    internalLinksYes: 'সাইটের ভেতরে {count}টি লিংক আছে।',
    internalLinksNo: 'সাইটের ভেতরের কোনো লিংক নেই।',
    internalLinksHint: 'সম্পর্কিত লেখায় লিংক দিলে পাঠক ও ক্রলার দুজনেরই পথ তৈরি হয়।',

    externalLinksYes: 'বাইরের {count}টি রেফারেন্স লিংক আছে।',
    externalLinksNo: 'বাইরের কোনো রেফারেন্স লিংক নেই।',
    externalLinksHint: 'কোড, স্ট্যান্ডার্ড বা উৎসের লিংক দাবিগুলো যাচাইযোগ্য করে।',

    titleMissing: 'SEO টাইটেল দেওয়া হয়নি।',
    titleLength: 'SEO টাইটেল {count} অক্ষর (২৫–৬৫ ভালো)।',
    titleLengthHint: 'বেশি লম্বা হলে সার্চ ফলাফলে কেটে যায়।',

    titleStartsYes: 'টাইটেল ফোকাস কিওয়ার্ড দিয়ে শুরু হয়েছে।',
    titleStartsNo: 'টাইটেল ফোকাস কিওয়ার্ড দিয়ে শুরু হয়নি।',
    titleStartsHint:
      'শুরুতে থাকলে চোখে আগে পড়ে; বাক্য অস্বাভাবিক হলে এটি উপেক্ষা করাই ভালো।',

    descriptionMissing: 'মেটা ডেসক্রিপশন দেওয়া হয়নি।',
    descriptionLength: 'মেটা ডেসক্রিপশন {count} অক্ষর (১১০–১৬০ ভালো)।',

    titleHasNumber: 'টাইটেলে সংখ্যা আছে।',
    titleNoNumber: 'টাইটেলে কোনো সংখ্যা নেই।',
    titleNumberHint:
      'ঐচ্ছিক — সংখ্যা থাকলে তালিকা বা ধাপভিত্তিক লেখায় ক্লিক বাড়ে, সব লেখায় নয়।',

    noHeadings: 'কোনো সাবহেডিং নেই।',
    headingCount: '{count}টি সাবহেডিং আছে।',
    headingHint: 'সাবহেডিং ছাড়া লম্বা লেখা স্ক্যান করা যায় না।',

    paragraphsShort: 'অনুচ্ছেদগুলো ছোট ও পাঠযোগ্য।',
    paragraphsLong: '{count}টি অনুচ্ছেদ ১৫০ শব্দের বেশি।',

    imagesYes: '{count}টি ছবি আছে।',
    imagesNo: 'কোনো ছবি বা ডায়াগ্রাম নেই।',
    imagesHint: 'হিসাব বা ধাপভিত্তিক লেখায় একটি চিত্র অনেক ব্যাখ্যা বাঁচায়।',

    altAllPresent: 'প্রতিটি ছবির alt টেক্সট আছে।',
    altMissing: '{count}টি ছবির alt টেক্সট নেই।',
    altHint:
      'alt টেক্সট ছাড়া ছবি স্ক্রিন রিডারে অদৃশ্য — এটি অ্যাক্সেসিবিলিটির শর্ত, শুধু SEO নয়।',

    excerptLength: 'সারসংক্ষেপ {count} অক্ষর।',
    excerptMissing: 'সারসংক্ষেপ দেওয়া হয়নি।',
    excerptHint: 'তালিকা ও কার্ডে এটিই দেখানো হয়; না থাকলে লেখার শুরুটা কেটে দেখানো হয়।',
  },

  /*
    Status values the API returns as machine names.

    Kept beside every other label rather than in the component that renders a
    badge, because the same order status appears in the admin, in the customer's
    order list and in an email.
  */
  status: {
    order: {
      draft: 'খসড়া',
      pending_payment: 'পেমেন্টের অপেক্ষায়',
      paid: 'পরিশোধিত',
      fulfilled: 'সম্পন্ন',
      failed: 'ব্যর্থ',
      cancelled: 'বাতিল',
      refund_pending: 'রিফান্ড প্রক্রিয়াধীন',
      partially_refunded: 'আংশিক রিফান্ড',
      refunded: 'রিফান্ড হয়েছে',
    },
    enrollment: {
      active: 'চলছে',
      completed: 'সম্পন্ন',
      expired: 'মেয়াদ শেষ',
      revoked: 'বাতিল',
    },
    ticket: {
      open: 'খোলা',
      pending: 'অপেক্ষমাণ',
      resolved: 'সমাধান হয়েছে',
      closed: 'বন্ধ',
    },
    activation: {
      submitted: 'জমা হয়েছে',
      in_review: 'যাচাই চলছে',
      approved: 'অনুমোদিত',
      rejected: 'প্রত্যাখ্যাত',
      cancelled: 'বাতিল',
    },
    comment: {
      pending: 'অপেক্ষমাণ',
      approved: 'অনুমোদিত',
      rejected: 'বাতিল',
      spam: 'স্প্যাম',
    },
    content: {
      draft: 'খসড়া',
      in_review: 'রিভিউয়ে',
      scheduled: 'নির্ধারিত',
      published: 'প্রকাশিত',
      archived: 'সংরক্ষিত',
    },
  },

  /** Reader comments and star ratings at the foot of an article. */
  comments: {
    heading: 'পাঠকের মন্তব্য',
    empty: 'এই লেখায় এখনো কোনো মন্তব্য নেই। প্রথমটি আপনিই লিখতে পারেন।',
    formHeading: 'মন্তব্য লিখুন',
    bodyLabel: 'আপনার মন্তব্য',
    bodyPlaceholder: 'কোন অংশটি কাজে লেগেছে, বা কোথায় আরও ব্যাখ্যা দরকার?',
    ratingLabel: 'রেটিং',
    ratingOptional: '(ঐচ্ছিক)',
    starCount: '{count} তারা',
    clearRating: 'রেটিং সরান',
    outOfFive: '৫-এর মধ্যে {value}',
    fromCount: '{count} জনের রেটিং',
    send: 'মন্তব্য পাঠান',
    sending: 'পাঠানো হচ্ছে…',
    held: 'ধন্যবাদ। মন্তব্যটি জমা হয়েছে; পর্যালোচনার পরে পাতায় দেখা যাবে।',
    moderationNote:
      'প্রতিটি মন্তব্য প্রকাশের আগে পড়ে দেখা হয়, তাই সঙ্গে সঙ্গে পাতায় দেখা যাবে না।',
    signInPrompt: 'মন্তব্য করতে সাইন ইন করুন। এতে স্প্যাম ঠেকানো সহজ হয়।',
    alreadyCommented: 'এই লেখায় আপনি ইতিমধ্যে একটি মন্তব্য করেছেন।',
    failed: 'মন্তব্য পাঠানো যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।',
  },

  /*
    The signed-in admin panel.

    Its language is a preference rather than a URL - see lib/i18n/admin-locale.ts
    - and it defaults to English. Everything an editor reads while working lives
    under this key.
  */
  admin: {
    shellTitle: 'অ্যাডমিন',
    navLabel: 'ড্যাশবোর্ড নেভিগেশন',

    group: {
      overview: 'ওভারভিউ',
      content: 'কনটেন্ট',
      commerce: 'কমার্স',
      learning: 'শিক্ষা',
      support: 'সাপোর্ট',
      platform: 'প্ল্যাটফর্ম',
    },

    nav: {
      dashboard: 'ড্যাশবোর্ড',
      posts: 'আর্টিকেল',
      pages: 'পেজ',
      media: 'মিডিয়া',
      comments: 'মন্তব্য',
      redirects: 'রিডাইরেক্ট',
      products: 'প্রোডাক্ট',
      orders: 'অর্ডার',
      releases: 'রিলিজ ও ডাউনলোড',
      courses: 'কোর্স',
      activationRequests: 'অ্যাক্টিভেশন',
      tickets: 'টিকিট',
      users: 'ব্যবহারকারী',
      settings: 'সেটিংস',
      auditLog: 'অডিট লগ',
    },

    /** Words that appear on nearly every admin screen. */
    common: {
      status: 'অবস্থা',
      actions: 'কার্যক্রম',
      created: 'তৈরি',
      updated: 'হালনাগাদ',
      published: 'প্রকাশিত',
      title: 'শিরোনাম',
      name: 'নাম',
      email: 'ইমেইল',
      role: 'রোল',
      price: 'দাম',
      type: 'ধরন',
      slug: 'স্লাগ',
      date: 'তারিখ',
      view: 'দেখুন',
      edit: 'সম্পাদনা',
      save: 'সংরক্ষণ',
      saving: 'সংরক্ষণ হচ্ছে…',
      saved: 'সংরক্ষিত হয়েছে',
      cancel: 'বাতিল',
      search: 'খুঁজুন',
      filter: 'ফিল্টার',
      all: 'সব',
      none: 'নেই',
      notSet: 'নির্ধারিত হয়নি',
      loadFailed: 'তথ্য আনা যায়নি। পাতাটি রিফ্রেশ করুন।',
      saveFailed: 'সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।',
    },

    dashboard: {
      window: 'গত {days} দিনের হিসাব। শুধু যাচাই হওয়া পেমেন্ট আয় হিসেবে গণনা করা হয়।',
      settledRevenue: 'নিষ্পত্তি হওয়া আয়',
      refunded: 'ফেরত',
      paidOrders: 'পরিশোধিত অর্ডার',
      activeEnrollments: 'সক্রিয় এনরোলমেন্ট',
      needsAttention: 'মনোযোগ প্রয়োজন',
      paymentsOnHold: 'ঝুঁকি হিসেবে চিহ্নিত পেমেন্ট',
      openActivations: 'খোলা অ্যাক্টিভেশন রিকোয়েস্ট',
      openTickets: 'খোলা সাপোর্ট টিকিট',
      postsInReview: 'রিভিউয়ের অপেক্ষায় আর্টিকেল',
      awaitingPayment:
        '{count} টি অর্ডার এখনো পেমেন্টের অপেক্ষায়। Reconciliation প্রতি ১৫ মিনিটে গেটওয়ের সঙ্গে মিলিয়ে দেখে।',
    },

    filterByStatus: 'অবস্থা অনুযায়ী ছাঁকুন',

    posts: {
      caption: 'আর্টিকেলের তালিকা',
      empty: 'কোনো আর্টিকেল নেই',
      unpublished: 'অপ্রকাশিত',
      review: 'রিভিউ',
      reviewed: 'রিভিউ হয়েছে',
      awaitingReview: 'রিভিউ বাকি',
    },

    orders: {
      caption: 'অর্ডারের তালিকা',
      empty: 'কোনো অর্ডার নেই',
      order: 'অর্ডার',
      customer: 'গ্রাহক',
      total: 'মোট',
    },

    courses: {
      caption: 'কোর্সের তালিকা',
      empty: 'কোনো কোর্স নেই',
      publishRule: 'অন্তত একটি লেসন যুক্ত না করা পর্যন্ত কোনো কোর্স প্রকাশ করা যায় না।',
      level: 'স্তর',
      lessons: 'লেসন',
      analysis: 'বিশ্লেষণ',
      draft: 'খসড়া',
    },

    /** The comment moderation queue. */
    commentQueue: {
      title: 'পাঠকের মন্তব্য',
      caption: 'মন্তব্যের তালিকা',
      empty: 'এই তালিকায় কোনো মন্তব্য নেই।',
      pendingNotice:
        'অনুমোদন না দেওয়া পর্যন্ত কোনো মন্তব্য পাতায়, গণনায় বা structured data-তে দেখা যায় না।',
      author: 'লেখক',
      comment: 'মন্তব্য',
      article: 'আর্টিকেল',
      rating: 'রেটিং',
      noRating: 'রেটিং দেননি',
      approve: 'অনুমোদন',
      reject: 'বাতিল',
      spam: 'স্প্যাম',
      working: 'প্রক্রিয়া চলছে…',
      failed: 'কাজটি সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।',
      filterLabel: 'অবস্থা অনুযায়ী দেখুন',
    },

    tickets: {
      title: 'সাপোর্ট টিকিট',
      caption: 'সাপোর্ট টিকিটের তালিকা',
      empty: 'কোনো টিকিট নেই',
      reference: 'রেফারেন্স',
      subject: 'বিষয়',
      category: 'ক্যাটাগরি',
      opened: 'খোলা হয়েছে',
    },

    media: {
      altAdvice: 'প্রতিটি ছবির জন্য alt টেক্সট লিখুন। alt ছাড়া ছবি প্রকাশ করলে অ্যাক্সেসিবিলিটি ভাঙে।',
      empty: 'কোনো মিডিয়া আপলোড করা হয়নি',
      noAlt: 'Alt টেক্সট নেই',
    },

    auditLog: {
      privacyNote: 'পাসওয়ার্ড, টোকেন এবং সম্পূর্ণ Machine ID লগে লেখার আগেই মুছে ফেলা হয়।',
      caption: 'অডিট লগ',
      empty: 'কোনো রেকর্ড নেই',
      event: 'ঘটনা',
      actor: 'কে',
      subject: 'বিষয়',
      when: 'কখন',
      system: 'সিস্টেম',
    },

    users: {
      roleRule:
        'রোল পরিবর্তন শুধু super admin করতে পারেন এবং নিজের অ্যাকাউন্টে নয়। পরিবর্তনের আগে পাসওয়ার্ড নিশ্চিতকরণ লাগে।',
      searchLabel: 'নাম বা ইমেইল দিয়ে খুঁজুন',
      searchPlaceholder: 'নাম বা ইমেইল',
      caption: 'ব্যবহারকারীর তালিকা',
      empty: 'কোনো ব্যবহারকারী পাওয়া যায়নি',
      verified: 'যাচাই হয়েছে',
      unverified: 'যাচাই হয়নি',
    },

    products: {
      priceRule:
        'দাম প্রকাশ না করা পর্যন্ত ভ্যারিয়েন্টটি বিক্রয়যোগ্য নয় এবং সাইটে “দাম জানতে যোগাযোগ করুন” দেখায়।',
      caption: 'প্রোডাক্টের তালিকা',
      empty: 'কোনো প্রোডাক্ট নেই',
      product: 'প্রোডাক্ট',
      variants: 'ভ্যারিয়েন্ট',
      noPrice: 'দাম প্রকাশ করা হয়নি',
      analysis: 'বিশ্লেষণ',
    },

    pages: {
      legalRule: 'আইনি পাতাগুলো পেশাগত পর্যালোচনা রেকর্ড না হওয়া পর্যন্ত DRAFT নোটিশ দেখায়।',
      caption: 'পেজের তালিকা',
      empty: 'কোনো পেজ নেই',
      template: 'টেমপ্লেট',
      legalReview: 'আইনি পর্যালোচনা',
      notApplicable: 'প্রযোজ্য নয়',
      awaiting: 'অপেক্ষমাণ',
      done: 'সম্পন্ন',
    },

    redirects: {
      rule: 'উৎস ও গন্তব্য দুটোই সাইট-আপেক্ষিক পথ হতে হবে, তাই এটি কখনো ওপেন রিডাইরেক্ট হতে পারে না।',
      caption: 'রিডাইরেক্টের তালিকা',
      empty: 'কোনো রিডাইরেক্ট নেই',
      source: 'উৎস',
      destination: 'গন্তব্য',
      code: 'কোড',
    },

    activations: {
      title: 'অ্যাক্টিভেশন রিকোয়েস্ট',
      maskNote:
        'Machine ID সবসময় মাস্ক করা অবস্থায় দেখানো হয়; সম্পূর্ণ মান সার্ভারে এনক্রিপ্ট করা থাকে।',
      caption: 'অ্যাক্টিভেশন রিকোয়েস্টের তালিকা',
      empty: 'কোনো রিকোয়েস্ট নেই',
      reference: 'রেফারেন্স',
      submitted: 'জমা',
      reviewTitle: 'রিকোয়েস্ট রিভিউ',
      details: 'রিকোয়েস্টের তথ্য',
      maskedMachineId: 'Machine ID (মাস্ক করা)',
      order: 'অর্ডার',
      licence: 'লাইসেন্স',
      customerNote: 'গ্রাহকের নোট',
      secretsWarning:
        'এই ওয়েবসাইটে কোনো signing key, token বা recovery ফাইল সংরক্ষণ করা হয় না। গ্রাহকের রেসপন্সে কখনো সেরকম কিছু লিখবেন না।',
      history: 'ইতিহাস',
    },

    orderDetail: {
      title: 'অর্ডারের বিস্তারিত',
      itemsCaption: 'অর্ডারের আইটেম',
      item: 'আইটেম',
      quantity: 'পরিমাণ',
      statusHistory: 'অবস্থার ইতিহাস',
    },

    releases: {
      storageNote:
        'ইনস্টলার সবসময় প্রাইভেট ডিস্কে থাকে, কখনো Next.js-এর /public ফোল্ডারে বা পাবলিক বাকেটে নয়। চেকসাম আপলোড করা বাইট থেকে সার্ভারেই হিসাব করা হয়। ফাইল আপলোড না করা পর্যন্ত রিলিজ উপলব্ধ করা যায় না।',
      caption: 'রিলিজের তালিকা',
      empty: 'কোনো রিলিজ নেই',
      release: 'রিলিজ',
      noVersion: 'ভার্সন নেই',
      file: 'ফাইল',
      notUploaded: 'আপলোড হয়নি',
      notComputed: 'হিসাব করা হয়নি',
      signing: 'সাইনিং',
      available: 'উপলব্ধ',
      notPublished: 'প্রকাশিত নয়',
    },

    settings: {
      title: 'সাইট সেটিংস',
      envNote:
        'দাম, ফোন, ঠিকানা, সাপোর্ট সময়, SSLCOMMERZ ক্রেডেনশিয়াল এবং আইনি অনুমোদনের মতো মানগুলো এখানে নয়, সার্ভারের environment-এ রাখা হয়। তালিকা:',
      empty: 'কোনো সেটিং নেই',
      emptyHint: 'সিডার চালালে ডিফল্ট সেটিংস তৈরি হবে।',
    },


    postEditor: {
      sendToReview: 'রিভিউতে পাঠান',
      publish: 'প্রকাশ করুন',
      backToDraft: 'খসড়ায় ফেরত',
      publishNow: 'এখনই প্রকাশ',
      archive: 'আর্কাইভ',
      saveFailed: 'সংরক্ষণ করা যায়নি।',
      statusFailed: 'অবস্থা পরিবর্তন করা যায়নি।',
      saved: 'সংরক্ষিত হয়েছে। আগের সংস্করণটি রিভিশন হিসেবে রাখা হয়েছে।',
      title: 'শিরোনাম',
      slug: 'স্লাগ',
      slugHint: 'ছোট হাতের অক্ষর ও হাইফেন',
      excerpt: 'সারসংক্ষেপ',
      body: 'মূল লেখা (Markdown)',
      bodyHint: 'Raw HTML রেন্ডারের সময় বাদ দেওয়া হয়; শুধু Markdown ব্যবহার করুন।',
      funnelStage: 'ফানেল স্টেজ',
      searchIntent: 'সার্চ ইনটেন্ট',
      choose: 'নির্বাচন করুন',
      focusKeyword: 'ফোকাস কিওয়ার্ড',
      focusHint: 'যে শব্দগুচ্ছে এই লেখাটি খুঁজে পাওয়া উচিত। নিচের বিশ্লেষণ এর সাপেক্ষেই হয়।',
      currentStatus: 'বর্তমান অবস্থা',
      reviewWarning: 'ইঞ্জিনিয়ার রিভিউ রেকর্ড করা হয়নি। রিভিউ ছাড়া প্রকাশ করা উচিত নয়।',
    },

    activationReview: {
      startReview: 'রিভিউ শুরু করুন',
      needsInfo: 'আরও তথ্য দরকার',
      reject: 'বাতিল করুন',
      approve: 'অনুমোদন করুন',
      backToReview: 'রিভিউতে ফেরত',
      markComplete: 'সম্পন্ন হিসেবে চিহ্নিত করুন',
      finalState: 'এই রিকোয়েস্টটি চূড়ান্ত অবস্থায় আছে; আর কোনো পরিবর্তন করা যাবে না।',
      updated: 'রিকোয়েস্ট হালনাগাদ করা হয়েছে।',
      failed: 'হালনাগাদ করা যায়নি।',
      heading: 'রিভিউ',
      newStatus: 'নতুন অবস্থা',
      internalNote: 'অভ্যন্তরীণ নোট',
      internalHint: 'শুধু স্টাফ দেখতে পাবে',
      customerResponse: 'গ্রাহকের জন্য রেসপন্স',
      customerHint: 'কখনো token, key বা recovery ফাইল এখানে লিখবেন না।',
      historyNote: 'ইতিহাসে নোট',
      notifyCustomer: 'গ্রাহককে ইমেইলে জানান',
      update: 'হালনাগাদ করুন',
    },

    seoPanel: {
      title: 'SEO বিশ্লেষণ',
      pass: 'ঠিক আছে',
      warn: 'বিবেচনা করুন',
      fail: 'সমস্যা',
      summary: '{passed} ঠিক · {warned} বিবেচনা · {failed} সমস্যা',
      noKeyword:
        'স্কোর ফোকাস কিওয়ার্ডের ওপর ভিত্তি করে হিসাব হয়, তাই কিওয়ার্ড না দেওয়া পর্যন্ত স্কোর দেখানো হচ্ছে না। কিওয়ার্ড দিলে কিওয়ার্ড-ভিত্তিক চেকগুলো ও স্কোর — দুটোই চালু হবে। এখন শুধু দৈর্ঘ্য ও গঠনের চেক দেখানো হচ্ছে।',
      scoreLocked: 'স্কোর নেই',
      scoreLockedHint: 'ফোকাস কিওয়ার্ড দিলে স্কোর দেখা যাবে।',
      disclaimer:
        'এগুলো পরিচ্ছন্নতার চেক — কোনো র‍্যাঙ্কিংয়ের প্রতিশ্রুতি নয়। সব সবুজ হলেই লেখা ভালো হয়ে যায় না, আর কিছু হলুদ থাকলেও সমস্যা নেই।',
    },

    settingsForm: {
      invalidJson: 'এটি বৈধ JSON নয়।',
      saved: 'সেটিংস সংরক্ষিত হয়েছে।',
      failed: 'সংরক্ষণ করা যায়নি।',
      group: 'গ্রুপ',
      public: 'পাবলিক',
      internal: 'অভ্যন্তরীণ',
      valueLabel: 'মান (JSON)',
      saveAll: 'সব সংরক্ষণ করুন',
    },

    seoEditor: {
      failed: 'সংরক্ষণ করা যায়নি।',
      saved: 'সংরক্ষিত হয়েছে।',
      focusKeyword: 'ফোকাস কিওয়ার্ড',
      focusHint: 'যে শব্দগুচ্ছে এটি খুঁজে পাওয়া উচিত। পাশের বিশ্লেষণ এর সাপেক্ষেই হয়।',
    },

    orderActions: {
      failed: 'অনুরোধটি সম্পন্ন হয়নি।',
      changeStatus: 'অবস্থা পরিবর্তন',
      statusChanged: 'অবস্থা পরিবর্তন করা হয়েছে।',
      newStatus: 'নতুন অবস্থা',
      reason: 'কারণ',
      reasonHint: 'অডিট লগে সংরক্ষিত হবে',
      change: 'পরিবর্তন করুন',
      refundRequest: 'রিফান্ড অনুরোধ',
      refundCeiling: 'সর্বোচ্চ {amount} ফেরত দেওয়া যাবে। অনুমোদন আলাদা ধাপ।',
      refundCreated: 'রিফান্ড অনুরোধ তৈরি হয়েছে; অনুমোদনের অপেক্ষায়।',
      amountLabel: 'পরিমাণ (minor unit)',
      amountHint: '১০০ = ১ টাকা',
      revokeLabel: 'অ্যাক্সেস প্রত্যাহার করবেন?',
      revokeYes: 'হ্যাঁ, ডাউনলোড ও কোর্স প্রত্যাহার করুন',
      revokeNo: 'না, অ্যাক্সেস রেখে দিন',
      requestRefund: 'রিফান্ড অনুরোধ করুন',
    },

    editPost: 'আর্টিকেল সম্পাদনা',
    productSeo: 'প্রোডাক্টের SEO',
    courseSeo: 'কোর্সের SEO',
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

  seoCheck: {
    kind: { post: 'article', course: 'course', product: 'product' },

    groups: {
      basic: 'Basic SEO',
      additional: 'Additional',
      title: 'Title and description',
      readability: 'Readability',
    },

    keywordInTitleYes: 'The focus keyword is in the SEO title.',
    keywordInTitleNo: 'The focus keyword is not in the SEO title.',
    keywordInTitleHint: 'The title is the strongest signal in a search result.',

    keywordInDescriptionYes: 'The focus keyword is in the meta description.',
    keywordInDescriptionNo: 'The focus keyword is not in the meta description.',
    keywordInDescriptionHint:
      'A search result shows the keyword in bold, which earns more clicks.',

    keywordInSlugYes: 'The focus keyword is in the URL.',
    keywordInSlugNo: 'The focus keyword is not in the URL.',
    keywordInSlugHint:
      'Changing a slug after publishing breaks the old links - settle it before publishing.',

    keywordInOpeningYes: 'The focus keyword appears in the first 10% of the text.',
    keywordInOpeningNo: 'The focus keyword is missing from the first 10% of the text.',
    keywordInOpeningHint:
      'A reader and a crawler both work out what this is about from the opening.',

    keywordInContentYes: 'The focus keyword appears {count} time(s) in the body.',
    keywordInContentNo: 'The focus keyword does not appear in the body.',

    contentLength: 'The {noun} is {words} words long (target {target}+).',
    contentLengthHint:
      'Word count is not a ranking factor in itself; a very short piece usually does not answer the question.',

    keywordInHeadingYes: 'The focus keyword appears in a subheading.',
    keywordInHeadingNo: 'The focus keyword appears in no subheading.',

    keywordInAltYes: 'The focus keyword appears in an image alt text.',
    keywordInAltNo: 'The focus keyword appears in no image alt text.',
    keywordInAltHint:
      'Alt text is for screen readers first - describe what the image shows rather than forcing the keyword in.',

    density: 'Keyword density {value}%.',
    densityHigh: 'Unusually high - it may read as forced.',
    densityNormal: 'There is no ideal figure; ordinary language is enough.',

    slugMissing: 'No URL slug has been set.',
    slugLength: 'The URL is {count} characters long.',

    internalLinksYes: 'There are {count} link(s) to other pages on the site.',
    internalLinksNo: 'There are no links to other pages on the site.',
    internalLinksHint:
      'Linking to related writing gives both the reader and the crawler a route onward.',

    externalLinksYes: 'There are {count} outward reference link(s).',
    externalLinksNo: 'There are no outward reference links.',
    externalLinksHint:
      'Linking a code, a standard or a source is what makes a claim checkable.',

    titleMissing: 'No SEO title has been set.',
    titleLength: 'The SEO title is {count} characters (25-65 is good).',
    titleLengthHint: 'Too long and it is cut off in a search result.',

    titleStartsYes: 'The title begins with the focus keyword.',
    titleStartsNo: 'The title does not begin with the focus keyword.',
    titleStartsHint:
      'It catches the eye sooner at the start; ignore this when it makes the sentence read oddly.',

    descriptionMissing: 'No meta description has been set.',
    descriptionLength: 'The meta description is {count} characters (110-160 is good).',

    titleHasNumber: 'The title contains a number.',
    titleNoNumber: 'The title contains no number.',
    titleNumberHint:
      'Optional - a number earns clicks on a list or a step-by-step piece, not on everything.',

    noHeadings: 'There are no subheadings.',
    headingCount: 'There are {count} subheading(s).',
    headingHint: 'A long piece without subheadings cannot be scanned.',

    paragraphsShort: 'The paragraphs are short and readable.',
    paragraphsLong: '{count} paragraph(s) run past 150 words.',

    imagesYes: 'There are {count} image(s).',
    imagesNo: 'There is no image or diagram.',
    imagesHint: 'On a calculation or a step-by-step piece, one figure saves a lot of explaining.',

    altAllPresent: 'Every image has alt text.',
    altMissing: '{count} image(s) have no alt text.',
    altHint:
      'An image without alt text is invisible to a screen reader - this is an accessibility requirement, not only SEO.',

    excerptLength: 'The summary is {count} characters.',
    excerptMissing: 'No summary has been set.',
    excerptHint:
      'This is what lists and cards show; without it the opening of the text is cut down instead.',
  },

  status: {
    order: {
      draft: 'Draft',
      pending_payment: 'Awaiting payment',
      paid: 'Paid',
      fulfilled: 'Fulfilled',
      failed: 'Failed',
      cancelled: 'Cancelled',
      refund_pending: 'Refund in progress',
      partially_refunded: 'Partially refunded',
      refunded: 'Refunded',
    },
    enrollment: {
      active: 'In progress',
      completed: 'Completed',
      expired: 'Expired',
      revoked: 'Revoked',
    },
    ticket: {
      open: 'Open',
      pending: 'Pending',
      resolved: 'Resolved',
      closed: 'Closed',
    },
    activation: {
      submitted: 'Submitted',
      in_review: 'In review',
      approved: 'Approved',
      rejected: 'Rejected',
      cancelled: 'Cancelled',
    },
    comment: {
      pending: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected',
      spam: 'Spam',
    },
    content: {
      draft: 'Draft',
      in_review: 'In review',
      scheduled: 'Scheduled',
      published: 'Published',
      archived: 'Archived',
    },
  },

  comments: {
    heading: 'Reader comments',
    empty: 'No comments on this article yet. Yours can be the first.',
    formHeading: 'Leave a comment',
    bodyLabel: 'Your comment',
    bodyPlaceholder: 'What was useful, or where would more explanation help?',
    ratingLabel: 'Rating',
    ratingOptional: '(optional)',
    starCount: '{count} star(s)',
    clearRating: 'Clear rating',
    outOfFive: '{value} out of 5',
    fromCount: '{count} rating(s)',
    send: 'Post comment',
    sending: 'Sending\u2026',
    held: 'Thank you. Your comment has been received and will appear once it has been read.',
    moderationNote:
      'Every comment is read before it is published, so it will not appear on the page straight away.',
    signInPrompt: 'Sign in to comment. It keeps the spam out.',
    alreadyCommented: 'You have already commented on this article.',
    failed: 'The comment could not be sent. Please try again in a little while.',
  },

  admin: {
    shellTitle: 'Admin',
    navLabel: 'Dashboard navigation',

    group: {
      overview: 'Overview',
      content: 'Content',
      commerce: 'Commerce',
      learning: 'Learning',
      support: 'Support',
      platform: 'Platform',
    },

    nav: {
      dashboard: 'Dashboard',
      posts: 'Articles',
      pages: 'Pages',
      media: 'Media',
      comments: 'Comments',
      redirects: 'Redirects',
      products: 'Products',
      orders: 'Orders',
      releases: 'Releases & downloads',
      courses: 'Courses',
      activationRequests: 'Activations',
      tickets: 'Tickets',
      users: 'Users',
      settings: 'Settings',
      auditLog: 'Audit log',
    },

    common: {
      status: 'Status',
      actions: 'Actions',
      created: 'Created',
      updated: 'Updated',
      published: 'Published',
      title: 'Title',
      name: 'Name',
      email: 'Email',
      role: 'Role',
      price: 'Price',
      type: 'Type',
      slug: 'Slug',
      date: 'Date',
      view: 'View',
      edit: 'Edit',
      save: 'Save',
      saving: 'Saving\u2026',
      saved: 'Saved',
      cancel: 'Cancel',
      search: 'Search',
      filter: 'Filter',
      all: 'All',
      none: 'None',
      notSet: 'Not set',
      loadFailed: 'That could not be loaded. Refresh the page.',
      saveFailed: 'That could not be saved. Please try again.',
    },

    dashboard: {
      window:
        'The last {days} days. Only payments that have settled are counted as revenue.',
      settledRevenue: 'Settled revenue',
      refunded: 'Refunded',
      paidOrders: 'Paid orders',
      activeEnrollments: 'Active enrolments',
      needsAttention: 'Needs attention',
      paymentsOnHold: 'Payments held as risky',
      openActivations: 'Open activation requests',
      openTickets: 'Open support tickets',
      postsInReview: 'Articles awaiting review',
      awaitingPayment:
        '{count} order(s) are still awaiting payment. Reconciliation checks against the gateway every 15 minutes.',
    },

    filterByStatus: 'Filter by status',

    posts: {
      caption: 'List of articles',
      empty: 'No articles yet',
      unpublished: 'Unpublished',
      review: 'Review',
      reviewed: 'Reviewed',
      awaitingReview: 'Review outstanding',
    },

    orders: {
      caption: 'List of orders',
      empty: 'No orders yet',
      order: 'Order',
      customer: 'Customer',
      total: 'Total',
    },

    courses: {
      caption: 'List of courses',
      empty: 'No courses yet',
      publishRule: 'A course cannot be published until it holds at least one lesson.',
      level: 'Level',
      lessons: 'Lessons',
      analysis: 'Analysis',
      draft: 'Draft',
    },

    commentQueue: {
      title: 'Reader comments',
      caption: 'List of comments',
      empty: 'No comments in this list.',
      pendingNotice:
        'Until it is approved, a comment appears nowhere - not on the page, not in the count, not in the structured data.',
      author: 'Author',
      comment: 'Comment',
      article: 'Article',
      rating: 'Rating',
      noRating: 'Not rated',
      approve: 'Approve',
      reject: 'Reject',
      spam: 'Spam',
      working: 'Working…',
      failed: 'That could not be done. Please try again.',
      filterLabel: 'Filter by status',
    },

    tickets: {
      title: 'Support tickets',
      caption: 'List of support tickets',
      empty: 'No tickets yet',
      reference: 'Reference',
      subject: 'Subject',
      category: 'Category',
      opened: 'Opened',
    },

    media: {
      altAdvice:
        'Write alt text for every image. Publishing one without it breaks accessibility.',
      empty: 'No media uploaded yet',
      noAlt: 'No alt text',
    },

    auditLog: {
      privacyNote:
        'Passwords, tokens and full Machine IDs are stripped before anything is written to the log.',
      caption: 'Audit log',
      empty: 'No records yet',
      event: 'Event',
      actor: 'Who',
      subject: 'Subject',
      when: 'When',
      system: 'System',
    },

    users: {
      roleRule:
        'Only a super admin can change a role, and never their own. The change needs a password confirmation first.',
      searchLabel: 'Search by name or email',
      searchPlaceholder: 'Name or email',
      caption: 'List of users',
      empty: 'No users found',
      verified: 'Verified',
      unverified: 'Not verified',
    },

    products: {
      priceRule:
        'Until a price is published the variant cannot be sold, and the site says “contact us for pricing”.',
      caption: 'List of products',
      empty: 'No products yet',
      product: 'Product',
      variants: 'Variants',
      noPrice: 'No price published',
      analysis: 'Analysis',
    },

    pages: {
      legalRule:
        'Legal pages keep a DRAFT notice until a professional review has been recorded.',
      caption: 'List of pages',
      empty: 'No pages yet',
      template: 'Template',
      legalReview: 'Legal review',
      notApplicable: 'Not applicable',
      awaiting: 'Awaiting',
      done: 'Done',
    },

    redirects: {
      rule:
        'Both the source and the destination have to be site-relative paths, so this can never become an open redirect.',
      caption: 'List of redirects',
      empty: 'No redirects yet',
      source: 'Source',
      destination: 'Destination',
      code: 'Code',
    },

    activations: {
      title: 'Activation requests',
      maskNote:
        'A Machine ID is always shown masked; the full value is stored encrypted on the server.',
      caption: 'List of activation requests',
      empty: 'No requests yet',
      reference: 'Reference',
      submitted: 'Submitted',
      reviewTitle: 'Review request',
      details: 'Request details',
      maskedMachineId: 'Machine ID (masked)',
      order: 'Order',
      licence: 'Licence',
      customerNote: 'Customer note',
      secretsWarning:
        'No signing key, token or recovery file is ever stored on this website. Never write anything of that kind into a response to a customer.',
      history: 'History',
    },

    orderDetail: {
      title: 'Order detail',
      itemsCaption: 'Order items',
      item: 'Item',
      quantity: 'Quantity',
      statusHistory: 'Status history',
    },

    releases: {
      storageNote:
        'The installer always lives on a private disk, never in the Next.js /public folder or a public bucket. The checksum is computed on the server from the uploaded bytes. A release cannot be made available until its file has been uploaded.',
      caption: 'List of releases',
      empty: 'No releases yet',
      release: 'Release',
      noVersion: 'No version',
      file: 'File',
      notUploaded: 'Not uploaded',
      notComputed: 'Not computed',
      signing: 'Signing',
      available: 'Available',
      notPublished: 'Not published',
    },

    settings: {
      title: 'Site settings',
      envNote:
        'Values such as prices, phone number, address, support hours, SSLCOMMERZ credentials and legal approval are not kept here but in the server environment. The list:',
      empty: 'No settings yet',
      emptyHint: 'Running the seeder creates the default settings.',
    },


    postEditor: {
      sendToReview: 'Send for review',
      publish: 'Publish',
      backToDraft: 'Back to draft',
      publishNow: 'Publish now',
      archive: 'Archive',
      saveFailed: 'That could not be saved.',
      statusFailed: 'The status could not be changed.',
      saved: 'Saved. The previous version has been kept as a revision.',
      title: 'Title',
      slug: 'Slug',
      slugHint: 'Lower case and hyphens',
      excerpt: 'Summary',
      body: 'Body (Markdown)',
      bodyHint: 'Raw HTML is stripped when rendering; use Markdown only.',
      funnelStage: 'Funnel stage',
      searchIntent: 'Search intent',
      choose: 'Choose',
      focusKeyword: 'Focus keyword',
      focusHint:
        'The phrase this article should be found for. The analysis below is measured against it.',
      currentStatus: 'Current status',
      reviewWarning:
        'No engineer review has been recorded. This should not be published without one.',
    },

    activationReview: {
      startReview: 'Start the review',
      needsInfo: 'More information needed',
      reject: 'Reject',
      approve: 'Approve',
      backToReview: 'Back to review',
      markComplete: 'Mark as complete',
      finalState: 'This request is in a final state; it cannot be changed any further.',
      updated: 'The request has been updated.',
      failed: 'That could not be updated.',
      heading: 'Review',
      newStatus: 'New status',
      internalNote: 'Internal note',
      internalHint: 'Only staff can see this',
      customerResponse: 'Response to the customer',
      customerHint: 'Never write a token, a key or a recovery file here.',
      historyNote: 'Note for the history',
      notifyCustomer: 'Email the customer',
      update: 'Update',
    },

    seoPanel: {
      title: 'SEO analysis',
      pass: 'Fine',
      warn: 'Worth a look',
      fail: 'Problem',
      summary: '{passed} fine · {warned} worth a look · {failed} problem(s)',
      noKeyword:
        'The score is calculated against the focus keyword, so no score is shown until one is set. Setting a keyword turns on both the keyword checks and the score. For now only the length and structure checks are shown.',
      scoreLocked: 'No score',
      scoreLockedHint: 'Set a focus keyword to see the score.',
      disclaimer:
        'These are tidiness checks, not a ranking promise. All green does not make the writing good, and a few amber ones are not a problem.',
    },

    settingsForm: {
      invalidJson: 'That is not valid JSON.',
      saved: 'Settings saved.',
      failed: 'That could not be saved.',
      group: 'Group',
      public: 'Public',
      internal: 'Internal',
      valueLabel: 'Value (JSON)',
      saveAll: 'Save all',
    },

    seoEditor: {
      failed: 'That could not be saved.',
      saved: 'Saved.',
      focusKeyword: 'Focus keyword',
      focusHint:
        'The phrase this should be found for. The analysis beside it is measured against this.',
    },

    orderActions: {
      failed: 'The request did not go through.',
      changeStatus: 'Change status',
      statusChanged: 'The status has been changed.',
      newStatus: 'New status',
      reason: 'Reason',
      reasonHint: 'Recorded in the audit log',
      change: 'Change',
      refundRequest: 'Refund request',
      refundCeiling: 'At most {amount} can be refunded. Approval is a separate step.',
      refundCreated: 'The refund request has been created and is awaiting approval.',
      amountLabel: 'Amount (minor units)',
      amountHint: '100 = 1 taka',
      revokeLabel: 'Revoke access?',
      revokeYes: 'Yes, revoke the downloads and the courses',
      revokeNo: 'No, leave access in place',
      requestRefund: 'Request refund',
    },

    editPost: 'Edit article',
    productSeo: 'Product SEO',
    courseSeo: 'Course SEO',
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
