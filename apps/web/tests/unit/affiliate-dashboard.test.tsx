import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AffiliateDashboard } from '@/features/affiliate/affiliate-dashboard';
import type { AffiliateAccount } from '@/features/affiliate/affiliate-shared';

const request = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api/browser', () => ({ api: request, ApiError: class extends Error {} }));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});

const SITE = 'https://nuruzzaman.com.bd';

const program: AffiliateAccount['program'] = {
  enabled: true,
  default_rate: 10,
  cookie_days: 30,
  hold_days: 7,
  min_payout_minor: 50000,
  currency: 'BDT',
  payout_methods: ['bkash', 'nagad', 'rocket', 'bank', 'other'],
};

const member: AffiliateAccount = {
  program,
  affiliate: {
    code: 'karim-civil',
    status: 'active',
    rate: 10,
    payout_method: 'bkash',
    payout_account: '01711000000',
    payout_name: 'Karim Uddin',
    joined_at: '2026-09-01T00:00:00+00:00',
    stats: {
      visits: 42,
      orders: 2,
      earned_minor: 69900,
      pending_minor: 49900,
      available_minor: 20000,
      paid_minor: 10000,
      balance_minor: 10000,
    },
    commissions: [
      {
        id: 31,
        state: 'pending',
        currency: 'BDT',
        base_minor: 499000,
        rate: 10,
        amount_minor: 49900,
        items: ['NB Engineering Tools — Single PC licence'],
        created_at: '2026-09-14T10:00:00+00:00',
        available_at: '2026-09-21T10:00:00+00:00',
        void_reason: null,
      },
    ],
    payouts: [
      {
        id: 5,
        amount_minor: 10000,
        currency: 'BDT',
        method: 'bkash',
        reference: 'TXN8H2K1',
        note: null,
        paid_at: '2026-09-10T10:00:00+00:00',
      },
    ],
  },
};

beforeEach(() => {
  request.mockReset();
});

describe('AffiliateDashboard', () => {
  it('explains the terms and joins with the chosen code', async () => {
    request.mockResolvedValue({ data: member });
    render(<AffiliateDashboard account={{ program, affiliate: null }} siteUrl={SITE} />);

    expect(
      screen.getByRole('heading', { name: 'Share your link and earn 10% on every sale' }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Your code/), { target: { value: 'karim-civil' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join the affiliate program' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/account/affiliate', {
        method: 'POST',
        body: { code: 'karim-civil' },
      }),
    );
    expect(await screen.findByDisplayValue(`${SITE}/?ref=karim-civil`)).toBeInTheDocument();
  });

  it('links to any page on the site and saves a new code', async () => {
    request.mockResolvedValue({
      data: { ...member, affiliate: { ...member.affiliate!, code: 'karim-cad' } },
    });
    render(<AffiliateDashboard account={member} siteUrl={SITE} />);

    const link = () => screen.getByLabelText(/^Your affiliate link/);

    fireEvent.change(screen.getByLabelText(/^Page to link to/), {
      target: { value: '/products/nb-engineering-tools' },
    });
    expect(link()).toHaveValue(`${SITE}/products/nb-engineering-tools?ref=karim-civil`);

    fireEvent.change(screen.getByLabelText(/^Page to link to/), { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText(/^Page address/), {
      target: { value: `${SITE}/courses/autocad-basics?tab=outline` },
    });
    expect(link()).toHaveValue(`${SITE}/courses/autocad-basics?tab=outline&ref=karim-civil`);

    fireEvent.change(screen.getByLabelText(/^Code in your link/), {
      target: { value: 'karim-cad' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save code' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/account/affiliate', {
        method: 'PATCH',
        body: { code: 'karim-cad' },
      }),
    );
    expect(
      await screen.findByDisplayValue(`${SITE}/courses/autocad-basics?tab=outline&ref=karim-cad`),
    ).toBeInTheDocument();
  });

  it('shows what is on hold, what was paid and where payouts go', () => {
    render(<AffiliateDashboard account={member} siteUrl={SITE} />);

    expect(screen.getByText('NB Engineering Tools — Single PC licence')).toBeInTheDocument();
    // Once as a total, once on the commission itself.
    expect(screen.getAllByText('On hold')).toHaveLength(2);
    expect(screen.getByText('TXN8H2K1')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Number \/ account/)).toHaveValue('01711000000');
  });
});
