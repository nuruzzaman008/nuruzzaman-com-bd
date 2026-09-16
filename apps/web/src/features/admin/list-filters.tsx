'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { monthLabel } from '@/features/dashboard/media-filters';
import { cn } from '@/lib/cn';
import { number } from '@/lib/format';
import { useLocale } from '@/lib/i18n/locale-provider';
import { statusLabel } from '@/lib/status';

/*
  The filter bar WordPress puts above a list: the statuses with a count each,
  then the dropdowns - a month, and whatever else the list is sorted by.

  Every filter travels in the address, so a filtered list can be bookmarked,
  reloaded and shared, and the browser's back button takes you where you were.
*/
export type FilterOption = { value: string; label: string };

export type FilterSelect = {
  /** The query parameter it writes, e.g. `category`. */
  name: string;
  label: string;
  /** What the first option says when nothing is chosen, e.g. "All categories". */
  anyLabel: string;
  options: FilterOption[];
};

export const STATUSES = ['draft', 'in_review', 'scheduled', 'published', 'archived'] as const;

/** Keeps every other filter while one of them changes. */
export function listHref(
  basePath: string,
  current: Record<string, string | undefined>,
  changes: Record<string, string | undefined>,
): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries({ ...current, ...changes })) {
    // `page` is dropped on purpose: a new filter starts at the first page.
    if (value && key !== 'page') {
      query.set(key, value);
    }
  }

  const search = query.toString();

  return search ? `${basePath}?${search}` : basePath;
}

export function StatusLinks({
  basePath,
  current,
  counts,
  statuses = STATUSES,
  group = 'content',
}: {
  basePath: string;
  current: Record<string, string | undefined>;
  counts: Record<string, number> | undefined;
  /** Which statuses to offer, in order. Content by default. */
  statuses?: readonly string[];
  /** Where their labels come from. */
  group?: 'content' | 'order';
}) {
  const { locale, t } = useLocale();
  const active = current.status;

  const item = (status: string | undefined, label: string) => {
    const count = counts?.[status ?? 'all'];
    const on = (status ?? '') === (active ?? '');

    return (
      <li key={status ?? 'all'}>
        <Link
          href={listHref(basePath, current, { status })}
          aria-current={on ? 'page' : undefined}
          className={cn(
            'inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-medium',
            on
              ? 'border-blue bg-blue text-white'
              : 'border-line bg-white text-navy hover:border-blue',
          )}
        >
          {label}
          {typeof count === 'number' ? (
            <span className={cn('ms-1.5 text-xs', on ? 'text-white/80' : 'text-muted')}>
              ({number(count, locale)})
            </span>
          ) : null}
        </Link>
      </li>
    );
  };

  return (
    <nav aria-label={t.admin.filterByStatus}>
      <ul className="mt-4 flex flex-wrap gap-2">
        {item(undefined, t.admin.common.all)}
        {statuses.map((status) => item(status, statusLabel(group, status, locale)))}
      </ul>
    </nav>
  );
}

/** The dropdown row: a month, plus whatever else this list filters by. */
export function ListFilters({
  basePath,
  current,
  months,
  selects = [],
}: {
  basePath: string;
  current: Record<string, string | undefined>;
  months: string[];
  selects?: FilterSelect[];
}) {
  const { locale, t } = useLocale();
  const bn = locale === 'bn';
  const router = useRouter();
  const [chosen, setChosen] = useState<Record<string, string>>({});

  const value = (name: string) => chosen[name] ?? current[name] ?? '';
  const all: FilterSelect[] = [
    {
      name: 'month',
      label: t.admin.filters.date,
      anyLabel: t.admin.filters.allDates,
      options: months.map((month) => ({ value: month, label: monthLabel(month, bn) })),
    },
    ...selects,
  ];

  // Nothing to filter by is not a filter bar.
  if (all.every((select) => select.options.length === 0)) {
    return null;
  }

  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        router.push(listHref(basePath, current, chosen));
      }}
    >
      {all
        .filter((select) => select.options.length > 0)
        .map((select) => (
          <label key={select.name} className="text-xs font-semibold text-muted">
            <span className="sr-only">{select.label}</span>
            <select
              aria-label={select.label}
              className="block min-h-10 rounded-lg border border-line bg-white px-3 text-sm font-medium text-navy"
              value={value(select.name)}
              onChange={(event) =>
                setChosen((values) => ({ ...values, [select.name]: event.target.value }))
              }
            >
              <option value="">{select.anyLabel}</option>
              {select.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}

      <Button type="submit" size="sm" variant="secondary">
        {t.admin.filters.apply}
      </Button>

      {Object.entries(current).some(
        ([key, chosenValue]) => chosenValue && !['q', 'status', 'page'].includes(key),
      ) ? (
        <Link
          href={listHref(basePath, { q: current.q, status: current.status }, {})}
          className="text-sm font-semibold text-blue hover:underline"
        >
          {t.admin.filters.clear}
        </Link>
      ) : null}
    </form>
  );
}
