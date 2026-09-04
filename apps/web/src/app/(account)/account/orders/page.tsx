import type { Metadata } from 'next';
import Link from 'next/link';
import type { Order } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/states';
import { sessionApi } from '@/lib/api/server';
import { date, price } from '@/lib/format';
import { privateMetadata } from '@/lib/seo';
import { statusLabel } from '@/lib/status';

export const metadata: Metadata = privateMetadata('আমার অর্ডার');

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
  const orders = await sessionApi<{ data: Order[] }>('/account/orders');

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">আমার অর্ডার</h1>

      <div className="mt-6">
        <DataTable
          caption="আপনার অর্ডারের তালিকা"
          rows={orders.data}
          getRowKey={(order) => order.number}
          empty={
            <EmptyState
              title="এখনো কোনো অর্ডার নেই"
              description="শপ থেকে একটি পণ্য বা কোর্স কিনলে সেটি এখানে দেখা যাবে।"
              action={<ButtonLink href="/shop">শপে যান</ButtonLink>}
            />
          }
          columns={[
            {
              key: 'number',
              header: 'অর্ডার',
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
              header: 'তারিখ',
              render: (order) => date(order.placed_at) ?? '—',
            },
            {
              key: 'status',
              header: 'অবস্থা',
              render: (order) => (
                <Badge tone={STATUS_TONES[order.status] ?? 'neutral'}>
                  {statusLabel('order', order.status)}
                </Badge>
              ),
            },
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
