/**
 * The visitor's address, as this site's own web server saw it.
 *
 * X-Forwarded-For is a list that anyone can start: a browser may send the
 * header with whatever it likes, and each proxy then appends the address it
 * received the request from. Only the last entry was written by our server, so
 * that is the only one worth passing on.
 *
 * Passing the whole list let a visitor's own first entry reach the API, where
 * the web server in front of Laravel took it as the client's address - and
 * every per-address rate limit counted a name the visitor had made up.
 */
export function clientAddress(forwardedFor: string | null | undefined): string {
  const entries = (forwardedFor ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return entries.at(-1) ?? '';
}
