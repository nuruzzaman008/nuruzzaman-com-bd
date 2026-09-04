import type { Metadata } from 'next';
import type { Page } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/states';
import { sessionApi } from '@/lib/api/server';
import { date } from '@/lib/format';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.nav.pages);
}

export default async function DashboardPagesPage() {
  const { locale, t } = await adminDictionary();
  const pages = await sessionApi<{ data: Page[] }>('/admin/pages');

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">{t.admin.nav.pages}</h1>
      <p className="mt-2 text-muted">{t.admin.pages.legalRule}</p>

      <div className="mt-6">
        <DataTable
          caption={t.admin.pages.caption}
          rows={pages.data}
          getRowKey={(page) => page.slug}
          empty={<EmptyState title={t.admin.pages.empty} />}
          columns={[
            {
              key: 'title',
              header: t.admin.common.title,
              render: (page) => (
                <span>
                  <span data-authored="true" className="block font-medium text-navy">
                    {page.title}
                  </span>
                  <span className="font-latin block text-xs text-muted">/{page.slug}</span>
                </span>
              ),
            },
            {
              key: 'template',
              header: t.admin.pages.template,
              render: (page) => page.template,
            },
            {
              key: 'legal',
              header: t.admin.pages.legalReview,
              render: (page) =>
                page.template !== 'legal' ? (
                  <span className="text-muted">{t.admin.pages.notApplicable}</span>
                ) : page.awaiting_legal_review ? (
                  <Badge tone="warning">{t.admin.pages.awaiting}</Badge>
                ) : (
                  <Badge tone="success">{page.legal_reviewer ?? t.admin.pages.done}</Badge>
                ),
            },
            {
              key: 'updated',
              header: t.admin.common.updated,
              render: (page) => date(page.updated_at, locale) ?? '—',
            },
          ]}
        />
      </div>
    </div>
  );
}
