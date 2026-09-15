import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AffiliateAdminDetail } from '@/features/affiliate/affiliate-admin-detail';
import { AffiliateSettingsForm } from '@/features/affiliate/affiliate-settings-form';
import type { AdminAffiliateDetail } from '@/features/affiliate/affiliate-shared';

const request = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@/lib/api/browser', () => ({ api: request, ApiError: class extends Error {} }));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});

const settings = {
  enabled: true,
  default_rate: 10,
  cookie_days: 30,
  hold_days: 7,
  min_payout_minor: 50000,
};

const detail: AdminAffiliateDetail = {
  id: 7,
  code: 'karim-civil',
  status: 'active',
  commission_rate: null,
  rate: 10,
  user: { id: 3, name: 'Karim Uddin', email: 'karim@example.com' },
  joined_at: '2026-09-01T00:00:00+00:00',
  stats: {
    visits: 42,
    orders: 1,
    earned_minor: 49900,
    pending_minor: 0,
    available_minor: 49900,
    paid_minor: 0,
    balance_minor: 49900,
  },
  phone: null,
  payout_method: 'bkash',
  payout_account: '01711000000',
  payout_name: 'Karim Uddin',
  admin_note: null,
  commissions: [
    {
      id: 31,
      state: 'available',
      currency: 'BDT',
      base_minor: 499000,
      rate: 10,
      amount_minor: 49900,
      items: ['NB Engineering Tools — Single PC licence'],
      created_at: '2026-09-01T10:00:00+00:00',
      available_at: '2026-09-08T10:00:00+00:00',
      void_reason: null,
      order_number: 'NB-2026-0001',
      order_status: 'fulfilled',
      buyer_name: 'Rafiq Hasan',
      buyer_email: 'rafiq@example.com',
    },
  ],
  payouts: [],
  settings,
};

beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue({ data: detail });
  refresh.mockReset();
});

describe('AffiliateAdminDetail', () => {
  it('records a payout in poisha, with how it was sent and the transaction id', async () => {
    render(<AffiliateAdminDetail affiliate={detail} />);

    // The payable balance is offered as the amount.
    expect(screen.getByLabelText(/^Amount/)).toHaveValue(499);

    fireEvent.change(screen.getByLabelText(/^Amount/), { target: { value: '450.50' } });
    fireEvent.change(screen.getByLabelText(/^Paid by/), { target: { value: 'nagad' } });
    fireEvent.change(screen.getByLabelText(/^Transaction ID/), { target: { value: 'TXN8H2K1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record payout' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/admin/affiliates/7/payouts', {
        method: 'POST',
        body: {
          amount_minor: 45050,
          method: 'nagad',
          reference: 'TXN8H2K1',
          note: null,
          paid_at: null,
        },
      }),
    );
  });

  it('gives the affiliate their own rate', async () => {
    render(<AffiliateAdminDetail affiliate={detail} />);

    fireEvent.change(screen.getByLabelText(/^Commission rate for this affiliate/), {
      target: { value: '15' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/admin/affiliates/7', {
        method: 'PATCH',
        body: { status: 'active', commission_rate: 15, code: 'karim-civil', admin_note: null },
      }),
    );
  });

  it('asks for a reason before voiding a commission', async () => {
    render(<AffiliateAdminDetail affiliate={detail} />);

    fireEvent.click(screen.getByRole('button', { name: 'Void' }));
    expect(screen.getByRole('button', { name: 'Confirm void' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Chargeback' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm void' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/admin/affiliate-commissions/31/void', {
        method: 'POST',
        body: { reason: 'Chargeback' },
      }),
    );
  });
});

describe('AffiliateSettingsForm', () => {
  it('saves the default rate as typed and the minimum payout in poisha', async () => {
    render(<AffiliateSettingsForm settings={settings} />);

    fireEvent.change(screen.getByLabelText(/^Default commission/), { target: { value: '12.5' } });
    fireEvent.change(screen.getByLabelText(/^Minimum payout/), { target: { value: '750' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/admin/affiliate-settings', {
        method: 'PUT',
        body: {
          enabled: true,
          default_rate: 12.5,
          cookie_days: 30,
          hold_days: 7,
          min_payout_minor: 75000,
        },
      }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
});
