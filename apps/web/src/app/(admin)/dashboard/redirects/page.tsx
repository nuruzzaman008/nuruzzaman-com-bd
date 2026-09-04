import type { Metadata } from 'next';
import type { Redirect } from '@nuruzzaman/contracts';

import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/states';
import { sessionApi } from '@/lib/api/server';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.nav.redirects);
}

/** The admin index is paginated, so the rows sit one level deeper. */
type Paginated = { data: Redirect[] };

export default async function DashboardRedirectsPage() {
  const { t } = await adminDictionary();
  const response = await sessionApi<{ data: Paginated }>('/admin/redirects');
  const rows = response.data.data ?? [];

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">
        {t.admin.nav.redirects}
      </h1>
      <p className="mt-2 text-muted">{t.admin.redirects.rule}</p>

      <div className="mt-6">
        <DataTable
          caption={t.admin.redirects.caption}
          rows={rows}
          getRowKey={(redirect) => redirect.source_path}
          empty={<EmptyState title={t.admin.redirects.empty} />}
          columns={[
            {
              key: 'source',
              header: t.admin.redirects.source,
              render: (redirect) => (
                <span className="font-latin text-navy">{redirect.source_path}</span>
              ),
            },
            {
              key: 'destination',
              header: t.admin.redirects.destination,
              render: (redirect) => (
                <span className="font-latin text-muted">{redirect.destination_path}</span>
              ),
            },
            {
              key: 'code',
              header: t.admin.redirects.code,
              align: 'end',
              render: (redirect) => <span className="font-latin">{redirect.status_code}</span>,
            },
          ]}
        />
      </div>
    </div>
  );
}
