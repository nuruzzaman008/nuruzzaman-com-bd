import type { Metadata } from 'next';
import type { AuditLogEntry } from '@nuruzzaman/contracts';

import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/states';
import { sessionApi } from '@/lib/api/server';
import { dateTime } from '@/lib/format';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.nav.auditLog);
}

export default async function DashboardAuditLogPage(props: {
  searchParams: Promise<{ action?: string }>;
}) {
  const { locale, t } = await adminDictionary();
  const searchParams = await props.searchParams;

  const logs = await sessionApi<{ data: AuditLogEntry[] }>('/admin/audit-logs', {
    query: { action: searchParams.action },
  });

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">
        {t.admin.nav.auditLog}
      </h1>
      <p className="mt-2 text-muted">{t.admin.auditLog.privacyNote}</p>

      <div className="mt-6">
        <DataTable
          caption={t.admin.auditLog.caption}
          rows={logs.data}
          getRowKey={(entry) => String(entry.id)}
          empty={<EmptyState title={t.admin.auditLog.empty} />}
          columns={[
            {
              key: 'action',
              header: t.admin.auditLog.event,
              render: (entry) => (
                <span className="font-latin font-medium text-navy">{entry.action}</span>
              ),
            },
            {
              key: 'actor',
              header: t.admin.auditLog.actor,
              render: (entry) => entry.actor?.name ?? t.admin.auditLog.system,
            },
            {
              key: 'subject',
              header: t.admin.auditLog.subject,
              render: (entry) => (
                <span className="font-latin text-xs text-muted">
                  {entry.subject_type
                    ? `${entry.subject_type.split(String.fromCharCode(92)).pop()} #${entry.subject_id}`
                    : '—'}
                </span>
              ),
            },
            {
              key: 'at',
              header: t.admin.auditLog.when,
              render: (entry) => dateTime(entry.at, locale) ?? '—',
            },
          ]}
        />
      </div>
    </div>
  );
}
