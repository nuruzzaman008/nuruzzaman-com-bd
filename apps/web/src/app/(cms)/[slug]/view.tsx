import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CmsPage, cmsPageMetadata, loadCmsPage } from '@/features/content/cms-page';
import { pageDictionary, type LocalizedPageProps } from '@/lib/i18n/page';
import { isSitePage, pagePathForSlug } from '@/lib/site';

type Props = LocalizedPageProps & { params: Promise<{ slug: string }> };

/** The shape of a page address, as the API accepts it. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Only an address a page added in the dashboard could have reaches the API.
 * The site's own pages live at their fixed routes and an English document at
 * its Bengali page's /en address, so neither answers here; anything else (a
 * file name, a bot's guess) is a 404 without a request.
 */
async function pageSlug(props: Props): Promise<string> {
  const { slug } = await props.params;

  if (!SLUG.test(slug) || slug.endsWith('-en') || isSitePage(slug)) {
    notFound();
  }

  return slug;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale } = pageDictionary(props.locale);
  const slug = await pageSlug(props);

  return cmsPageMetadata(slug, pagePathForSlug(slug), locale);
}

/**
 * A page the owner added under Dashboard → Pages, served at /{slug}.
 *
 * Its own route group, not (public): that group's loading.tsx starts the
 * response streaming before the page is looked up, so a missing page would
 * answer 200. Here the lookup finishes first and a missing page is a real 404.
 */
export default async function Page(props: Props) {
  const { locale, t } = pageDictionary(props.locale);
  const slug = await pageSlug(props);
  // The same cached request CmsPage makes, so the crumb can carry the title.
  const page = await loadCmsPage(slug, locale);

  return (
    <CmsPage
      slug={slug}
      locale={locale}
      trail={[
        { name: t.common.home, path: '/' },
        { name: page.title, path: pagePathForSlug(slug) },
      ]}
    />
  );
}
