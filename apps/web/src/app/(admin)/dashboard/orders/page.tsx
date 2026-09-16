import type { Metadata } from 'next';
import type { Order } from '@nuruzzaman/contracts';

import { AdminSearchForm } from '@/features/admin/admin-search-form';
import { ListFilters, StatusLinks } from '@/features/admin/list-filters';
import { OrderList, type OrderRow } from '@/features/dashboard/order-list';
import { sessionApi } from '@/lib/api/server';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.nav.orders);
}

/** Every state an order can be in, in the order a sale moves through them. */
const STATUSES = [
  'pending_payment',
  'paid',
  'fulfilled',
  'failed',
  'cancelled',
  'refund_pending',
  'partially_refunded',
  'refunded',
] as const;

export default async function DashboardOrdersPage(props: {
  searchParams: Promise<{ status?: string; q?: string; month?: string }>;
}) {
  const { locale, t } = await adminDictionary();
  const bn = locale === 'bn';
  const searchParams = await props.searchParams;
  const q = searchParams.q?.trim() || undefined;
  const current = { status: searchParams.status, q, month: searchParams.month };

  const orders = await sessionApi<{
    data: Order[];
    meta?: { total?: number };
    filters?: { counts?: Record<string, number>; months?: string[] };
  }>('/admin/orders', { query: current });

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

      <AdminSearchForm
        id="order-search"
        basePath="/dashboard/orders"
        value={q}
        keep={{ ...current, q: undefined }}
        total={orders.meta?.total ?? orders.data.length}
        label={bn ? 'অর্ডার খুঁজুন' : 'Search orders'}
        placeholder={bn ? 'অর্ডার নম্বর, গ্রাহকের নাম বা ইমেইল…' : 'Order number, customer name or email…'}
        searchLabel={t.admin.common.search}
        locale={locale}
      />

      <StatusLinks
        basePath="/dashboard/orders"
        current={current}
        counts={orders.filters?.counts}
        statuses={STATUSES}
        group="order"
      />

      <ListFilters
        basePath="/dashboard/orders"
        current={current}
        months={orders.filters?.months ?? []}
      />

      <OrderList rows={rows} />
    </div>
  );
}
