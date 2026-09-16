'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import type { Column } from '@/components/ui/data-table';
import { api } from '@/lib/api/browser';
import { number } from '@/lib/format';
import { useLocale } from '@/lib/i18n/locale-provider';

/*
  Choosing rows in a dashboard list and deleting them, shared by the articles,
  products and courses lists.

  The question asked before anything is deleted names how many of the chosen
  rows are live on the site, because a draft nobody has read and a page with
  readers and links are not the same decision. Rows the API refuses - a product
  someone has ordered, a course someone is enrolled in - are listed afterwards
  with the reason it gave, rather than disappearing into a count.
*/
export type Deletable = { id: number; title: string; live: boolean };

export type BulkDelete<T extends Deletable> = {
  active: boolean;
  busy: boolean;
  problem: string | null;
  selected: Set<number>;
  start: () => void;
  cancel: () => void;
  toggle: (id: number) => void;
  run: () => Promise<void>;
  /** The checkbox column, or nothing while the list is not in selecting mode. */
  column: () => Column<T>[];
};

export function useBulkDelete<T extends Deletable>({
  rows,
  path,
  noun,
}: {
  rows: T[];
  /** Where one row is deleted, e.g. `/admin/posts/12`. */
  path: (row: T) => string;
  noun: 'post' | 'product' | 'course';
}): BulkDelete<T> {
  const { locale, t } = useLocale();
  const words = t.admin.bulk;
  const router = useRouter();
  const [active, setActive] = useState(false);
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

  /** Leaves any message about what failed: that is the result of the run. */
  function cancel() {
    setActive(false);
    setSelected(new Set());
  }

  async function run() {
    const chosen = rows.filter((row) => selected.has(row.id));

    if (chosen.length === 0) {
      return;
    }

    const live = chosen.filter((row) => row.live).length;
    const nouns = words.nouns[noun];
    const question = [
      words.confirm
        .replace('{count}', number(chosen.length, locale))
        .replace('{noun}', chosen.length === 1 ? nouns.one : nouns.many),
      live > 0 ? words.live.replace('{count}', number(live, locale)) : null,
      words.noUndo,
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
        await api(path(row), { method: 'DELETE' });
        deleted += 1;
      } catch (caught) {
        failed.push(`${row.title}: ${caught instanceof Error ? caught.message : ''}`);
      }
    }

    setBusy(false);

    if (failed.length > 0) {
      setProblem(`${words.failed}\n${failed.join('\n')}`);
    }

    if (deleted > 0) {
      router.refresh();
    }

    cancel();
  }

  return {
    active,
    busy,
    problem,
    selected,
    start: () => {
      setProblem(null);
      setActive(true);
    },
    cancel,
    toggle,
    run,
    column: () =>
      active
        ? [
            {
              key: 'select',
              header: words.selectRow,
              render: (row: T) => (
                <input
                  type="checkbox"
                  className="size-4 accent-[--color-blue]"
                  checked={selected.has(row.id)}
                  disabled={busy}
                  onChange={() => toggle(row.id)}
                  aria-label={`${words.selectRow}: ${row.title}`}
                />
              ),
            },
          ]
        : [],
  };
}

/** The Bulk select / Delete / Cancel row above a list, and what went wrong. */
export function BulkToolbar<T extends Deletable>({ bulk }: { bulk: BulkDelete<T> }) {
  const { locale, t } = useLocale();
  const words = t.admin.bulk;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {bulk.active ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="danger"
              disabled={bulk.busy || bulk.selected.size === 0}
              onClick={() => void bulk.run()}
            >
              {bulk.busy ? t.admin.common.saving : words.delete}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={bulk.busy}
              onClick={bulk.cancel}
            >
              {t.admin.common.cancel}
            </Button>
            <span role="status" className="text-sm text-muted">
              {words.selected.replace('{count}', number(bulk.selected.size, locale))}
            </span>
          </>
        ) : (
          <Button type="button" size="sm" variant="secondary" onClick={bulk.start}>
            {words.select}
          </Button>
        )}
      </div>

      {bulk.problem ? (
        <p role="alert" className="mb-3 text-sm font-medium whitespace-pre-line text-danger">
          {bulk.problem}
        </p>
      ) : null}
    </>
  );
}
