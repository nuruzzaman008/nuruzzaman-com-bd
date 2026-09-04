import { describe, expect, it } from 'vitest';

import { getDictionary } from '@/lib/i18n/dictionary';
import { levelLabel, productTypeLabel, taxonomyLabel } from '@/lib/i18n/labels';
import { localizeHref } from '@/components/ui/locale-link';
import { counted, date, duration, minutes, number } from '@/lib/format';

const bn = getDictionary('bn');
const en = getDictionary('en');

describe('taxonomyLabel', () => {
  it('prefers the name the API sent on the Bengali site', () => {
    // Editing a category in the admin has to change what a Bengali reader sees,
    // so the dictionary value is only a fallback there.
    expect(taxonomyLabel(bn, 'structural-engineering', 'স্ট্রাকচারাল কিছু', 'bn')).toBe(
      'স্ট্রাকচারাল কিছু',
    );
  });

  it('falls back to the dictionary when the API sent no name', () => {
    expect(taxonomyLabel(bn, 'steel-design', null, 'bn')).toBe('স্টিল স্ট্রাকচার ডিজাইন');
  });

  it('uses the English name on the English site, not the Bengali one the API sent', () => {
    expect(taxonomyLabel(en, 'steel-design', 'স্টিল স্ট্রাকচার ডিজাইন', 'en')).toBe(
      'Steel structure design',
    );
  });

  it('keeps an unknown slug visible rather than rendering blank', () => {
    expect(taxonomyLabel(en, 'brand-new-track', 'নতুন', 'en')).toBe('নতুন');
    expect(taxonomyLabel(en, 'brand-new-track', null, 'en')).toBe('brand-new-track');
  });
});

describe('levelLabel and productTypeLabel', () => {
  it('translate the known values', () => {
    expect(levelLabel(en, 'beginner')).toBe('Beginner');
    expect(productTypeLabel(en, 'credit_refill')).toBe('Credit refill');
  });

  it('pass an unknown value through instead of hiding it', () => {
    expect(levelLabel(en, 'expert')).toBe('expert');
    expect(productTypeLabel(en, 'mystery')).toBe('mystery');
  });
});

describe('localizeHref', () => {
  it('leaves every path alone on the Bengali site, which is unprefixed', () => {
    expect(localizeHref('/blog', 'bn')).toBe('/blog');
    expect(localizeHref('/', 'bn')).toBe('/');
  });

  it('prefixes public paths on the English site', () => {
    expect(localizeHref('/blog', 'en')).toBe('/en/blog');
    expect(localizeHref('/', 'en')).toBe('/en');
  });

  it('keeps the query string and the hash outside the prefix', () => {
    expect(localizeHref('/courses?track=steel-design', 'en')).toBe('/en/courses?track=steel-design');
    expect(localizeHref('/support#activation', 'en')).toBe('/en/support#activation');
  });

  it('leaves the signed-in applications unprefixed: they have no English tree', () => {
    expect(localizeHref('/account/orders', 'en')).toBe('/account/orders');
    expect(localizeHref('/dashboard', 'en')).toBe('/dashboard');
    expect(localizeHref('/cart', 'en')).toBe('/cart');
  });

  it('leaves external links and fragments untouched', () => {
    expect(localizeHref('https://example.com/x', 'en')).toBe('https://example.com/x');
    expect(localizeHref('mailto:a@b.c', 'en')).toBe('mailto:a@b.c');
    expect(localizeHref('#top', 'en')).toBe('#top');
  });

  it('does not prefix a path that is already English', () => {
    expect(localizeHref('/en/blog', 'en')).toBe('/en/blog');
  });
});

describe('locale-aware formatting', () => {
  it('uses Bengali digits by default and Latin digits for English', () => {
    expect(number(1234)).toBe(number(1234, 'bn'));
    expect(number(1234, 'en')).toBe('1,234');
    expect(number(1234, 'bn')).not.toBe('1,234');
  });

  it('names the unit in the requested language', () => {
    expect(minutes(7, 'en')).toBe('7 minutes');
    expect(duration(3 * 3600, 'en')).toBe('3 hours');
    expect(minutes(7, 'bn')).toContain('মিনিট');
  });

  it('uses the singular for one, which English needs and Bengali does not', () => {
    expect(minutes(1, 'en')).toBe('1 minute');
    expect(duration(3600, 'en')).toBe('1 hour');
    expect(counted(1, 'lesson', 'en')).toBe('1 lesson');
    expect(counted(2, 'lesson', 'en')).toBe('2 lessons');
    // Bengali uses one form for both, so the count is all that changes.
    expect(minutes(1, 'bn')).toContain('মিনিট');
    expect(minutes(9, 'bn')).toContain('মিনিট');
  });

  it('formats dates in the requested language, always in Asia/Dhaka', () => {
    const iso = '2026-09-03T18:30:00Z'; // 04 Sep 2026 00:30 in Dhaka
    expect(date(iso, 'en')).toBe('September 4, 2026');
    expect(date(iso, 'bn')).toContain('২০২৬');
  });

  it('treats a missing value as a real state, not as zero', () => {
    expect(minutes(null, 'en')).toBeNull();
    expect(duration(0, 'en')).toBeNull();
    expect(date(null, 'en')).toBeNull();
  });
});
