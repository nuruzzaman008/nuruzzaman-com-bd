import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApiError, type Page } from '@nuruzzaman/contracts';

import { PageEditor, type PageCounterpart } from '@/features/dashboard/page-editor';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { sessionApi } from '@/lib/api/server';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';
import { basePageSlug } from '@/lib/site';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.nav.pages);
}

export default async function EditPagePage(props: { params: Promise<{ id: string }> }) {
  const { t } = await adminDictionary();
  const { id } = await props.params;

  let page: Page;
  let all: Page[];

  try {
    // The list too, to find the same page in the other language.
    const [response, list] = await Promise.all([
      sessionApi<{ data: Page }>(`/admin/pages/${encodeURIComponent(id)}`),
      sessionApi<{ data: Page[] }>('/admin/pages'),
    ]);
    page = response.data;
    all = list.data;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.isForbidden)) {
      notFound();
    }

    throw error;
  }

  const pairedSlug = page.slug.endsWith('-en') ? basePageSlug(page.slug) : `${page.slug}-en`;
  const other = all.find((candidate) => candidate.slug === pairedSlug);
  const counterpart: PageCounterpart = other
    ? { id: other.id, slug: other.slug, title: other.title }
    : null;

  return (
    <div>
      <Breadcrumbs
        trail={[
          { name: t.admin.nav.dashboard, path: '/dashboard' },
          { name: t.admin.nav.pages, path: '/dashboard/pages' },
          { name: page.title, path: `/dashboard/pages/${page.id}` },
        ]}
      />

      <h1 data-authored="true" className="mt-4 text-[length:var(--step-h1)] font-bold text-navy">
        {page.title}
      </h1>

      <div className="mt-6">
        {/* Keyed by page, so moving between the two languages starts fresh. */}
        <PageEditor key={page.id} page={page} counterpart={counterpart} />
      </div>
    </div>
  );
}
