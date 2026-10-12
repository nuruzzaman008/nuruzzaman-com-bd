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
  queued: 0,
  recent_statuses: [],
};
beforeEach(() => {
  request.mockReset();
  request.mockImplementation((path: string) =>
    Promise.resolve(
      path.endsWith('/overview') ? { data: overview } : { data: [], meta: { last_page: 1 } },
    ),
  );
});
it('shows real empty inbox and hides super admin settings from admin', async () => {
  render(<WhatsAppInbox superAdmin={false} />);
  expect(await screen.findByText(/এখনো conversation নেই/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Connection & settings' })).not.toBeInTheDocument();
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
it('surfaces inbox failures without fabricating contact history', async () => {
  request.mockRejectedValue(new Error('Connection unavailable'));
  render(<WhatsAppInbox superAdmin={false} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Connection unavailable');
});
