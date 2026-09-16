'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import type { Column } from '@/components/ui/data-table';
import { STATUSES } from '@/features/admin/list-filters';
import { api } from '@/lib/api/browser';
import { number } from '@/lib/format';
import { useLocale } from '@/lib/i18n/locale-provider';
import { statusLabel } from '@/lib/status';

/*
  Choosing rows in a dashboard list and doing one thing to all of them, shared
  by the articles, products and courses lists.

  The actions are the editorial ones - draft, in review, scheduled, published,
  archived - and deleting. Only deleting asks first, and the question names how
  many of the chosen rows are live on the site, because a draft nobody has read
  and a page with readers and links are not the same decision.

  Rows the API refuses are listed afterwards with the reason it gave rather
  than disappearing into a count, and it refuses for good reasons: a published
  page cannot slip sideways into review, a schedule needs its date first, and a
  product that has sold or a course with a learner in it cannot be deleted.
*/
export type Deletable = { id: number; title: string; live: boolean };

/** What the dropdown offers: a status to move to, or deleting. */
export type BulkAction = 'delete' | (typeof STATUSES)[number] | '';

export type BulkDelete<T extends Deletable> = {
  active: boolean;
  busy: boolean;
  problem: string | null;
  /** What happened, when something did: "3 changed". */
  note: string | null;
  action: BulkAction;
  setAction: (action: BulkAction) => void;
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
  const [action, setAction] = useState<BulkAction>('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

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

    if (chosen.length === 0 || !action) {
      return;
    }

    const deleting = action === 'delete';

    if (deleting) {
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
    }

    setBusy(true);
    setProblem(null);
    setNote(null);

    const failed: string[] = [];
    let done = 0;

    for (const row of chosen) {
      try {
        await (deleting
          ? api(path(row), { method: 'DELETE' })
          : api(`${path(row)}/transition`, { method: 'POST', body: { status: action } }));
        done += 1;
      } catch (caught) {
        failed.push(`${row.title}: ${caught instanceof Error ? caught.message : ''}`);
      }
    }

    setBusy(false);

    if (done > 0) {
      setNote((deleting ? words.deleted : words.changed).replace('{count}', number(done, locale)));
      router.refresh();
    }

    if (failed.length > 0) {
      setProblem(`${words.failed}\n${failed.join('\n')}`);
    }

    cancel();
  }

  return {
    active,
    busy,
    problem,
    note,
    action,
    setAction,
    selected,
    start: () => {
      setProblem(null);
      setNote(null);
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

/** The Bulk select row above a list: what to do, to how many, and what happened. */
export function BulkToolbar<T extends Deletable>({ bulk }: { bulk: BulkDelete<T> }) {
  const { locale, t } = useLocale();
  const words = t.admin.bulk;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {bulk.active ? (
          <>
            <label>
              <span className="sr-only">{words.actions}</span>
              <select
                aria-label={words.actions}
                className="block min-h-10 rounded-lg border border-line bg-white px-3 text-sm font-medium text-navy"
                value={bulk.action}
                disabled={bulk.busy}
                onChange={(event) => bulk.setAction(event.target.value as BulkAction)}
              >
                <option value="">{words.actions}</option>
                <optgroup label={words.statusGroup}>
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {statusLabel('content', status, locale)}
                    </option>
                  ))}
                </optgroup>
                <option value="delete">{words.delete}</option>
              </select>
            </label>

            <Button
              type="button"
              size="sm"
              variant={bulk.action === 'delete' ? 'danger' : 'primary'}
              disabled={bulk.busy || bulk.selected.size === 0 || !bulk.action}
              onClick={() => void bulk.run()}
            >
              {bulk.busy ? t.admin.common.saving : words.apply}
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

      {bulk.note ? (
        <p role="status" className="mb-3 text-sm font-medium text-success">
          {bulk.note}
        </p>
      ) : null}

      {bulk.problem ? (
        <p role="alert" className="mb-3 text-sm font-medium whitespace-pre-line text-danger">
          {bulk.problem}
        </p>
      ) : null}
    </>
  );
}
