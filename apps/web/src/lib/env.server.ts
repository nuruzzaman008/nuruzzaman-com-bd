import 'server-only';

/**
 * Server-only configuration.
 *
 * `server-only` makes importing this file from a Client Component a build
 * error, which is the guardrail that keeps the revalidation secret and the
 * internal API address out of the browser bundle.
 */
export const serverEnv = {
  /**
   * Where Server Components reach Laravel. In Docker this is the internal
   * service address, so a server render never leaves the network to talk to
   * its own backend.
   */
  internalApiUrl: process.env.INTERNAL_API_URL ?? 'http://localhost:8000/api/v1',
  /** Shared secret for the signed revalidation webhook Laravel calls. */
  revalidateSecret: process.env.NEXT_REVALIDATE_SECRET ?? '',
} as const;

export function assertRevalidateSecret(): string {
  if (!serverEnv.revalidateSecret) {
    throw new Error('NEXT_REVALIDATE_SECRET is not configured.');
  }

  return serverEnv.revalidateSecret;
}
