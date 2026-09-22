import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

const item = (id: string, read = false) => ({
  id,
  type: 'order.paid',
  category: 'orders',
  title: `New paid order · NB-${id}`,
  body: 'Rahim · ৳ 1,000.00',
  detail: null,
  url: `/dashboard/orders/NB-${id}`,
  read,
  created_at: new Date().toISOString(),
});

describe('the notification bell', () => {
  beforeEach(() => {
    request.mockReset();
    push.mockReset();
    refresh.mockReset();
    document.title = 'Orders';
  });

  afterEach(() => vi.useRealTimers());

  it('shows the unread count on the bell and in the tab title', async () => {
    request.mockResolvedValue({ data: [item('1'), item('2', true)], meta: { unread: 1 } });

    render(<NotificationBell scope="admin" allHref="/dashboard/notifications" />);

    expect(await screen.findByRole('button', { name: 'Notifications (1 unread)' })).toBeTruthy();
    expect(request).toHaveBeenCalledWith('/admin/notifications/feed', { query: { locale: 'en' } });
    await waitFor(() => expect(document.title).toBe('(1) Orders'));
  });

  it('opens a notification by marking it read and going to its page', async () => {
    request.mockResolvedValue({ data: [item('7')], meta: { unread: 1 } });

    render(<NotificationBell scope="me" allHref="/account/notifications" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications (1 unread)' }));
    fireEvent.click(await screen.findByRole('button', { name: /New paid order · NB-7/ }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard/orders/NB-7'));
    expect(request).toHaveBeenCalledWith('/me/notifications/7/read', { method: 'POST' });
  });

  it('marks everything read from the panel and refreshes the page', async () => {
    request.mockResolvedValue({ data: [item('9')], meta: { unread: 1 } });

    render(<NotificationBell scope="admin" allHref="/dashboard/notifications" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications (1 unread)' }));
    request.mockResolvedValue({ data: [item('9', true)], meta: { unread: 0 } });
    fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(request).toHaveBeenCalledWith('/admin/notifications/read-all', { method: 'POST' });
  });

  it('asks again every half minute while the tab is visible', async () => {
    vi.useFakeTimers();
    request.mockResolvedValue({ data: [], meta: { unread: 0 } });

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
