import type { Metadata } from 'next';
import Link from 'next/link';
import type { Page } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/states';
import { sessionApi } from '@/lib/api/server';
import { date } from '@/lib/format';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';
import { pagePathForSlug } from '@/lib/site';
import { statusLabel } from '@/lib/status';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.nav.pages);
}

const TONES: Record<string, 'neutral' | 'info' | 'success' | 'warning'> = {
  draft: 'neutral',
  in_review: 'warning',
  scheduled: 'info',
  published: 'success',
  archived: 'neutral',
};

export default async function DashboardPagesPage() {
  const { locale, t } = await adminDictionary();
  const words = t.admin.pages;
  const pages = await sessionApi<{ data: Page[] }>('/admin/pages');

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[length:var(--step-h1)] font-bold text-navy">{t.admin.nav.pages}</h1>
        <Link
          href="/dashboard/pages/new"
          className="inline-flex min-h-11 items-center rounded-lg bg-blue px-5 font-semibold text-white hover:bg-navy"
        >
          {words.newPage}
        </Link>
      </div>
      <p className="mt-2 text-muted">{words.intro}</p>
      <p className="mt-1 text-sm text-muted">{words.legalRule}</p>

      <div className="mt-6">
        <DataTable
          caption={words.caption}
          rows={pages.data}
          getRowKey={(page) => page.slug}
          empty={<EmptyState title={words.empty} />}
          columns={[
            {
              key: 'title',
              header: t.admin.common.title,
              render: (page) => (
                <span>
                  <Link
                    href={`/dashboard/pages/${page.id}`}
                    data-authored="true"
                    className="block font-medium text-navy hover:text-blue hover:underline"
                  >
                    {page.title}
                  </Link>
                  <span className="font-latin block text-xs text-muted">
                    {pagePathForSlug(page.slug)}
                  </span>
                </span>
              ),
            },
            {
              key: 'language',
              header: words.language,
              render: (page) => (page.slug.endsWith('-en') ? words.english : words.bengali),
            },
            {
              key: 'status',
              header: t.admin.common.status,
              render: (page) => (
                <Badge tone={TONES[page.status] ?? 'neutral'}>
                  {statusLabel('content', page.status, locale)}
                </Badge>
              ),
            },
            {
              key: 'template',
              header: words.template,
              render: (page) => t.admin.pageEditor.templates[page.template] ?? page.template,
            },
            {
              key: 'legal',
              header: words.legalReview,
              render: (page) =>
                page.template !== 'legal' ? (
                  <span className="text-muted">{words.notApplicable}</span>
                ) : page.awaiting_legal_review ? (
                  <Badge tone="warning">{words.awaiting}</Badge>
                ) : (
                  <Badge tone="success">{page.legal_reviewer ?? words.done}</Badge>
                ),
            },
            {
              key: 'updated',
              header: t.admin.common.updated,
              render: (page) => date(page.updated_at, locale) ?? '—',
            },
            {
              key: 'actions',
              header: t.admin.common.actions,
              render: (page) => (
                <span className="flex flex-wrap gap-2">
                  <Link
                    href={`/dashboard/pages/${page.id}`}
                    className="inline-flex rounded bg-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-navy"
                  >
                    {words.edit}
                  </Link>
                  {page.status === 'published' ? (
                    <a
                      href={pagePathForSlug(page.slug)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex rounded border border-line px-3 py-1.5 text-sm font-semibold text-navy hover:border-blue hover:text-blue"
                    >
                      {words.view}
                    </a>
                  ) : null}
                </span>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
