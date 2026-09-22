'use client';

import type { ConversationList, ConversationSummary } from '@nuruzzaman/contracts';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { api } from '@/lib/api/browser';
import { cn } from '@/lib/cn';
import { useLocale } from '@/lib/i18n/locale-provider';

import { relativeTime } from '../notifications/time';
import { ChatThread } from './chat-thread';
import { PersonAvatar } from './person-avatar';
import { badgeForKind } from './type-badge';

type Kind = ConversationSummary['kind'];

const LIST_POLL_MS = 30_000;

function selectionHref(kind: Kind | null, waiting: boolean, conversation: string | null): string {
  const params = new URLSearchParams();
  if (kind) params.set('kind', kind);
  if (waiting) params.set('filter', 'waiting');
  if (conversation) params.set('c', conversation);
  const search = params.toString();

  return search ? `/dashboard/messages?${search}` : '/dashboard/messages';
}

/**
 * Dashboard -> Messages: every conversation on the left, the open one on the
 * right, the way Messenger lays it out. On a phone it is one or the other,
 * with a way back.
 */
export function MessagesInbox({
  initial,
  kind,
  waiting,
  selected,
  renderedAt,
}: {
  initial: ConversationList;
  kind: Kind | null;
  waiting: boolean;
  /** "ticket:TCK-1234" and the like. */
  selected: string | null;
  renderedAt: number;
}) {
  const { locale, t } = useLocale();
  const copy = t.messages;
  const router = useRouter();
  const [list, setList] = useState(initial);
  const [now, setNow] = useState(renderedAt);

  const refresh = useCallback(async () => {
    try {
      setList(
        await api<ConversationList>('/admin/conversations', {
          query: { kind: kind ?? undefined, filter: waiting ? 'waiting' : 'all' },
        }),
      );
      setNow(Date.now());
    } catch {
      // Keep what is on screen; the next poll tries again.
    }
  }, [kind, waiting]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, LIST_POLL_MS);

    return () => window.clearInterval(timer);
  }, [refresh]);

  const [selectedKind, ...rest] = (selected ?? '').split(':');
  const selectedKey = rest.join(':');
  const open =
    selected && list.meta.kinds.includes(selectedKind as Kind) && selectedKey
      ? { scope: 'admin' as const, kind: selectedKind as Kind, key: selectedKey }
      : null;

  const pill = (active: boolean) =>
    cn(
      'shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold',
      active ? 'bg-blue-soft text-blue' : 'text-navy hover:bg-surface',
    );
  const waitingCounts = list.meta.waiting as Record<string, number>;

  return (
    <div className="mt-5 grid h-[calc(100dvh-13rem)] min-h-[32rem] overflow-hidden rounded-xl border border-line bg-white md:grid-cols-[22rem_1fr]">
      <aside
        className={cn('flex min-h-0 flex-col border-line md:border-e', open && 'hidden md:flex')}
      >
        <div className="flex gap-1 overflow-x-auto border-b border-line px-2 py-2">
          <button
            type="button"
            className={pill(kind === null)}
            onClick={() => router.push(selectionHref(null, waiting, null))}
          >
            {copy.all}
          </button>
          {list.meta.kinds.map((name) => (
            <button
              key={name}
              type="button"
              className={pill(kind === name)}
              onClick={() => router.push(selectionHref(name, waiting, null))}
            >
              {copy.kinds[name]}
              {waitingCounts[name] ? (
                <span className="font-latin ms-1.5 rounded-full bg-red-600 px-1.5 text-xs text-white">
                  {waitingCounts[name]}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-2 border-b border-line px-4 py-2 text-sm text-navy">
          <input
            type="checkbox"
            checked={waiting}
            onChange={(event) => router.push(selectionHref(kind, event.target.checked, selected))}
            className="accent-blue"
          />
          {copy.waiting}
        </label>
        <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {list.data.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-muted">
              {waiting ? copy.emptyWaiting : copy.empty}
            </li>
          ) : (
            list.data.map((conversation) => {
              const id = `${conversation.kind}:${conversation.key}`;
              const active = id === selected;

              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => router.push(selectionHref(kind, waiting, id))}
                    aria-current={active ? 'true' : undefined}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg p-2 text-start',
                      active ? 'bg-blue-soft' : 'hover:bg-surface',
                    )}
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
                        {copy.kinds[conversation.kind]} · {conversation.title}
                      </span>
                      <span
                        className={cn(
                          'block truncate text-[0.8rem]',
                          conversation.waiting ? 'font-semibold text-navy' : 'text-muted',
                        )}
                      >
                        {conversation.preview_from === 'staff' ? `${copy.you}: ` : ''}
                        {conversation.preview} ·{' '}
                        {relativeTime(conversation.at, t.notifications, locale, now)}
                      </span>
                    </span>
                    {conversation.waiting ? (
                      <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-blue" />
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </aside>

      <section className={cn('min-h-0', !open && 'hidden md:block')}>
        {open ? (
          <div className="flex h-full min-h-0 flex-col">
            <button
              type="button"
              onClick={() => router.push(selectionHref(kind, waiting, null))}
              className="flex items-center gap-1 border-b border-line px-3 py-2 text-sm font-semibold text-blue md:hidden"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              {copy.back}
            </button>
            <div className="min-h-0 flex-1">
              <ChatThread key={selected} source={open} onChanged={() => void refresh()} />
            </div>
          </div>
        ) : (
          <p className="grid h-full place-items-center px-6 text-center text-sm text-muted">
            {copy.pick}
          </p>
        )}
      </section>
    </div>
  );
}
