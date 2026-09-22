import type { Metadata } from 'next';
import type { ConversationList } from '@nuruzzaman/contracts';

import { MessagesInbox } from '@/features/messages/messages-inbox';
import { sessionApi } from '@/lib/api/server';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.messages.title);
}

const KINDS = ['ticket', 'contact', 'question', 'comment'] as const;

/** Read once per request, so every row agrees about "now". */
function requestTime(): number {
  return Date.now();
}

/**
 * Dashboard -> Messages: support tickets, contact form messages, student
 * questions and comments as one Messenger-style inbox. `?c=ticket:TCK-1234`
 * opens a conversation, which is what the bell and notifications link to.
 */
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; filter?: string; c?: string }>;
}) {
  const { t } = await adminDictionary();
  const params = await searchParams;
  const kind = KINDS.find((item) => item === params.kind) ?? null;
  const waiting = params.filter === 'waiting';
  const selected = params.c && params.c.length <= 80 && /^[a-z]+:/.test(params.c) ? params.c : null;

  const query = new URLSearchParams({ filter: waiting ? 'waiting' : 'all' });
  if (kind) query.set('kind', kind);
  const list = await sessionApi<ConversationList>(`/admin/conversations?${query.toString()}`);

  return (
    <div className="max-w-6xl">
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">{t.messages.title}</h1>
      <p className="mt-2 text-sm text-muted">{t.messages.intro}</p>
      {/* Keyed by the filters: a new filter starts from the server's list. */}
      <MessagesInbox
        key={`${kind ?? 'all'}:${waiting}`}
        initial={list}
        kind={kind}
        waiting={waiting}
        selected={selected}
        renderedAt={requestTime()}
      />
    </div>
  );
}
