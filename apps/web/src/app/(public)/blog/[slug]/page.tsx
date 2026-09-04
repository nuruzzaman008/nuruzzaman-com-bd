import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ApiError, type Post, type PostSummary } from '@nuruzzaman/contracts';

import { AuthorBio } from '@/features/content/author-bio';
import { PostCard } from '@/features/content/post-card';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { LocaleLink } from '@/components/ui/locale-link';
import { Callout } from '@/components/ui/callout';
import { Container } from '@/components/ui/container';
import { CoverArt } from '@/components/ui/cover-art';
import { Prose } from '@/components/ui/prose';
import { TableOfContents } from '@/components/ui/table-of-contents';
import { publicApi, tryPublicApi } from '@/lib/api/server';
import { date, isoDate, minutes } from '@/lib/format';
import { taxonomyLabel } from '@/lib/i18n/labels';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locale';
import { pageDictionary, type LocalizedPageProps } from '@/lib/i18n/page';
import { articleSchema, buildMetadata, jsonLd } from '@/lib/seo';

async function loadPost(slug: string, locale: Locale = DEFAULT_LOCALE): Promise<Post> {
  try {
    const response = await publicApi<{ data: Post }>(`/posts/${encodeURIComponent(slug)}`, {
      query: { locale },
      tags: ['posts', `post:${slug}`, `post:${slug}:${locale}`],
    });

    return response.data;
  } catch (error) {
    // A draft or a deleted article is a 404 to the public, never a 500.
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      notFound();
    }

    throw error;
  }
}

export async function generateMetadata(
  props: LocalizedPageProps & { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { locale } = pageDictionary(props.locale);
  const { slug } = await props.params;
  const post = await loadPost(slug, locale);

  return buildMetadata({
    title: post.title,
    description: post.excerpt,
    path: `/blog/${post.slug}`,
    image: post.cover_url,
    seo: post.seo,
    type: 'article',
    publishedAt: post.published_at,
    modifiedAt: post.updated_at,
    authorName: post.author?.name,
  });
}

export default async function BlogPostPage(
  props: LocalizedPageProps & { params: Promise<{ slug: string }> },
) {
  const { locale, t } = pageDictionary(props.locale);
  const { slug } = await props.params;
  const post = await loadPost(slug, locale);

  const category = post.categories?.[0];
  const categoryName = category ? taxonomyLabel(t, category.slug, category.name, locale) : null;

  const related = await tryPublicApi<{ data: PostSummary[] }>(
    `/posts/${encodeURIComponent(slug)}/related`,
    { query: { locale }, tags: ['posts', `posts:${locale}`] },
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            articleSchema({
              title: post.title,
              excerpt: post.excerpt,
              slug: post.slug,
              cover_url: post.cover_url,
              published_at: post.published_at,
              updated_at: post.updated_at,
              author: post.author,
              reviewer: post.reviewer,
            }),
          ),
        }}
      />

      <Container className="py-10 sm:py-14">
        <Breadcrumbs
          trail={[
            { name: t.common.home, path: '/' },
            { name: t.nav.blog, path: '/blog' },
            { name: post.title, path: `/blog/${post.slug}`, authored: true },
          ]}
        />

        <article className="mt-6">
          <header className="max-w-3xl">
            {category ? (
              <p className="text-sm font-semibold text-teal">
                <LocaleLink href={`/topics/${category.slug}`} className="hover:underline">
                  {categoryName}
                </LocaleLink>
              </p>
            ) : null}

            <h1
              data-authored="true"
              className="mt-2 text-[length:var(--step-h1)] leading-tight font-bold text-navy"
            >
              {post.title}
            </h1>

            {post.excerpt ? (
              <p data-authored="true" className="mt-4 text-lg text-muted">
                {post.excerpt}
              </p>
            ) : null}

            <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              {post.author?.name ? (
                <span className="font-medium text-navy">{post.author.name}</span>
              ) : null}
              {post.published_at ? (
                <time dateTime={isoDate(post.published_at)}>
                  {t.post.published}: {date(post.published_at, locale)}
                </time>
              ) : null}
              {post.updated_at && post.updated_at !== post.published_at ? (
                <time dateTime={isoDate(post.updated_at)}>
                  {t.post.updated}: {date(post.updated_at, locale)}
                </time>
              ) : null}
              {post.reading_minutes ? (
                <span>
                  {minutes(post.reading_minutes, locale)} {t.units.read}
                </span>
              ) : null}
            </p>

            {post.reviewer?.name ? (
              <p className="mt-2 text-sm text-success">
                {t.ui.technicalReview}: {post.reviewer.name}
                {post.reviewer.credentials ? ` ${post.reviewer.credentials}` : ''}
              </p>
            ) : (
              // Said plainly rather than left blank: a reader cannot tell an
              // unreviewed article from a reviewed one by looking at it.
              <p className="mt-2 text-sm font-medium text-warning">
                {t.post.reviewPending}
              </p>
            )}
          </header>

          {post.cover_url ? (
            <Image
              src={post.cover_url}
              alt={post.cover_alt ?? ''}
              width={1200}
              height={630}
              sizes="(min-width: 1024px) 900px, 100vw"
              priority
              className="mt-8 aspect-[1200/630] w-full rounded-[--radius-card] border border-line object-cover"
            />
          ) : (
            <CoverArt
              topic={post.categories?.[0]?.slug}
              seed={post.slug}
              label={categoryName ?? undefined}
              className="mt-8 rounded-[--radius-card] border border-line"
            />
          )}

          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_16rem]">
            <div>
              {post.body_translated ? null : (
                <Callout tone="info" title={t.cms.untranslatedTitle} role="status">
                  {t.cms.untranslatedBody}
                </Callout>
              )}

              <Prose html={post.body_html} />

              {post.tags?.length ? (
                <ul data-authored="true" className="mt-10 flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <li key={tag.slug}>
                      <span className="inline-flex rounded-full border border-line bg-white px-3 py-1 text-xs text-muted">
                        {tag.name}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <Callout tone="warning" className="mt-8">
                {t.post.educationalNotice} {t.post.moreDetail}:{' '}
                <LocaleLink href="/engineering-disclaimer" className="underline">
                  {t.pageTitle.disclaimer}
                </LocaleLink>
              </Callout>

              <div className="mt-8">
                <AuthorBio author={post.author} reviewer={post.reviewer} />
              </div>
            </div>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <TableOfContents entries={post.toc ?? []} />
            </aside>
          </div>
        </article>

        {related && related.data.length > 0 ? (
          <section aria-labelledby="related-heading" className="mt-16">
            <h2 id="related-heading" className="text-[length:var(--step-h2)] font-bold text-navy">
              {t.post.readMore}
            </h2>
            <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.data.map((item) => (
                <li key={item.slug} className="contents">
                  <PostCard post={item} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </Container>
    </>
  );
}
