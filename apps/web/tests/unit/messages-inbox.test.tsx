import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

import { MessagesInbox } from '@/features/messages/messages-inbox';

const request = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api/browser', () => ({ api: request }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});

const now = Date.parse('2026-09-22T10:00:00Z');
const list = {
  data: [
    {
      kind: 'contact' as const,
      key: '12',
      title: 'Training for our firm',
      subtitle: 'salma@example.com',
      status: 'open',
      waiting: true,
      preview: 'Do you run on-site training?',
      preview_from: 'customer' as const,
      at: '2026-09-22T09:55:00Z',
      person: { name: 'Salma', email: 'salma@example.com', avatar_url: null },
      url: '/dashboard/messages?c=contact:12',
    },
  ],
  meta: {
    kinds: ['ticket', 'contact'] as ('ticket' | 'contact')[],
    waiting: { ticket: 0, contact: 1 },
  },
};

beforeEach(() => {
  request.mockReset();
  push.mockReset();
  request.mockResolvedValue({
    data: {
      kind: 'contact',
      key: '12',
      title: 'Training for our firm',
      subtitle: 'salma@example.com',
      status: 'open',
      waiting: true,
      at: '2026-09-22T09:55:00Z',
      person: { name: 'Salma', email: 'salma@example.com', avatar_url: null },
      url: '/dashboard/messages?c=contact:12',
      can_reply: true,
      actions: { internal_note: false, resolve: false, moderate: false },
      messages: [
        {
          id: 'c12',
          from: 'customer',
          author: 'Salma',
          body: 'Do you run on-site training?',
          at: '2026-09-22T09:55:00Z',
          avatar_url: null,
        },
      ],
    },
  });
});

it('lists conversations and opens one from the address', async () => {
  render(
    <MessagesInbox initial={list} kind={null} waiting={false} selected={null} renderedAt={now} />,
  );

  expect(screen.getByText('Choose a conversation on the left.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Salma/ }));
  expect(push).toHaveBeenCalledWith('/dashboard/messages?c=contact%3A12');
});

it('shows the open conversation with a reply box that answers by email', async () => {
  render(
    <MessagesInbox
      initial={list}
      kind={null}
      waiting={false}
      selected="contact:12"
      renderedAt={now}
    />,
  );

  expect(await screen.findByText('The reply goes to the sender by email.')).toBeInTheDocument();
  expect(request).toHaveBeenCalledWith('/admin/conversations/contact/12');
});

it('filters by kind and by waiting', () => {
  render(
    <MessagesInbox initial={list} kind={null} waiting={false} selected={null} renderedAt={now} />,
  );

  fireEvent.click(screen.getByRole('button', { name: /^Contact/ }));
  expect(push).toHaveBeenCalledWith('/dashboard/messages?kind=contact');
  fireEvent.click(screen.getByLabelText('Waiting'));
  expect(push).toHaveBeenCalledWith('/dashboard/messages?filter=waiting');
});
