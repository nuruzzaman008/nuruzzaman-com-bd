import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApiError, type Order } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { sessionApi } from '@/lib/api/server';
import { dateTime, price } from '@/lib/format';
import { privateMetadata } from '@/lib/seo';

export const metadata: Metadata = privateMetadata('অর্ডারের বিস্তারিত');

export default async function AccountOrderPage(props: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await props.params;

  let order: Order;

  try {
    const response = await sessionApi<{ data: Order }>(
      `/account/orders/${encodeURIComponent(number)}`,
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
          { name: 'অ্যাকাউন্ট', path: '/account' },
          { name: 'অর্ডার', path: '/account/orders' },
          { name: order.number, path: `/account/orders/${order.number}` },
        ]}
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-latin text-[length:var(--step-h1)] font-bold text-navy">
          {order.number}
        </h1>
        <Badge tone={order.status === 'fulfilled' ? 'success' : 'info'}>{order.status}</Badge>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
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
                    <span className="block text-xs text-muted">{item.variant_name}</span>
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
              <h2 className="font-bold text-navy">অর্ডারের ইতিহাস</h2>
              <ol className="mt-3 space-y-3 text-sm">
                {order.timeline.map((event, index) => (
                  <li key={`${event.to}-${index}`} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-1.5 size-2 shrink-0 rounded-full bg-blue"
                    />
                    <span>
                      <span className="font-latin block font-medium text-navy">
                        {event.from ? `${event.from} - ${event.to}` : event.to}
                      </span>
                      {event.reason ? <span className="block text-muted">{event.reason}</span> : null}
                      <span className="block text-xs text-muted">{dateTime(event.at)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <h2 className="font-bold text-navy">সারসংক্ষেপ</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">সাবটোটাল</dt>
                <dd>{price(order.subtotal_minor, order.currency)}</dd>
              </div>
              {order.discount_minor > 0 ? (
                <div className="flex justify-between text-success">
                  <dt>ছাড়</dt>
                  <dd>-{price(order.discount_minor, order.currency)}</dd>
                </div>
              ) : null}
              {order.tax_minor > 0 ? (
                <div className="flex justify-between">
                  <dt className="text-muted">কর</dt>
                  <dd>{price(order.tax_minor, order.currency)}</dd>
                </div>
              ) : null}
              {order.refunded_minor > 0 ? (
                <div className="flex justify-between">
                  <dt className="text-muted">ফেরত</dt>
                  <dd>-{price(order.refunded_minor, order.currency)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-line pt-3 font-bold text-navy">
                <dt>মোট</dt>
                <dd>{price(order.total_minor, order.currency)}</dd>
              </div>
            </dl>
          </Card>

          {order.accepted_terms?.length ? (
            <Card className="p-5">
              <h2 className="font-bold text-navy">গৃহীত নীতি</h2>
              <ul className="font-latin mt-2 list-disc space-y-1 ps-5 text-sm text-muted">
                {order.accepted_terms.map((term) => (
                  <li key={term}>{term}</li>
                ))}
              </ul>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
