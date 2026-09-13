import { describe, expect, it } from 'vitest';

import { slugify } from '@/lib/slug';

describe('slugify', () => {
  it('turns a typed title into a URL slug', () => {
    expect(slugify('Basic English Sound')).toBe('basic-english-sound');
    expect(slugify('  Basic--English   Sound!! ')).toBe('basic-english-sound');
    expect(slugify('RCC Beam & Slab (Part 2)')).toBe('rcc-beam-and-slab-part-2');
  });

  it('leaves a slug that is already right unchanged', () => {
    expect(slugify('basic-english-sound')).toBe('basic-english-sound');
  });

  it('drops accents, and letters with no Latin form', () => {
    expect(slugify('Café Déjà vu')).toBe('cafe-deja-vu');
    expect(slugify('বেসিক English 101')).toBe('english-101');
    expect(slugify('বাংলা কোর্স')).toBe('');
  });

  it('keeps within the length the API allows, without a trailing hyphen', () => {
    const slug = slugify(`${'a'.repeat(179)} b`);

    expect(slug.length).toBeLessThanOrEqual(180);
    expect(slug.endsWith('-')).toBe(false);
  });
});
