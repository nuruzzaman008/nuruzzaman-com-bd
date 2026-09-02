'use client';

import { ApiError, createClient, type RequestOptions } from '@nuruzzaman/contracts';

import { publicEnv } from '@/lib/env';

/**
 * Browser-side API access.
 *
 * Requests go to the same origin, so the Sanctum session cookie travels with
 * them and no token is ever stored in JavaScript. Mutations carry the CSRF
 * header Laravel expects, priming the cookie first when it is missing.
 */

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));

  return match ? decodeURIComponent(match[1]) : null;
}

let csrfPrimed: Promise<void> | null = null;

async function primeCsrf(): Promise<void> {
  if (readCookie('XSRF-TOKEN')) {
    return;
  }

  csrfPrimed ??= fetch('/sanctum/csrf-cookie', { credentials: 'include' }).then(() => undefined);

  await csrfPrimed;
  csrfPrimed = null;
}

const client = createClient({
  baseUrl: publicEnv.apiBasePath,
  getHeaders: (): Record<string, string> => {
    const token = readCookie('XSRF-TOKEN');

    return token ? { 'X-XSRF-TOKEN': token } : {};
  },
});

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (options.method && options.method !== 'GET') {
    await primeCsrf();
  }

  try {
    return await client.request<T>(path, options);
  } catch (error) {
    // A stale CSRF token is worth exactly one transparent retry; anything else
    // is surfaced to the caller so the UI can show a real message.
    if (error instanceof ApiError && error.status === 419) {
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' });

      return client.request<T>(path, options);
    }

    throw error;
  }
}

export { ApiError };
