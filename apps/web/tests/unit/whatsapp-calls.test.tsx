import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { WhatsAppCalls } from '@/features/whatsapp/whatsapp-calls';
import nextConfig from '../../next.config';
const request = vi.hoisted(() => vi.fn());
const tones = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn() }));
vi.mock('@/lib/api/browser', () => ({ api: request }));
vi.mock('@/features/whatsapp/call-audio', () => ({ startRingtone: tones.start }));
const contact = {
  id: 1,
  phone: '8801711945113',
  name: 'Test contact',
  opt_out: false,
  suppressed: false,
};
const stop = vi.fn(),
  microphone = vi.fn();
const track = { stop, enabled: true };
class Peer {
  localDescription: { sdp: string } | null = null;
  iceGatheringState = 'complete';
  connectionState = 'new';
  signalingState = 'stable';
  addTrack = vi.fn();
  close = vi.fn();
  setRemoteDescription = vi.fn(async () => undefined);
  createAnswer = vi.fn(async () => ({ type: 'answer', sdp: 'v=0 answer from microphone browser' }));
  createOffer = vi.fn(async () => ({ type: 'offer', sdp: 'v=0 offer from microphone browser' }));
  setLocalDescription = vi.fn(async (d: { sdp: string }) => {
    this.localDescription = d;
  });
  ontrack = null;
  onconnectionstatechange = null;
}
beforeEach(() => {
  request.mockReset();
  stop.mockReset();
  microphone.mockReset();
  tones.start.mockReset();
  tones.stop.mockReset();
  tones.start.mockReturnValue(tones.stop);
  vi.stubGlobal(
    'AudioContext',
    class {
      state = 'running';
      resume = vi.fn(async () => undefined);
      close = vi.fn(async () => undefined);
    },
  );
  microphone.mockResolvedValue({ getTracks: () => [track], getAudioTracks: () => [track] });
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: microphone },
  });
  vi.stubGlobal('RTCPeerConnection', Peer);
  request.mockImplementation(() => Promise.resolve({ data: [] }));
});
afterEach(() => vi.unstubAllGlobals());
it('keeps ringtone enabled by default, rings incoming calls and stops on leaving', async () => {
  request.mockResolvedValue({
    data: [
      {
        id: 12,
        phone: contact.phone,
        name: 'Caller',
        direction: 'inbound',
        status: 'ringing',
        ended_at: null,
        mine: false,
        claimable: true,
      },
    ],
  });
  const view = render(<WhatsAppCalls contact={null} enabled />);
  await screen.findByRole('button', { name: 'Answer call' });
  await waitFor(() => expect(tones.start).toHaveBeenCalled());
  expect(microphone).not.toHaveBeenCalled();
  expect(screen.getByText('Ringtone on')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Enable ringtone' })).not.toBeInTheDocument();
  view.unmount();
  expect(tones.stop).toHaveBeenCalled();
});
it('unlocks suspended browser audio on any dashboard interaction without opening the microphone', async () => {
  let allowSound = false;
  vi.stubGlobal(
    'AudioContext',
    class {
      state = 'suspended';
      resume = vi.fn(async () => {
        if (allowSound) this.state = 'running';
      });
      close = vi.fn(async () => undefined);
    },
  );
  request.mockResolvedValue({
    data: [
      {
        id: 12,
        phone: contact.phone,
        name: 'Caller',
        direction: 'inbound',
        status: 'ringing',
        ended_at: null,
        claimable: true,
      },
    ],
  });
  render(<WhatsAppCalls contact={null} enabled />);
  await screen.findByRole('button', { name: 'Answer call' });
  expect(tones.start).not.toHaveBeenCalled();
  allowSound = true;
  fireEvent.pointerDown(window);
  await waitFor(() => expect(tones.start).toHaveBeenCalled());
  expect(microphone).not.toHaveBeenCalled();
});
it('allows microphone only on the WhatsApp dashboard while keeping other device access blocked', async () => {
  const rules = await nextConfig.headers?.();
  const microphoneRules = rules?.filter((rule) =>
    rule.headers.some(
      (header) => header.key === 'Permissions-Policy' && header.value.includes('microphone=(self)'),
    ),
  );
  expect(microphoneRules?.map((rule) => rule.source)).toEqual(['/dashboard/:path*']);
  expect(
    microphoneRules?.[0].headers.find((header) => header.key === 'Permissions-Policy')?.value,
  ).toContain('camera=()');
  expect(
    rules
      ?.find((rule) => rule.source === '/:path*')
      ?.headers.find((header) => header.key === 'Permissions-Policy')?.value,
  ).toContain('microphone=()');
});
it('checks permission automatically and refuses to call or open microphone without consent', async () => {
  request.mockImplementation((path: string) =>
    Promise.resolve({
      data: path.endsWith('call-permission')
        ? {
            permission: { status: 'no_permission' },
            actions: [{ action_name: 'start_call', can_perform_action: false }],
          }
        : [],
    }),
  );
  render(<WhatsAppCalls contact={contact} enabled />);
  await screen.findByText('no_permission');
  expect(screen.queryByRole('button', { name: 'Check call permission' })).not.toBeInTheDocument();
  expect(microphone).not.toHaveBeenCalled();
  expect(request.mock.calls.some(([, o]) => o?.method === 'POST')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Call contact' }));
  await screen.findByRole('status');
  expect(microphone).not.toHaveBeenCalled();
  expect(request.mock.calls.some(([, o]) => o?.method === 'POST')).toBe(false);
});
it('requests missing call consent only after Call contact is pressed', async () => {
  request.mockImplementation((path: string, options?: { method?: string }) =>
    Promise.resolve({
      data: path.endsWith('call-permission')
        ? options?.method === 'POST'
          ? { status: 'accepted' }
          : {
              permission: { status: 'no_permission' },
              actions: [{ action_name: 'send_call_permission_request', can_perform_action: true }],
            }
        : [],
    }),
  );
  render(<WhatsAppCalls contact={contact} enabled />);
  await screen.findByText('no_permission');
  expect(request.mock.calls.some(([, o]) => o?.method === 'POST')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Call contact' }));
  expect(await screen.findByRole('status')).toHaveTextContent('স্বয়ংক্রিয়ভাবে আপডেট');
  expect(request.mock.calls.filter(([, o]) => o?.method === 'POST')).toHaveLength(1);
  expect(microphone).not.toHaveBeenCalled();
});
it('automatically verifies granted consent and starts an outbound call only after the operator clicks', async () => {
  request.mockImplementation((path: string) =>
    Promise.resolve({
      data: path.endsWith('call-permission')
        ? {
            permission: { status: 'granted' },
            actions: [{ action_name: 'start_call', can_perform_action: true }],
          }
        : path.endsWith('/call')
          ? { id: 18 }
          : [],
    }),
  );
  render(<WhatsAppCalls contact={contact} enabled />);
  await screen.findByText('granted');
  expect(microphone).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Call contact' }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      '/admin/whatsapp/contacts/1/call',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({ sdp: 'v=0 offer from microphone browser' }),
      }),
    ),
  );
  expect(microphone).toHaveBeenCalledTimes(1);
});
it('incoming answer uses the browser-generated SDP answer and stops microphone on claim conflict', async () => {
  const call = {
    id: 12,
    phone: contact.phone,
    name: 'Caller',
    direction: 'inbound',
    status: 'ringing',
    ended_at: null,
    mine: false,
    claimable: true,
    remote_sdp: null,
  };
  request.mockImplementation((path: string, options?: { body?: { action?: string } }) => {
    if (options?.body?.action === 'claim')
      return Promise.reject(new Error('Another operator answered'));
    return Promise.resolve({ data: [call] });
  });
  render(<WhatsAppCalls contact={null} enabled />);
  fireEvent.click(await screen.findByRole('button', { name: 'Answer call' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Another operator answered');
  expect(stop).toHaveBeenCalled();
  expect(request.mock.calls.some(([, o]) => o?.body?.action === 'accept')).toBe(false);
});
it('answers inbound with a real answer rather than echoing the offer', async () => {
  request.mockImplementation((path: string, options?: { body?: { action?: string } }) => {
    if (options?.body?.action === 'claim')
      return Promise.resolve({ data: { sdp: 'v=0 remote offer', sdp_type: 'offer' } });
    if (options?.body?.action) return Promise.resolve({ success: true });
    return Promise.resolve({
      data: [
        {
          id: 12,
          phone: contact.phone,
          name: 'Caller',
          direction: 'inbound',
          status: 'ringing',
          ended_at: null,
          mine: false,
          claimable: true,
        },
      ],
    });
  });
  render(<WhatsAppCalls contact={null} enabled />);
  fireEvent.click(await screen.findByRole('button', { name: 'Answer call' }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      '/admin/whatsapp/calls/12/action',
      expect.objectContaining({
        body: expect.objectContaining({
          action: 'accept',
          sdp: 'v=0 answer from microphone browser',
        }),
      }),
    ),
  );
  expect(microphone).toHaveBeenCalledWith(expect.objectContaining({ video: false }));
});
