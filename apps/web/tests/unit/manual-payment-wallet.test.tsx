import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { ManualPayments } from '@/features/dashboard/manual-payments';

const request = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/browser', () => ({ api: request }));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');
  return { useLocale: () => ({ locale: 'en', t: getDictionary('en') }) };
});
const credit = { eligible: true, amount: 1000, transaction_id: 'wallet-tx-example' };
const row = { id: 1, number: 'ORDER-TEST', billing_name: 'Test', billing_email: 'test@example.test', method: 'bkash', transaction_id: 'PAY-TEST', sender: 'test', recipient: 'test', total_minor: 10000, currency: 'BDT', status: 'pending', review_note: null, created_at: '2026-09-19', has_proof: false };
let replay = false;
beforeEach(() => {
  replay = false;
  request.mockReset();
  request.mockImplementation((path: string, options?: { method?: string; query?: { status?: string } }) => {
    if (options?.method === 'POST') return Promise.resolve({ data: { wallet_credit: { ...credit, already_credited: replay } } });
    if (path === '/admin/payment-methods') return Promise.resolve({ data: [] });
    return Promise.resolve({ data: [{ ...row, ...(options?.query?.status === 'approved' ? { status: 'approved', wallet_credit: credit } : {}) }], last_page: 1 });
  });
});

async function approve() {
  fireEvent.change(await screen.findByLabelText(/Received amount/), { target: { value: '100' } });
  fireEvent.change(screen.getByLabelText(/Verification note/), { target: { value: 'Bank checked' } });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Save payment review' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save payment review' })).not.toBeDisabled());
}

it('shows the committed token amount and wallet transaction after approval', async () => {
  render(<ManualPayments />);
  await approve();
  await screen.findByText(/Payment Approved — Wallet Credited: 1000 Tokens/);
  expect(screen.getByText(/Wallet Transaction ID: wallet-tx-example/)).toBeInTheDocument();
  await waitFor(() => expect(request).toHaveBeenCalledWith('/admin/manual-payments/1/review', expect.objectContaining({ body: { decision: 'approved', note: 'Bank checked', confirmed_amount_minor: 10000 } })));
});

it('shows Already Credited when the approval was already committed', async () => {
  replay = true;
  render(<ManualPayments />);
  await approve();
  await screen.findByText(/Already Credited.*Wallet Transaction ID: wallet-tx-example/);
});

it('retains the credit receipt when the approved list is refreshed', async () => {
  render(<ManualPayments />);
  fireEvent.change(await screen.findByLabelText('Status'), { target: { value: 'approved' } });
  await screen.findByText(/Already Credited: 1000 Tokens/);
  expect(screen.getByText('wallet-tx-example')).toBeInTheDocument();
});
