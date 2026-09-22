'use client';

import type { NotificationFeed, NotificationItem } from '@nuruzzaman/contracts';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { api, ApiError } from '@/lib/api/browser';
import { cn } from '@/lib/cn';
import { useLocale } from '@/lib/i18n/locale-provider';

import { playChime, readAlertSetting, showDesktopNotification } from './alerts';
import { relativeTime } from './time';

/** How often an open page asks for new notifications. */
const POLL_MS = 30_000;
/** More than this many at once become one summary alert instead of a burst. */
const MAX_SEPARATE_ALERTS = 3;

/*
  Which notifications this tab has already seen. Module scope rather than
  state: pages remount their shell on navigation, and an alert must be neither
  lost nor repeated because of that. Kept in plain functions, outside the
  component, so rendering never mutates it.
*/
const seen = new Set<string>();
let primed = false;

/** The unread items not seen before; empty on the very first load. */
function takeFresh(items: NotificationItem[]): NotificationItem[] {
  const fresh = primed ? items.filter((item) => !item.read && !seen.has(item.id)) : [];
  primed = true;
  for (const item of items) seen.add(item.id);

  return fresh;
}

/** "(3) Page title", so a background tab shows there is news. */
function applyTitleCount(unread: number): void {
  const base = document.title.replace(/^\(\d+\+?\)\s*/, '');
  const wanted = unread > 0 ? `(${unread > 99 ? '99+' : unread}) ${base}` : base;
  if (document.title !== wanted) document.title = wanted;
}

function alertFor(fresh: NotificationItem[], summary: string, allHref: string): void {
  if (readAlertSetting('desktop')) {
    if (fresh.length <= MAX_SEPARATE_ALERTS) {
      for (const item of fresh) {
        showDesktopNotification({
          title: item.title,
          body: item.body,
          href: item.url ?? allHref,
          tag: item.id,
        });
      }
    } else {
      showDesktopNotification({
        title: summary,
        body: fresh[0]?.title ?? '',
        href: allHref,
        tag: `summary-${fresh[0]?.id ?? ''}`,
      });
    }
  }
  if (readAlertSetting('sound')) playChime();
}

/**
 * The bell: the unread count, a panel with the newest notifications, and live
 * updates while the page is open.
 *
 * It polls a small JSON feed instead of holding a connection open - the host
 * serves ordinary requests, and half a minute is soon enough for an order or a
 * ticket. Polling pauses while the tab is hidden and catches up on return.
 */
export function NotificationBell({
  scope,
  allHref,
  settingsHref,
  tone = 'light',
}: {
  scope: 'admin' | 'me';
  allHref: string;
  settingsHref?: string;
  tone?: 'light' | 'inverse';
}) {
  const { locale, t } = useLocale();
  const copy = t.notifications;
  const router = useRouter();
  const panelId = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const stopped = useRef(false);

  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ringing, setRinging] = useState(false);
  const [now, setNow] = useState(0);
  const [announcement, setAnnouncement] = useState('');

  const apply = useCallback(
    (feed: NotificationFeed) => {
      setUnread(feed.meta.unread);
      setItems(feed.data);
      setFailed(false);
      setNow(Date.now());

      const fresh = takeFresh(feed.data);
      if (fresh.length > 0) {
        const summary = `${fresh.length}${copy.newSuffix}`;
        setRinging(true);
        window.setTimeout(() => setRinging(false), 1000);
        setAnnouncement(summary);
        alertFor(fresh, summary, allHref);
      }
    },
    [allHref, copy.newSuffix],
  );

  const load = useCallback(async () => {
    if (stopped.current) return;
    try {
      apply(await api<NotificationFeed>(`/${scope}/notifications/feed`, { query: { locale } }));
    } catch (error) {
      // Signed out, or not allowed (a staff session still waiting for its
      // two-step code): stop asking rather than fail every half minute.
      if (error instanceof ApiError && (error.isUnauthenticated || error.isForbidden)) {
        stopped.current = true;
        return;
      }
      setFailed(true);
    }
  }, [apply, locale, scope]);

  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  // Next.js rewrites <title> on navigation; put the count back when it does.
  useEffect(() => {
    applyTitleCount(unread);
    const observer = new MutationObserver(() => applyTitleCount(unread));
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });

    return () => observer.disconnect();
  }, [unread]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function markAllRead() {
    setBusy(true);
    try {
      await api(`/${scope}/notifications/read-all`, { method: 'POST' });
      await load();
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function openItem(item: NotificationItem) {
    setOpen(false);
    if (!item.read) {
      // Best effort: a failed "read" must not stop the page opening.
      await api(`/${scope}/notifications/${item.id}/read`, { method: 'POST' }).catch(() => null);
    }
    router.push(item.url ?? allHref);
  }

  const label = unread > 0 ? `${copy.bell} (${unread}${copy.unreadSuffix})` : copy.bell;

  return (
    <div className="relative" ref={wrapper}>
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((value) => !value);
          if (!open) void load();
        }}
        className={cn(
          'relative grid size-10 place-items-center rounded-lg border transition-colors',
          tone === 'inverse'
            ? 'border-white/25 text-white hover:bg-white/10'
            : 'border-line bg-white text-navy hover:border-blue',
          open && (tone === 'inverse' ? 'bg-white/10' : 'border-blue'),
        )}
      >
        <Bell
          aria-hidden="true"
          className={cn('size-5', ringing && 'motion-safe:animate-[bounce_0.9s_ease-in-out_1]')}
        />
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className="font-latin absolute -end-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-amber px-1 text-xs font-bold text-navy"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>

      {open ? (
        <div
          id={panelId}
          role="region"
          aria-label={copy.bell}
          className="absolute end-0 top-12 z-50 flex max-h-[min(72vh,36rem)] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-line bg-white text-navy shadow-xl"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <p className="font-bold">{copy.bell}</p>
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={busy || unread === 0}
              className="rounded px-1.5 py-1 text-sm font-semibold text-blue underline-offset-2 hover:underline disabled:opacity-40 disabled:hover:no-underline"
            >
              {copy.markAllRead}
            </button>
          </div>

          {items === null ? (
            <p className="px-4 py-8 text-center text-sm text-muted">
              {failed ? copy.loadFailed : copy.loading}
            </p>
          ) : items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">{copy.empty}</p>
          ) : (
            <ul className="flex-1 divide-y divide-line overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => void openItem(item)}
                    className={cn(
                      'grid w-full grid-cols-[0.5rem_1fr] gap-3 px-4 py-3 text-start hover:bg-surface focus-visible:bg-surface',
                      !item.read && 'bg-amber-soft/60',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn('mt-1.5 size-2 rounded-full', !item.read && 'bg-amber')}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold break-words">{item.title}</span>
                      {item.body ? (
                        <span className="mt-0.5 block text-sm break-words text-muted">
                          {item.body}
                        </span>
                      ) : null}
                      <time
                        dateTime={item.created_at ?? undefined}
                        className="mt-1 block text-xs text-muted"
                      >
                        {now ? relativeTime(item.created_at, copy, locale, now) : ''}
                      </time>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3 text-sm font-semibold">
            <Link
              href={allHref}
              onClick={() => setOpen(false)}
              className="text-blue hover:underline"
            >
              {copy.viewAll}
            </Link>
            {settingsHref ? (
              <Link
                href={settingsHref}
                onClick={() => setOpen(false)}
                className="text-blue hover:underline"
              >
                {copy.settings}
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
