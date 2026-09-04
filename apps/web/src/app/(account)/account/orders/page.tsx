import type { Metadata } from 'next';
import Link from 'next/link';
import type { Order } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/states';
import { sessionApi } from '@/lib/api/server';
import { date, price } from '@/lib/format';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';
import { statusLabel } from '@/lib/status';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.customer.orders.title);
}

const STATUS_TONES: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  paid: 'info',
  fulfilled: 'success',
  pending_payment: 'warning',
  failed: 'danger',
  cancelled: 'neutral',
  refunded: 'neutral',
  partially_refunded: 'warning',
  refund_pending: 'warning',
  draft: 'neutral',
};

export default async function AccountOrdersPage() {
  const { locale, t } = await adminDictionary();
  const orders = await sessionApi<{ data: Order[] }>('/account/orders');

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">
        {t.customer.orders.title}
      </h1>

      <div className="mt-6">
        <DataTable
          caption={t.customer.orders.caption}
          rows={orders.data}
          getRowKey={(order) => order.number}
          empty={
            <EmptyState
              title={t.customer.orders.emptyTitle}
              description={t.customer.orders.emptyBody}
              action={<ButtonLink href="/shop">{t.customer.goToShop}</ButtonLink>}
            />
          }
          columns={[
            {
              key: 'number',
              header: t.customer.orders.order,
              render: (order) => (
                <Link
                  href={`/account/orders/${order.number}`}
                  className="font-latin font-semibold text-blue hover:underline"
                >
                  {order.number}
                </Link>
              ),
            },
            {
              key: 'placed_at',
              header: t.customer.orders.date,
              render: (order) => date(order.placed_at, locale) ?? '—',
            },
            {
              key: 'status',
              header: t.customer.orders.status,
              render: (order) => (
                <Badge tone={STATUS_TONES[order.status] ?? 'neutral'}>
                  {statusLabel('order', order.status, locale)}
                </Badge>
              ),
            },
            {
              key: 'total',
              header: t.customer.orders.total,
              align: 'end',
              render: (order) => price(order.total_minor, order.currency, locale),
            },
          ]}
        />
      </div>
    </div>
  );
}
