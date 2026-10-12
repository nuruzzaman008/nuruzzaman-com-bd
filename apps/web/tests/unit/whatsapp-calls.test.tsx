import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { WhatsAppCalls } from '@/features/whatsapp/whatsapp-calls';
const request = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/browser', () => ({ api: request }));
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
  microphone.mockResolvedValue({ getTracks: () => [track], getAudioTracks: () => [track] });
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: microphone },
  });
  vi.stubGlobal('RTCPeerConnection', Peer);
  request.mockImplementation(() => Promise.resolve({ data: [] }));
});
afterEach(() => vi.unstubAllGlobals());
it('never calls a contact or requests microphone without explicit action and Meta permission', async () => {
  render(<WhatsAppCalls contact={contact} enabled />);
  expect(screen.getByRole('button', { name: 'Call contact' })).toBeDisabled();
  expect(microphone).not.toHaveBeenCalled();
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
  fireEvent.click(screen.getByRole('button', { name: 'Check call permission' }));
  await screen.findByText('no_permission');
  expect(screen.getByRole('button', { name: 'Call contact' })).toBeDisabled();
  expect(request.mock.calls.some(([, o]) => o?.method === 'POST')).toBe(false);
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
