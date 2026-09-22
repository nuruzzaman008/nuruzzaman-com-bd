/** Reads the notification page filters from its query string; anything unexpected falls back. */
export function notificationQuery(
  params: { filter?: string; category?: string; page?: string },
  categories: readonly string[],
): { filter: 'all' | 'unread'; category: string | null; page: number; api: string } {
  const filter = params.filter === 'unread' ? 'unread' : 'all';
  const category = categories.includes(params.category ?? '') ? (params.category as string) : null;
  const requested = Number.parseInt(params.page ?? '1', 10);
  const page = Number.isFinite(requested) && requested > 0 ? Math.min(requested, 10_000) : 1;

  const query = new URLSearchParams({ filter, page: String(page) });
  if (category) query.set('category', category);

  return { filter, category, page, api: query.toString() };
}

export const STAFF_CATEGORIES = [
  'orders',
  'licences',
  'support',
  'learning',
  'content',
  'users',
  'security',
] as const;

export const CUSTOMER_CATEGORIES = ['orders', 'licences', 'support', 'learning'] as const;

export const ADMIN_ROLES = ['super_admin', 'admin'];
