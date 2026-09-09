import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { PaymentSelection } from '@/features/commerce/payment-selection';
import { ManualPayments } from '@/features/dashboard/manual-payments';
const request = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/browser', () => ({ api: request }));
vi.mock('@/lib/i18n/locale-provider', () => ({ useLocale: () => ({ locale: 'en' }) }));
const methods = [{ id: 'bkash', name: 'bKash', enabled: true, recipient: 'TEST-MERCHANT', instructions: 'Payment' }];
const data = { order: { number: 'ORDER-TEST', total_minor: 150000, currency: 'BDT', status: 'pending_payment', items: [] }, methods, gateway_enabled: false, gateway_test_mode: true, submissions: [] };
beforeEach(() => vi.clearAllMocks());
it('submits mobile payment evidence and waits for approval without granting access', async () => {
  request.mockResolvedValueOnce({ data }).mockResolvedValueOnce({ data: { ...data, submissions: [{ id: 1, method: 'bkash', transaction_id: 'TEST1234', status: 'pending' }] } });
  render(<PaymentSelection number="ORDER-TEST" />);
  fireEvent.click(await screen.findByRole('button', { name: 'bKash' }));
  expect(screen.getByText('TEST-MERCHANT')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Sender mobile / account number'), { target: { value: 'TEST-SENDER' } });
  fireEvent.change(screen.getByLabelText('Transaction ID'), { target: { value: 'TEST1234' } });
  fireEvent.change(screen.getByLabelText(/Payment screenshot/), { target: { files: [new File(['proof'], 'receipt.png', { type: 'image/png' })] } });
  fireEvent.submit(screen.getByRole('button', { name: 'Submit for verification' }).closest('form')!);
  await screen.findByText(/Payment submitted — awaiting admin verification/);
  expect(request).toHaveBeenCalledWith('/checkout/orders/ORDER-TEST/payment/manual', { method: 'POST', body: expect.any(FormData) });
  expect(screen.queryByRole('link', { name: 'Open account' })).not.toBeInTheDocument();
});
it('admin submits the verified amount and review note', async () => {
  request.mockImplementation((path: string) => Promise.resolve(path === '/admin/payment-methods' ? { data: methods } : path.includes('/review') ? { message: 'Saved' } : { data: [{ id: 1, number: 'ORDER-TEST', billing_name: 'Test Buyer', billing_email: 'buyer@example.test', method: 'bkash', transaction_id: 'TEST1234', sender: 'TEST-SENDER', recipient: 'TEST-MERCHANT', total_minor: 150000, currency: 'BDT', status: 'pending', has_proof: true }], last_page: 1 }));
  render(<ManualPayments />);
  await screen.findByText('TEST1234');
  expect(screen.getByRole('link', { name: /Open full payment screenshot/ })).toHaveAttribute('href', '/api/v1/admin/manual-payments/1/proof');
  fireEvent.change(screen.getByLabelText('Received amount (BDT)'), { target: { value: '1500' } });
  fireEvent.change(screen.getByLabelText('Verification note / rejection reason (visible to customer)'), { target: { value: 'Matched bank statement' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'I checked the receiving account statement and confirm this decision.' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save payment review' }));
  await waitFor(() => expect(request).toHaveBeenCalledWith('/admin/manual-payments/1/review', { method: 'POST', body: { decision: 'approved', note: 'Matched bank statement', confirmed_amount_minor: 150000 } }));
});

it('allows selecting every unconfigured manual method and requires a screenshot', async () => {
  request.mockResolvedValue({ data: { ...data, methods: ['bKash', 'Nagad', 'Rocket', 'Bank transfer'].map(name => ({ id: name, name, enabled: true, recipient: '', instructions: '' })) } });
  render(<PaymentSelection number="ORDER-TEST" />);
  for (const name of ['bKash', 'Nagad', 'Rocket', 'Bank transfer']) {
    fireEvent.click(await screen.findByRole('button', { name }));
    expect(screen.getByText(/Receiving account not provided/)).toBeVisible();
    expect(screen.getByLabelText(/Payment screenshot/)).toBeRequired();
  }
});
