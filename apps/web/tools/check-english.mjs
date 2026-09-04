/*
 * Walks every English route and reports Bengali text still rendered in the
 * interface.
 *
 * Article titles, course names and other authored content are written in
 * Bengali and stay Bengali on the English site - translating them would be
 * inventing content. So a text node is only reported when it is NOT inside an
 * element marked data-authored, and the caller reads the list to decide.
 *
 *   node tools/check-english.mjs [baseUrl]
 */
import { chromium } from '@playwright/test';

const BASE = process.argv[2] ?? 'http://localhost:3200';

const ROUTES = [
  '/en',
  '/en/blog',
  '/en/courses',
  '/en/engineering-tools',
  '/en/shop',
  '/en/contact',
  '/en/search',
  '/en/about',
  '/en/resources',
  '/en/faq',
  '/en/support',
  '/en/support/installation',
  '/en/support/activation',
  '/en/support/license-recovery',
  '/en/support/release-notes',
  '/en/support/system-requirements',
  '/en/privacy-policy',
  '/en/terms',
  '/en/refund-policy',
  '/en/software-eula',
  '/en/course-terms',
  '/en/engineering-disclaimer',
  '/en/verify/unknown-id',
  // One of each detail template, so the dynamic routes are covered too.
  '/en/blog/bnbc-load-combination-notes',
  '/en/courses/nb-engineering-tools-complete-workflow',
  '/en/shop/nb-credit-refill',
  '/en/topics/structural-engineering',
  '/en/authors/nuruzzaman',
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

let failures = 0;

for (const route of ROUTES) {
  const response = await page.goto(BASE + route, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  });
  await page.waitForTimeout(500);

  const found = await page.evaluate(() => {
    const bengali = /[ঀ-৿]/;
    const out = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;

    while ((node = walker.nextNode())) {
      const text = node.textContent.trim();

      if (!text || !bengali.test(text)) {
        continue;
      }

      const el = node.parentElement;

      // Hidden text is not part of what the reader sees.
      if (!el || el.offsetParent === null) {
        continue;
      }

      // The language switcher names each language in its own language.
      if (el.closest('[data-language-switcher]')) {
        continue;
      }

      // Bodies and titles written by the owner in Bengali.
      if (el.closest('[data-authored]')) {
        continue;
      }

      out.add(text.slice(0, 70));
    }

    return [...out];
  });

  const status = response.status();
  const title = await page.title();
  const ok = status === 200 && found.length === 0;

  if (!ok) {
    failures += 1;
  }

  console.log(`${ok ? 'ok  ' : 'FAIL'} ${status} ${route}`);
  console.log(`       title: ${title}`);

  for (const text of found) {
    console.log(`       bengali: ${text}`);
  }
}

await browser.close();

console.log(failures === 0 ? '\nAll English routes are clean.' : `\n${failures} route(s) need attention.`);
process.exit(failures === 0 ? 0 : 1);
