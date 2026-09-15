/**
 * The affiliate code a visitor arrived with.
 *
 * Kept in a first-party cookie rather than on the account: most visitors are
 * not signed in when they open a referral link, and the sale can come days
 * later. Script-readable on purpose - checkout sends the code in its request
 * body, so attribution does not depend on which host serves the API.
 */
export const REFERRAL_COOKIE = 'nb_ref';
export const REFERRAL_PARAM = 'ref';

/** The same shape the API accepts: lowercase letters, digits, inner hyphens. */
const CODE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

export function normalizeReferralCode(value: string | null | undefined): string | null {
  const code = value?.trim().toLowerCase() ?? '';

  return CODE.test(code) ? code : null;
}

export function readReferralCode(cookie: string): string | null {
  const match = cookie.match(new RegExp(`(?:^|; )${REFERRAL_COOKIE}=([^;]*)`));

  return match ? normalizeReferralCode(decodeURIComponent(match[1])) : null;
}

export function referralCookie(code: string, days: number, secure: boolean): string {
  const maxAge = Math.max(1, Math.round(days * 86400));

  return `${REFERRAL_COOKIE}=${encodeURIComponent(code)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure ? '; Secure' : ''}`;
}

/** A page on the site with the code added, keeping any query it already had. */
export function referralLink(siteUrl: string, path: string, code: string): string {
  const url = new URL(path || '/', siteUrl);
  url.searchParams.set(REFERRAL_PARAM, code);

  return url.toString();
}
