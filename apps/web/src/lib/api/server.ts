import 'server-only';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ApiError, createClient, type RequestOptions } from '@nuruzzaman/contracts';

import { clientAddress } from '@/lib/client-address';
import { loginRedirect, REQUEST_PATH_HEADER } from '@/lib/request-path';
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

/**
 * Set only while the site is being built, by the deploy workflow, which reads
 * it from the server over SSH. It gives the build its own rate limit on the
 * API - pre-rendering every page is more requests a minute than a visitor's
 * browser could ever make. At runtime it is not set, and nothing sends it.
 */
const buildToken = process.env.NB_BUILD_TOKEN;

/** Cached read for public pages. Never send a signed-in visitor's data here. */
export async function publicApi<T>(path: string, options: PublicFetchOptions = {}): Promise<T> {
  return client.request<T>(path, {
    query: options.query,
    ...(buildToken ? { headers: { 'X-NB-Build-Token': buildToken } } : {}),
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
  // The last address only: see lib/client-address.ts.
  forwarded['X-Forwarded-For'] = clientAddress(headerStore.get('x-forwarded-for'));

  const requestId = headerStore.get('x-request-id');

  if (requestId) {
    forwarded['X-Request-Id'] = requestId;
  }

  try {
    return await client.request<T>(path, {
      ...options,
      headers: { ...forwarded, ...options.headers },
      cache: 'no-store',
    });
  } catch (error) {
    /*
      Signed out: to the sign-in page and back to this URL, which is what every
      layout already did. A page renders alongside its layout, though, so while
      the layout redirected, the page's own request failed too and was logged
      as an unhandled server error on every signed-out visit to /account or
      /dashboard.
    */
    if (error instanceof ApiError && error.isUnauthenticated) {
      redirect(loginRedirect(headerStore.get(REQUEST_PATH_HEADER), '/account'));
    }

    throw error;
  }
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
