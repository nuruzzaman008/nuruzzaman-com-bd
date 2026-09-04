import type { Metadata } from 'next';
import Link from 'next/link';
import type { Order } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/states';
import { sessionApi } from '@/lib/api/server';
import { date, price } from '@/lib/format';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';
import { statusLabel } from '@/lib/status';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.nav.orders);
}

const STATUSES = [
  'pending_payment',
  'paid',
  'fulfilled',
  'failed',
  'refund_pending',
  'refunded',
] as const;

export default async function DashboardOrdersPage(props: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { locale, t } = await adminDictionary();
  const searchParams = await props.searchParams;

  const orders = await sessionApi<{ data: Order[] }>('/admin/orders', {
    query: { status: searchParams.status, q: searchParams.q },
  });

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">{t.admin.nav.orders}</h1>

      <nav aria-label={t.admin.filterByStatus} className="mt-5 flex flex-wrap gap-2">
        <Link
          href="/dashboard/orders"
          className="inline-flex min-h-9 items-center rounded-full border border-line bg-white px-3 text-sm font-medium text-navy hover:border-blue"
        >
          {t.admin.common.all}
        </Link>
        {STATUSES.map((status) => (
          <Link
            key={status}
            href={`/dashboard/orders?status=${status}`}
            className="inline-flex min-h-9 items-center rounded-full border border-line bg-white px-3 text-sm font-medium text-navy hover:border-blue"
          >
            {statusLabel('order', status, locale)}
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        <DataTable
          caption={t.admin.orders.caption}
          rows={orders.data}
          getRowKey={(order) => order.number}
          empty={<EmptyState title={t.admin.orders.empty} />}
          columns={[
            {
              key: 'number',
              header: t.admin.orders.order,
              render: (order) => (
                <Link
                  href={`/dashboard/orders/${order.number}`}
                  className="font-latin font-semibold text-blue hover:underline"
                >
                  {order.number}
                </Link>
              ),
            },
            {
              key: 'customer',
              header: t.admin.orders.customer,
              render: (order) => (
                <span>
                  <span className="block">{order.billing_name}</span>
                  <span className="font-latin block text-xs text-muted">{order.billing_email}</span>
                </span>
              ),
            },
            {
              key: 'status',
              header: t.admin.common.status,
              render: (order) => (
                <Badge tone={order.status === 'fulfilled' ? 'success' : 'info'}>
                  {statusLabel('order', order.status, locale)}
                </Badge>
              ),
            },
            {
              key: 'placed',
              header: t.admin.common.date,
              render: (order) => date(order.placed_at, locale) ?? '—',
            },
            {
              key: 'total',
              header: t.admin.orders.total,
              align: 'end',
              render: (order) => price(order.total_minor, order.currency, locale),
            },
          ]}
        />
      </div>
    </div>
  );
}
