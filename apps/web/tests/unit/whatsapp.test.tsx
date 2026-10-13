import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { WhatsAppInbox } from '@/features/whatsapp/whatsapp-inbox';
import { parseContactsCsv } from '@/features/whatsapp/csv';
const request = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/browser', () => ({ api: request }));
const overview = {
  configured: false,
  enabled: false,
  campaign_enabled: false,
  test_received: false,
  remaining: 50,
  daily_limit: 50,
  template: 'nbconsultant_intro_v1',
  language: 'bn',
  phone_number_id: '1312758371929461',
  waba_id: '1569882861085596',
  api_version: 'v26.0',
  webhook_url: 'https://api.nuruzzaman.com.bd/api/v1/whatsapp/webhook',
  webhook_at: null,
  secret_configured: false,
  verify_configured: false,
  unread: 0,
  contacts: 0,
  whatsapp_confirmed: 0,
  whatsapp_unverified: 0,
  queued: 0,
  recent_statuses: [],
};
beforeEach(() => {
  window.localStorage.clear();
  request.mockReset();
  request.mockImplementation((path: string) =>
    Promise.resolve(
      path.endsWith('/overview') ? { data: overview } : { data: [], meta: { last_page: 1 } },
    ),
  );
});
it('places evidenced WhatsApp count immediately after Contacts and explains unknown numbers', async () => {
  render(<WhatsAppInbox superAdmin={false} />);
  const metric = await screen.findByText('WhatsApp confirmed');
  const contacts = screen.getByLabelText('WhatsApp overview').querySelectorAll('div');
  expect(contacts[1]).toHaveTextContent('Contacts');
  expect(contacts[2]).toContainElement(metric);
  expect(screen.getByText(/যাচাই হয়নি মানে WhatsApp নেই নয়/)).toBeInTheDocument();
});
it('defaults to light, switches beside Refresh and remembers the chosen theme', async () => {
  const view = render(<WhatsAppInbox superAdmin={false} />);
  const toggle = screen.getByRole('switch', { name: 'Dark theme' });
  expect(toggle).toHaveAttribute('aria-checked', 'false');
  expect(toggle.closest('[data-theme]')).toHaveAttribute('data-theme', 'light');
  expect(
    toggle.compareDocumentPosition(screen.getByRole('button', { name: 'Refresh' })) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-checked', 'true');
  expect(window.localStorage.getItem('nb.whatsapp.theme')).toBe('dark');
  view.unmount();
  render(<WhatsAppInbox superAdmin={false} />);
  expect(screen.getByRole('switch', { name: 'Dark theme' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  fireEvent.click(screen.getByRole('switch', { name: 'Dark theme' }));
  expect(window.localStorage.getItem('nb.whatsapp.theme')).toBe('light');
  await screen.findByText(/এখনো conversation নেই/);
});
it('shows real empty inbox and hides super admin settings from admin', async () => {
  render(<WhatsAppInbox superAdmin={false} />);
  expect(await screen.findByText(/এখনো conversation নেই/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Connection & settings' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Contacts' }));
  expect(await screen.findByText(/Import Contacts CSV/)).toBeInTheDocument();
  expect(request.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
});
it('keeps saved Meta secrets out of inputs and clears new secrets after save', async () => {
  render(<WhatsAppInbox superAdmin />);
  await screen.findByText(/এখনো conversation নেই/);
  fireEvent.click(screen.getByRole('button', { name: 'Connection & settings' }));
  const input = screen.getByLabelText(/Meta access token/);
  expect(input).toHaveValue('');
  fireEvent.change(input, { target: { value: 'test-secret' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save connection settings' }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      '/admin/whatsapp/settings',
      expect.objectContaining({
        method: 'PUT',
        body: expect.objectContaining({ access_token: 'test-secret', campaign_enabled: false }),
      }),
    ),
  );
  await waitFor(() => expect(input).toHaveValue(''));
});
it('parses quoted CSV and never assumes opt-in from a blank consent column', () => {
  expect(
    parseContactsCsv(
      'Phone,Name,Opt_In,Opt_In_Source,Opt_Out,Suppressed\n01711945113,"Name, quoted",,,NO,FALSE',
    )[0],
  ).toEqual({
    phone: '01711945113',
    name: 'Name, quoted',
    opt_in: false,
    consent_source: null,
    opt_out: false,
    suppressed: false,
  });
  expect(() => parseContactsCsv('Phone,Opt_In\n01711945113,YES')).toThrow(/source/);
});
it('imports Google first names and Unicode phone headers without granting consent', () => {
  expect(
    parseContactsCsv(
      'First name,Last name,Phone 1 – Value\n"Name, quoted",Family,8801312345678',
    )[0],
  ).toMatchObject({
    name: 'Name, quoted Family',
    phone: '8801312345678',
    opt_in: false,
  });
});
it('surfaces inbox failures without fabricating contact history', async () => {
  request.mockRejectedValue(new Error('Connection unavailable'));
  render(<WhatsAppInbox superAdmin={false} />);
  const alerts = await screen.findAllByRole('alert');
  alerts.forEach((alert) => expect(alert).toHaveTextContent('Connection unavailable'));
});
it('accepts Google Contacts and mobile headers without inventing consent', () => {
  expect(parseContactsCsv('Name,Phone 1 - Value\nCustomer,01711945113')[0]).toMatchObject({
    name: 'Customer',
    phone: '01711945113',
    opt_in: false,
  });
  expect(
    parseContactsCsv(
      'Full Name,Mobile,Opt In,Consent Source\nCustomer,01711945113,YES,Written permission',
    )[0],
  ).toMatchObject({
    name: 'Customer',
    phone: '01711945113',
    opt_in: true,
    consent_source: 'Written permission',
  });
});
it('shows chat filters and contact information while keeping a closed reply window disabled', async () => {
  const contact = {
    id: 7,
    phone: '8801712345678',
    name: 'Customer',
    opt_in: true,
    consent_source: 'Written permission',
    opt_out: false,
    suppressed: false,
    stage: 'open',
    tags: 'Course',
    notes: 'Requested details',
    assigned_to: null,
    unread: 0,
    last_inbound_at: null,
  };
  request.mockImplementation((path: string) =>
    Promise.resolve(
      path.endsWith('/overview')
        ? { data: { ...overview, enabled: true } }
        : path.endsWith('/messages')
          ? { data: [], contact, reply_window_open: false, older_before: null }
          : { data: [contact], meta: { last_page: 1 } },
    ),
  );
  render(<WhatsAppInbox superAdmin={false} />);
  expect(await screen.findByRole('textbox', { name: 'Search chats' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Unread' }));
  expect(screen.getByRole('button', { name: 'Unread' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(await screen.findByRole('button', { name: /Customer/ }));
  expect(await screen.findByRole('textbox', { name: 'Reply message' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'প্রথম message · Send template' })).toBeEnabled();
  expect(screen.getByText('Written permission')).toBeInTheDocument();
  expect(screen.getByText('Requested details')).toBeInTheDocument();
  expect(request.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
});
it('follows latest messages unless the operator scrolls up to read history', async () => {
  let height = 1000;
  const scrollHeight = vi
    .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
    .mockImplementation(() => height);
  const clientHeight = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(200);
  try {
    const contact = {
      id: 9,
      name: 'Reader',
      phone: '8801712345678',
      opt_in: true,
      unread: 0,
      stage: 'open',
    };
    let messages = [
      {
        id: 1,
        body: 'First message',
        kind: 'text',
        direction: 'inbound',
        status: 'received',
        occurred_at: '2026-10-12T10:00:00Z',
      },
    ];
    request.mockImplementation((path: string) =>
      Promise.resolve(
        path.endsWith('/overview')
          ? { data: { ...overview, enabled: true } }
          : path.endsWith('/messages')
            ? { data: messages, contact, reply_window_open: true, older_before: null }
            : { data: [contact], meta: { last_page: 1 } },
      ),
    );
    render(<WhatsAppInbox superAdmin={false} />);
    fireEvent.click(await screen.findByRole('button', { name: /Reader/ }));
    await screen.findByText('First message');
    const firstBubble = screen.getByText('First message').closest('article');
    expect(firstBubble?.querySelector('time')).toHaveTextContent('4:00 pm');
    expect(firstBubble?.querySelector('time')).toHaveAttribute('dateTime', '2026-10-12T10:00:00Z');
    expect(firstBubble?.querySelector('details')).not.toHaveAttribute('open');
    const pane = screen.getByLabelText('Messages');
    expect(pane.scrollTop + pane.clientHeight).toBeGreaterThanOrEqual(pane.scrollHeight);
    pane.scrollTop = 100;
    fireEvent.scroll(pane);
    height = 1300;
    messages = [...messages, { ...messages[0], id: 2, body: 'Second message' }];
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await screen.findByText('Second message');
    expect(pane.scrollTop).toBe(100);
    pane.scrollTop = 1100;
    fireEvent.scroll(pane);
    height = 1400;
    messages = [...messages, { ...messages[0], id: 3, body: 'Third message' }];
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await screen.findByText('Third message');
    await waitFor(() =>
      expect(pane.scrollTop + pane.clientHeight).toBeGreaterThanOrEqual(pane.scrollHeight),
    );
  } finally {
    scrollHeight.mockRestore();
    clientHeight.mockRestore();
  }
});
it('shows reactions on their message and previews private images without stripping the referrer', async () => {
  const contact = {
    id: 7,
    name: 'Media customer',
    phone: '8801712345678',
    unread: 0,
    stage: 'open',
  };
  request.mockImplementation((path: string) =>
    Promise.resolve(
      path.endsWith('/overview')
        ? { data: overview }
        : path.endsWith('/messages')
          ? {
              data: [
                {
                  id: 20,
                  kind: 'image',
                  body: null,
                  media_id: '123',
                  direction: 'inbound',
                  status: 'received',
                  occurred_at: '2026-10-13T07:00:00Z',
                  reactions: ['❤️'],
                },
              ],
              contact,
              reply_window_open: true,
              older_before: null,
            }
          : { data: [contact], meta: { last_page: 1 } },
    ),
  );
  render(<WhatsAppInbox superAdmin={false} />);
  fireEvent.click(await screen.findByRole('button', { name: /Media customer/ }));
  const image = await screen.findByRole('img', { name: 'WhatsApp image' });
  expect(image).toHaveAttribute('src', '/api/v1/admin/whatsapp/messages/20/media');
  expect(screen.getByLabelText('Message reactions')).toHaveTextContent('❤️');
  const link = screen.getByRole('link', { name: 'Open image' });
  expect(link).toHaveAttribute('rel', 'noopener');
  fireEvent.error(image);
  expect(screen.getByText(/Image preview unavailable/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open image' })).toBeInTheDocument();
});
