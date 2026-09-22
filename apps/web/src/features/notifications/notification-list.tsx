'use client';

import type {
  NotificationItem,
  NotificationList as NotificationListData,
} from '@nuruzzaman/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { api } from '@/lib/api/browser';
import { cn } from '@/lib/cn';
import type { Dictionary } from '@/lib/i18n/dictionary';
import { useLocale } from '@/lib/i18n/locale-provider';

import { fullTime, relativeTime } from './time';

type Category = keyof Dictionary['notifications']['categories'];
type Filter = 'all' | 'unread';

function href(
  basePath: string,
  values: { filter?: Filter; category?: string | null; page?: number },
) {
  const params = new URLSearchParams();
  if (values.filter === 'unread') params.set('filter', 'unread');
  if (values.category) params.set('category', values.category);
  if (values.page && values.page > 1) params.set('page', String(values.page));
  const search = params.toString();

  return search ? `${basePath}?${search}` : basePath;
}

function Pill({
  active,
  href: to,
  children,
}: {
  active: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'rounded-full border px-3 py-1.5 text-sm font-semibold',
        active
          ? 'border-navy bg-navy text-white'
          : 'border-line bg-white text-navy hover:border-blue',
      )}
    >
      {children}
    </Link>
  );
}

/**
 * The notification page: filters, the list, and what can be done to each.
 * Every change goes to the API and then re-reads the page from the server, so
 * the counts in the menu and the bell agree with it.
 */
export function NotificationList({
  scope,
  basePath,
  initial,
  filter,
  category,
  categories,
  renderedAt,
}: {
  scope: 'admin' | 'me';
  basePath: string;
  initial: NotificationListData;
  filter: Filter;
  category: string | null;
  categories: Category[];
  renderedAt: number;
}) {
  const { locale, t } = useLocale();
  const copy = t.notifications;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { data: items, meta } = initial;

  function run(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch {
        setError(copy.actionFailed);
      }
    });
  }

  function open(item: NotificationItem) {
    if (!item.url) {
      if (!item.read) run(() => api(`/${scope}/notifications/${item.id}/read`, { method: 'POST' }));
      return;
    }
    startTransition(async () => {
      if (!item.read) {
        await api(`/${scope}/notifications/${item.id}/read`, { method: 'POST' }).catch(() => null);
      }
      router.push(item.url as string);
    });
  }

  return (
    <div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label={copy.title} className="flex flex-wrap gap-2">
          <Pill active={filter === 'all'} href={href(basePath, { category })}>
            {copy.all}
          </Pill>
          <Pill active={filter === 'unread'} href={href(basePath, { filter: 'unread', category })}>
            {copy.unread} <span className="font-latin">({meta.unread})</span>
          </Pill>
        </nav>
        <div className="flex flex-wrap gap-3 text-sm font-semibold">
          <button
            type="button"
            disabled={pending || meta.unread === 0}
            onClick={() => run(() => api(`/${scope}/notifications/read-all`, { method: 'POST' }))}
            className="text-blue hover:underline disabled:opacity-40 disabled:hover:no-underline"
          >
            {copy.markAllRead}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => api(`/${scope}/notifications/read`, { method: 'DELETE' }))}
            className="text-red-700 hover:underline disabled:opacity-40"
          >
            {copy.clearRead}
          </button>
        </div>
      </div>

      <nav aria-label={copy.allCategories} className="mt-3 flex flex-wrap gap-2">
        <Pill active={category === null} href={href(basePath, { filter })}>
          {copy.allCategories}
        </Pill>
        {categories.map((name) => (
          <Pill
            key={name}
            active={category === name}
            href={href(basePath, { filter, category: name })}
          >
            {copy.categories[name]}
          </Pill>
        ))}
      </nav>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-line bg-white px-4 py-10 text-center text-sm text-muted">
          {filter === 'unread' ? copy.emptyUnread : copy.empty}
        </p>
      ) : (
        <ul
          aria-busy={pending}
          className={cn(
            'mt-5 divide-y divide-line overflow-hidden rounded-xl border border-line bg-white',
            pending && 'opacity-70',
          )}
        >
          {items.map((item) => (
            <li
              key={item.id}
              className={cn(
                'grid grid-cols-[0.5rem_1fr] gap-3 px-4 py-4 sm:grid-cols-[0.5rem_1fr_auto]',
                !item.read && 'bg-amber-soft/50',
              )}
            >
              <span
                aria-hidden="true"
                className={cn('mt-2 size-2 rounded-full', !item.read && 'bg-amber')}
              />
              <button type="button" onClick={() => open(item)} className="min-w-0 text-start">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-muted">
                    {copy.categories[item.category as Category] ?? item.category}
                  </span>
                  <span className="font-semibold break-words text-navy hover:underline">
                    {item.title}
                  </span>
                  {!item.read ? <span className="sr-only">({copy.unread})</span> : null}
                </span>
                {item.body ? (
                  <span className="mt-1 block text-sm break-words text-muted">{item.body}</span>
                ) : null}
                {item.detail ? (
                  <span className="mt-2 block border-s-2 border-line ps-3 text-sm break-words whitespace-pre-wrap text-navy/80">
                    {item.detail}
                  </span>
                ) : null}
                <time
                  dateTime={item.created_at ?? undefined}
                  title={fullTime(item.created_at, locale)}
                  className="mt-1.5 block text-xs text-muted"
                >
                  {relativeTime(item.created_at, copy, locale, renderedAt)}
                </time>
              </button>
              <div className="col-start-2 flex gap-3 text-sm font-semibold sm:col-start-3 sm:flex-col sm:items-end sm:gap-1">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(() =>
                      api(`/${scope}/notifications/${item.id}/${item.read ? 'unread' : 'read'}`, {
                        method: 'POST',
                      }),
                    )
                  }
                  className="text-blue hover:underline disabled:opacity-40"
                >
                  {item.read ? copy.markUnread : copy.markRead}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(() => api(`/${scope}/notifications/${item.id}`, { method: 'DELETE' }))
                  }
                  className="text-red-700 hover:underline disabled:opacity-40"
                >
                  {copy.delete}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {meta.last_page > 1 ? (
        <nav
          aria-label={copy.page}
          className="mt-5 flex items-center justify-center gap-4 text-sm font-semibold"
        >
          {meta.current_page > 1 ? (
            <Link
              className="text-blue hover:underline"
              href={href(basePath, { filter, category, page: meta.current_page - 1 })}
            >
              {copy.previous}
            </Link>
          ) : null}
          <span className="font-latin text-muted">
            {copy.page} {meta.current_page} / {meta.last_page}
          </span>
          {meta.current_page < meta.last_page ? (
            <Link
              className="text-blue hover:underline"
              href={href(basePath, { filter, category, page: meta.current_page + 1 })}
            >
              {copy.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
