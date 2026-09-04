import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApiError, type Order } from '@nuruzzaman/contracts';

import { OrderActions } from '@/features/dashboard/order-actions';
import { Badge } from '@/components/ui/badge';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { sessionApi } from '@/lib/api/server';
import { dateTime, price } from '@/lib/format';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';
import { statusLabel } from '@/lib/status';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.orderDetail.title);
}

export default async function DashboardOrderPage(props: {
  params: Promise<{ number: string }>;
}) {
  const { locale, t } = await adminDictionary();
  const { number } = await props.params;

  let order: Order;

  try {
    const response = await sessionApi<{ data: Order }>(
      `/admin/orders/${encodeURIComponent(number)}`,
    );
    order = response.data;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.isForbidden)) {
      notFound();
    }

    throw error;
  }

  return (
    <div>
      <Breadcrumbs
        trail={[
          { name: t.admin.nav.dashboard, path: '/dashboard' },
          { name: t.admin.nav.orders, path: '/dashboard/orders' },
          { name: order.number, path: `/dashboard/orders/${order.number}` },
        ]}
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-latin text-[length:var(--step-h1)] font-bold text-navy">
          {order.number}
        </h1>
        <Badge tone={order.status === 'fulfilled' ? 'success' : 'info'}>{statusLabel('order', order.status, locale)}</Badge>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <DataTable
            caption={t.admin.orderDetail.itemsCaption}
            rows={order.items ?? []}
            getRowKey={(item) => item.sku}
            columns={[
              {
                key: 'name',
                header: t.admin.orderDetail.item,
                render: (item) => (
                  <span>
                    <span className="block font-medium text-navy">{item.product_name}</span>
                    <span className="font-latin block text-xs text-muted">{item.sku}</span>
                  </span>
                ),
              },
              {
                key: 'qty',
                header: t.admin.orderDetail.quantity,
                align: 'end',
                render: (item) => item.quantity,
              },
              {
                key: 'total',
                header: t.admin.orders.total,
                align: 'end',
                render: (item) => price(item.line_total_minor, order.currency, locale),
              },
            ]}
          />

          {order.timeline?.length ? (
            <Card className="p-5">
              <h2 className="font-bold text-navy">{t.admin.orderDetail.statusHistory}</h2>
              <ol className="mt-3 space-y-3 text-sm">
                {order.timeline.map((event, index) => (
                  <li key={`${event.to}-${index}`}>
                    <span className="font-latin font-medium text-navy">
                      {event.from ? `${event.from} - ${event.to}` : event.to}
                    </span>
                    {event.reason ? <span className="block text-muted">{event.reason}</span> : null}
                    <span className="block text-xs text-muted">{dateTime(event.at, locale)}</span>
                  </li>
                ))}
              </ol>
            </Card>
          ) : null}
        </div>

        <aside>
          <OrderActions order={order} />
        </aside>
      </div>
    </div>
  );
}
