import type { Metadata } from 'next';
import Link from 'next/link';
import type { Order } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/states';
import { sessionApi } from '@/lib/api/server';
import { date, price } from '@/lib/format';
import { privateMetadata } from '@/lib/seo';

export const metadata: Metadata = privateMetadata('অর্ডার');

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
  const searchParams = await props.searchParams;

  const orders = await sessionApi<{ data: Order[] }>('/admin/orders', {
    query: { status: searchParams.status, q: searchParams.q },
  });

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">অর্ডার</h1>

      <nav aria-label="অবস্থা অনুযায়ী ছাঁকুন" className="mt-5 flex flex-wrap gap-2">
        <Link
          href="/dashboard/orders"
          className="inline-flex min-h-9 items-center rounded-full border border-line bg-white px-3 text-sm font-medium text-navy hover:border-blue"
        >
          সব
        </Link>
        {STATUSES.map((status) => (
          <Link
            key={status}
            href={`/dashboard/orders?status=${status}`}
            className="font-latin inline-flex min-h-9 items-center rounded-full border border-line bg-white px-3 text-sm font-medium text-navy hover:border-blue"
          >
            {status}
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        <DataTable
          caption="অর্ডারের তালিকা"
          rows={orders.data}
          getRowKey={(order) => order.number}
          empty={<EmptyState title="কোনো অর্ডার নেই" />}
          columns={[
            {
              key: 'number',
              header: 'অর্ডার',
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
              header: 'গ্রাহক',
              render: (order) => (
                <span>
                  <span className="block">{order.billing_name}</span>
                  <span className="font-latin block text-xs text-muted">{order.billing_email}</span>
                </span>
              ),
            },
            {
              key: 'status',
              header: 'অবস্থা',
              render: (order) => (
                <Badge tone={order.status === 'fulfilled' ? 'success' : 'info'}>
                  {order.status}
                </Badge>
              ),
            },
            { key: 'placed', header: 'তারিখ', render: (order) => date(order.placed_at) ?? '—' },
            {
              key: 'total',
              header: 'মোট',
              align: 'end',
              render: (order) => price(order.total_minor, order.currency),
            },
          ]}
        />
      </div>
    </div>
  );
}
