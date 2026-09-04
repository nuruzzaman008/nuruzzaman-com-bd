import type { Metadata } from 'next';
import Link from 'next/link';
import type { Post } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/states';
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

export default async function DashboardPostsPage(props: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { locale, t } = await adminDictionary();
  const searchParams = await props.searchParams;

  const posts = await sessionApi<{ data: Post[] }>('/admin/posts', {
    query: { status: searchParams.status, q: searchParams.q },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[length:var(--step-h1)] font-bold text-navy">{t.admin.nav.posts}</h1>
      </div>

      <nav aria-label={t.admin.filterByStatus} className="mt-5 flex flex-wrap gap-2">
        <Link
          href="/dashboard/posts"
          className="inline-flex min-h-9 items-center rounded-full border border-line bg-white px-3 text-sm font-medium text-navy hover:border-blue"
        >
          {t.admin.common.all}
        </Link>
        {STATUSES.map((status) => (
          <Link
            key={status}
            href={`/dashboard/posts?status=${status}`}
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
          empty={<EmptyState title={t.admin.posts.empty} />}
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
                <Badge tone={TONES[post.status] ?? 'neutral'}>
                  {statusLabel('content', post.status, locale)}
                </Badge>
              ),
            },
            {
              key: 'published',
              header: t.admin.common.published,
              render: (post) => date(post.published_at, locale) ?? t.admin.posts.unpublished,
            },
            {
              key: 'reviewed',
              header: t.admin.posts.review,
              render: (post) =>
                post.reviewed_at ? (
                  <Badge tone="success">{t.admin.posts.reviewed}</Badge>
                ) : (
                  <Badge tone="warning">{t.admin.posts.awaitingReview}</Badge>
                ),
            },
          ]}
        />
      </div>
    </div>
  );
}
