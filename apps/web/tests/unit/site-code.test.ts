import { describe, expect, it } from 'vitest';

import { parseSiteCode, siteCodeValue, SITE_CODE_KEYS } from '@/lib/site-code';

describe('the code an owner pastes into Settings', () => {
  it('reads the AdSense loader as a script the page can run', () => {
    const nodes = parseSiteCode(
      '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1" crossorigin="anonymous"></script>',
    );

    expect(nodes).toEqual([
      {
        kind: 'script',
        // `async=""` is still async, and React spells crossorigin its own way.
        attributes: {
          async: true,
          src: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1',
          crossOrigin: 'anonymous',
        },
        code: null,
      },
    ]);
  });

  it('keeps an inline script as code, so it is not lost as text', () => {
    const nodes = parseSiteCode(
      `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}</script>`,
    );

    expect(nodes[0]).toMatchObject({ kind: 'script', attributes: {} });
    expect((nodes[0] as { code: string }).code).toContain('dataLayer');
  });

  it('reads a verification tag and a stylesheet link', () => {
    const nodes = parseSiteCode(
      '<meta name="google-site-verification" content="abc123" />\n<link rel="stylesheet" href="https://fonts.example/x.css">',
    );

    expect(nodes).toEqual([
      { kind: 'meta', attributes: { name: 'google-site-verification', content: 'abc123' } },
      { kind: 'link', attributes: { rel: 'stylesheet', href: 'https://fonts.example/x.css' } },
    ]);
  });

  it('handles a whole Tag Manager snippet, comments and all', () => {
    const nodes = parseSiteCode(`
      <!-- Google Tag Manager -->
      <script>(function(w,d,s,l,i){w[l]=w[l]||[];})(window,document,'script','dataLayer','GTM-XYZ');</script>
      <!-- End Google Tag Manager -->
      <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-XYZ" height="0"></iframe></noscript>
    `);

    expect(nodes.map((node) => node.kind)).toEqual(['script', 'markup']);
    expect(nodes[1]).toMatchObject({ kind: 'markup' });
  });

  it('keeps a plain banner as markup and drops an event handler', () => {
    expect(parseSiteCode('<div class="promo" onclick="steal()">Hello</div>')).toEqual([
      { kind: 'markup', html: '<div class="promo" onclick="steal()">Hello</div>' },
    ]);
    // Inside a tag it renders as an element, and there the handler is dropped.
    expect(parseSiteCode('<script src="/a.js" onload="steal()"></script>')).toEqual([
      { kind: 'script', attributes: { src: '/a.js' }, code: null },
    ]);
  });

  it('is empty for an empty box', () => {
    expect(parseSiteCode('')).toEqual([]);
    expect(parseSiteCode('   \n  ')).toEqual([]);
    expect(parseSiteCode('<!-- nothing yet -->')).toEqual([]);
  });

  it('reads one saved box out of the public settings', () => {
    const overrides = { [SITE_CODE_KEYS.adsTxt]: 'google.com, pub-1, DIRECT, f08c47fec0942fa0' };

    expect(siteCodeValue(overrides, SITE_CODE_KEYS.adsTxt)).toContain('pub-1');
    expect(siteCodeValue(overrides, SITE_CODE_KEYS.head)).toBe('');
    expect(siteCodeValue(undefined, SITE_CODE_KEYS.head)).toBe('');
  });
});
