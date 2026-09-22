import type { Metadata } from 'next';
import type { NotificationPreference, User } from '@nuruzzaman/contracts';

import { BrowserAlerts, EmailPreferences } from '@/features/notifications/notification-settings';
import { NotificationTabs } from '@/features/notifications/notification-tabs';
import { ADMIN_ROLES } from '@/features/notifications/query';
import { sessionApi } from '@/lib/api/server';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.notifications.settingsTitle);
}

/** Dashboard -> Notifications -> Settings: email per category, and alerts in this browser. */
export default async function NotificationSettingsPage() {
  const { t } = await adminDictionary();
  const [preferences, me] = await Promise.all([
    sessionApi<{ data: NotificationPreference[] }>('/me/notification-preferences'),
    sessionApi<{ data: User }>('/me'),
  ]);

  return (
    <div className="max-w-3xl">
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">
        {t.notifications.settingsTitle}
      </h1>
      <NotificationTabs
        t={t.notifications}
        current="settings"
        showEmailLog={me.data.roles.some((role) => ADMIN_ROLES.includes(role))}
      />
      <div className="mt-5 grid gap-5">
        <EmailPreferences initial={preferences.data} />
        <BrowserAlerts allHref="/dashboard/notifications" />
      </div>
    </div>
  );
}
