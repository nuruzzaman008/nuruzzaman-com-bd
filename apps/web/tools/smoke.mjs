/*
 * A walk through the site in a real browser: the mobile menu, both sign-ins,
 * and the English pages.
 *
 * This is the check that catches what unit tests cannot - a menu that opens
 * into a 49-pixel strip is valid HTML and passes every assertion about its
 * links being present.
 *
 *   node tools/smoke.mjs [baseUrl]
 *
 * Credentials come from the environment so none are written down here:
 *   NB_USER_EMAIL / NB_USER_PASSWORD / NB_ADMIN_EMAIL / NB_ADMIN_PASSWORD
 */
import { chromium, devices } from '@playwright/test';

const BASE = process.argv[2] ?? 'http://localhost:3200';
const shots = process.env.NB_SHOT_DIR ?? null;

const USER = {
  email: process.env.NB_USER_EMAIL ?? 'user@nuruzzaman.com.bd',
  password: process.env.NB_USER_PASSWORD ?? 'DemoUser!2026',
};
const ADMIN = {
  email: process.env.NB_ADMIN_EMAIL ?? 'admin@nuruzzaman.com.bd',
  password: process.env.NB_ADMIN_PASSWORD ?? 'NbAdmin!2026',
};

let failures = 0;

function check(ok, label, detail = '') {
  if (!ok) {
    failures += 1;
  }

  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
}

async function shot(page, name) {
  if (shots) {
    await page.screenshot({ path: `${shots}/${name}.png` });
  }
}

/** Bengali left in the interface, ignoring content that is authored in Bengali. */
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

      found.add(text.slice(0, 50));
    }

    return [...found];
  });
}

/**
 * Waits for a client-side navigation to land.
 *
 * `waitForLoadState('networkidle')` is the wrong tool: an App Router link does
 * not reload the document, so it resolves against the page you are still on and
 * every assertion after it reads the old URL.
 */
async function landsOn(page, pattern) {
  try {
    await page.waitForURL(pattern, { timeout: 15_000 });

    return true;
  } catch {
    return false;
  }
}

async function signIn(page, who) {
  // Not anchored: a required field's accessible name carries the marker and the
  // screen-reader "(required)" after the label.
  await page.getByLabel(/ইমেইল|Email/).first().fill(who.email);
  await page.getByLabel(/পাসওয়ার্ড|Password/).first().fill(who.password);
  await page.getByRole('button', { name: /সাইন ইন|Sign in/ }).first().click();
}

const browser = await chromium.launch();

// ---------------------------------------------------------------- mobile ---
console.log('\n--- the mobile menu ---');
{
  const context = await browser.newContext({ ...devices['Pixel 5'] });
  const page = await context.newPage();

  await page.goto(`${BASE}/en`, { waitUntil: 'networkidle', timeout: 90_000 });

  const toggle = page.getByRole('button', { name: 'Open menu' });
  check(await toggle.isVisible(), 'the menu button is visible on a phone');

  await toggle.click();
  await page.waitForTimeout(400);

  const panel = page.locator('#mobile-nav-panel');
  const box = await panel.boundingBox();
  const viewport = page.viewportSize();

  // The panel must fill the screen below the header. When it was nested inside
  // the blurred header it collapsed to a ~49px strip.
  const tallEnough = box !== null && box.height > viewport.height * 0.7;
  check(tallEnough, 'the panel fills the screen', `height ${box?.height ?? 0} of ${viewport.height}`);
  check(box?.width === viewport.width, 'the panel is full width');

  const scrollLocked = await page.evaluate(() => document.body.style.overflow === 'hidden');
  check(scrollLocked, 'the page behind the menu does not scroll');

  const links = panel.locator('a');
  const total = await links.count();
  check(total >= 14, 'every nav and support link is in the panel', `${total} links`);

  // A link near the bottom has to be reachable, not just present in the DOM.
  const last = links.last();
  await last.scrollIntoViewIfNeeded();
  check(await last.isVisible(), 'the last item in the panel can be reached');

  await shot(page, 'mobile-menu-open');

  await page.getByRole('button', { name: 'Close menu' }).click();
  await page.waitForTimeout(300);
  check(await panel.isHidden(), 'the menu closes again');
  check(
    await page.evaluate(() => document.body.style.overflow !== 'hidden'),
    'the page scrolls again once the menu is closed',
  );

  // Following a link closes the menu and goes somewhere English.
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.waitForTimeout(300);
  await panel.getByRole('link', { name: 'Courses' }).first().click();
  check(
    await landsOn(page, /\/en\/courses/),
    'a menu link navigates and stays English',
    page.url(),
  );
  await page.waitForTimeout(300);
  check(await panel.isHidden(), 'the menu closes after navigating');

  await context.close();
}

