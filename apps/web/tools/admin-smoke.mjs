/*
 * Walks the admin panel in a real browser: is it English by default, does the
 * switcher work, and does the preference stick from one screen to the next?
 *
 *   node tools/admin-smoke.mjs [baseUrl]
 *
 * Credentials come from the environment:
 *   NB_ADMIN_EMAIL / NB_ADMIN_PASSWORD
 */
import { chromium } from '@playwright/test';

const BASE = process.argv[2] ?? 'http://localhost:3200';
const shots = process.env.NB_SHOT_DIR ?? null;

const ADMIN = {
  email: process.env.NB_ADMIN_EMAIL ?? 'admin@nuruzzaman.com.bd',
  password: process.env.NB_ADMIN_PASSWORD ?? 'NbAdmin!2026',
};

const SCREENS = [
  '/dashboard',
  '/dashboard/posts',
  '/dashboard/pages',
  '/dashboard/media',
  '/dashboard/comments',
  '/dashboard/redirects',
  '/dashboard/products',
  '/dashboard/orders',
  '/dashboard/releases',
  '/dashboard/courses',
  '/dashboard/activation-requests',
  '/dashboard/support-tickets',
  '/dashboard/users',
  '/dashboard/settings',
  '/dashboard/audit-log',
];

let failures = 0;

function check(ok, label, detail = '') {
  if (!ok) {
    failures += 1;
  }

  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
}

/**
 * Bengali still on screen, ignoring what is Bengali on purpose: the language
 * switcher names each language in its own language, and content the owner wrote
 * in Bengali stays Bengali in either interface.
 */
async function strayBengali(page) {
  return page.evaluate(() => {
    const bengali = /[ঀ-৿]/;
    const found = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;

    while ((node = walker.nextNode())) {
      const text = node.textContent?.trim();
      const el = node.parentElement;

      if (!text || !bengali.test(text) || !el || el.offsetParent === null) {
        continue;
      }

      if (el.closest('[data-authored]') || el.closest('[data-language-switcher]')) {
        continue;
      }

      found.add(text.slice(0, 45));
    }

    return [...found];
  });
}

/** Waits for the panel to re-render in the chosen language. */
async function settlesTo(page, text) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await page.evaluate((needle) => document.body.innerText.includes(needle), text)) {
      return true;
    }

    await page.waitForTimeout(500);
  }

  return false;
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();

// ------------------------------------------------------------- sign in ---
await page.goto(`${BASE}/login?next=%2Fdashboard`, { waitUntil: 'networkidle', timeout: 90_000 });
await page.getByLabel(/ইমেইল|Email/).first().fill(ADMIN.email);
await page.getByLabel(/পাসওয়ার্ড|Password/).first().fill(ADMIN.password);
await page.getByRole('button', { name: /সাইন ইন|Sign in/ }).first().click();
await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

// ----------------------------------------------- English is the default ---
console.log('\n--- English by default (no preference set yet) ---');
for (const path of SCREENS) {
  await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 60_000 });
  const stray = await strayBengali(page);
  check(stray.length === 0, `${path} reads in English`, stray.slice(0, 3).join(' | '));
}

await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
await shot(page, 'admin-english');

// --------------------------------------------------------- the switcher ---
console.log('\n--- switching to Bengali ---');
const toBengali = page.getByRole('button', { name: 'বাংলা' });
check(await toBengali.isVisible(), 'the switcher is in the admin sidebar');

await toBengali.click();

// router.refresh() re-renders the server components; poll rather than guess how
// long that takes on a cold route.
check(await settlesTo(page, 'ড্যাশবোর্ড'), 'the panel is now in Bengali');
await shot(page, 'admin-bengali');

// The preference has to survive a move to another screen and a reload.
await page.goto(`${BASE}/dashboard/orders`, { waitUntil: 'networkidle' });
check(
  await page.evaluate(() => document.body.innerText.includes('অর্ডার')),
  'the choice carries to the next screen',
);

await page.reload({ waitUntil: 'networkidle' });
check(
  await page.evaluate(() => document.body.innerText.includes('অর্ডার')),
  'and survives a reload',
);

console.log('\n--- switching back to English ---');
await page.getByRole('button', { name: 'English' }).click();
check(await settlesTo(page, 'Orders'), 'back to English');

// The public site must be unaffected by the admin preference.
await page.goto(`${BASE}/courses`, { waitUntil: 'networkidle' });
check(
  await page.evaluate(() => document.documentElement.lang === 'bn'),
  'the Bengali public site is still Bengali',
);

await browser.close();

console.log(failures === 0 ? '\nThe admin panel checks out.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);

async function shot(target, name) {
  if (shots) {
    await target.screenshot({ path: `${shots}/${name}.png` });
  }
}
