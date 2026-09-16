'use client';

import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/states';
import { BulkToolbar, useBulkDelete } from '@/features/dashboard/bulk-delete';
import { date, price } from '@/lib/format';
import { useLocale } from '@/lib/i18n/locale-provider';
import { statusLabel } from '@/lib/status';

/**
 * The orders list, with selecting and deleting.
 *
 * Only an order that never took money can be deleted; the API refuses the rest
 * and says why, and that reason is shown against the order it belongs to. An
 * order has no editorial status, so the only bulk action is deleting.
 */
export type OrderRow = {
  number: string;
  status: string;
  billingName: string | null;
  billingEmail: string | null;
  placedAt: string | null;
  totalMinor: number;
  currency: string;
};

export function OrderList({ rows }: { rows: OrderRow[] }) {
  const { locale, t } = useLocale();
  const selectable = rows.map((row) => ({ ...row, id: row.number, title: row.number, live: false }));
  const bulk = useBulkDelete({
    rows: selectable,
    noun: 'order',
    path: (row) => `/admin/orders/${encodeURIComponent(row.number)}`,
  });

  return (
    <div className="mt-6">
      <BulkToolbar bulk={bulk} statusActions={false} />

      <DataTable
        caption={t.admin.orders.caption}
        rows={selectable}
        getRowKey={(row) => row.number}
        empty={<EmptyState title={t.admin.orders.empty} />}
        columns={[
          ...bulk.column(),
          {
            key: 'number',
            header: t.admin.orders.order,
            render: (row) => (
              <Link
                href={`/dashboard/orders/${row.number}`}
                className="font-latin font-semibold text-blue hover:underline"
              >
                {row.number}
              </Link>
            ),
          },
          {
            key: 'customer',
            header: t.admin.orders.customer,
            render: (row) => (
              <span>
                <span className="block">{row.billingName}</span>
                <span className="font-latin block text-xs text-muted">{row.billingEmail}</span>
              </span>
            ),
          },
          {
            key: 'status',
            header: t.admin.common.status,
            render: (row) => (
              <Badge tone={row.status === 'fulfilled' ? 'success' : 'info'}>
                {statusLabel('order', row.status, locale)}
              </Badge>
            ),
          },
          {
            key: 'placed',
            header: t.admin.common.date,
            render: (row) => date(row.placedAt, locale) ?? '—',
          },
          {
            key: 'total',
            header: t.admin.orders.total,
            align: 'end',
            render: (row) => price(row.totalMinor, row.currency, locale),
          },
        ]}
      />
    </div>
  );
}
