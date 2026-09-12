import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { SupportTickets } from '@/features/support/tickets';
const request = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/browser', () => ({ api: request }));
vi.mock('@/lib/i18n/locale-provider', () => ({ useLocale: () => ({ locale: 'en' }) }));
const ticket = { reference: 'TKT-TEST', name: 'Test Buyer', mobile: '01712345678', subject: 'Installation help', category: 'installation', status: 'open', messages: [{ id: 1, body: 'Please help with installation.', author_kind: 'customer', is_internal: false, at: '2026-09-09T00:00:00Z' }] };
beforeEach(() => { vi.clearAllMocks(); request.mockImplementation((path: string, options?: { method?: string }) => Promise.resolve(options?.method || path.endsWith('TKT-TEST') ? { data: ticket } : { data: [ticket], meta: { last_page: 1 } })); });
it('requires customer contact details and creates a ticket with its conversation', async () => {
  render(<SupportTickets />);
  fireEvent.click(screen.getByText('Create support ticket'));
  expect(screen.getByLabelText('Name (required)')).toBeRequired();
  expect(screen.getByLabelText('Mobile number (required)')).toBeRequired();
  fireEvent.change(screen.getByLabelText('Name (required)'), { target: { value: 'Test Buyer' } });
  fireEvent.change(screen.getByLabelText('Mobile number (required)'), { target: { value: '01712345678' } });
  fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Installation help' } });
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Please help with installation.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit ticket' }));
  await screen.findByLabelText('Your reply');
  expect(request).toHaveBeenCalledWith('/account/support-tickets', { method: 'POST', body: { name: 'Test Buyer', mobile: '01712345678', subject: 'Installation help', category: 'general', message: 'Please help with installation.' } });
});
it.each([false, true])('opens and sends replies with admin=%s', async admin => {
  render(<SupportTickets admin={admin} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Open / Reply' }));
  fireEvent.change(await screen.findByLabelText('Your reply'), { target: { value: 'Please check again.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send reply' }));
  await screen.findByText('Reply saved.');
  expect(request).toHaveBeenCalledWith(`/${admin ? 'admin' : 'account'}/support-tickets/TKT-TEST/replies`, { method: 'POST', body: { message: 'Please check again.', ...(admin ? { is_internal: false } : {}) } });
  expect(screen.getByLabelText('Your reply')).toHaveValue('');
});
it('keeps the draft when sending fails', async () => {
  render(<SupportTickets admin />);
  fireEvent.click(await screen.findByRole('button', { name: 'Open / Reply' }));
  fireEvent.change(await screen.findByLabelText('Your reply'), { target: { value: 'Keep my draft' } });
  request.mockRejectedValueOnce(new Error('Connection failed'));
  fireEvent.click(screen.getByRole('button', { name: 'Send reply' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Connection failed'));
  expect(screen.getByLabelText('Your reply')).toHaveValue('Keep my draft');
});

it('shows the admin who wrote in, and what about, on one compact line', async () => {
  render(<SupportTickets admin />);

  // Everything the customer supplied when creating the ticket: reference,
  // status and category on one line, name and mobile on the next.
  expect(await screen.findByText('TKT-TEST · open · installation')).toBeInTheDocument();
  expect(screen.getByText('Test Buyer · 01712345678')).toBeInTheDocument();
});

it('does not show a contact line to the customer, only to staff', async () => {
  render(<SupportTickets />);

  expect(await screen.findByText('TKT-TEST · open · installation')).toBeInTheDocument();
  expect(screen.queryByText(/Test Buyer/)).not.toBeInTheDocument();
});

it('leaves no stray separator when the API returns no contact details', async () => {
  // The deployed API omits name and mobile, and the panel rendered
  // "{name} · {mobile}" regardless - so it read "· —" and told staff nothing.
  const bare = { ...ticket, name: '', mobile: null };
  request.mockImplementation((path: string, options?: { method?: string }) =>
    Promise.resolve(
      options?.method || path.endsWith('TKT-TEST')
        ? { data: bare }
        : { data: [bare], meta: { last_page: 1 } },
    ),
  );

  render(<SupportTickets admin />);

  await screen.findByText('TKT-TEST · open · installation');
  expect(screen.queryByText(/^\s*·/)).not.toBeInTheDocument();
  expect(screen.getByText('Mobile not provided on older ticket')).toBeInTheDocument();
});
