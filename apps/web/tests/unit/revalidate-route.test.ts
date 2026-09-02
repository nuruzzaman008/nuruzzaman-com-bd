import { createHmac } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const revalidateTag = vi.fn();

vi.mock('next/cache', () => ({ revalidateTag }));
vi.mock('@/lib/env.server', () => ({
  serverEnv: { internalApiUrl: 'http://api/api/v1', revalidateSecret: 'test-secret' },
  assertRevalidateSecret: () => 'test-secret',
}));

const { POST } = await import('@/app/api/revalidate/route');

function signed(body: unknown, secret = 'test-secret'): Request {
  const payload = JSON.stringify(body);

  return new Request('http://localhost/api/revalidate', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-revalidate-signature': createHmac('sha256', secret).update(payload).digest('hex'),
    },
    body: payload,
  });
}

describe('POST /api/revalidate', () => {
  beforeEach(() => {
    revalidateTag.mockClear();
  });

  it('revalidates the tags in a correctly signed request', async () => {
    const response = await POST(signed({ tags: ['posts', 'post:footing-basics'] }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      revalidated: ['posts', 'post:footing-basics'],
    });
    expect(revalidateTag).toHaveBeenCalledWith('posts', 'max');
  });

  it('rejects a request signed with the wrong secret', async () => {
    const response = await POST(signed({ tags: ['posts'] }, 'not-the-secret'));

    expect(response.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('rejects a request with no signature at all', async () => {
    const response = await POST(
      new Request('http://localhost/api/revalidate', {
        method: 'POST',
        body: JSON.stringify({ tags: ['posts'] }),
      }),
    );

    expect(response.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('ignores tags that do not match the allowed shape', async () => {
    const response = await POST(signed({ tags: ['posts', '../../etc/passwd', 'Ω'] }));

    await expect(response.json()).resolves.toEqual({ revalidated: ['posts'] });
    expect(revalidateTag).toHaveBeenCalledTimes(1);
  });

  it('refuses an empty or oversized tag list', async () => {
    await expect(POST(signed({ tags: [] })).then((r) => r.status)).resolves.toBe(400);
    await expect(
      POST(signed({ tags: Array.from({ length: 51 }, (_, i) => `tag${i}`) })).then((r) => r.status),
    ).resolves.toBe(400);
  });
});
