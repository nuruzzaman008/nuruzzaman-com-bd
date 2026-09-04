import type { Metadata } from 'next';
import Link from 'next/link';
import type { PostComment } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { CommentModeration } from '@/features/dashboard/comment-moderation';
import { StarDisplay } from '@/features/content/star-rating';
import { sessionApi } from '@/lib/api/server';
import { date } from '@/lib/format';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';
import { statusLabel } from '@/lib/status';

const FILTERS = ['pending', 'approved', 'rejected', 'spam'] as const;

const TONES: Record<string, 'info' | 'success' | 'warning' | 'danger'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'info',
  spam: 'danger',
};

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.commentQueue.title);
}

/**
 * The comment moderation queue.
 *
 * Cards rather than a table: the body is the thing being judged and it needs
 * room to be read in full. A table would either truncate it or force a click
 * through to see what is actually being approved.
 */
export default async function DashboardCommentsPage(props: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale, t } = await adminDictionary();
  const searchParams = await props.searchParams;
  const active = FILTERS.includes(searchParams.status as (typeof FILTERS)[number])
    ? (searchParams.status as (typeof FILTERS)[number])
    : 'pending';

  const comments = await sessionApi<{ data: PostComment[] }>('/admin/comments', {
    query: { status: active },
  });

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">
        {t.admin.commentQueue.title}
      </h1>

      <Callout tone="info" className="mt-4">
        {t.admin.commentQueue.pendingNotice}
      </Callout>

      <nav aria-label={t.admin.commentQueue.filterLabel} className="mt-6">
        <ul className="flex flex-wrap gap-2">
          {FILTERS.map((status) => (
            <li key={status}>
              <Link
                href={`/dashboard/comments?status=${status}`}
                aria-current={status === active ? 'page' : undefined}
                className={
                  status === active
                    ? 'inline-flex min-h-9 items-center rounded-lg bg-navy px-3 text-sm font-semibold text-white'
                    : 'inline-flex min-h-9 items-center rounded-lg border border-line bg-white px-3 text-sm font-medium text-navy hover:border-blue hover:text-blue'
                }
              >
                {statusLabel('comment', status, locale)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {comments.data.length === 0 ? (
        <div className="mt-6">
          <EmptyState title={t.admin.commentQueue.empty} />
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {comments.data.map((comment) => (
            <li key={comment.id}>
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-navy" data-authored="true">
                      {comment.author_name}
                    </p>
                    {comment.post?.slug ? (
                      <p className="mt-0.5 text-xs text-muted">
                        {t.admin.commentQueue.article}:{' '}
                        <Link
                          href={`/blog/${comment.post.slug}`}
                          className="underline hover:text-blue"
                          data-authored="true"
                        >
                          {comment.post.title ?? comment.post.slug}
                        </Link>
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-3">
                    {comment.rating ? (
                      <StarDisplay value={comment.rating} />
                    ) : (
                      <span className="text-xs text-muted">{t.admin.commentQueue.noRating}</span>
                    )}
                    {comment.status ? (
                      <Badge tone={TONES[comment.status] ?? 'info'}>
                        {statusLabel('comment', comment.status, locale)}
                      </Badge>
                    ) : null}
                  </div>
                </div>

                <p
                  className="mt-3 text-sm whitespace-pre-line text-ink"
                  data-authored="true"
                >
                  {comment.body}
                </p>

                <p className="mt-3 text-xs text-muted">{date(comment.created_at, locale)}</p>

                <div className="mt-4">
                  <CommentModeration comment={comment} />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
