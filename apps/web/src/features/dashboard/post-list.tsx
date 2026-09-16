'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/states';
import { SeoScoreBadge, ViewLink } from '@/features/admin/seo-score-badge';
import { api } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';

/**
 * The articles list, with the selecting and deleting the media library has.
 *
 * The rows arrive ready to render: the SEO score is the editor's own analysis,
 * run on the server where the article's text already is, so none of it has to
 * be sent to the browser to show one number.
 */
export type PostRow = {
  id: number;
  slug: string;
  title: string;
  status: string;
  statusLabel: string;
  statusTone: 'neutral' | 'info' | 'success' | 'warning';
  /** Publication date, or the review state when it is not published. */
  note: string;
  seoScore: number | null;
  live: boolean;
};

export function PostList({ rows, emptyTitle }: { rows: PostRow[]; emptyTitle: string }) {
  const { locale, t } = useLocale();
  const bn = locale === 'bn';
  const router = useRouter();
  const [bulk, setBulk] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  function toggle(id: number) {
    setSelected((current) => {
      const next = new Set(current);

      if (!next.delete(id)) {
        next.add(id);
      }

      return next;
    });
  }

  /** Leaves the message about anything that failed: it is the result. */
  function endBulk() {
    setBulk(false);
    setSelected(new Set());
  }

  async function deleteSelected() {
    const chosen = rows.filter((row) => selected.has(row.id));

    if (chosen.length === 0) {
      return;
    }

    const live = chosen.filter((row) => row.live).length;
    const question = [
      bn
        ? `${chosen.length}টি আর্টিকেল মুছবেন?`
        : `Delete ${chosen.length} ${chosen.length === 1 ? 'article' : 'articles'}?`,
      // A draft nobody has seen and a page with readers and links are not the
      // same decision, so the question says which this is.
      live > 0
        ? bn
          ? `এর মধ্যে ${live}টি এখন সাইটে প্রকাশিত — মুছলে ওই ঠিকানাগুলো আর কাজ করবে না।`
          : `${live} of them are live on the site; those addresses will stop working.`
        : null,
      bn
        ? 'মুছে ফেলা আর্টিকেল ড্যাশবোর্ড থেকে ফেরানো যায় না।'
        : 'A deleted article cannot be brought back from the dashboard.',
    ]
      .filter(Boolean)
      .join('\n\n');

    if (!window.confirm(question)) {
      return;
    }

    setBusy(true);
    setProblem(null);

    const failed: string[] = [];
    let deleted = 0;

    for (const row of chosen) {
      try {
        await api(`/admin/posts/${row.id}`, { method: 'DELETE' });
        deleted += 1;
      } catch (caught) {
        failed.push(`${row.title}: ${caught instanceof Error ? caught.message : ''}`);
      }
    }

    setBusy(false);

    if (failed.length > 0) {
      setProblem(
        `${bn ? 'মুছতে পারা যায়নি:' : 'These could not be deleted:'}\n${failed.join('\n')}`,
      );
    }

    if (deleted > 0) {
      router.refresh();
    }

    endBulk();
  }

  return (
    <div className="mt-6">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {bulk ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="danger"
              disabled={busy || selected.size === 0}
              onClick={() => void deleteSelected()}
            >
              {busy ? t.admin.common.saving : bn ? 'মুছে ফেলুন' : 'Delete'}
            </Button>
            <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={endBulk}>
              {t.admin.common.cancel}
            </Button>
            <span role="status" className="text-sm text-muted">
              {bn ? `${selected.size}টি বাছাই করা হয়েছে` : `${selected.size} selected`}
            </span>
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              setProblem(null);
              setBulk(true);
            }}
          >
            {bn ? 'একসাথে বাছাই' : 'Bulk select'}
          </Button>
        )}
      </div>

      {problem ? (
        <p role="alert" className="mb-3 text-sm font-medium whitespace-pre-line text-danger">
          {problem}
        </p>
      ) : null}

      <DataTable
        caption={t.admin.posts.caption}
        rows={rows}
        getRowKey={(row) => row.slug}
        empty={<EmptyState title={emptyTitle} />}
        columns={[
          ...(bulk
            ? [
                {
                  key: 'select',
                  header: bn ? 'বাছাই' : 'Select',
                  render: (row: PostRow) => (
                    <input
                      type="checkbox"
                      className="size-4 accent-[--color-blue]"
                      checked={selected.has(row.id)}
                      disabled={busy}
                      onChange={() => toggle(row.id)}
                      aria-label={`${bn ? 'বাছাই' : 'Select'}: ${row.title}`}
                    />
                  ),
                },
              ]
            : []),
          {
            key: 'title',
            header: t.admin.common.title,
            render: (row: PostRow) => (
              <Link
                href={`/dashboard/posts/${row.id}`}
                data-authored="true"
                className="font-semibold text-blue hover:underline"
              >
                {row.title}
                <span className="font-latin block text-xs font-normal text-muted">/{row.slug}</span>
              </Link>
            ),
          },
          {
            key: 'status',
            header: t.admin.common.status,
            render: (row: PostRow) => (
              <span className="flex flex-col items-start gap-1">
                <Badge tone={row.statusTone}>{row.statusLabel}</Badge>
                <span className="text-xs text-muted">{row.note}</span>
              </span>
            ),
          },
          {
            key: 'seo',
            header: 'SEO',
            render: (row: PostRow) => (
              <SeoScoreBadge
                score={row.seoScore}
                href={`/dashboard/posts/${row.id}`}
                t={t}
                locale={locale}
              />
            ),
          },
          {
            key: 'view',
            header: t.admin.common.view,
            align: 'end',
            render: (row: PostRow) => (
              <ViewLink
                href={row.live ? `/blog/${row.slug}` : null}
                label={t.admin.common.view}
                draftLabel={t.admin.posts.unpublished}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
