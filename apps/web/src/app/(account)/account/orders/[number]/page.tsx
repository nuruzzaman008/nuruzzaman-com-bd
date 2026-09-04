import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApiError, type Order } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { sessionApi } from '@/lib/api/server';
import { dateTime, number as formatNumber, price } from '@/lib/format';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';
import { statusLabel } from '@/lib/status';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.customer.orders.detailTitle);
}

export default async function AccountOrderPage(props: {
  params: Promise<{ number: string }>;
}) {
  const { locale, t } = await adminDictionary();
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
          { name: t.customer.title, path: '/account' },
          { name: t.account.nav.orders, path: '/account/orders' },
          { name: order.number, path: `/account/orders/${order.number}` },
        ]}
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-latin text-[length:var(--step-h1)] font-bold text-navy">
          {order.number}
        </h1>
        <Badge tone={order.status === 'fulfilled' ? 'success' : 'info'}>{statusLabel('order', order.status, locale)}</Badge>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <DataTable
            caption={t.customer.orders.itemsCaption}
            rows={order.items ?? []}
            getRowKey={(item) => item.sku}
            columns={[
              {
                key: 'name',
                header: t.customer.orders.item,
                render: (item) => (
                  <span>
                    <span className="block font-medium text-navy">{item.product_name}</span>
                    <span className="block text-xs text-muted">{item.variant_name}</span>
                    <span className="font-latin block text-xs text-muted">{item.sku}</span>
                  </span>
                ),
              },
              {
                key: 'qty',
                header: t.customer.orders.quantity,
                align: 'end',
                render: (item) => formatNumber(item.quantity, locale),
              },
              {
                key: 'total',
                header: t.customer.orders.total,
                align: 'end',
                render: (item) => price(item.line_total_minor, order.currency, locale),
              },
            ]}
          />

          {order.timeline?.length ? (
            <Card className="p-5">
              <h2 className="font-bold text-navy">{t.customer.orders.history}</h2>
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
                      <span className="block text-xs text-muted">{dateTime(event.at, locale)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <h2 className="font-bold text-navy">{t.customer.orders.summary}</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">{t.customer.orders.subtotal}</dt>
                <dd>{price(order.subtotal_minor, order.currency, locale)}</dd>
              </div>
              {order.discount_minor > 0 ? (
                <div className="flex justify-between text-success">
                  <dt>{t.ui.discount}</dt>
                  <dd>-{price(order.discount_minor, order.currency, locale)}</dd>
                </div>
              ) : null}
              {order.tax_minor > 0 ? (
                <div className="flex justify-between">
                  <dt className="text-muted">{t.customer.orders.tax}</dt>
                  <dd>{price(order.tax_minor, order.currency, locale)}</dd>
                </div>
              ) : null}
              {order.refunded_minor > 0 ? (
                <div className="flex justify-between">
                  <dt className="text-muted">{t.customer.orders.refunded}</dt>
                  <dd>-{price(order.refunded_minor, order.currency, locale)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-line pt-3 font-bold text-navy">
                <dt>{t.customer.orders.total}</dt>
                <dd>{price(order.total_minor, order.currency, locale)}</dd>
              </div>
            </dl>
          </Card>

          {order.accepted_terms?.length ? (
            <Card className="p-5">
              <h2 className="font-bold text-navy">{t.customer.orders.acceptedTerms}</h2>
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
