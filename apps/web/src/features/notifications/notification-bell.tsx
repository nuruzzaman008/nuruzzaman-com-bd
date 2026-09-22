'use client';

import type {
  ConversationList,
  ConversationSummary,
  NotificationFeed,
  NotificationItem,
  PendingCount,
} from '@nuruzzaman/contracts';
import { Bell, MoreHorizontal, Reply, Settings } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { api, ApiError } from '@/lib/api/browser';
import { cn } from '@/lib/cn';
import { useLocale } from '@/lib/i18n/locale-provider';

import { openChat, type ChatSource } from '../messages/chat-store';
import { ChatWindowHost } from '../messages/chat-window';
import { PersonAvatar } from '../messages/person-avatar';
import { badgeForKind, badgeForType } from '../messages/type-badge';
import { playChime, readAlertSetting, showDesktopNotification } from './alerts';
import { relativeTime } from './time';

/** How often an open page asks for new notifications. */
const POLL_MS = 30_000;
/** More than this many at once become one summary alert instead of a burst. */
const MAX_SEPARATE_ALERTS = 3;

type Tab = 'all' | 'unread' | 'messages';

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
          title: item.person?.name ? `${item.person.name}: ${item.title}` : item.title,
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

/** The summary without the name that is already shown in bold above it. */
function bodyWithoutName(item: NotificationItem): string {
  const name = item.person?.name;
  if (name && item.body.startsWith(`${name} · `)) return item.body.slice(name.length + 3);

  return item.body === name ? '' : item.body;
}

function chatFor(
  scope: 'admin' | 'me',
  conversation: NotificationItem['conversation'],
): ChatSource | null {
  if (!conversation) return null;
  if (scope === 'me')
    return conversation.kind === 'ticket' ? { scope, kind: 'ticket', key: conversation.key } : null;

  return { scope, kind: conversation.kind, key: conversation.key };
}

