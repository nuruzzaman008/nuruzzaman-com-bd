import type { Metadata } from 'next';
import Link from 'next/link';
import type { Post } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/states';
import { AdminSearchForm } from '@/features/admin/admin-search-form';
import { SeoScore, ViewLink } from '@/features/admin/seo-score';
import { sessionApi } from '@/lib/api/server';
import { date } from '@/lib/format';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';
import { statusLabel } from '@/lib/status';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.nav.posts);
}

const STATUSES = ['draft', 'in_review', 'scheduled', 'published', 'archived'] as const;

const TONES: Record<string, 'neutral' | 'info' | 'success' | 'warning'> = {
  draft: 'neutral',
  in_review: 'warning',
  scheduled: 'info',
  published: 'success',
  archived: 'neutral',
};

/** A status filter link that keeps the search, and a search that keeps the status. */
function postsHref(status?: string, q?: string): string {
  const query = new URLSearchParams();

  if (status) query.set('status', status);
  if (q) query.set('q', q);

  const search = query.toString();

  return search ? `/dashboard/posts?${search}` : '/dashboard/posts';
}

export default async function DashboardPostsPage(props: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { locale, t } = await adminDictionary();
  const bn = locale === 'bn';
  const searchParams = await props.searchParams;
  const q = searchParams.q?.trim() || undefined;

  const posts = await sessionApi<{ data: Post[]; meta?: { total?: number } }>('/admin/posts', {
    query: { status: searchParams.status, q },
  });

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
        keep={{ status: searchParams.status }}
        label={bn ? 'ব্লগ পোস্ট খুঁজুন' : 'Search blog posts'}
        placeholder={bn ? 'পোস্টের শিরোনাম বা URL slug…' : 'Post title or URL slug…'}
        searchLabel={t.admin.common.search}
        locale={locale}
      />

      <nav aria-label={t.admin.filterByStatus} className="mt-4 flex flex-wrap gap-2">
        <Link
          href={postsHref(undefined, q)}
          className="inline-flex min-h-9 items-center rounded-full border border-line bg-white px-3 text-sm font-medium text-navy hover:border-blue"
        >
          {t.admin.common.all}
        </Link>
        {STATUSES.map((status) => (
          <Link
            key={status}
            href={postsHref(status, q)}
            className="inline-flex min-h-9 items-center rounded-full border border-line bg-white px-3 text-sm font-medium text-navy hover:border-blue"
          >
            {statusLabel('content', status, locale)}
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        <DataTable
          caption={t.admin.posts.caption}
          rows={posts.data}
          getRowKey={(post) => post.slug}
          empty={
            <EmptyState
              title={
                q
                  ? bn
                    ? `“${q}” শিরোনামে বা slug-এ কোনো পোস্ট পাওয়া যায়নি`
                    : `No post matches “${q}”`
                  : t.admin.posts.empty
              }
            />
          }
          columns={[
            {
              key: 'title',
              header: t.admin.common.title,
              render: (post) => (
                <Link
                  href={`/dashboard/posts/${post.id}`}
                  data-authored="true"
                  className="font-semibold text-blue hover:underline"
                >
                  {post.title}
                  <span className="font-latin block text-xs font-normal text-muted">
                    /{post.slug}
                  </span>
                </Link>
              ),
            },
            {
              key: 'status',
              header: t.admin.common.status,
              render: (post) => (
                <span className="flex flex-col items-start gap-1">
                  <Badge tone={TONES[post.status] ?? 'neutral'}>
                    {statusLabel('content', post.status, locale)}
                  </Badge>
                  <span className="text-xs text-muted">
                    {date(post.published_at, locale) ??
                      (post.reviewed_at ? t.admin.posts.reviewed : t.admin.posts.awaitingReview)}
                  </span>
                </span>
              ),
            },
            {
              key: 'seo',
              header: 'SEO',
              render: (post) => (
                <SeoScore
                  t={t}
                  locale={locale}
                  href={`/dashboard/posts/${post.id}`}
                  input={{
                    kind: 'post',
                    title: post.title,
                    slug: post.slug,
                    content: post.body_markdown ?? post.body_html,
                    excerpt: post.excerpt ?? undefined,
                    metaTitle: post.seo?.meta_title ?? '',
                    metaDescription: post.seo?.meta_description ?? '',
                    focusKeyword: post.seo?.focus_keyword ?? '',
                    featuredImage: post.cover_url ? { alt: post.cover_alt ?? null } : null,
                  }}
                />
              ),
            },
            {
              key: 'view',
              header: t.admin.common.view,
              align: 'end',
              render: (post) => (
                <ViewLink
                  href={post.status === 'published' ? `/blog/${post.slug}` : null}
                  label={t.admin.common.view}
                  draftLabel={t.admin.posts.unpublished}
                />
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
