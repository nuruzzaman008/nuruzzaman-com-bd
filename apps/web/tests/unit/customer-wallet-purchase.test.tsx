import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { CustomerWallets } from '@/features/account/customer-wallets';
const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock('@/lib/api/browser', () => ({ api: mocks.api }));
vi.mock('@/features/catalog/add-to-cart', () => ({ AddToCart: ({ checkoutLicense }: { checkoutLicense: string }) => <button>Buy for {checkoutLicense}</button> }));
beforeEach(() => {
  mocks.api.mockReset();
  mocks.api.mockImplementation((path: string) => {
    if (path === '/account/licenses') return Promise.resolve({ data: [{ license_code: 'NB-ONE', product_name: 'Tools', status: 'active' }, { license_code: 'NB-TWO', product_name: 'Tools', status: 'active' }] });
    if (path === '/products/nb-credit-refill') return Promise.resolve({ data: { variants: [{ id: 1, credit_amount: 500, is_purchasable: true }, { id: 2, credit_amount: 1000, is_purchasable: false }] } });
    return Promise.resolve({ data: { license_code: path.includes('NB-TWO') ? 'NB-TWO' : 'NB-ONE', license_status: 'active', last_sync: null, wallet: { balance: 0, available_balance: 0, reserved_balance: 0, status: 'active' }, devices: [], entries: [] }, meta: { page: 1, last_page: 1 } });
  });
});
it('shows purchasable packs for the selected license and links payment status', async () => {
  render(<CustomerWallets />);
  await screen.findByRole('option', { name: /NB-TWO/ });
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'NB-TWO' } });
  expect(await screen.findByRole('button', { name: 'Buy for NB-TWO' })).toBeVisible();
  expect(screen.getByText('500 Tokens')).toBeVisible();
  expect(screen.queryByText('1,000 Tokens')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Payment status / Orders' })).toHaveAttribute('href', '/account/orders');
});
it('does not offer purchases for a suspended wallet', async () => {
  const normal = mocks.api.getMockImplementation()!;
  mocks.api.mockImplementation((path: string) => path.endsWith('/wallet') ? Promise.resolve({ data: { license_code: 'NB-ONE', license_status: 'active', wallet: { status: 'suspended', balance: 0, available_balance: 0, reserved_balance: 0 }, devices: [], entries: [] }, meta: { page: 1, last_page: 1 } }) : normal(path));
  render(<CustomerWallets />);
  await screen.findByRole('option', { name: /NB-ONE/ });
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'NB-ONE' } });
  expect(await screen.findByText(/needs an active online wallet/)).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Buy for NB-ONE' })).not.toBeInTheDocument();
});
