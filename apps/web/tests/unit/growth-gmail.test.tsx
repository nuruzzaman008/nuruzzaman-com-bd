import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { GmailConnection } from '@/features/growth-hub/gmail';
const request = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/browser', () => ({ api: request }));
const disconnected = {
  configured: true,
  status: 'disconnected',
  email: null,
  checked_at: null,
  callback_url: 'https://example.test/api/v1/admin/growth-hub/gmail/callback',
};
beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue({ data: disconnected });
  window.history.replaceState({}, '', '/dashboard/growth-hub');
});
it('explains Gemini separation and offers real Google connection', async () => {
  render(<GmailConnection />);
  expect(await screen.findByRole('button', { name: 'Connect Gmail' })).toBeEnabled();
  expect(screen.getByText(/Gemini powers Ask My AI/)).toBeInTheDocument();
  expect(screen.getByText('Gmail is not connected.')).toBeInTheDocument();
});
it('requires server OAuth configuration instead of accepting a Gemini key', async () => {
  request.mockResolvedValue({ data: { ...disconnected, configured: false } });
  render(<GmailConnection />);
  expect(await screen.findByText(/Client ID and Client Secret/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Connect Gmail' })).not.toBeInTheDocument();
});
it('reports connection start failures without falsely connecting', async () => {
  render(<GmailConnection />);
  await screen.findByRole('button', { name: 'Connect Gmail' });
  request.mockRejectedValueOnce(new Error('failure'));
  fireEvent.click(screen.getByRole('button', { name: 'Connect Gmail' }));
  expect(await screen.findByText(/Could not start Gmail connection/)).toBeInTheDocument();
  expect(request).toHaveBeenLastCalledWith('/admin/growth-hub/gmail/connect', { method: 'POST' });
});
it('shows consent cancellation', async () => {
  window.history.replaceState({}, '', '/dashboard/growth-hub?gmail=cancelled');
  render(<GmailConnection />);
  expect(await screen.findByText(/Google consent was cancelled/)).toBeInTheDocument();
});
it('checks a saved connection and exposes failed verification', async () => {
  request.mockResolvedValueOnce({
    data: { ...disconnected, status: 'connected', email: 'owner@example.test' },
  });
  render(<GmailConnection />);
  await screen.findByText('Gmail connected.');
  request.mockResolvedValueOnce({
    data: { ...disconnected, status: 'verification_failed', email: 'owner@example.test' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Check connection' }));
  expect(await screen.findByText(/Gmail verification failed/)).toBeInTheDocument();
});
it('disconnects only through the authenticated mutation and updates status', async () => {
  request.mockResolvedValueOnce({
    data: { ...disconnected, status: 'connected', email: 'owner@example.test' },
  });
  render(<GmailConnection />);
  fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }));
  await waitFor(() =>
    expect(request).toHaveBeenLastCalledWith('/admin/growth-hub/gmail', { method: 'DELETE' }),
  );
  expect(await screen.findByText('Gmail is not connected.')).toBeInTheDocument();
  expect(screen.queryByText('owner@example.test')).not.toBeInTheDocument();
});
