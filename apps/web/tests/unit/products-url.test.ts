import { existsSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import nextConfig from '../../next.config';
import { headerNav, primaryNav } from '@/lib/site';

// From the working directory rather than import.meta.url: under the jsdom
// environment that is not a file: URL. The suite runs from apps/web, both
// locally and through the workspace script in CI; the fallback covers a run
// started at the repository root.
const APP = existsSync(path.resolve(process.cwd(), 'src/app'))
  ? path.resolve(process.cwd(), 'src/app')
  : path.resolve(process.cwd(), 'apps/web/src/app');

/**
 * The catalogue has one public address: /products.
 *
 * It was /shop, while the header said "Products", the dashboard said
 * "Products" and the schema.org type said Product. One name everywhere is the
 * point; the redirects are what keep it from costing anything already indexed
 * or linked at the old address.
 */
describe('the catalogue URL', () => {
  it('is served at /products in both languages', () => {
    for (const route of [
      '(public)/products/page.tsx',
      '(public)/products/[slug]/page.tsx',
      'en/products/page.tsx',
      'en/products/[slug]/page.tsx',
    ]) {
      expect(existsSync(path.join(APP, route)), route).toBe(true);
    }
  });

  it('is not also served at /shop', () => {
    // A page left behind at /shop would be a second indexable copy of the
    // catalogue - the duplicate the redirects exist to prevent.
    expect(existsSync(path.join(APP, '(public)/shop'))).toBe(false);
    expect(existsSync(path.join(APP, 'en/shop'))).toBe(false);
  });

  it('sends every old /shop address to its /products twin permanently', async () => {
    const redirects = (await nextConfig.redirects?.()) ?? [];

    for (const [source, destination] of [
      ['/shop', '/products'],
      ['/shop/:slug', '/products/:slug'],
      ['/en/shop', '/en/products'],
      ['/en/shop/:slug', '/en/products/:slug'],
    ]) {
      // Permanent, so search engines move the old URL's standing across
      // rather than keeping both.
      expect(redirects.find((rule) => rule.source === source), source).toMatchObject({
        destination,
        permanent: true,
      });
    }
  });

  it('is the address the header links to', () => {
    expect(headerNav.map((item) => item.href)).toContain('/products');
    expect(primaryNav.some((item) => item.href.startsWith('/shop'))).toBe(false);
  });
});
