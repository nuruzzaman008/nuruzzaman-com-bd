'use client';

import type { ConversationThread } from '@nuruzzaman/contracts';
import { SendHorizontal } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '@/lib/api/browser';
import { cn } from '@/lib/cn';
import { useLocale } from '@/lib/i18n/locale-provider';

import { fullTime, relativeTime } from '../notifications/time';
import type { ChatSource } from './chat-store';
import { PersonAvatar } from './person-avatar';

/** How often an open conversation asks for new messages. */
const POLL_MS = 10_000;

type Bubble = {
  id: string;
  from: 'customer' | 'staff' | 'note';
  author: string | null;
  avatar_url: string | null;
  body: string;
  at: string | null;
};

export type Thread = {
  title: string;
  subtitle: string | null;
  status: string;
  person: { name: string | null; email: string | null; avatar_url: string | null };
  canReply: boolean;
  actions: { internal_note: boolean; resolve: boolean; moderate: boolean };
  messages: Bubble[];
};

type CustomerTicket = {
  reference: string;
  name: string;
  subject: string;
  category: string;
  status: string;
  messages?: { id: number; author_kind: string; body: string; is_internal: boolean; at: string }[];
};

function fromStaffThread(data: ConversationThread): Thread {
  return {
    title: data.title,
    subtitle: data.subtitle,
    status: data.status,
    person: data.person,
    canReply: data.can_reply,
    actions: data.actions,
    messages: data.messages.map((message) => ({ ...message, body: message.body ?? '' })),
  };
}

function fromCustomerTicket(ticket: CustomerTicket, support: string): Thread {
  return {
    title: ticket.subject,
    subtitle: ticket.reference,
    status: ticket.status,
    person: { name: support, email: null, avatar_url: null },
    // A customer can always write back; a resolved ticket reopens.
    canReply: true,
    actions: { internal_note: false, resolve: false, moderate: false },
    messages: (ticket.messages ?? [])
      .filter((message) => !message.is_internal)
      .map((message) => ({
        id: `m${message.id}`,
        from: message.author_kind === 'staff' ? 'staff' : 'customer',
        author: message.author_kind === 'staff' ? support : ticket.name,
        avatar_url: null,
        body: message.body,
        at: message.at,
      })),
  };
}

/** Where a reply to this conversation is posted: each kind's own endpoint. */
function replyRequest(source: ChatSource, body: string, internal: boolean) {
  const key = encodeURIComponent(source.key);
  if (source.scope === 'me') {
    return api(`/account/support-tickets/${key}/replies`, {
      method: 'POST',
      body: { message: body },
    });
  }
  switch (source.kind) {
    case 'ticket':
      return api(`/admin/support-tickets/${key}/replies`, {
        method: 'POST',
        body: { message: body, is_internal: internal },
      });
    case 'contact':
      return api(`/admin/contact-messages/${key}/replies`, { method: 'POST', body: { body } });
    case 'question':
      return api(`/admin/course-questions/${key}/replies`, { method: 'POST', body: { body } });
    default:
      return Promise.reject(new Error('This conversation cannot be replied to.'));
  }
}

/**
 * One conversation, Messenger style: the other person on the left, the
 * viewer on the right, internal ticket notes in yellow, and a reply box at
 * the bottom that sends on Enter.
 *
 * Used in the floating chat window, on Dashboard -> Messages and on the
 * customer's support page. It polls while open, so a new message shows up
 * without reloading.
 */
