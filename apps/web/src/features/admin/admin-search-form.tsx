import Link from 'next/link';

import { number } from '@/lib/format';

/**
 * The search box above an admin list. A plain GET form, so it works before any
 * script has loaded and the search stays in the address bar; the list's other
 * filters - a post's status, say - are carried along in hidden fields.
 */
export function AdminSearchForm({
  id,
  basePath,
  value,
  label,
  placeholder,
  searchLabel,
  locale,
  total,
  keep = {},
}: {
  id: string;
  /** The list's own address, for "Show all". */
  basePath: string;
  /** What is being searched for now, if anything. */
  value?: string;
  label: string;
  placeholder: string;
  searchLabel: string;
  locale: 'bn' | 'en';
  /** How many rows matched, shown while searching. */
  total?: number;
  keep?: Record<string, string | undefined>;
}) {
  const bn = locale === 'bn';
  const kept = Object.entries(keep).filter((entry): entry is [string, string] => Boolean(entry[1]));
  const clearHref = kept.length ? `${basePath}?${new URLSearchParams(kept).toString()}` : basePath;

  return (
    <div className="mt-5">
      <form method="get" role="search" className="flex max-w-xl flex-wrap items-center gap-2">
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <input
          id={id}
          type="search"
          name="q"
          defaultValue={value ?? ''}
          placeholder={placeholder}
          maxLength={120}
          autoComplete="off"
          className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-sm"
        />
        {kept.map(([name, keptValue]) => (
          <input key={name} type="hidden" name={name} value={keptValue} />
        ))}
        <button
          type="submit"
          className="inline-flex h-11 items-center rounded-lg bg-blue px-4 text-sm font-semibold text-white hover:bg-navy"
        >
          {searchLabel}
        </button>
        {value ? (
          <Link href={clearHref} className="text-sm font-semibold text-blue hover:underline">
            {bn ? 'সব দেখুন' : 'Show all'}
          </Link>
        ) : null}
      </form>
      {value && total !== undefined ? (
        <p role="status" className="mt-2 text-sm text-muted">
          {bn
            ? `“${value}” — ${number(total, locale)}টি ফলাফল`
            : `“${value}” — ${total} ${total === 1 ? 'result' : 'results'}`}
        </p>
      ) : null}
    </div>
  );
}
