import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { NotificationEmailLog, User } from '@nuruzzaman/contracts';

import { EmailLog } from '@/features/notifications/email-log';
import { NotificationTabs } from '@/features/notifications/notification-tabs';
import { ADMIN_ROLES } from '@/features/notifications/query';
import { sessionApi } from '@/lib/api/server';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.notifications.emailLog);
}

const STATUSES = ['all', 'pending', 'sent', 'failed'] as const;
const SOURCES = ['all', 'notification', 'mail'] as const;

/**
 * Dashboard -> Notifications -> Email log. The API allows super admins and
 * admins only; the tab is hidden from everyone else, and this page is a 404
 * for them rather than a broken list.
 */
export default async function EmailLogPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; source?: string; page?: string }>;
}) {
  const { locale, t } = await adminDictionary();
  const me = await sessionApi<{ data: User }>('/me');
  if (!me.data.roles.some((role) => ADMIN_ROLES.includes(role))) notFound();

  const params = await searchParams;
  const status = STATUSES.find((item) => item === params.status) ?? 'all';
  const source = SOURCES.find((item) => item === params.source) ?? 'all';
  const requested = Number.parseInt(params.page ?? '1', 10);
  const page = Number.isFinite(requested) && requested > 0 ? requested : 1;
  const log = await sessionApi<NotificationEmailLog>(
    `/admin/notification-emails?status=${status}&source=${source}&page=${page}&locale=${locale}`,
  );

  return (
    <div className="max-w-5xl">
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">
        {t.notifications.emailLog}
      </h1>
      <NotificationTabs t={t.notifications} current="emails" showEmailLog />
      <EmailLog initial={log} status={status} source={source} />
    </div>
  );
}