export function ChatThread({
  source,
  variant = 'page',
  header,
  onChanged,
  collapsed = false,
}: {
  source: ChatSource;
  variant?: 'page' | 'window';
  /** Only the header shows (a minimised chat window); it keeps listening. */
  collapsed?: boolean;
  /** Replaces the default header, e.g. with the window's own controls. */
  header?: (thread: Thread | null) => React.ReactNode;
  onChanged?: () => void;
}) {
  const { locale, t } = useLocale();
  const copy = t.messages;
  const [thread, setThread] = useState<Thread | null>(null);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState('');
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);

  const load = useCallback(async () => {
    try {
      const next =
        source.scope === 'me'
          ? fromCustomerTicket(
              (
                await api<{ data: CustomerTicket }>(
                  `/account/support-tickets/${encodeURIComponent(source.key)}`,
                )
              ).data,
              copy.support,
            )
          : fromStaffThread(
              (
                await api<{ data: ConversationThread }>(
                  `/admin/conversations/${source.kind}/${encodeURIComponent(source.key)}`,
                )
              ).data,
            );
      setThread(next);
      setFailed(false);
      setNow(Date.now());
    } catch {
      setFailed(true);
    }
  }, [copy.support, source.key, source.kind, source.scope]);

  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_MS);

    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [load]);

  // Keep the newest message in view when one arrives.
  useEffect(() => {
    const count = thread?.messages.length ?? 0;
    if (count !== lastCount.current && scroller.current) {
      scroller.current.scrollTop = scroller.current.scrollHeight;
    }
    lastCount.current = count;
  }, [thread]);

  async function send() {
    const body = draft.trim();
    if (body.length < 2 || sending) return;
    setSending(true);
    setError(null);
    try {
      await replyRequest(source, body, internal);
      setDraft('');
      setInternal(false);
      await load();
      onChanged?.();
    } catch {
      setError(copy.sendFailed);
    } finally {
      setSending(false);
    }
  }

  async function act(request: () => Promise<unknown>) {
    setSending(true);
    setError(null);
    try {
      await request();
      await load();
      onChanged?.();
    } catch {
      setError(copy.sendFailed);
    } finally {
      setSending(false);
    }
  }

  const key = encodeURIComponent(source.key);
  const mine = (bubble: Bubble) =>
    source.scope === 'me' ? bubble.from === 'customer' : bubble.from !== 'customer';
  const statusLabel = thread
    ? (copy.status[thread.status as keyof typeof copy.status] ?? thread.status)
    : '';

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col',
        variant === 'page' ? 'h-full' : collapsed ? '' : 'h-[26rem]',
      )}
    >
      {header ? (
        header(thread)
      ) : (
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <PersonAvatar name={thread?.person.name} src={thread?.person.avatar_url} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-navy">{thread?.person.name ?? '…'}</p>
            <p className="truncate text-xs text-muted">
              {[thread?.title, thread?.subtitle].filter(Boolean).join(' · ')}
            </p>
          </div>
          {thread ? (
            <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-muted">
              {statusLabel}
            </span>
          ) : null}
          {thread?.actions.resolve && source.scope === 'admin' ? (
            <button
              type="button"
              disabled={sending}
              onClick={() =>
                void act(() =>
                  api(`/admin/support-tickets/${key}`, {
                    method: 'PATCH',
                    body: { status: 'resolved' },
                  }),
                )
              }
              className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-navy hover:border-blue disabled:opacity-50"
            >
              {copy.resolve}
            </button>
          ) : null}
        </div>
      )}

      <div
        ref={scroller}
        hidden={collapsed}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-surface/40 px-3 py-4"
        aria-live="polite"
      >
        {thread === null ? (
          <p className="py-10 text-center text-sm text-muted">
            {failed ? copy.loadFailed : t.notifications.loading}
          </p>
        ) : (
          thread.messages.map((bubble) => {
            const own = mine(bubble);
            const note = bubble.from === 'note';

            return (
              <div key={bubble.id} className={cn('flex items-end gap-2', own && 'justify-end')}>
                {!own ? (
                  <PersonAvatar name={bubble.author} src={bubble.avatar_url} size="sm" />
                ) : null}
                <div className={cn('max-w-[80%]', own && 'text-end')}>
                  <p className="mb-0.5 px-1 text-[0.7rem] text-muted">
                    {note ? `${copy.note} · ` : ''}
                    {own && source.scope === 'me' ? copy.you : bubble.author}
                  </p>
                  <div
                    className={cn(
                      'inline-block rounded-2xl px-3.5 py-2 text-start text-sm break-words whitespace-pre-wrap',
                      note
                        ? 'border border-amber/50 bg-amber-soft text-navy'
                        : own
                          ? 'rounded-br-md bg-blue text-white'
                          : 'rounded-bl-md bg-white text-navy shadow-sm ring-1 ring-line',
                    )}
                  >
                    {bubble.body}
                  </div>
                  <time
                    dateTime={bubble.at ?? undefined}
                    title={fullTime(bubble.at, locale)}
                    className="mt-0.5 block px-1 text-[0.7rem] text-muted"
                  >
                    {now ? relativeTime(bubble.at, t.notifications, locale, now) : ''}
                  </time>
                </div>
              </div>
            );
          })
        )}
      </div>

      {collapsed ? null : error ? (
        <p
          role="alert"
          className="border-t border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-800"
        >
          {error}
        </p>
      ) : null}

      {collapsed ? null : thread?.actions.moderate && source.scope === 'admin' ? (
        <div className="border-t border-line bg-white px-3 py-3">
          <p className="mb-2 text-xs text-muted">{copy.commentHint}</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['approved', copy.approve, 'bg-emerald-600 text-white hover:bg-emerald-700'],
                ['rejected', copy.reject, 'border border-line text-navy hover:border-blue'],
                ['spam', copy.spam, 'border border-red-200 text-red-700 hover:bg-red-50'],
              ] as const
            ).map(([status, label, style]) => (
              <button
                key={status}
                type="button"
                disabled={sending || thread.status === status}
                onClick={() =>
                  void act(() =>
                    api(`/admin/comments/${key}/moderate`, { method: 'POST', body: { status } }),
                  )
                }
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-40',
                  style,
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : thread && !thread.canReply ? (
        <p className="border-t border-line bg-white px-3 py-3 text-xs text-muted">
          {copy.readOnly}
        </p>
      ) : thread ? (
        <form
          className="border-t border-line bg-white px-3 py-2.5"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          {source.scope === 'admin' && source.kind === 'contact' ? (
            <p className="mb-1.5 text-[0.7rem] text-muted">{copy.contactHint}</p>
          ) : null}
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                // Enter sends; Shift+Enter is a new line. An input method that
                // is still composing (Bengali keyboards) keeps its Enter.
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void send();
                }
              }}
              rows={1}
              maxLength={5000}
              placeholder={copy.placeholder}
              aria-label={copy.placeholder}
              title={copy.enterHint}
              className={cn(
                'max-h-32 min-h-10 flex-1 resize-none rounded-2xl border border-line px-3.5 py-2 text-sm [field-sizing:content] focus:border-blue focus:outline-none',
                internal && 'border-amber bg-amber-soft/60',
              )}
            />
            <button
              type="submit"
              disabled={sending || draft.trim().length < 2}
              aria-label={sending ? copy.sending : copy.send}
              title={sending ? copy.sending : copy.send}
              className="grid size-10 shrink-0 place-items-center rounded-full bg-blue text-white hover:bg-blue/90 disabled:opacity-40"
            >
              <SendHorizontal className="size-4" aria-hidden="true" />
            </button>
          </div>
          {thread.actions.internal_note && source.scope === 'admin' ? (
            <label className="mt-1.5 flex cursor-pointer items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={internal}
                onChange={(event) => setInternal(event.target.checked)}
                className="accent-amber"
              />
              {copy.internalNote}
            </label>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
