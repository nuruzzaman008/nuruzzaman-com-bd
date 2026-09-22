import { useSyncExternalStore } from 'react';

/** Where a conversation lives: the staff inbox, or a customer's own ticket. */
export type ChatSource =
  | { scope: 'admin'; kind: 'ticket' | 'contact' | 'question' | 'comment'; key: string }
  | { scope: 'me'; kind: 'ticket'; key: string };

type ChatState = { source: ChatSource | null; minimized: boolean };

/*
  The one chat window, shared by whatever opens it (the bell, a notification)
  and the window itself, which lives in the layout. A tiny store rather than a
  context: the layout persists across dashboard pages, so the window stays
  open while the rest of the page changes, like a Facebook chat.
*/
let state: ChatState = { source: null, minimized: false };
const listeners = new Set<() => void>();

function set(next: ChatState): void {
  state = next;
  for (const listener of listeners) listener();
}

export function openChat(source: ChatSource): void {
  set({ source, minimized: false });
}

export function closeChat(): void {
  set({ source: null, minimized: false });
}

export function toggleChatMinimized(): void {
  set({ ...state, minimized: !state.minimized });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

const serverState: ChatState = { source: null, minimized: false };

export function useChat(): ChatState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => serverState,
  );
}

/** The full page a conversation opens in. */
export function chatPageHref(source: ChatSource): string {
  return source.scope === 'me'
    ? `/account/support?ticket=${encodeURIComponent(source.key)}`
    : `/dashboard/messages?c=${source.kind}:${encodeURIComponent(source.key)}`;
}
