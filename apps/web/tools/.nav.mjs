import { chromium } from '@playwright/test';
const B = 'http://localhost:3200';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 160)); });
p.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });

async function go(url, how) {
  if (how === 'click') {
    // Client-side navigation, which is how a visitor actually moves around.
    const link = p.locator(`a[href="${url}"]`).first();
    if (await link.count() === 0) { console.log(`  (no link to ${url} on this page)`); return; }
    await link.click();
    await p.waitForLoadState('networkidle');
  } else {
    await p.goto(B + url, { waitUntil: 'networkidle', timeout: 60000 });
  }
  const body = await p.locator('body').innerText();
  const broke = /কিছু একটা ভুল হয়েছে|Something went wrong|Reference:/.test(body);
  console.log(`${broke ? 'BROKEN' : 'ok    '}  ${p.url().replace(B, '') || '/'}`);
  if (broke) console.log('        ' + body.split('\n').slice(0, 4).join(' | '));
}

console.log('--- direct loads (Bengali) ---');
for (const u of ['/resources', '/about', '/support', '/faq', '/terms', '/course-terms']) await go(u, 'goto');

console.log('--- direct loads (English) ---');
for (const u of ['/en/resources', '/en/about', '/en/support', '/en/faq']) await go(u, 'goto');

console.log('--- client-side navigation from the English home ---');
await p.goto(B + '/en', { waitUntil: 'networkidle' });
for (const u of ['/en/about', '/en/support', '/en/resources']) await go(u, 'click');

console.log('--- language switch, then navigate ---');
await p.goto(B + '/en/about', { waitUntil: 'networkidle' });
await p.getByRole('link', { name: 'বাংলা' }).first().click();
await p.waitForLoadState('networkidle');
console.log('  after switch ->', p.url().replace(B, ''));
for (const u of ['/resources', '/support']) await go(u, 'click');

await b.close();
console.log('\n--- errors seen ---');
console.log(errors.length ? [...new Set(errors)].join('\n') : 'none');
