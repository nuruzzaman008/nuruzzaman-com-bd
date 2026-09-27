import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { GrowthHub } from '@/features/growth-hub/growth-hub';
import { AISettings } from '@/features/growth-hub/ai';
import { Records } from '@/features/growth-hub/records';
const request = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/browser', () => ({ api: request }));
beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue({ data: [], meta: { page: 1, last_page: 1 } });
});
it('renders private dashboard with real empty and disconnected states', async () => {
  request.mockResolvedValue({
    data: {
      name: 'Owner',
      date: '2026-09-27',
      hour: 9,
      focus: [],
      overdue: [],
      goals: [],
      ideas: [],
      counts: { tasks: 0, completed: 0, goals: 0, ideas: 0 },
      gmail: 'disconnected',
      ai_configured: false,
      preferences: null,
    },
  });
  render(<GrowthHub />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading');
  expect(await screen.findByText('Gmail is not connected.')).toBeInTheDocument();
  expect(screen.getByText('Good morning, Owner')).toBeInTheDocument();
});
it('shows safe API failure without inventing dashboard values', async () => {
  request.mockRejectedValue(new Error('Forbidden'));
  render(<GrowthHub />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden');
});
it('saves a goal through the existing API client', async () => {
  render(<Records kind="goals" />);
  await screen.findByText('No goals yet. Add your first item.');
  fireEvent.click(screen.getByRole('button', { name: 'Add goal' }));
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Learning roadmap' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      '/admin/growth-hub/goals',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({ title: 'Learning roadmap', progress: 0 }),
      }),
    ),
  );
});
it('never fills an API key input from saved provider data', async () => {
  request.mockResolvedValue({
    data: [
      {
        id: 1,
        provider: 'openai',
        display_name: 'Private provider',
        model: 'test',
        enabled: true,
        is_default: false,
        priority: 1,
        purpose: 'general',
        connection_status: 'connected',
        masked_key: '••••••••',
      },
    ],
  });
  render(<AISettings />);
  await screen.findByText('Private provider');
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  expect(screen.getByLabelText('API key (blank keeps saved key)')).toHaveValue('');
});

it('requires review and explicit save before an AI draft becomes a goal', async () => {
  render(<Records kind="goals" draft="Unverified AI roadmap to review" />);
  await screen.findByText('No goals yet. Add your first item.');
  expect(screen.getByLabelText('Description')).toHaveValue('Unverified AI roadmap to review');
  expect(request.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Approved roadmap' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      '/admin/growth-hub/goals',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({ title: 'Approved roadmap' }),
      }),
    ),
  );
});

it('clears the typed provider key after a successful save', async () => {
  render(<AISettings />);
  fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Provider' } });
  fireEvent.change(screen.getByLabelText('Model ID (from your provider)'), {
    target: { value: 'test' },
  });
  fireEvent.change(screen.getByLabelText('API key (blank keeps saved key)'), {
    target: { value: 'test-secret' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save provider' }));
  await screen.findByText('Provider saved. Keys remain on the server.');
  expect(screen.getByLabelText('API key (blank keeps saved key)')).toHaveValue('');
});
