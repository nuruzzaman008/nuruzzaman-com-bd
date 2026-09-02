import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApiError, type Category, type PostSummary } from '@nuruzzaman/contracts';

import { PostCard } from '@/features/content/post-card';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Container } from '@/components/ui/container';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/states';
import { publicApi } from '@/lib/api/server';
import { buildMetadata } from '@/lib/seo';

async function loadCategory(slug: string): Promise<Category> {
  try {
    const response = await publicApi<{ data: Category }>(
      `/categories/${encodeURIComponent(slug)}`,
      { tags: ['categories'] },
    );

    return response.data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const category = await loadCategory(slug);

  return buildMetadata({
    title: `${category.name} — বিষয়ভিত্তিক আর্টিকেল`,
    description: category.description,
    path: `/topics/${category.slug}`,
  });
}

export default async function TopicPage(props: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ slug }, searchParams] = await Promise.all([props.params, props.searchParams]);

  const [category, posts] = await Promise.all([
    loadCategory(slug),
    publicApi<{ data: PostSummary[]; meta?: { current_page?: number; last_page?: number } }>(
      '/posts',
      { query: { category: slug, page: searchParams.page, per_page: 12 }, tags: ['posts'] },
    ),
  ]);

  return (
    <Container className="py-10 sm:py-14">
      <Breadcrumbs
        trail={[
          { name: 'হোম', path: '/' },
          { name: 'ব্লগ', path: '/blog' },
          { name: category.name, path: `/topics/${category.slug}` },
        ]}
      />

      <header className="mt-6 max-w-3xl">
        <h1 className="text-[length:var(--step-h1)] font-bold text-navy">{category.name}</h1>
        {category.description ? <p className="mt-3 text-muted">{category.description}</p> : null}
      </header>

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
          title="এই বিষয়ে এখনো লেখা প্রকাশ হয়নি"
          description="নতুন আর্টিকেল যুক্ত হলে এখানে দেখা যাবে।"
        />
      )}

      <Pagination
        meta={posts.meta}
        basePath={`/topics/${category.slug}`}
        searchParams={searchParams as Record<string, string | undefined>}
      />
    </Container>
  );
}
