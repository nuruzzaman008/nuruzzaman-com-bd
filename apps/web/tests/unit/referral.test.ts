import { describe, expect, it } from 'vitest';

import {
  normalizeReferralCode,
  readReferralCode,
  referralCookie,
  referralLink,
} from '@/lib/referral';

describe('referral codes', () => {
  it('accepts only the shape the API accepts, lowercased', () => {
    expect(normalizeReferralCode(' Karim-Civil ')).toBe('karim-civil');
    expect(normalizeReferralCode('ab')).toBeNull();
    expect(normalizeReferralCode('-karim')).toBeNull();
    expect(normalizeReferralCode('karim civil')).toBeNull();
    expect(normalizeReferralCode(null)).toBeNull();
  });

  it('reads the remembered code from the cookies', () => {
    expect(readReferralCode('theme=dark; nb_ref=rahim-eng; XSRF-TOKEN=abc')).toBe('rahim-eng');
    expect(readReferralCode('theme=dark')).toBeNull();
  });

  it('remembers the code for the program window', () => {
    expect(referralCookie('rahim-eng', 30, true)).toBe(
      'nb_ref=rahim-eng; Max-Age=2592000; Path=/; SameSite=Lax; Secure',
    );
  });

  it('adds the code to any page, keeping its query', () => {
    expect(referralLink('https://nuruzzaman.com.bd', '/courses?level=basic', 'rahim-eng')).toBe(
      'https://nuruzzaman.com.bd/courses?level=basic&ref=rahim-eng',
    );
  });
});
