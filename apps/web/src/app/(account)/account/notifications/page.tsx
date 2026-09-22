import type { Metadata } from 'next';
import type {
  NotificationList as NotificationListData,
  NotificationPreference,
} from '@nuruzzaman/contracts';

import { NotificationList } from '@/features/notifications/notification-list';
import { BrowserAlerts, EmailPreferences } from '@/features/notifications/notification-settings';
import { CUSTOMER_CATEGORIES, notificationQuery } from '@/features/notifications/query';
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

/** Account -> Notifications: news about the customer's own orders, requests, tickets and courses. */
export default async function AccountNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; category?: string; page?: string }>;
}) {
  const { locale, t } = await adminDictionary();
  const query = notificationQuery(await searchParams, CUSTOMER_CATEGORIES);
  const [list, preferences] = await Promise.all([
    sessionApi<NotificationListData>(`/me/notifications?${query.api}&locale=${locale}`),
    sessionApi<{ data: NotificationPreference[] }>('/me/notification-preferences'),
  ]);

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">{t.notifications.title}</h1>
      <p className="mt-2 text-sm text-muted">{t.notifications.intro}</p>
      <NotificationList
        scope="me"
        basePath="/account/notifications"
        initial={list}
        filter={query.filter}
        category={query.category}
        categories={[...CUSTOMER_CATEGORIES]}
        renderedAt={requestTime()}
      />
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <EmailPreferences initial={preferences.data} />
        <BrowserAlerts allHref="/account/notifications" />
      </div>
    </div>
  );
}
