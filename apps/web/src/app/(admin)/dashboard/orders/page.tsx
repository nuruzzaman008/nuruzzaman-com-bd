import type { Metadata } from 'next';
import Link from 'next/link';
import type { Order } from '@nuruzzaman/contracts';

import { OrderList, type OrderRow } from '@/features/dashboard/order-list';
import { sessionApi } from '@/lib/api/server';
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

  const rows: OrderRow[] = orders.data.map((order) => ({
    number: order.number,
    status: order.status,
    billingName: order.billing_name,
    billingEmail: order.billing_email,
    placedAt: order.placed_at,
    totalMinor: order.total_minor,
    currency: order.currency,
  }));

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

      <OrderList rows={rows} />
    </div>
  );
}
