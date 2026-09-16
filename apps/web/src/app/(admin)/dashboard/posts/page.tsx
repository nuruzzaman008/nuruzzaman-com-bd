import type { Metadata } from 'next';
import Link from 'next/link';
import type { Post } from '@nuruzzaman/contracts';

import { AdminSearchForm } from '@/features/admin/admin-search-form';
import { ListFilters, StatusLinks } from '@/features/admin/list-filters';
import { seoScoreOf } from '@/features/admin/seo-score';
import { PostList, type PostRow } from '@/features/dashboard/post-list';
import { sessionApi } from '@/lib/api/server';
import { date } from '@/lib/format';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';
import { statusLabel } from '@/lib/status';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.nav.posts);
}

const TONES: Record<string, 'neutral' | 'info' | 'success' | 'warning'> = {
  draft: 'neutral',
  in_review: 'warning',
  scheduled: 'info',
  published: 'success',
  archived: 'neutral',
};

type Taxonomy = { slug: string; name: string };

export default async function DashboardPostsPage(props: {
  searchParams: Promise<{
    status?: string;
    q?: string;
    category?: string;
    tag?: string;
    month?: string;
  }>;
}) {
  const { locale, t } = await adminDictionary();
  const bn = locale === 'bn';
  const searchParams = await props.searchParams;
  const q = searchParams.q?.trim() || undefined;
  const current = {
    status: searchParams.status,
    q,
    category: searchParams.category,
    tag: searchParams.tag,
    month: searchParams.month,
  };

  // The three go together on this page, so they are asked for together.
  const [posts, categories, tags] = await Promise.all([
    sessionApi<{
      data: Post[];
      meta?: { total?: number };
      filters?: { counts?: Record<string, number>; months?: string[] };
    }>('/admin/posts', { query: current }),
    sessionApi<{ data: Taxonomy[] }>('/admin/categories'),
    sessionApi<{ data: Taxonomy[] }>('/admin/tags'),
  ]);

  const rows: PostRow[] = posts.data.map((post) => ({
    id: post.id,
    slug: post.slug,
    title: post.title,
    statusLabel: statusLabel('content', post.status, locale),
    statusTone: TONES[post.status] ?? 'neutral',
    note:
      date(post.published_at, locale) ??
      (post.reviewed_at ? t.admin.posts.reviewed : t.admin.posts.awaitingReview),
    seoScore: seoScoreOf(
      {
        kind: 'post',
        title: post.title,
        slug: post.slug,
        content: post.body_markdown ?? post.body_html,
        excerpt: post.excerpt ?? undefined,
        metaTitle: post.seo?.meta_title ?? '',
        metaDescription: post.seo?.meta_description ?? '',
        focusKeyword: post.seo?.focus_keyword ?? '',
        featuredImage: post.cover_url ? { alt: post.cover_alt ?? null } : null,
      },
      t,
    ),
    live: post.status === 'published',
  }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[length:var(--step-h1)] font-bold text-navy">{t.admin.nav.posts}</h1>
        <Link
          href="/dashboard/posts/new"
          className="inline-flex min-h-11 items-center rounded-lg bg-blue px-5 font-semibold text-white hover:bg-navy"
        >
          {t.admin.posts.newPost}
        </Link>
      </div>

      <AdminSearchForm
        id="post-search"
        basePath="/dashboard/posts"
        value={q}
        total={posts.meta?.total ?? posts.data.length}
        keep={{ ...current, q: undefined }}
        label={bn ? 'ব্লগ পোস্ট খুঁজুন' : 'Search blog posts'}
        placeholder={bn ? 'পোস্টের শিরোনাম বা URL slug…' : 'Post title or URL slug…'}
        searchLabel={t.admin.common.search}
        locale={locale}
      />

      <StatusLinks basePath="/dashboard/posts" current={current} counts={posts.filters?.counts} />

      <ListFilters
        basePath="/dashboard/posts"
        current={current}
        months={posts.filters?.months ?? []}
        selects={[
          {
            name: 'category',
            label: t.admin.filters.category,
            anyLabel: t.admin.filters.allCategories,
            options: categories.data.map((row) => ({ value: row.slug, label: row.name })),
          },
          {
            name: 'tag',
            label: t.admin.filters.tag,
            anyLabel: t.admin.filters.allTags,
            options: tags.data.map((row) => ({ value: row.slug, label: row.name })),
          },
        ]}
      />

      <PostList
        rows={rows}
        emptyTitle={
          q
            ? bn
              ? `“${q}” শিরোনামে বা slug-এ কোনো পোস্ট পাওয়া যায়নি`
              : `No post matches “${q}”`
            : t.admin.posts.empty
        }
      />
    </div>
  );
}
