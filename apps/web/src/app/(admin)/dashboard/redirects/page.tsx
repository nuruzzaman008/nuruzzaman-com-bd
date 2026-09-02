import type { Metadata } from 'next';
import type { Redirect } from '@nuruzzaman/contracts';

import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/states';
import { sessionApi } from '@/lib/api/server';
import { privateMetadata } from '@/lib/seo';

export const metadata: Metadata = privateMetadata('রিডাইরেক্ট');

/** The admin index is paginated, so the rows sit one level deeper. */
type Paginated = { data: Redirect[] };

export default async function DashboardRedirectsPage() {
  const response = await sessionApi<{ data: Paginated }>('/admin/redirects');
  const rows = response.data.data ?? [];

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">রিডাইরেক্ট</h1>
      <p className="mt-2 text-muted">
        উৎস ও গন্তব্য দুটোই সাইট-আপেক্ষিক পথ হতে হবে, তাই এটি কখনো ওপেন রিডাইরেক্ট হতে পারে না।
      </p>

      <div className="mt-6">
        <DataTable
          caption="রিডাইরেক্টের তালিকা"
          rows={rows}
          getRowKey={(redirect) => redirect.source_path}
          empty={<EmptyState title="কোনো রিডাইরেক্ট নেই" />}
          columns={[
            {
              key: 'source',
              header: 'উৎস',
              render: (redirect) => (
                <span className="font-latin text-navy">{redirect.source_path}</span>
              ),
            },
            {
              key: 'destination',
              header: 'গন্তব্য',
              render: (redirect) => (
                <span className="font-latin text-muted">{redirect.destination_path}</span>
              ),
            },
            {
              key: 'code',
              header: 'কোড',
              align: 'end',
              render: (redirect) => <span className="font-latin">{redirect.status_code}</span>,
            },
          ]}
        />
      </div>
    </div>
  );
}
