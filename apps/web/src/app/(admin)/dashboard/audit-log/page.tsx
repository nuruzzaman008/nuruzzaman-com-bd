import type { Metadata } from 'next';
import type { AuditLogEntry } from '@nuruzzaman/contracts';

import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/states';
import { sessionApi } from '@/lib/api/server';
import { dateTime } from '@/lib/format';
import { privateMetadata } from '@/lib/seo';

export const metadata: Metadata = privateMetadata('অডিট লগ');

export default async function DashboardAuditLogPage(props: {
  searchParams: Promise<{ action?: string }>;
}) {
  const searchParams = await props.searchParams;

  const logs = await sessionApi<{ data: AuditLogEntry[] }>('/admin/audit-logs', {
    query: { action: searchParams.action },
  });

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">অডিট লগ</h1>
      <p className="mt-2 text-muted">
        পাসওয়ার্ড, টোকেন এবং সম্পূর্ণ Machine ID লগে লেখার আগেই মুছে ফেলা হয়।
      </p>

      <div className="mt-6">
        <DataTable
          caption="অডিট লগ"
          rows={logs.data}
          getRowKey={(entry) => String(entry.id)}
          empty={<EmptyState title="কোনো রেকর্ড নেই" />}
          columns={[
            {
              key: 'action',
              header: 'ঘটনা',
              render: (entry) => (
                <span className="font-latin font-medium text-navy">{entry.action}</span>
              ),
            },
            {
              key: 'actor',
              header: 'কে',
              render: (entry) => entry.actor?.name ?? 'সিস্টেম',
            },
            {
              key: 'subject',
              header: 'বিষয়',
              render: (entry) => (
                <span className="font-latin text-xs text-muted">
                  {entry.subject_type
                    ? `${entry.subject_type.split(String.fromCharCode(92)).pop()} #${entry.subject_id}`
                    : '—'}
                </span>
              ),
            },
            { key: 'at', header: 'কখন', render: (entry) => dateTime(entry.at) ?? '—' },
          ]}
        />
      </div>
    </div>
  );
}
