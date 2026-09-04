import type { Metadata } from 'next';
import type { Category, PostSummary } from '@nuruzzaman/contracts';
import Link from 'next/link';

import { PostCard } from '@/features/content/post-card';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Container } from '@/components/ui/container';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/states';
import { publicApi, tryPublicApi } from '@/lib/api/server';
import { taxonomyLabel } from '@/lib/i18n/labels';
import { localizePath } from '@/lib/i18n/locale';
import { buildMetadata } from '@/lib/seo';
import { pageDictionary, type LocalizedPageProps } from '@/lib/i18n/page';

export const metadata: Metadata = buildMetadata({
  title: 'ব্লগ — যাচাই করা টেকনিক্যাল আর্টিকেল',
  description:
    'স্ট্রাকচারাল ডিজাইন, RCC ডিটেইলিং, ফাউন্ডেশন এবং AutoCAD প্রোডাক্টিভিটি নিয়ে বাংলায় প্র্যাকটিক্যাল লেখা।',
  path: '/blog',
});

type Search = { page?: string; category?: string; sort?: string };

export default async function BlogIndexPage(
  props: LocalizedPageProps & { searchParams: Promise<Search> },
) {
  const { locale, t } = pageDictionary(props.locale);
  const searchParams = await props.searchParams;

  const [posts, categories] = await Promise.all([
    publicApi<{ data: PostSummary[]; meta?: { current_page?: number; last_page?: number } }>(
      '/posts',
      {
        query: {
          page: searchParams.page,
          category: searchParams.category,
          sort: searchParams.sort,
          per_page: 12,
        },
        tags: ['posts'],
      },
    ),
    tryPublicApi<{ data: Category[] }>('/categories', { tags: ['categories'] }),
  ]);

  return (
    <Container className="py-10 sm:py-14">
      <Breadcrumbs
        trail={[
          { name: t.common.home, path: '/' },
          { name: t.blog.heading, path: '/blog' },
        ]}
      />

      <header className="mt-6 max-w-3xl">
        <h1 className="text-[length:var(--step-h1)] font-bold text-navy">{t.blog.heading}</h1>
        <p className="mt-3 text-muted">
          {t.blog.intro}
        </p>
      </header>

      {categories && categories.data.length > 0 ? (
        <nav aria-label={t.common.filterByTopic} className="mt-8">
          <ul className="flex flex-wrap gap-2">
            <li>
              <Link
                href={localizePath('/blog', locale)}
                aria-current={searchParams.category ? undefined : 'page'}
                className="inline-flex min-h-11 items-center rounded-full border border-line bg-white px-4 text-sm font-semibold text-navy aria-[current=page]:border-blue aria-[current=page]:bg-blue aria-[current=page]:text-white hover:border-blue"
              >
                {t.common.all}
              </Link>
            </li>
            {categories.data.map((category) => (
              <li key={category.slug}>
                <Link
                  href={localizePath(`/topics/${category.slug}`, locale)}
                  className="inline-flex min-h-11 items-center rounded-full border border-line bg-white px-4 text-sm font-semibold text-navy hover:border-blue hover:text-blue"
                >
                  {taxonomyLabel(t, category.slug, category.name, locale)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {posts.data.length > 0 ? (
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.data.map((post, index) => (
            <li key={post.slug} className="contents">
              <PostCard post={post} priority={index === 0} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          className="mt-8"
          title={t.blog.emptyTitle}
          description={t.blog.emptyDescription}
        />
      )}

      <Pagination
        meta={posts.meta}
        basePath="/blog"
        searchParams={searchParams as Record<string, string | undefined>}
      />
    </Container>
  );
}
