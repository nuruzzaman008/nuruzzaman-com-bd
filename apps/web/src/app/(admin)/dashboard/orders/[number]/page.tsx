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
import { privateMetadata } from '@/lib/seo';

export const metadata: Metadata = privateMetadata('অর্ডারের বিস্তারিত');

export default async function DashboardOrderPage(props: {
  params: Promise<{ number: string }>;
}) {
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
          { name: 'ড্যাশবোর্ড', path: '/dashboard' },
          { name: 'অর্ডার', path: '/dashboard/orders' },
          { name: order.number, path: `/dashboard/orders/${order.number}` },
        ]}
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-latin text-[length:var(--step-h1)] font-bold text-navy">
          {order.number}
        </h1>
        <Badge tone={order.status === 'fulfilled' ? 'success' : 'info'}>{order.status}</Badge>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <DataTable
            caption="অর্ডারের আইটেম"
            rows={order.items ?? []}
            getRowKey={(item) => item.sku}
            columns={[
              {
                key: 'name',
                header: 'আইটেম',
                render: (item) => (
                  <span>
                    <span className="block font-medium text-navy">{item.product_name}</span>
                    <span className="font-latin block text-xs text-muted">{item.sku}</span>
                  </span>
                ),
              },
              { key: 'qty', header: 'পরিমাণ', align: 'end', render: (item) => item.quantity },
              {
                key: 'total',
                header: 'মোট',
                align: 'end',
                render: (item) => price(item.line_total_minor, order.currency),
              },
            ]}
          />

          {order.timeline?.length ? (
            <Card className="p-5">
              <h2 className="font-bold text-navy">অবস্থার ইতিহাস</h2>
              <ol className="mt-3 space-y-3 text-sm">
                {order.timeline.map((event, index) => (
                  <li key={`${event.to}-${index}`}>
                    <span className="font-latin font-medium text-navy">
                      {event.from ? `${event.from} - ${event.to}` : event.to}
                    </span>
                    {event.reason ? <span className="block text-muted">{event.reason}</span> : null}
                    <span className="block text-xs text-muted">{dateTime(event.at)}</span>
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
