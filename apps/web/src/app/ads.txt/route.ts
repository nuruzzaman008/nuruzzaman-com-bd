import type { SiteSettings } from '@nuruzzaman/contracts';

import { tryPublicApi } from '@/lib/api/server';
import { SITE_CODE_KEYS, siteCodeValue } from '@/lib/site-code';

/*
  https://nuruzzaman.com.bd/ads.txt

  An advertising network reads this file to check that the site really is
  allowed to sell its own inventory - AdSense will not pay out without it, and
  it has to be served from the site root, which is why it cannot simply be
  pasted into the header. The line AdSense gives you goes in Settings.
*/
export async function GET(): Promise<Response> {
  const settings = await tryPublicApi<{ data: SiteSettings }>('/site/settings', {
    tags: ['settings'],
    revalidate: 600,
  });
  const text = siteCodeValue(
    settings?.data.overrides as Record<string, unknown> | undefined,
    SITE_CODE_KEYS.adsTxt,
  ).trim();

  if (!text) {
    // Nothing declared: say so plainly rather than serving an empty file,
    // which a network reads as "this site sells nothing".
    return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } });
  }

  return new Response(`${text}\n`, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=600' },
  });
}
