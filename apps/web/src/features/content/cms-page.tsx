import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ApiError, type Page } from '@nuruzzaman/contracts';

import { LegalDraftNotice, LegalReviewedNote } from '@/components/layout/legal-notice';
import { Breadcrumbs, type Crumb } from '@/components/ui/breadcrumbs';
import { Callout } from '@/components/ui/callout';
import { Container } from '@/components/ui/container';
import { Prose } from '@/components/ui/prose';
import { TableOfContents } from '@/components/ui/table-of-contents';
import { publicApi } from '@/lib/api/server';
import { date } from '@/lib/format';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locale';
import { pageDictionary } from '@/lib/i18n/page';
import { buildMetadata } from '@/lib/seo';

/**
 * Renders a page whose body lives in the CMS.
 *
 * Legal pages keep a visible DRAFT notice until an admin records a real
 * professional review, so nobody mistakes seeded wording for approved wording.
 *
 * TRANSLATION: an English page is a separate CMS document under the same slug
 * plus `-en`, edited in the admin like any other. The API resolves that from
 * `?locale=en` and falls back to the Bengali document, telling us which it sent
 * in `translated`. Nothing here machine-translates a body: a policy or a set of
 * installation steps that says something slightly different in one language
 * than the other is worse than one the reader can see is untranslated.
 */
export async function loadCmsPage(
  slug: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<Page> {
  try {
    const response = await publicApi<{ data: Page }>(`/pages/${encodeURIComponent(slug)}`, {
      query: { locale },
      // Tagged per language: revalidating one must not serve the other's body.
      tags: ['pages', `page:${slug}`, `page:${slug}:${locale}`],
    });

    return response.data;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      notFound();
    }

    throw error;
  }
}

export async function cmsPageMetadata(
  slug: string,
  path: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<Metadata> {
  const page = await loadCmsPage(slug, locale);

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
  locale,
}: {
  slug: string;
  trail: Crumb[];
  showToc?: boolean;
  locale?: Locale;
}) {
  const { locale: active, t } = pageDictionary(locale);
  const page = await loadCmsPage(slug, active);
  const isLegal = page.template === 'legal';

  return (
    <Container size={showToc ? 'default' : 'narrow'} className="py-10 sm:py-14">
      <Breadcrumbs trail={trail} />

      <header className="mt-6 max-w-3xl">
        <h1 data-authored="true" className="text-[length:var(--step-h1)] font-bold text-navy">
          {page.title}
        </h1>
        {page.updated_at ? (
          <p className="mt-2 text-sm text-muted">
            {t.ui.lastUpdated}: {date(page.updated_at, active)}
          </p>
        ) : null}
      </header>

      <div className="mt-6 max-w-3xl space-y-3">
        {page.translated ? null : (
          <Callout tone="info" title={t.cms.untranslatedTitle} role="status">
            {t.cms.untranslatedBody}
          </Callout>
        )}

        {isLegal ? (
          <>
            <LegalDraftNotice awaiting={page.awaiting_legal_review} />
            <LegalReviewedNote
              reviewer={page.legal_reviewer ?? null}
              reviewedAt={date(page.legal_reviewed_at, active)}
            />
          </>
        ) : null}
      </div>

      <div className={showToc ? 'mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_16rem]' : 'mt-8'}>
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
