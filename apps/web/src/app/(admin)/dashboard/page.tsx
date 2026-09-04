import type { Metadata } from 'next';
import Link from 'next/link';
import type { AdminDashboard } from '@nuruzzaman/contracts';

import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { sessionApi } from '@/lib/api/server';
import { number, price } from '@/lib/format';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.nav.dashboard);
}

export default async function DashboardPage() {
  const { locale, t } = await adminDictionary();
  const response = await sessionApi<{ data: AdminDashboard }>('/admin/dashboard');
  const data = response.data;

  const attention = [
    {
      label: t.admin.dashboard.paymentsOnHold,
      value: data.attention.payments_on_risk_hold,
      href: '/dashboard/orders?status=pending_payment',
    },
    {
      label: t.admin.dashboard.openActivations,
      value: data.attention.activation_requests_open,
      href: '/dashboard/activation-requests',
    },
    {
      label: t.admin.dashboard.openTickets,
      value: data.attention.support_tickets_open,
      href: '/dashboard/support-tickets',
    },
    {
      label: t.admin.dashboard.postsInReview,
      value: data.attention.posts_in_review,
      href: '/dashboard/posts?status=in_review',
    },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-[length:var(--step-h1)] font-bold text-navy">
          {t.admin.nav.dashboard}
        </h1>
        <p className="mt-2 text-muted">
          {t.admin.dashboard.window.replace('{days}', number(data.window_days, locale))}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm text-muted">{t.admin.dashboard.settledRevenue}</p>
          <p className="mt-1 text-2xl font-bold text-navy">
            {price(data.revenue.settled_minor, data.revenue.currency, locale)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">{t.admin.dashboard.refunded}</p>
          <p className="mt-1 text-2xl font-bold text-navy">
            {price(data.revenue.refunded_minor, data.revenue.currency, locale)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">{t.admin.dashboard.paidOrders}</p>
          <p className="font-latin mt-1 text-2xl font-bold text-navy">
            {number(data.orders.paid, locale)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">{t.admin.dashboard.activeEnrollments}</p>
          <p className="font-latin mt-1 text-2xl font-bold text-navy">
            {number(data.learning.active_enrollments, locale)}
          </p>
        </Card>
      </div>

      <section>
        <h2 className="text-[length:var(--step-h2)] font-bold text-navy">
          {t.admin.dashboard.needsAttention}
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {attention.map((item) => (
            <li key={item.label}>
              <Card className="flex items-center justify-between gap-4 p-4">
                <Link href={item.href} className="text-sm font-medium text-navy hover:text-blue">
                  {item.label}
                </Link>
                <span
                  className={
                    item.value > 0
                      ? 'font-latin rounded-full bg-amber px-3 py-1 text-sm font-bold text-navy'
                      : 'font-latin rounded-full bg-surface px-3 py-1 text-sm font-bold text-muted'
                  }
                >
                  {number(item.value, locale)}
                </span>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {data.orders.pending > 0 ? (
        <Callout tone="info">
          {t.admin.dashboard.awaitingPayment.replace(
            '{count}',
            number(data.orders.pending, locale),
          )}
        </Callout>
      ) : null}
    </div>
  );
}
