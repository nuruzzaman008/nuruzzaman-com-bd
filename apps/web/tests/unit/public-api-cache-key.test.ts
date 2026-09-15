import { beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.hoisted(() => vi.fn());
const contentVersion = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock('@/lib/env.server', () => ({ serverEnv: { internalApiUrl: 'http://api/api/v1' } }));
vi.mock('@/lib/cache-versions', () => ({ contentVersion }));
vi.mock('@nuruzzaman/contracts', () => ({ createClient: () => ({ request }) }));

const { publicApi } = await import('@/lib/api/server');

beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue({ data: {} });
  contentVersion.mockReset();
});

describe('publicApi cache key', () => {
  it('carries the shared version of its tags, so an update misses the cache in every process', async () => {
    contentVersion.mockReturnValue('1726412453000.0');

    await publicApi('/posts/bolt-shear', { tags: ['posts', 'post:bolt-shear'] });

    expect(contentVersion).toHaveBeenCalledWith(['posts', 'post:bolt-shear']);
    expect(request).toHaveBeenCalledWith('/posts/bolt-shear', {
      query: undefined,
      headers: { 'X-NB-Content-Version': '1726412453000.0' },
      next: { tags: ['posts', 'post:bolt-shear'], revalidate: 300 },
    });
  });

  it('adds nothing for an untagged read', async () => {
    contentVersion.mockReturnValue('');

    await publicApi('/site/settings', { revalidate: 600 });

    expect(request).toHaveBeenCalledWith('/site/settings', {
      query: undefined,
      next: { tags: undefined, revalidate: 600 },
    });
  });
});
