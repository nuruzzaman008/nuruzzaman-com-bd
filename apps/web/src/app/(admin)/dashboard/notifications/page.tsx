import type { Metadata } from 'next';
import type { NotificationList as NotificationListData, User } from '@nuruzzaman/contracts';

import { NotificationList } from '@/features/notifications/notification-list';
import { NotificationTabs } from '@/features/notifications/notification-tabs';
import { ADMIN_ROLES, notificationQuery, STAFF_CATEGORIES } from '@/features/notifications/query';
import { sessionApi } from '@/lib/api/server';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.notifications.title);
}

/** Read once per request, so every row on the page agrees about "now". */
function requestTime(): number {
  return Date.now();
}

/** Dashboard -> Notifications: everything the dashboard has told this staff member. */
export default async function StaffNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; category?: string; page?: string }>;
}) {
  const { locale, t } = await adminDictionary();
  const query = notificationQuery(await searchParams, STAFF_CATEGORIES);
  const [list, me] = await Promise.all([
    sessionApi<NotificationListData>(`/admin/notifications?${query.api}&locale=${locale}`),
    sessionApi<{ data: User }>('/me'),
  ]);

  return (
    <div className="max-w-4xl">
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">{t.notifications.title}</h1>
      <p className="mt-2 text-sm text-muted">{t.notifications.intro}</p>
      <NotificationTabs
        t={t.notifications}
        current="inbox"
        showEmailLog={me.data.roles.some((role) => ADMIN_ROLES.includes(role))}
      />
      <NotificationList
        scope="admin"
        basePath="/dashboard/notifications"
        initial={list}
        filter={query.filter}
        category={query.category}
        categories={[...STAFF_CATEGORIES]}
        renderedAt={requestTime()}
      />
    </div>
  );
}