/**
 * The one bell: notifications Facebook style (a face or a coloured initial,
 * a small icon for what happened, "New" and "Earlier"), what is still waiting
 * on this person, and - for staff - a Messages tab with every conversation,
 * each opening in a chat window for a quick reply.
 *
 * It polls a small JSON feed instead of holding a connection open; half a
 * minute is soon enough for an order or a ticket. Polling pauses while the
 * tab is hidden and catches up on return.
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
  const messages = t.messages;
  const router = useRouter();
  const panelId = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const stopped = useRef(false);

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('all');
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [pending, setPending] = useState<PendingCount[]>([]);
  const [waiting, setWaiting] = useState(0);
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ringing, setRinging] = useState(false);
  const [now, setNow] = useState(0);
  const [announcement, setAnnouncement] = useState('');

  const apply = useCallback(
    (feed: NotificationFeed) => {
      setUnread(feed.meta.unread);
      setItems(feed.data);
      setPending(feed.meta.pending ?? []);
      setWaiting(feed.meta.messages_waiting ?? 0);
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

  const loadConversations = useCallback(async () => {
    if (scope !== 'admin') return;
    try {
      const list = await api<ConversationList>('/admin/conversations');
      setConversations(list.data);
    } catch {
      setConversations([]);
    }
  }, [scope]);

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

  // The Messages tab keeps itself current while it is the one showing.
  useEffect(() => {
    if (!open || tab !== 'messages') return;
    const first = window.setTimeout(() => void loadConversations(), 0);
    const timer = window.setInterval(() => void loadConversations(), POLL_MS);

    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [open, tab, loadConversations]);

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
      if (!wrapper.current?.contains(event.target as Node)) {
        setOpen(false);
        setMenuFor(null);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setMenuFor(null);
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function change(request: Promise<unknown>) {
    setBusy(true);
    try {
      await request;
      await load();
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
      setMenuFor(null);
    }
  }

  async function markRead(item: NotificationItem) {
    if (!item.read) {
      // Best effort: a failed "read" must not stop the page opening.
      await api(`/${scope}/notifications/${item.id}/read`, { method: 'POST' }).catch(() => null);
    }
  }

  async function openItem(item: NotificationItem) {
    setOpen(false);
    await markRead(item);
    router.push(item.url ?? allHref);
  }

  async function reply(item: NotificationItem) {
    const source = chatFor(scope, item.conversation);
    if (!source) return;
    setOpen(false);
    openChat(source);
    await markRead(item);
    void load();
  }

  const label = unread > 0 ? `${copy.bell} (${unread}${copy.unreadSuffix})` : copy.bell;
  const visible = (items ?? []).filter((item) => tab !== 'unread' || !item.read);
  const sections =
    tab === 'all'
      ? [
          { heading: copy.newSection, rows: visible.filter((item) => !item.read) },
          { heading: copy.earlierSection, rows: visible.filter((item) => item.read) },
        ]
      : [{ heading: null, rows: visible }];
  const todo = pending.filter((row) => row.count > 0);

  function renderItem(item: NotificationItem) {
    const source = chatFor(scope, item.conversation);
    const body = bodyWithoutName(item);

    return (
      <li key={item.id} className="group relative rounded-lg hover:bg-surface">
        <div className="flex items-start">
          <button
            type="button"
            onClick={() => void openItem(item)}
            className="flex min-w-0 flex-1 gap-3 rounded-lg p-2 text-start focus-visible:bg-surface"
          >
            <PersonAvatar
              name={item.person?.name ?? item.title}
              src={item.person?.avatar_url}
              size="lg"
              badge={badgeForType(item.type)}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm break-words text-navy">
                {item.person?.name ? <strong>{item.person.name}</strong> : null}
                {item.person?.name ? ' · ' : null}
                {item.title}
              </span>
              {body ? (
                <span className="mt-0.5 line-clamp-2 block text-[0.8rem] break-words text-muted">
                  {body}
                </span>
              ) : null}
              <time
                dateTime={item.created_at ?? undefined}
                className={cn(
                  'mt-0.5 block text-xs',
                  item.read ? 'text-muted' : 'font-semibold text-blue',
                )}
              >
                {now ? relativeTime(item.created_at, copy, locale, now) : ''}
              </time>
            </span>
          </button>
          <div className="flex shrink-0 flex-col items-center gap-2 py-3 pe-2">
            <button
              type="button"
              aria-label={copy.moreOptions}
              aria-expanded={menuFor === item.id}
              onClick={() => setMenuFor((current) => (current === item.id ? null : item.id))}
              className="grid size-7 place-items-center rounded-full bg-white text-navy opacity-0 shadow ring-1 ring-line group-hover:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
            >
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </button>
            {!item.read ? (
              <span aria-hidden="true" className="size-2.5 rounded-full bg-blue" />
            ) : null}
          </div>
        </div>
        {source ? (
          <div className="-mt-1 ps-[4.25rem] pb-2">
            <button
              type="button"
              onClick={() => void reply(item)}
              className="inline-flex items-center gap-1 rounded-md bg-blue-soft px-2.5 py-1 text-xs font-semibold text-blue hover:bg-blue hover:text-white"
            >
              <Reply className="size-3.5" aria-hidden="true" />
              {copy.reply}
            </button>
          </div>
        ) : null}
        {menuFor === item.id ? (
          <div className="absolute end-2 top-10 z-10 w-44 overflow-hidden rounded-lg border border-line bg-white py-1 text-sm shadow-lg">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void change(
                  api(`/${scope}/notifications/${item.id}/${item.read ? 'unread' : 'read'}`, {
                    method: 'POST',
                  }),
                )
              }
              className="block w-full px-3 py-2 text-start hover:bg-surface"
            >
              {item.read ? copy.markUnread : copy.markRead}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void change(api(`/${scope}/notifications/${item.id}`, { method: 'DELETE' }))
              }
              className="block w-full px-3 py-2 text-start text-red-700 hover:bg-surface"
            >
              {copy.delete}
            </button>
          </div>
        ) : null}
      </li>
    );
  }

  function renderConversation(conversation: ConversationSummary) {
    return (
      <li key={`${conversation.kind}:${conversation.key}`}>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            openChat({ scope: 'admin', kind: conversation.kind, key: conversation.key });
          }}
          className="flex w-full items-center gap-3 rounded-lg p-2 text-start hover:bg-surface"
        >
          <PersonAvatar
            name={conversation.person.name}
            src={conversation.person.avatar_url}
            size="lg"
            badge={badgeForKind(conversation.kind)}
          />
          <span className="min-w-0 flex-1">
            <span
              className={cn(
                'block truncate text-sm text-navy',
                conversation.waiting && 'font-bold',
              )}
            >
              {conversation.person.name ?? conversation.title}
            </span>
            <span className="block truncate text-xs text-muted">
              {messages.kinds[conversation.kind]} · {conversation.title}
            </span>
            <span
              className={cn(
                'block truncate text-[0.8rem]',
                conversation.waiting ? 'font-semibold text-navy' : 'text-muted',
              )}
            >
              {conversation.preview_from === 'staff' ? `${messages.you}: ` : ''}
              {conversation.preview}
              {now ? ` · ${relativeTime(conversation.at, copy, locale, now)}` : ''}
            </span>
          </span>
          {conversation.waiting ? (
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-blue" />
          ) : null}
        </button>
      </li>
    );
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'all', label: copy.all },
    { key: 'unread', label: copy.unread },
    ...(scope === 'admin'
      ? [{ key: 'messages' as const, label: copy.messagesTab, count: waiting }]
      : []),
  ];

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
          setMenuFor(null);
          if (!open) void load();
        }}
        className={cn(
          'relative grid size-10 place-items-center rounded-full border transition-colors',
          tone === 'inverse'
            ? 'border-white/25 text-white hover:bg-white/10'
            : 'border-line bg-white text-navy hover:border-blue',
          open && (tone === 'inverse' ? 'bg-white/10' : 'border-blue bg-blue-soft text-blue'),
        )}
      >
        <Bell
          aria-hidden="true"
          className={cn('size-5', ringing && 'motion-safe:animate-[bounce_0.9s_ease-in-out_1]')}
        />
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className="font-latin absolute -end-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-xs font-bold text-white ring-2 ring-white"
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
          className="absolute end-0 top-12 z-50 flex max-h-[min(80vh,42rem)] w-[min(25rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-line bg-white text-navy shadow-2xl"
        >
          <div className="flex items-center justify-between gap-2 px-4 pt-3">
            <p className="text-xl font-bold">{copy.bell}</p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  void change(api(`/${scope}/notifications/read-all`, { method: 'POST' }))
                }
                disabled={busy || unread === 0}
                className="rounded-md px-2 py-1 text-sm font-semibold text-blue hover:bg-surface disabled:opacity-40"
              >
                {copy.markAllRead}
              </button>
              {settingsHref ? (
                <Link
                  href={settingsHref}
                  onClick={() => setOpen(false)}
                  aria-label={copy.settings}
                  title={copy.settings}
                  className="grid size-8 place-items-center rounded-full hover:bg-surface"
                >
                  <Settings className="size-4" aria-hidden="true" />
                </Link>
              ) : null}
            </div>
          </div>

          <div role="tablist" aria-label={copy.bell} className="flex gap-1 px-3 pt-2 pb-1">
            {tabs.map((entry) => (
              <button
                key={entry.key}
                type="button"
                role="tab"
                aria-selected={tab === entry.key}
                onClick={() => {
                  setTab(entry.key);
                  setMenuFor(null);
                }}
                className={cn(
                  'rounded-full px-3 py-1.5 text-sm font-semibold',
                  tab === entry.key ? 'bg-blue-soft text-blue' : 'text-navy hover:bg-surface',
                )}
              >
                {entry.label}
                {entry.count ? (
                  <span className="font-latin ms-1.5 rounded-full bg-red-600 px-1.5 text-xs text-white">
                    {entry.count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {todo.length > 0 && tab !== 'messages' ? (
            <div className="border-b border-line px-4 pt-1 pb-2.5">
              <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
                {copy.pendingTitle}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {todo.map((row) => (
                  <Link
                    key={row.key}
                    href={row.url}
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-navy hover:bg-blue-soft"
                  >
                    {copy.pending[row.key as keyof typeof copy.pending] ?? row.key}
                    <span className="font-latin rounded-full bg-amber px-1.5 text-navy">
                      {row.count}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
            {tab === 'messages' ? (
              conversations === null ? (
                <p className="px-4 py-8 text-center text-sm text-muted">{copy.loading}</p>
              ) : conversations.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted">{messages.empty}</p>
              ) : (
                <ul>{conversations.map(renderConversation)}</ul>
              )
            ) : items === null ? (
              <p className="px-4 py-8 text-center text-sm text-muted">
                {failed ? copy.loadFailed : copy.loading}
              </p>
            ) : visible.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">
                {tab === 'unread' ? copy.emptyUnread : copy.empty}
              </p>
            ) : (
              sections
                .filter((section) => section.rows.length > 0)
                .map((section) => (
                  <div key={section.heading ?? 'all'}>
                    {section.heading ? (
                      <p className="px-2 pt-2 pb-1 text-sm font-bold text-navy">
                        {section.heading}
                      </p>
                    ) : null}
                    <ul>{section.rows.map(renderItem)}</ul>
                  </div>
                ))
            )}
          </div>

          <div className="border-t border-line px-4 py-2.5 text-center text-sm font-semibold">
            {tab === 'messages' ? (
              <Link
                href="/dashboard/messages"
                onClick={() => setOpen(false)}
                className="text-blue hover:underline"
              >
                {copy.allMessages}
              </Link>
            ) : (
              <Link
                href={allHref}
                onClick={() => setOpen(false)}
                className="text-blue hover:underline"
              >
                {copy.viewAll}
              </Link>
            )}
          </div>
        </div>
      ) : null}

      <ChatWindowHost />
    </div>
  );
}
