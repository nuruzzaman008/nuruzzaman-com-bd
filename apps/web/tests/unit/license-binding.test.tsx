import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { LicenseBinding } from '@/features/dashboard/license-binding';
import { WalletManagement } from '@/features/dashboard/wallet-management';

const request = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/browser', () => ({ api: request }));
beforeEach(() => { request.mockReset(); });

function fill() {
  fireEvent.change(screen.getByLabelText('Customer email'), { target: { value: 'customer@example.test' } });
  fireEvent.change(screen.getByLabelText('Existing license code'), { target: { value: 'NB-202608-61FC41C2' } });
  fireEvent.change(screen.getByLabelText('Support reference'), { target: { value: 'CASE-1' } });
  fireEvent.change(screen.getByLabelText('Binding reason'), { target: { value: 'Original license verified' } });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Bind existing license' }));
}

it('submits an attested legacy binding without balance or admin impersonation fields', async () => {
  request.mockResolvedValue({ data: { email: 'customer@example.test', license_code: 'NB-202608-61FC41C2', already_bound: false } });
  render(<LicenseBinding />);
  fireEvent.click(screen.getByText(/পুরোনো লাইসেন্স/));
  fill();
  expect(await screen.findByRole('status')).toHaveTextContent('Online wallet starts at 0 tokens');
  expect(request).toHaveBeenCalledWith('/admin/licenses/bind-existing', { method: 'POST', body: { email: 'customer@example.test', license_code: 'NB-202608-61FC41C2', reference: 'CASE-1', reason: 'Original license verified', ownership_verified: true } });
});

it('shows rejection and preserves input for correction', async () => {
  request.mockRejectedValue(new Error('This license belongs to another account.'));
  render(<LicenseBinding />);
  fireEvent.click(screen.getByText(/পুরোনো লাইসেন্স/));
  fill();
  expect(await screen.findByRole('alert')).toHaveTextContent('another account');
  expect(screen.getByLabelText('Customer email')).toHaveValue('customer@example.test');
});

it('reports retry without promising a reset or another token grant', async () => {
  request.mockResolvedValue({ data: { email: 'customer@example.test', license_code: 'NB-202608-61FC41C2', already_bound: true } });
  render(<LicenseBinding />);
  fireEvent.click(screen.getByText(/পুরোনো লাইসেন্স/));
  fill();
  expect(await screen.findByRole('status')).toHaveTextContent('No balance or status was changed');
});

it('hides binding from read-only wallet administrators', async () => {
  request.mockResolvedValue({ data: [], meta: { page: 1, last_page: 1, total: 0, can_manage: false } });
  render(<WalletManagement />);
  await screen.findByText(/No provisioned wallets match/);
  expect(screen.queryByText(/পুরোনো লাইসেন্স/)).not.toBeInTheDocument();
});
