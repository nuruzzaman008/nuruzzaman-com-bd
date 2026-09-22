import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { closeChat } from '@/features/messages/chat-store';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { notificationQuery, STAFF_CATEGORIES } from '@/features/notifications/query';
import { relativeTime } from '@/features/notifications/time';
import { getDictionary } from '@/lib/i18n/dictionary';

const request = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api/browser', () => ({
  api: request,
  ApiError: class ApiError extends Error {
    isUnauthenticated = false;
    isForbidden = false;
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary: dictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: dictionary('en') }) };
});

const item = (id: string, read = false, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'order.paid',
  category: 'orders',
  title: `New paid order · NB-${id}`,
  body: 'Rahim · ৳ 1,000.00',
  detail: null,
  url: `/dashboard/orders/NB-${id}`,
  read,
  created_at: new Date().toISOString(),
  conversation: null,
  person: { name: 'Rahim', avatar_url: null },
  ...extra,
});

const ticketItem = item('t1', false, {
  type: 'ticket.opened',
  category: 'support',
  title: 'New support ticket · TCK-1',
  body: 'Karim · Licence not activating',
  url: '/dashboard/messages?c=ticket:TCK-1',
  conversation: { kind: 'ticket', key: 'TCK-1' },
  person: { name: 'Karim', avatar_url: null },
});

const thread = {
  kind: 'ticket',
  key: 'TCK-1',
  title: 'Licence not activating',
  subtitle: 'TCK-1',
  status: 'open',
  waiting: true,
  at: new Date().toISOString(),
  person: { name: 'Karim', email: 'k@example.com', avatar_url: null },
  url: '/dashboard/messages?c=ticket:TCK-1',
  can_reply: true,
  actions: { internal_note: true, resolve: true, moderate: false },
  messages: [
    {
      id: 'm1',
      from: 'customer',
      author: 'Karim',
      body: 'It says invalid.',
      at: new Date().toISOString(),
      avatar_url: null,
    },
  ],
};

/** Answers each API path the bell and the chat window ask for. */
function answer(feed: unknown) {
  request.mockImplementation((path: string) => {
    if (path.endsWith('/notifications/feed')) return Promise.resolve(feed);
    if (path === '/admin/conversations/ticket/TCK-1') return Promise.resolve({ data: thread });
    if (path === '/admin/conversations') {
      return Promise.resolve({
        data: [
          {
            kind: 'ticket',
            key: 'TCK-1',
            title: 'Licence not activating',
            subtitle: 'TCK-1',
            status: 'open',
            waiting: true,
            preview: 'It says invalid.',
            preview_from: 'customer',
            at: new Date().toISOString(),
            person: { name: 'Karim', email: null, avatar_url: null },
            url: '/dashboard/messages?c=ticket:TCK-1',
          },
        ],
        meta: { kinds: ['ticket'], waiting: { ticket: 1 } },
      });
    }

    return Promise.resolve({ meta: { unread: 0 } });
  });
}

