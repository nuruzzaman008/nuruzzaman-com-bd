import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PendingPaymentAlert } from '@/features/dashboard/pending-payment-alert';
const request = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/browser', () => ({ api: request }));
vi.mock('@/lib/i18n/locale-provider', () => ({ useLocale: () => ({ locale: 'en' }) }));
afterEach(() => { vi.useRealTimers(); request.mockReset(); });
it('highlights pending payments then clears the alert after approval', async () => {
  vi.useFakeTimers();
  request.mockResolvedValueOnce({ data: { pending_count: 2 } }).mockResolvedValueOnce({ data: { pending_count: 0 } });
  render(<PendingPaymentAlert />);
  await act(async () => { await Promise.resolve(); });
  expect(screen.getByRole('status')).toHaveTextContent('2 payment(s) awaiting verification');
  expect(screen.getByRole('link')).toHaveAttribute('href', '/dashboard/payments');
  await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
it('shows an unavailable notice instead of claiming there are no payments', async () => {
  request.mockRejectedValueOnce(new Error('Offline'));
  render(<PendingPaymentAlert />);
  expect(await screen.findByRole('status')).toHaveTextContent('Payment status unavailable');
});
