import type { Metadata } from 'next';
import Link from 'next/link';
import type { DownloadEntitlement, Enrollment, Order, User } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { sessionApi } from '@/lib/api/server';
import { date, number, price } from '@/lib/format';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';
import { statusLabel } from '@/lib/status';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.customer.title);
}

export default async function AccountOverviewPage() {
  const { locale, t } = await adminDictionary();

  const [me, orders, enrollments, downloads] = await Promise.all([
    sessionApi<{ data: User }>('/me'),
    sessionApi<{ data: Order[] }>('/account/orders'),
    sessionApi<{ data: Enrollment[] }>('/account/courses'),
    sessionApi<{ data: DownloadEntitlement[] }>('/account/downloads'),
  ]);

  const latestOrder = orders.data[0] ?? null;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-[length:var(--step-h1)] font-bold text-navy">
          {t.customer.welcome.replace('{name}', me.data.name)}
        </h1>
        <p className="mt-2 text-muted">{t.customer.overviewIntro}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: t.account.nav.orders, value: orders.data.length, href: '/account/orders' },
          { label: t.account.nav.courses, value: enrollments.data.length, href: '/account/courses' },
          {
            label: t.account.nav.downloads,
            value: downloads.data.length,
            href: '/account/downloads',
          },
        ].map((stat) => (
          <Card key={stat.href} className="p-5">
            <p className="text-sm text-muted">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold text-navy">{number(stat.value, locale)}</p>
            <Link href={stat.href} className="mt-2 inline-block text-sm text-blue hover:underline">
              {t.customer.view}
            </Link>
          </Card>
        ))}
      </div>

      {latestOrder ? (
        <Card className="p-6">
          <h2 className="font-bold text-navy">{t.customer.latestOrder}</h2>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-latin font-semibold text-navy">{latestOrder.number}</p>
              <p className="text-sm text-muted">
                {date(latestOrder.placed_at, locale) ?? '—'} ·{' '}
                {price(latestOrder.total_minor, latestOrder.currency, locale)}
              </p>
            </div>
            <Badge tone={latestOrder.status === 'fulfilled' ? 'success' : 'info'}>
              {statusLabel('order', latestOrder.status, locale)}
            </Badge>
          </div>
          <Link
            href={`/account/orders/${latestOrder.number}`}
            className="mt-4 inline-block text-sm text-blue hover:underline"
          >
            {t.customer.orderDetails}
          </Link>
        </Card>
      ) : null}
    </div>
  );
}
