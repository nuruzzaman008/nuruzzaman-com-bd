import { expect, it, vi } from 'vitest';

const request = vi.hoisted(() => vi.fn());
vi.mock('@nuruzzaman/contracts', () => ({ createClient: () => ({ request }), ApiError: class extends Error {} }));
vi.mock('@/lib/env', () => ({ publicEnv: { apiBasePath: '/api/v1' } }));

it('waits for the guest cookie before the next cart request and recovers after errors', async () => {
  const { api } = await import('@/lib/api/browser');
  let done!: (value: unknown) => void;
  request.mockReturnValueOnce(new Promise((resolve) => { done = resolve; })).mockResolvedValueOnce({ data: 'same cart' });
  const first = api('/cart');
  const second = api('/cart');
  await Promise.resolve();
  expect(request).toHaveBeenCalledTimes(1);
  done({ data: 'initial cart' });
  await first;
  await expect(second).resolves.toEqual({ data: 'same cart' });
  request.mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce({ data: 'retry' });
  await expect(api('/cart')).rejects.toThrow('Unavailable');
  await expect(api('/cart')).resolves.toEqual({ data: 'retry' });
});
