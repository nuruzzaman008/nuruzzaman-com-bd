import type { Metadata } from 'next';
import type { Page } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/states';
import { sessionApi } from '@/lib/api/server';
import { date } from '@/lib/format';
import { privateMetadata } from '@/lib/seo';

export const metadata: Metadata = privateMetadata('পেজ');

export default async function DashboardPagesPage() {
  const pages = await sessionApi<{ data: Page[] }>('/admin/pages');

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">পেজ</h1>
      <p className="mt-2 text-muted">
        আইনি পাতাগুলো পেশাগত পর্যালোচনা রেকর্ড না হওয়া পর্যন্ত DRAFT নোটিশ দেখায়।
      </p>

      <div className="mt-6">
        <DataTable
          caption="পেজের তালিকা"
          rows={pages.data}
          getRowKey={(page) => page.slug}
          empty={<EmptyState title="কোনো পেজ নেই" />}
          columns={[
            {
              key: 'title',
              header: 'শিরোনাম',
              render: (page) => (
                <span>
                  <span className="block font-medium text-navy">{page.title}</span>
                  <span className="font-latin block text-xs text-muted">/{page.slug}</span>
                </span>
              ),
            },
            { key: 'template', header: 'টেমপ্লেট', render: (page) => page.template },
            {
              key: 'legal',
              header: 'আইনি পর্যালোচনা',
              render: (page) =>
                page.template !== 'legal' ? (
                  <span className="text-muted">প্রযোজ্য নয়</span>
                ) : page.awaiting_legal_review ? (
                  <Badge tone="warning">অপেক্ষমাণ</Badge>
                ) : (
                  <Badge tone="success">{page.legal_reviewer ?? 'সম্পন্ন'}</Badge>
                ),
            },
            {
              key: 'updated',
              header: 'হালনাগাদ',
              render: (page) => date(page.updated_at) ?? '—',
            },
          ]}
        />
      </div>
    </div>
  );
}
