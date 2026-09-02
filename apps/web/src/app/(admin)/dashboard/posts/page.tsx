import type { Metadata } from 'next';
import Link from 'next/link';
import type { Post } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/states';
import { sessionApi } from '@/lib/api/server';
import { date } from '@/lib/format';
import { privateMetadata } from '@/lib/seo';

export const metadata: Metadata = privateMetadata('আর্টিকেল');

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
  const searchParams = await props.searchParams;

  const posts = await sessionApi<{ data: Post[] }>('/admin/posts', {
    query: { status: searchParams.status, q: searchParams.q },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[length:var(--step-h1)] font-bold text-navy">আর্টিকেল</h1>
      </div>

      <nav aria-label="অবস্থা অনুযায়ী ছাঁকুন" className="mt-5 flex flex-wrap gap-2">
        <Link
          href="/dashboard/posts"
          className="inline-flex min-h-9 items-center rounded-full border border-line bg-white px-3 text-sm font-medium text-navy hover:border-blue"
        >
          সব
        </Link>
        {STATUSES.map((status) => (
          <Link
            key={status}
            href={`/dashboard/posts?status=${status}`}
            className="font-latin inline-flex min-h-9 items-center rounded-full border border-line bg-white px-3 text-sm font-medium text-navy hover:border-blue"
          >
            {status}
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        <DataTable
          caption="আর্টিকেলের তালিকা"
          rows={posts.data}
          getRowKey={(post) => post.slug}
          empty={<EmptyState title="কোনো আর্টিকেল নেই" />}
          columns={[
            {
              key: 'title',
              header: 'শিরোনাম',
              render: (post) => (
                <Link
                  href={`/dashboard/posts/${post.id}`}
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
              header: 'অবস্থা',
              render: (post) => (
                <Badge tone={TONES[post.status] ?? 'neutral'}>{post.status}</Badge>
              ),
            },
            {
              key: 'published',
              header: 'প্রকাশ',
              render: (post) => date(post.published_at) ?? 'অপ্রকাশিত',
            },
            {
              key: 'reviewed',
              header: 'রিভিউ',
              render: (post) =>
                post.reviewed_at ? (
                  <Badge tone="success">রিভিউ হয়েছে</Badge>
                ) : (
                  <Badge tone="warning">রিভিউ বাকি</Badge>
                ),
            },
          ]}
        />
      </div>
    </div>
  );
}
