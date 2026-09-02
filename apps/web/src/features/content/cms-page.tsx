import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ApiError, type Page } from '@nuruzzaman/contracts';

import { LegalDraftNotice, LegalReviewedNote } from '@/components/layout/legal-notice';
import { Breadcrumbs, type Crumb } from '@/components/ui/breadcrumbs';
import { Container } from '@/components/ui/container';
import { Prose } from '@/components/ui/prose';
import { TableOfContents } from '@/components/ui/table-of-contents';
import { publicApi } from '@/lib/api/server';
import { date } from '@/lib/format';
import { buildMetadata } from '@/lib/seo';

/**
 * Renders a page whose body lives in the CMS.
 *
 * Legal pages keep a visible DRAFT notice until an admin records a real
 * professional review, so nobody mistakes seeded wording for approved wording.
 */
export async function loadCmsPage(slug: string): Promise<Page> {
  try {
    const response = await publicApi<{ data: Page }>(`/pages/${encodeURIComponent(slug)}`, {
      tags: ['pages', `page:${slug}`],
    });

    return response.data;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      notFound();
    }

    throw error;
  }
}

export async function cmsPageMetadata(slug: string, path: string): Promise<Metadata> {
  const page = await loadCmsPage(slug);

  return buildMetadata({
    title: page.title,
    description: page.seo?.meta_description,
    path,
    seo: page.seo,
  });
}

export async function CmsPage({
  slug,
  trail,
  showToc = true,
}: {
  slug: string;
  trail: Crumb[];
  showToc?: boolean;
}) {
  const page = await loadCmsPage(slug);
  const isLegal = page.template === 'legal';

  return (
    <Container size={showToc ? 'default' : 'narrow'} className="py-10 sm:py-14">
      <Breadcrumbs trail={trail} />

      <header className="mt-6 max-w-3xl">
        <h1 className="text-[length:var(--step-h1)] font-bold text-navy">{page.title}</h1>
        {page.updated_at ? (
          <p className="mt-2 text-sm text-muted">সর্বশেষ হালনাগাদ: {date(page.updated_at)}</p>
        ) : null}
      </header>

      {isLegal ? (
        <div className="mt-6 max-w-3xl space-y-3">
          <LegalDraftNotice awaiting={page.awaiting_legal_review} />
          <LegalReviewedNote
            reviewer={page.legal_reviewer ?? null}
            reviewedAt={date(page.legal_reviewed_at)}
          />
        </div>
      ) : null}

      <div
        className={
          showToc
            ? 'mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_16rem]'
            : 'mt-8'
        }
      >
        <Prose html={page.body_html} />
        {showToc ? (
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <TableOfContents entries={page.toc ?? []} />
          </aside>
        ) : null}
      </div>
    </Container>
  );
}
