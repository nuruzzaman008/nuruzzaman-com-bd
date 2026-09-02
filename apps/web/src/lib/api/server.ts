import 'server-only';

import { cookies, headers } from 'next/headers';
import { createClient, type RequestOptions } from '@nuruzzaman/contracts';

import { serverEnv } from '@/lib/env.server';

/**
 * Server-side API access.
 *
 * Server Components call Laravel directly over the internal network rather than
 * looping back through a Next Route Handler, which would add a whole extra
 * request to every render.
 *
 * Two clients are exported because they cache very differently:
 *   * `publicApi` is for cacheable, tag-revalidated public content.
 *   * `sessionApi` forwards the visitor's cookies and never caches.
 */

const client = createClient({ baseUrl: serverEnv.internalApiUrl });

export type PublicFetchOptions = {
  /** Cache tags Laravel can invalidate through the revalidation webhook. */
  tags?: string[];
  /** Seconds. `false` caches until a tag is revalidated. */
  revalidate?: number | false;
  query?: RequestOptions['query'];
};

/** Cached read for public pages. Never send a signed-in visitor's data here. */
export async function publicApi<T>(path: string, options: PublicFetchOptions = {}): Promise<T> {
  return client.request<T>(path, {
    query: options.query,
    next: {
      tags: options.tags,
      revalidate: options.revalidate ?? 300,
    },
  });
}

/**
 * Authenticated read/write on behalf of the current visitor. Always dynamic:
 * a response built from someone's session must never enter a shared cache.
 */
export async function sessionApi<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);

  const forwarded: Record<string, string> = {
    Cookie: cookieStore.toString(),
  };

  const xsrf = cookieStore.get('XSRF-TOKEN')?.value;

  if (xsrf) {
    forwarded['X-XSRF-TOKEN'] = decodeURIComponent(xsrf);
  }

  // Sanctum decides a request is first-party from its Origin, and Laravel needs
  // the real client address for rate limiting and audit rows.
  forwarded.Origin = headerStore.get('origin') ?? headerStore.get('host') ?? '';
  forwarded['X-Forwarded-For'] = headerStore.get('x-forwarded-for') ?? '';

  const requestId = headerStore.get('x-request-id');

  if (requestId) {
    forwarded['X-Request-Id'] = requestId;
  }

  return client.request<T>(path, {
    ...options,
    headers: { ...forwarded, ...options.headers },
    cache: 'no-store',
  });
}

/** Returns null on 404/403 instead of throwing, for optional page sections. */
export async function tryPublicApi<T>(
  path: string,
  options: PublicFetchOptions = {},
): Promise<T | null> {
  try {
    return await publicApi<T>(path, options);
  } catch {
    return null;
  }
}
