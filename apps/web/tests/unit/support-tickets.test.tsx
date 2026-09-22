import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { SupportTickets } from '@/features/support/tickets';
const request = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/browser', () => ({ api: request }));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});
const ticket = { reference: 'TKT-TEST', name: 'Test Buyer', mobile: '01712345678', subject: 'Installation help', category: 'installation', status: 'open', messages: [{ id: 1, body: 'Please help with installation.', author_kind: 'customer', is_internal: false, at: '2026-09-09T00:00:00Z' }] };
/** The staff side reads the same ticket through the message inbox. */
const thread = {
  kind: 'ticket', key: 'TKT-TEST', title: 'Installation help', subtitle: 'TKT-TEST', status: 'open', waiting: true,
  at: '2026-09-09T00:00:00Z', person: { name: 'Test Buyer', email: null, avatar_url: null }, url: '/dashboard/messages?c=ticket:TKT-TEST',
  can_reply: true, actions: { internal_note: true, resolve: true, moderate: false },
  messages: [{ id: 'm1', from: 'customer', author: 'Test Buyer', body: 'Please help with installation.', at: '2026-09-09T00:00:00Z', avatar_url: null }],
};
function answer(listTicket: Record<string, unknown> = ticket) {
  request.mockImplementation((path: string, options?: { method?: string }) =>
    Promise.resolve(
      path === '/admin/conversations/ticket/TKT-TEST'
        ? { data: thread }
        : options?.method || path.endsWith('TKT-TEST')
          ? { data: listTicket }
          : { data: [listTicket], meta: { last_page: 1 } },
    ),
  );
}
beforeEach(() => { vi.clearAllMocks(); answer(); });
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
  // The new ticket opens as a chat, the message already in it.
  await screen.findByRole('textbox', { name: 'Write a reply…' });
  expect(await screen.findByText('Please help with installation.')).toBeInTheDocument();
  expect(request).toHaveBeenCalledWith('/account/support-tickets', { method: 'POST', body: { name: 'Test Buyer', mobile: '01712345678', subject: 'Installation help', category: 'general', message: 'Please help with installation.' } });
});
it.each([false, true])('opens and sends replies with admin=%s', async admin => {
  render(<SupportTickets admin={admin} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Open / Reply' }));
  const box = await screen.findByRole('textbox', { name: 'Write a reply…' });
  await screen.findByText('Please help with installation.');
  fireEvent.change(box, { target: { value: 'Please check again.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(request).toHaveBeenCalledWith(`/${admin ? 'admin' : 'account'}/support-tickets/TKT-TEST/replies`, { method: 'POST', body: { message: 'Please check again.', ...(admin ? { is_internal: false } : {}) } }));
  await waitFor(() => expect(box).toHaveValue(''));
});
it('keeps the draft when sending fails', async () => {
  render(<SupportTickets admin />);
  fireEvent.click(await screen.findByRole('button', { name: 'Open / Reply' }));
  const box = await screen.findByRole('textbox', { name: 'Write a reply…' });
  await screen.findByText('Please help with installation.');
  fireEvent.change(box, { target: { value: 'Keep my draft' } });
  request.mockRejectedValueOnce(new Error('Connection failed'));
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not send. Please try again.'));
  expect(box).toHaveValue('Keep my draft');
});

it('opens the ticket a notification points at', async () => {
  render(<SupportTickets initialTicket="TKT-TEST" />);

  expect(await screen.findByText('Please help with installation.')).toBeInTheDocument();
  expect(request).toHaveBeenCalledWith('/account/support-tickets/TKT-TEST');
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
  answer({ ...ticket, name: '', mobile: null });

  render(<SupportTickets admin />);

  await screen.findByText('TKT-TEST · open · installation');
  expect(screen.queryByText(/^\s*·/)).not.toBeInTheDocument();
  expect(screen.getByText('Mobile not provided on older ticket')).toBeInTheDocument();
});
