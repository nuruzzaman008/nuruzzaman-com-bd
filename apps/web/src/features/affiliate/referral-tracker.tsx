'use client';

import { useEffect } from 'react';

import { api } from '@/lib/api/browser';
import { REFERRAL_PARAM, normalizeReferralCode, referralCookie } from '@/lib/referral';

type VisitResult = { data: { valid: boolean; code: string | null; cookie_days: number } };

/**
 * Remembers the affiliate code a visitor arrived with (`?ref=code`) and counts
 * the visit. Renders nothing.
 *
 * The code is taken out of the address bar once read, so the canonical URL is
 * what gets bookmarked or shared onward, and a second visitor is not credited
 * to someone who never sent them.
 */
export function ReferralTracker() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = normalizeReferralCode(url.searchParams.get(REFERRAL_PARAM));

    if (!code) {
      return;
    }

    url.searchParams.delete(REFERRAL_PARAM);
    window.history.replaceState(
      window.history.state,
      '',
      `${url.pathname}${url.search}${url.hash}`,
    );

    void api<VisitResult>('/affiliate-visits', {
      method: 'POST',
      body: { code, path: url.pathname },
    })
      .then((response) => {
        if (response.data.valid && response.data.code) {
          document.cookie = referralCookie(
            response.data.code,
            response.data.cookie_days,
            window.location.protocol === 'https:',
          );
        }
      })
      // A failed count must never get in the way of the page.
      .catch(() => undefined);
  }, []);

  return null;
}
