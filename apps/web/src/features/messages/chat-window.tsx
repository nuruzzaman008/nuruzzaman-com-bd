'use client';

import { ExternalLink, Minus, X } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { useLocale } from '@/lib/i18n/locale-provider';

import { ChatThread } from './chat-thread';
import { chatPageHref, closeChat, toggleChatMinimized, useChat } from './chat-store';
import { PersonAvatar } from './person-avatar';

/**
 * The floating chat window, bottom right, the way Facebook opens a chat. It
 * sits in the layout, so it stays open while the dashboard page underneath
 * changes. Opened from the bell (openChat).
 */
export function ChatWindowHost() {
  const { t } = useLocale();
  const copy = t.messages;
  const { source, minimized } = useChat();

  if (!source) return null;

  const button =
    'grid size-8 place-items-center rounded-full text-navy hover:bg-surface focus-visible:bg-surface';

  return (
    <section
      aria-label={copy.title}
      className="fixed end-3 bottom-0 z-50 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-t-xl border border-b-0 border-line bg-white shadow-2xl"
    >
      <ChatThread
        key={`${source.scope}:${source.kind}:${source.key}`}
        source={source}
        variant="window"
        collapsed={minimized}
        header={(thread) => (
          <div
            className={cn(
              'flex items-center gap-2 border-b border-line px-2.5 py-2',
              minimized && 'border-b-0',
            )}
          >
            <button
              type="button"
              onClick={toggleChatMinimized}
              className="flex min-w-0 flex-1 items-center gap-2 text-start"
            >
              <PersonAvatar name={thread?.person.name} src={thread?.person.avatar_url} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-navy">
                  {thread?.person.name ?? '…'}
                </span>
                <span className="block truncate text-xs text-muted">{thread?.title}</span>
              </span>
            </button>
            <Link
              href={chatPageHref(source)}
              onClick={closeChat}
              aria-label={copy.openFull}
              title={copy.openFull}
              className={button}
            >
              <ExternalLink className="size-4" aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={toggleChatMinimized}
              aria-label={copy.minimize}
              title={copy.minimize}
              className={button}
            >
              <Minus className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={closeChat}
              aria-label={copy.close}
              title={copy.close}
              className={button}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        )}
      />
    </section>
  );
}
