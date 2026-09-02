import { describe, expect, it } from 'vitest';

import { date, duration, fileSize, isoDate, minutes, number, price } from '@/lib/format';

describe('price', () => {
  it('formats integer minor units as currency in Bangla digits', () => {
    // 500000 poisha is 5,000.00 BDT, rendered with bn-BD numerals and symbol.
    expect(price(500000)).toBe('৫,০০০.০০৳');
  });

  it('returns null when no price has been published', () => {
    // A missing price is a real state, not zero: the UI must render its own
    // "contact for price" copy rather than a fabricated amount.
    expect(price(null)).toBeNull();
    expect(price(undefined)).toBeNull();
  });

  it('formats zero as zero rather than null', () => {
    expect(price(0)).not.toBeNull();
  });
});

describe('date', () => {
  it('renders a UTC timestamp in Asia/Dhaka', () => {
    // 2026-01-01T20:00:00Z is already 2 January in Dhaka (UTC+6).
    expect(date('2026-01-01T20:00:00Z')).toContain('২');
  });

  it('returns null for a missing value', () => {
    expect(date(null)).toBeNull();
  });

  it('keeps ISO output unlocalised for machines', () => {
    expect(isoDate('2026-01-01T20:00:00Z')).toBe('2026-01-01T20:00:00.000Z');
  });
});

describe('duration and sizes', () => {
  it('describes minutes and hours', () => {
    expect(duration(90)).toContain('মিনিট');
    expect(duration(7200)).toContain('ঘণ্টা');
    expect(duration(0)).toBeNull();
  });

  it('formats file sizes', () => {
    expect(fileSize(1024)).toBe('1.0 KB');
    expect(fileSize(0)).toBeNull();
  });

  it('formats numbers and minutes in Bangla digits', () => {
    expect(number(1234)).toBe('১,২৩৪');
    expect(minutes(5)).toContain('মিনিট');
  });
});
