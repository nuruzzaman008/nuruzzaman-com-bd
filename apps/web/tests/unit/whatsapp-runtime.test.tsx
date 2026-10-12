import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { WhatsAppRuntime, useWhatsAppRuntime } from '@/features/whatsapp/whatsapp-runtime';
const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  path: '/dashboard/orders',
  tone: vi.fn(),
  stop: vi.fn(),
}));
vi.mock('@/lib/api/browser', () => ({ api: mocks.api }));
vi.mock('next/navigation', () => ({ usePathname: () => mocks.path }));
vi.mock('@/features/whatsapp/call-audio', () => ({ startRingtone: mocks.tone }));
beforeEach(() => {
  mocks.path = '/dashboard/orders';
  mocks.api.mockReset();
  mocks.tone.mockReset();
  mocks.stop.mockReset();
  mocks.tone.mockReturnValue(mocks.stop);
  vi.stubGlobal(
    'AudioContext',
    class {
      state = 'running';
      resume = vi.fn(async () => undefined);
      close = vi.fn(async () => undefined);
    },
  );
  mocks.api.mockImplementation((path: string) =>
    Promise.resolve({ data: path.endsWith('/overview') ? { enabled: true, unread: 0 } : [] }),
  );
});
it('opens incoming call popup on another admin page', async () => {
  mocks.api.mockImplementation((path: string) =>
    Promise.resolve({
      data: path.endsWith('/overview')
        ? { enabled: true, unread: 0 }
        : [
            {
              id: 9,
              phone: '8801711945113',
              name: 'Caller',
              status: 'ringing',
              direction: 'inbound',
              ended_at: null,
              mine: false,
              claimable: true,
            },
          ],
    }),
  );
  render(
    <WhatsAppRuntime>
      <div>Order management</div>
    </WhatsAppRuntime>,
  );
  expect(await screen.findByRole('dialog', { name: 'WhatsApp calls' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Answer call' })).toBeEnabled();
  expect(screen.getByText('Order management')).toBeInTheDocument();
});
it('keeps call controls and sound enabled while moving between admin pages', async () => {
  const view = render(
    <WhatsAppRuntime>
      <div>Orders</div>
    </WhatsAppRuntime>,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'WhatsApp · Calls' }));
  fireEvent.click(screen.getByRole('button', { name: 'Enable ringtone' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Ringtone on · Turn off' })).toHaveAttribute(
      'aria-pressed',
      'true',
    ),
  );
  const polls = mocks.api.mock.calls.filter(([path]) => path === '/admin/whatsapp/calls');
  const firstKey = polls[0][1].query.session_key;
  mocks.path = '/dashboard/whatsapp';
  view.rerender(
    <WhatsAppRuntime>
      <div>Inbox</div>
    </WhatsAppRuntime>,
  );
  expect(screen.getByRole('button', { name: 'Ringtone on · Turn off' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(
    mocks.api.mock.calls
      .filter(([path]) => path === '/admin/whatsapp/calls')
      .every(([, options]) => options.query.session_key === firstKey),
  ).toBe(true);
});
it('opens call controls from the chat header without starting a call', async () => {
  function HeaderAction() {
    const runtime = useWhatsAppRuntime();
    return <button onClick={runtime?.openCalls}>Open voice call controls</button>;
  }
  render(
    <WhatsAppRuntime>
      <HeaderAction />
    </WhatsAppRuntime>,
  );
  await screen.findByRole('button', { name: 'WhatsApp · Calls' });
  fireEvent.click(screen.getByRole('button', { name: 'Open voice call controls' }));
  expect(await screen.findByRole('dialog', { name: 'WhatsApp calls' })).toBeInTheDocument();
  expect(mocks.api.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
});
