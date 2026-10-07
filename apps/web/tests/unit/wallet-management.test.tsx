import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { WalletManagement } from '@/features/dashboard/wallet-management';

const request = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/browser', () => ({ api: request }));
const wallet = { id: 12, name: 'Sample User', email: 'sample@example.test', license_code: 'NB-TEST', balance: 100, available_balance: 80, reserved_balance: 20, status: 'active', version: 3, last_sync: null };
let canManage = true;
beforeEach(() => {
  canManage = true;
  request.mockReset();
  request.mockImplementation((path: string, options?: { method?: string }) => {
    if (options?.method === 'POST') return Promise.resolve({ data: {} });
    return Promise.resolve(path === '/admin/wallets' ? { data: [wallet], meta: { page: 1, last_page: 1, total: 1 } } : { data: { wallet, entries: [], devices: [], can_manage: canManage }, meta: { page: 1, last_page: 1, device_page: 1, device_last_page: 1 } });
  });
});

async function select() {
  fireEvent.click(await screen.findByRole('button', { name: 'View wallet' }));
  await screen.findByRole('heading', { name: 'NB-TEST' });
}

it('shows sync history and requests the next sync page independently', async () => {
  const original = request.getMockImplementation()!;
  request.mockImplementation((path: string, options?: { method?: string }) => {
    if (path === '/admin/wallets/12' && !options?.method) return Promise.resolve({ data: { wallet, entries: [], devices: [], can_manage: true, syncs: [{ id: 'sync-1', request_id: 'request-42', device_id: 7, status: 'accepted', accepted_count: 3, error_code: null, created_at: '2026-09-26 10:00:00', completed_at: '2026-09-26 10:00:01' }] }, meta: { page: 1, last_page: 1, device_page: 1, device_last_page: 1, sync_page: 1, sync_last_page: 2 } });
    return original(path, options);
  });
  render(<WalletManagement />);
  await select();
  expect(screen.getByText('request-42')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Sync history' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next syncs' }));
  await waitFor(() => expect(request).toHaveBeenCalledWith('/admin/wallets/12', { query: { page: 1, device_page: 1, sync_page: 2 } }));
});

it('searches license and submits an audited integer adjustment without a caller supplied admin ID', async () => {
  render(<WalletManagement />);
  await select();
  fireEvent.click(screen.getByRole('button', { name: '+ Add Token' }));
  fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '25' } });
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Reviewed correction' } });
  fireEvent.change(screen.getByLabelText('Reference note'), { target: { value: 'Case 42' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save audited action' }));
  await waitFor(() => expect(request).toHaveBeenCalledWith('/admin/wallets/12/actions', expect.objectContaining({ method: 'POST', body: expect.objectContaining({ action: 'add', amount: 25, expected_version: 3, reason: 'Reviewed correction', reference_note: 'Case 42', transaction_id: expect.any(String) }) })));
  const sent = request.mock.calls.find(([, options]) => options?.method === 'POST')?.[1].body;
  expect(sent).not.toHaveProperty('created_by');
  await screen.findByText('Action saved with an audit trail.');
  fireEvent.change(screen.getByLabelText('User name, email or license'), { target: { value: 'NB-TEST' } });
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));
  await waitFor(() => expect(request).toHaveBeenCalledWith('/admin/wallets', { query: { q: 'NB-TEST', page: 1 } }));
});

it('hides mutation controls from view-only staff', async () => {
  canManage = false;
  render(<WalletManagement />);
  await select();
  expect(screen.queryByRole('button', { name: '+ Add Token' })).not.toBeInTheDocument();
  expect(screen.getByText('Reserved tokens')).toBeInTheDocument();
});

it('reuses the transaction ID when the unchanged action is retried after a lost response', async () => {
  render(<WalletManagement />);
  await select();
  fireEvent.click(screen.getByRole('button', { name: '+ Add Token' }));
  fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '10' } });
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Correction' } });
  fireEvent.change(screen.getByLabelText('Reference note'), { target: { value: 'Case 7' } });
  request.mockRejectedValueOnce(new Error('Response lost'));
  fireEvent.click(screen.getByRole('button', { name: 'Save audited action' }));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Save audited action' }));
  await screen.findByText('Action saved with an audit trail.');
  const sent = request.mock.calls.filter(([, options]) => options?.method === 'POST');
  expect(sent).toHaveLength(2);
  expect(sent[0][1].body.transaction_id).toBe(sent[1][1].body.transaction_id);
});

it('requires an explicit audited device reset without sending an amount', async () => {
  render(<WalletManagement />);
  await select();
  fireEvent.click(screen.getByRole('button', { name: 'Reset Device' }));
  expect(screen.queryByLabelText('Amount')).not.toBeInTheDocument();
  expect(screen.getByText(/Unsynced reserved tokens remain held/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Device replacement' } });
  fireEvent.change(screen.getByLabelText('Reference note'), { target: { value: 'Case 99' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save audited action' }));
  await waitFor(() => expect(request).toHaveBeenCalledWith('/admin/wallets/12/actions', expect.objectContaining({ body: expect.objectContaining({ action: 'reset_device', reason: 'Device replacement' }) })));
  const body = request.mock.calls.find(([, options]) => options?.method === 'POST')?.[1].body;
  expect(body).not.toHaveProperty('amount');
  expect(body).not.toHaveProperty('status');
});
