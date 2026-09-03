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

  footer: {
    explore: 'ঘুরে দেখুন',
    help: 'সহায়তা',
    contact: 'যোগাযোগ',
    legal: 'আইনি',
  },
};

// Derived from the Bengali entry, so a missing English string fails the build.
export type Dictionary = typeof bn;

const en: Dictionary = {
  brand: {
    role: 'RSE · nuruzzaman.com.bd',
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

  footer: {
    explore: 'Explore',
    help: 'Help',
    contact: 'Contact',
    legal: 'Legal',
  },
};

const DICTIONARIES: Record<Locale, Dictionary> = { bn, en };

/** The dictionary for a locale. Never falls back across languages. */
export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
