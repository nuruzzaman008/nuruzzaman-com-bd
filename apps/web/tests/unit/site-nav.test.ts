import { describe, expect, it } from 'vitest';

import { getDictionary } from '@/lib/i18n/dictionary';
import { headerNav, navItemLabel, primaryNav } from '@/lib/site';

describe('site navigation', () => {
  it('offers the catalogue from the header', () => {
    expect(headerNav.map((item) => item.href)).toContain('/shop');
  });

  it('keeps the About page out of the header', () => {
    expect(headerNav.map((item) => item.href)).not.toContain('/about');
  });

  it('still links every header-hidden page from the footer', () => {
    // The footer's "explore" column is primaryNav.slice(1). A page dropped from
    // primaryNav outright would have no internal link left anywhere on the
    // site - orphaned for a reader and for a crawler alike.
    const footer = primaryNav.slice(1).map((item) => item.href);

    expect(footer).toContain('/about');

    for (const item of primaryNav.filter((entry) => entry.footerOnly)) {
      expect(footer).toContain(item.href);
    }
  });

  it('gives every item a label in both languages', () => {
    for (const locale of ['bn', 'en'] as const) {
      const t = getDictionary(locale);

      for (const item of primaryNav) {
        const label = navItemLabel(item, t);

        // navItemLabel falls back to the href when no key resolves, which
        // would put a raw path in the menu rather than a word.
        expect(label).not.toBe(item.href);
        expect(label.trim()).not.toBe('');
      }
    }
  });

  it('has no duplicate destinations', () => {
    const hrefs = primaryNav.map((item) => item.href);

    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