describe('the notification bell', () => {
  beforeEach(() => {
    request.mockReset();
    push.mockReset();
    refresh.mockReset();
    closeChat();
    document.title = 'Orders';
  });

  afterEach(() => vi.useRealTimers());

  it('shows the unread count on the bell and in the tab title', async () => {
    answer({ data: [item('1'), item('2', true)], meta: { unread: 1 } });

    render(<NotificationBell scope="admin" allHref="/dashboard/notifications" />);

    expect(await screen.findByRole('button', { name: 'Notifications (1 unread)' })).toBeTruthy();
    expect(request).toHaveBeenCalledWith('/admin/notifications/feed', { query: { locale: 'en' } });
    await waitFor(() => expect(document.title).toBe('(1) Orders'));
  });

  it('shows new ones apart from earlier ones, with the person in bold', async () => {
    answer({ data: [item('1'), item('2', true)], meta: { unread: 1 } });

    render(<NotificationBell scope="admin" allHref="/dashboard/notifications" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications (1 unread)' }));

    const panel = await screen.findByRole('region', { name: 'Notifications' });
    expect(within(panel).getByText('New')).toBeTruthy();
    expect(within(panel).getByText('Earlier')).toBeTruthy();
    // The name is not repeated in the summary under it.
    expect(within(panel).getAllByText('৳ 1,000.00')).toHaveLength(2);
  });

  it('opens a notification by marking it read and going to its page', async () => {
    answer({ data: [item('7')], meta: { unread: 1 } });

    render(<NotificationBell scope="me" allHref="/account/notifications" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications (1 unread)' }));
    fireEvent.click(await screen.findByRole('button', { name: /New paid order · NB-7/ }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard/orders/NB-7'));
    expect(request).toHaveBeenCalledWith('/me/notifications/7/read', { method: 'POST' });
  });

  it('shows what is still to do, for staff', async () => {
    answer({
      data: [],
      meta: {
        unread: 0,
        pending: [
          { key: 'payments', count: 2, url: '/dashboard/payments' },
          { key: 'comments', count: 0, url: '/dashboard/messages?kind=comment' },
        ],
        messages_waiting: 0,
      },
    });

    render(<NotificationBell scope="admin" allHref="/dashboard/notifications" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications' }));

    const chip = await screen.findByRole('link', { name: /Payments to verify/ });
    expect(chip.getAttribute('href')).toBe('/dashboard/payments');
    expect(screen.queryByText('Comments to approve')).toBeNull();
  });

  it('replies from the chat window, sending on Enter', async () => {
    answer({ data: [ticketItem], meta: { unread: 1, pending: [], messages_waiting: 1 } });

    render(<NotificationBell scope="admin" allHref="/dashboard/notifications" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications (1 unread)' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reply' }));

    const box = await screen.findByRole('textbox', { name: 'Write a reply…' });
    expect(await screen.findByText('It says invalid.')).toBeTruthy();
    fireEvent.change(box, { target: { value: 'Please try the new code.' } });
    fireEvent.keyDown(box, { key: 'Enter' });

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/admin/support-tickets/TCK-1/replies', {
        method: 'POST',
        body: { message: 'Please try the new code.', is_internal: false },
      }),
    );
    expect(request).toHaveBeenCalledWith('/admin/notifications/t1/read', { method: 'POST' });
  });

  it('keeps Shift+Enter for a new line', async () => {
    answer({ data: [ticketItem], meta: { unread: 1, pending: [], messages_waiting: 1 } });

    render(<NotificationBell scope="admin" allHref="/dashboard/notifications" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications (1 unread)' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reply' }));
    const box = await screen.findByRole('textbox', { name: 'Write a reply…' });
    fireEvent.change(box, { target: { value: 'Line one' } });
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true });

    expect(request).not.toHaveBeenCalledWith(
      '/admin/support-tickets/TCK-1/replies',
      expect.anything(),
    );
  });

  it('lists conversations in the Messages tab and opens one in the chat window', async () => {
    answer({ data: [], meta: { unread: 0, pending: [], messages_waiting: 1 } });

    render(<NotificationBell scope="admin" allHref="/dashboard/notifications" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications' }));
    fireEvent.click(screen.getByRole('tab', { name: /Messages/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Karim/ }));

    expect(await screen.findByText('It says invalid.')).toBeTruthy();
  });

  it('marks everything read from the panel and refreshes the page', async () => {
    answer({ data: [item('9')], meta: { unread: 1 } });

    render(<NotificationBell scope="admin" allHref="/dashboard/notifications" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications (1 unread)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(request).toHaveBeenCalledWith('/admin/notifications/read-all', { method: 'POST' });
  });

  it('asks again every half minute while the tab is visible', async () => {
    vi.useFakeTimers();
    answer({ data: [], meta: { unread: 0 } });

    render(<NotificationBell scope="admin" allHref="/dashboard/notifications" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    const first = request.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(request.mock.calls.length).toBe(first + 1);
  });
});

describe('notification helpers', () => {
  it('reads filters from the query string and ignores anything else', () => {
    expect(notificationQuery({}, STAFF_CATEGORIES)).toMatchObject({
      filter: 'all',
      category: null,
      page: 1,
    });
    expect(
      notificationQuery({ filter: 'unread', category: 'support', page: '2' }, STAFF_CATEGORIES).api,
    ).toBe('filter=unread&page=2&category=support');
    expect(notificationQuery({ category: 'nonsense', page: '-3' }, STAFF_CATEGORIES)).toMatchObject(
      {
        category: null,
        page: 1,
      },
    );
  });

  it('says how long ago in either language', () => {
    const now = Date.parse('2026-09-22T10:00:00Z');
    const en = getDictionary('en').notifications;
    const bn = getDictionary('bn').notifications;

    expect(relativeTime('2026-09-22T09:59:40Z', en, 'en', now)).toBe('just now');
    expect(relativeTime('2026-09-22T09:55:00Z', bn, 'bn', now)).toBe('5 মিনিট আগে');
    expect(relativeTime('2026-09-22T07:00:00Z', en, 'en', now)).toBe('3 h ago');
    expect(relativeTime(null, en, 'en', now)).toBe('');
  });
});
