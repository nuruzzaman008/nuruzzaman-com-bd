import type { Dictionary } from '@/lib/i18n/dictionary';

export type NavItem = {
  href: string;
  /**
   * A name that is the same in both languages - a product name, say. Every
   * other item carries a key instead, so that one set of words is translated
   * rather than two sets kept in step by hand.
   */
  label?: string;
  /** Key into `Dictionary['nav']`. */
  labelKey?: keyof Dictionary['nav'];
  /** Key into `Dictionary['pageTitle']`, for links named after a page. */
  titleKey?: keyof Dictionary['pageTitle'];
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

  // Nothing left to fall back to but the path, which at least says where the
  // link goes rather than rendering an empty control.
  return item.label ?? item.href;
}

/** Primary navigation, in the order the information architecture defines. */
export const primaryNav: NavItem[] = [
  { href: '/', labelKey: 'home' },
  { href: '/courses', labelKey: 'courses', descriptionKey: 'courses' },
  { href: '/engineering-tools', labelKey: 'tools', descriptionKey: 'tools' },
  { href: '/blog', labelKey: 'blog', descriptionKey: 'blog' },
  { href: '/resources', labelKey: 'resources', descriptionKey: 'resources' },
  { href: '/about', labelKey: 'about' },
  { href: '/support', labelKey: 'support', descriptionKey: 'support' },
];

export const supportNav: NavItem[] = [
  { href: '/support/installation', titleKey: 'supportInstallation' },
  { href: '/support/activation', titleKey: 'supportActivation' },
  { href: '/support/license-recovery', titleKey: 'supportLicenseRecovery' },
  { href: '/support/release-notes', titleKey: 'supportReleaseNotes' },
  { href: '/support/system-requirements', titleKey: 'supportSystemRequirements' },
  { href: '/faq', titleKey: 'faq' },
  { href: '/contact', titleKey: 'contact' },
];

export const legalNav: NavItem[] = [
  { href: '/privacy-policy', titleKey: 'privacy' },
  { href: '/terms', titleKey: 'terms' },
  { href: '/refund-policy', titleKey: 'refund' },
  { href: '/software-eula', titleKey: 'eula' },
  { href: '/course-terms', titleKey: 'courseTerms' },
  { href: '/engineering-disclaimer', titleKey: 'disclaimer' },
];

/**
 * The customer account nav.
 *
 * Keys rather than labels, for the same reason the admin nav uses them: this
 * is a signed-in application, its language follows the reader's choice, and a
 * hard-coded Bengali label put Bengali items under an English shell.
 */
export type AccountNavItem = { href: string; key: keyof Dictionary['account']['nav'] };

export const accountNav: AccountNavItem[] = [
  { href: '/account', key: 'overview' },
  { href: '/account/orders', key: 'orders' },
  { href: '/account/downloads', key: 'downloads' },
  { href: '/account/courses', key: 'courses' },
  { href: '/account/activation-requests', key: 'activationRequests' },
  { href: '/account/support', key: 'support' },
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
