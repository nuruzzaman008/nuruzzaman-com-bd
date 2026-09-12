/**
 * What the browser asked for, made available to server components.
 *
 * A layout is not given the request path, and two of them need it: the root
 * layout to decide `<html lang>`, and the account shell to send a signed-out
 * visitor to sign in and then back to where they were going. proxy.ts sets
 * both headers on every request that renders the shell.
 */

/** Path only — `/en/courses`. */
export const PATHNAME_HEADER = 'x-nb-pathname';

/** Path and query — `/account/verify-email?target=%2Fapi%2Fv1%2F...`. */
export const REQUEST_PATH_HEADER = 'x-nb-request-path';

/**
 * A `/login` URL that comes back to where the visitor was going.
 *
 * Without this the account shell sent everyone to `/account`, which quietly
 * threw away whatever they had actually asked for - a verification link's
 * `target` among other things, so clicking the link in the email on a phone
 * signed you in and then lost the verification.
 *
 * The path arrives in a header, and is treated as untrusted regardless: only a
 * plain relative path is passed on, so nothing here can land someone on
 * another site once they have signed in. The same rules as loginDestination,
 * which validates the value again at the other end.
 */
export function loginRedirect(requested: string | null | undefined, fallback: string): string {
  const usable =
    typeof requested === 'string'
    && requested.startsWith('/')
    && !requested.startsWith('//')
    && !requested.includes('\\')
    && !Array.from(requested).some((character) => character.charCodeAt(0) < 32);

  return `/login?next=${encodeURIComponent(usable ? requested : fallback)}`;
}
