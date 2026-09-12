import { describe, expect, it } from 'vitest';

import { loginDestination } from '@/lib/account-routing';
import { loginRedirect } from '@/lib/request-path';

/*
 * Returning a signed-out visitor to where they were going.
 *
 * The account shell used to send everyone to /login?next=/account, which threw
 * away what they had asked for. A verification link is nothing but its query
 * string, so opening one from the email on a phone - no session in that browser
 * - signed you in and then lost the verification, leaving the same "not
 * verified" notice that had sent you to your email.
 */
describe('loginRedirect', () => {
  it('keeps the query string, which is the whole payload of a verification link', () => {
    const requested = '/account/verify-email?target=%2Fapi%2Fv1%2Fauth%2Fverify-email%2F8%2Fabc';

    const redirect = loginRedirect(requested, '/account');

    // Encoded once, so `next` survives as one parameter rather than the
    // target's own query being read as a sibling of it.
    expect(redirect).toBe(`/login?next=${encodeURIComponent(requested)}`);

    // And decodes back to exactly what was asked for.
    const next = new URLSearchParams(redirect.split('?')[1]).get('next');
    expect(next).toBe(requested);
    expect(new URLSearchParams(next!.split('?')[1]).get('target')).toBe(
      '/api/v1/auth/verify-email/8/abc',
    );
  });

  it.each([
    ['an absolute URL', 'https://evil.example/steal'],
    ['a protocol-relative URL', '//evil.example/steal'],
    ['a backslash path', '/account\\..\\evil'],
    ['a path with a control character', '/account\nSet-Cookie: x=1'],
    ['a bare word', 'account'],
    ['an empty string', ''],
    ['null', null],
    ['undefined', undefined],
  ])('falls back rather than trusting %s', (_label, requested) => {
    // The value reaches the layout in a header. The proxy overwrites that
    // header on every request, but a redirect target is worth checking anyway.
    expect(loginRedirect(requested as string | null | undefined, '/account')).toBe(
      `/login?next=${encodeURIComponent('/account')}`,
    );
  });

  it('produces something loginDestination accepts, so the round trip completes', () => {
    const requested = '/account/verify-email?target=%2Fapi%2Fv1%2Fauth%2Fverify-email%2F8%2Fabc';

    const next = new URLSearchParams(
      loginRedirect(requested, '/account').split('?')[1],
    ).get('next');

    // The two ends validate independently; this is the seam between them, and
    // a value rejected here would silently strand the visitor on /account.
    expect(loginDestination(['customer'], next)).toBe(requested);
  });

  it('still sends an administrator to the dashboard, which is deliberate', () => {
    const next = new URLSearchParams(
      loginRedirect('/account/verify-email?target=%2Fapi%2Fv1', '/account').split('?')[1],
    ).get('next');

    // Staff are routed to /dashboard regardless of `next`, so a staff member
    // verifying an address lands there instead of back on the page. Recorded
    // rather than changed: the routing rule predates this and is intended.
    expect(loginDestination(['admin'], next)).toBe('/dashboard');
  });
});
