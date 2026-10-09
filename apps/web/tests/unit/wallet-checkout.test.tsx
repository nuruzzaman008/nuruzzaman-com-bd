import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { CheckoutForm } from '@/features/commerce/checkout-form';
const mocks = vi.hoisted(() => ({ api: vi.fn(), push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push, replace: mocks.replace }) }));
vi.mock('@/lib/api/browser', () => ({ api: mocks.api, ApiError: class extends Error {} }));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');
  const t = getDictionary('en');
  return { useLocale: () => ({ locale: 'en', t }) };
});
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, '', '/checkout?wallet_license=NB-TWO');
  mocks.api.mockImplementation((path: string) => {
    if (path === '/cart') return Promise.resolve({ data: { is_purchasable: true, blockers: [], currency: 'BDT', subtotal_minor: 49900, total_minor: 49900, discount_minor: 0, tax_minor: 0, lines: [{ variant_id: 2, product_type: 'credit_refill', product_name: 'Tokens', quantity: 1, line_total_minor: 49900 }] } });
    if (path === '/me') return Promise.resolve({ data: { name: 'Customer', email: 'customer@example.test' } });
    if (path === '/account/licenses') return Promise.resolve({ data: [{ license_code: 'NB-ONE', status: 'active', product_name: 'Tools' }, { license_code: 'NB-TWO', status: 'active', product_name: 'Tools' }] });
    return Promise.resolve({ data: { redirect_url: '/checkout/payment/TEST-ORDER' } });
  });
});
it('preselects the requested license and submits it with existing checkout consents', async () => {
  const { container } = render(<CheckoutForm />);
  expect(await screen.findByLabelText('License receiving tokens')).toHaveValue('NB-TWO');
  fireEvent.submit(container.querySelector('form')!);
  await waitFor(() => expect(mocks.api).toHaveBeenCalledWith('/checkout', expect.objectContaining({ body: expect.objectContaining({ wallet_license_code: 'NB-TWO' }) })));
  expect(mocks.push).toHaveBeenCalledWith('/checkout/payment/TEST-ORDER');
});
it('does not accept a URL license that is absent from the current account', async () => {
  window.history.replaceState({}, '', '/checkout?wallet_license=NB-SOMEONE-ELSE');
  render(<CheckoutForm />);
  expect(await screen.findByLabelText('License receiving tokens')).toHaveValue('');
});
