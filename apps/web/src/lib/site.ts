import type { Dictionary } from '@/lib/i18n/dictionary';

export type NavItem = {
  href: string;
  /** Bengali label, used when an item has no dictionary key. */
  label: string;
  /**
   * Key into `Dictionary['nav']`. Items that carry one are translated; items
   * without one show `label` in both languages, which is right for names that
   * do not translate.
   */
  labelKey?: keyof Dictionary['nav'];
  /** Key into `Dictionary['pageTitle']`, for links named after a page. */
  titleKey?: keyof Dictionary['pageTitle'];
  description?: string;
  /** Key into `Dictionary['navDescription']`, for the mobile menu blurb. */
  descriptionKey?: keyof Dictionary['navDescription'];
};

/**
 * The label to show for a nav item, in the active language.
 *
 * Lives here rather than in the header so that server-rendered pages, which
 * cannot call `useLocale()`, can label the same lists the same way.
 */
export function navItemLabel(item: NavItem, t: Dictionary): string {
  if (item.labelKey) {
    return t.nav[item.labelKey];
  }

  if (item.titleKey) {
    return t.pageTitle[item.titleKey];
  }

  return item.label;
}

/** Primary navigation, in the order the information architecture defines. */
export const primaryNav: NavItem[] = [
  { href: '/', label: 'হোম', labelKey: 'home' },
  { href: '/courses', label: 'কোর্স', labelKey: 'courses', descriptionKey: 'courses', description: 'বাংলায় প্র্যাকটিক্যাল ইঞ্জিনিয়ারিং কোর্স' },
  {
    href: '/engineering-tools',
    label: 'ইঞ্জিনিয়ারিং টুলস',
    labelKey: 'tools',
    descriptionKey: 'tools',
    description: 'AutoCAD-এর জন্য NB Engineering Tools',
  },
  { href: '/blog', label: 'ব্লগ', labelKey: 'blog', descriptionKey: 'blog', description: 'যাচাই করা টেকনিক্যাল আর্টিকেল' },
  { href: '/resources', label: 'রিসোর্স', labelKey: 'resources', descriptionKey: 'resources', description: 'চেকলিস্ট ও টেমপ্লেট' },
  { href: '/about', label: 'পরিচিতি', labelKey: 'about' },
  { href: '/support', label: 'সাপোর্ট', labelKey: 'support', descriptionKey: 'support', description: 'ইনস্টলেশন, অ্যাক্টিভেশন ও লাইসেন্স' },
];

export const supportNav: NavItem[] = [
  { href: '/support/installation', label: 'ইনস্টলেশন গাইড', titleKey: 'supportInstallation' },
  { href: '/support/activation', label: 'অ্যাক্টিভেশন', titleKey: 'supportActivation' },
  {
    href: '/support/license-recovery',
    label: 'লাইসেন্স রিকভারি',
    titleKey: 'supportLicenseRecovery',
  },
  { href: '/support/release-notes', label: 'রিলিজ নোট', titleKey: 'supportReleaseNotes' },
  {
    href: '/support/system-requirements',
    label: 'সিস্টেম রিকোয়ারমেন্ট',
    titleKey: 'supportSystemRequirements',
  },
  { href: '/faq', label: 'সাধারণ জিজ্ঞাসা', titleKey: 'faq' },
  { href: '/contact', label: 'যোগাযোগ', titleKey: 'contact' },
];

export const legalNav: NavItem[] = [
  { href: '/privacy-policy', label: 'গোপনীয়তা নীতি', titleKey: 'privacy' },
  { href: '/terms', label: 'ব্যবহারের শর্তাবলি', titleKey: 'terms' },
  { href: '/refund-policy', label: 'রিফান্ড নীতি', titleKey: 'refund' },
  { href: '/software-eula', label: 'সফটওয়্যার EULA', titleKey: 'eula' },
  { href: '/course-terms', label: 'কোর্স শর্তাবলি', titleKey: 'courseTerms' },
  { href: '/engineering-disclaimer', label: 'ইঞ্জিনিয়ারিং দাবিত্যাগ', titleKey: 'disclaimer' },
];

export const accountNav: NavItem[] = [
  { href: '/account', label: 'ওভারভিউ' },
  { href: '/account/orders', label: 'অর্ডার' },
  { href: '/account/downloads', label: 'ডাউনলোড' },
  { href: '/account/courses', label: 'আমার কোর্স' },
  { href: '/account/activation-requests', label: 'অ্যাক্টিভেশন রিকোয়েস্ট' },
  { href: '/account/support', label: 'সাপোর্ট টিকিট' },
];

/** An admin nav item. Its label is always a dictionary key. */
export type DashboardNavItem = { href: string; key: keyof Dictionary['admin']['nav'] };

export function dashboardNavLabel(item: DashboardNavItem, t: Dictionary): string {
  return t.admin.nav[item.key];
}

export const dashboardNav: {
  headingKey: keyof Dictionary['admin']['group'];
  items: DashboardNavItem[];
}[] = [
  {
    headingKey: 'overview',
    items: [{ href: '/dashboard', key: 'dashboard' }],
  },
  {
    headingKey: 'content',
    items: [
      { href: '/dashboard/posts', key: 'posts' },
      { href: '/dashboard/pages', key: 'pages' },
      { href: '/dashboard/media', key: 'media' },
      { href: '/dashboard/comments', key: 'comments' },
      { href: '/dashboard/redirects', key: 'redirects' },
    ],
  },
  {
    headingKey: 'commerce',
    items: [
      { href: '/dashboard/products', key: 'products' },
      { href: '/dashboard/orders', key: 'orders' },
      { href: '/dashboard/releases', key: 'releases' },
    ],
  },
  {
    headingKey: 'learning',
    items: [{ href: '/dashboard/courses', key: 'courses' }],
  },
  {
    headingKey: 'support',
    items: [
      { href: '/dashboard/activation-requests', key: 'activationRequests' },
      { href: '/dashboard/support-tickets', key: 'tickets' },
    ],
  },
  {
    headingKey: 'platform',
    items: [
      { href: '/dashboard/users', key: 'users' },
      { href: '/dashboard/settings', key: 'settings' },
      { href: '/dashboard/audit-log', key: 'auditLog' },
    ],
  },
];

export const brand = {
  statement: 'প্রকৌশল শিখুন। কাজ দ্রুত করুন। আত্মবিশ্বাসের সঙ্গে ডিজাইন করুন।',
  heroSupport:
    'Engr. Md. Nuruzzaman, RSE-এর practical engineering tutorials, verified technical articles এবং AutoCAD-এর জন্য NB Engineering Tools—এক জায়গায়।',
  owner: 'Engr. Md. Nuruzzaman, RSE',
} as const;

/**
 * Page slugs live in the CMS without a slash, so a nested route maps to a
 * flat slug. Keeping the mapping in one place stops the two drifting apart.
 */
export const pageSlugForPath: Record<string, string> = {
  '/about': 'about',
  '/resources': 'resources',
  '/support': 'support',
  '/support/installation': 'support-installation',
  '/support/activation': 'support-activation',
  '/support/license-recovery': 'support-license-recovery',
  '/support/release-notes': 'support-release-notes',
  '/support/system-requirements': 'support-system-requirements',
  '/faq': 'faq',
  '/privacy-policy': 'privacy-policy',
  '/terms': 'terms',
  '/refund-policy': 'refund-policy',
  '/software-eula': 'software-eula',
  '/course-terms': 'course-terms',
  '/engineering-disclaimer': 'engineering-disclaimer',
};