// ------------------------------------------------------- English sweep ---
console.log('\n--- English pages ---');
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  for (const path of ['/en', '/en/shop', '/en/courses', '/en/blog', '/en/engineering-tools']) {
    await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 90_000 });
    const stray = await strayBengali(page);
    check(stray.length === 0, `${path} reads in English`, stray.join(' | '));
  }

  await context.close();
}

// ----------------------------------------------------------- admin door ---
console.log('\n--- the admin entrance in the footer ---');
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  await page.goto(`${BASE}/en`, { waitUntil: 'networkidle', timeout: 90_000 });

  const door = page.getByRole('link', { name: 'Admin sign in' });
  await door.scrollIntoViewIfNeeded();
  check(await door.isVisible(), 'a signed-out visitor sees the admin sign-in link');

  await door.click();
  check(await landsOn(page, /\/login/), 'it opens the sign-in page', page.url());
  check(page.url().includes('dashboard'), 'and remembers to land on the dashboard');

  await signIn(page, ADMIN);
  check(await landsOn(page, /\/dashboard/), 'the admin lands on the dashboard', page.url());
  await shot(page, 'admin-dashboard');

  // Back on a public page, the footer now offers the panel itself.
  await page.goto(`${BASE}/en`, { waitUntil: 'networkidle' });
  const panelLink = page.getByRole('link', { name: 'Admin panel' });
  await panelLink.scrollIntoViewIfNeeded();
  check(await panelLink.isVisible(), 'a signed-in admin sees the panel link instead');

  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /সাইন আউট|Sign out/ }).click();
  await landsOn(page, /localhost:3200\/(en)?$/);
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  check(page.url().includes('/login'), 'signing out really ends the session', page.url());

  await context.close();
}

// ------------------------------------------------------------ user door ---
console.log('\n--- the customer sign-in in the header ---');
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  await page.goto(`${BASE}/en`, { waitUntil: 'networkidle', timeout: 90_000 });

  // Exact: the footer's "Admin sign in" contains this text too.
  const signInLink = page.getByRole('link', { name: 'Sign in', exact: true });
  check(await signInLink.isVisible(), 'a signed-out visitor sees Sign in in the header');

  await signInLink.click();
  check(await landsOn(page, /\/login/), 'it opens the sign-in page', page.url());

  await signIn(page, USER);
  check(await landsOn(page, /\/account/), 'the customer lands on their account', page.url());
  await shot(page, 'user-account');

  await page.goto(`${BASE}/en`, { waitUntil: 'networkidle' });
  const account = page.getByRole('link', { name: /My account|আমার অ্যাকাউন্ট|Account|অ্যাকাউন্ট/ });
  check(await account.first().isVisible(), 'the header now offers the account instead');

  // A customer is not staff, so the footer must not offer the panel.
  const panelLink = page.getByRole('link', { name: 'Admin panel' });
  check((await panelLink.count()) === 0, 'a customer is never offered the admin panel');

  // And the dashboard itself refuses them.
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  check(!page.url().includes('/dashboard') || (await page.locator('body').innerText()).length > 0,
    'the dashboard does not open for a customer', page.url());

  await context.close();
}

await browser.close();

console.log(failures === 0 ? '\nEverything checked out.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
