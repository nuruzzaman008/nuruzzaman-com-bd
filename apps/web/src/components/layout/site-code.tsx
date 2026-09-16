import type { SiteSettings } from '@nuruzzaman/contracts';

import { tryPublicApi } from '@/lib/api/server';
import { SITE_CODE_KEYS, parseSiteCode, siteCodeValue, type SiteCodeNode } from '@/lib/site-code';

/*
  The owner's own code on every public page: a Search Console tag, an AdSense
  loader, analytics, a chat widget. Saved in Settings, rendered here.

  React lifts a <meta>, a <link> and an async <script> into <head> wherever
  they are rendered, which is why this can sit at the top of the body and a
  verification tag still lands where a crawler looks for it.

  Only the public shell renders it. The dashboard and the course player are
  not pages an advertiser or an analytics account has any business in.
*/
function render(nodes: SiteCodeNode[], prefix: string) {
  return nodes.map((node, index) => {
    const key = `${prefix}-${index}`;

    switch (node.kind) {
      case 'script':
        return node.code ? (
          <script key={key} {...node.attributes} dangerouslySetInnerHTML={{ __html: node.code }} />
        ) : (
          <script key={key} {...node.attributes} />
        );
      case 'style':
        return <style key={key} dangerouslySetInnerHTML={{ __html: node.code }} />;
      case 'meta':
        return <meta key={key} {...node.attributes} />;
      case 'link':
        return <link key={key} {...node.attributes} />;
      case 'markup':
        // `contents` keeps the wrapper out of the layout: the body is a flex
        // column, and a stray box in it would push the page down.
        return (
          <div key={key} className="contents" dangerouslySetInnerHTML={{ __html: node.html }} />
        );
    }
  });
}

export async function SiteCode({ slot }: { slot: 'top' | 'bottom' }) {
  const settings = await tryPublicApi<{ data: SiteSettings }>('/site/settings', {
    tags: ['settings'],
    revalidate: 600,
  });
  const overrides = settings?.data.overrides as Record<string, unknown> | undefined;

  const snippets =
    slot === 'top'
      ? [
          siteCodeValue(overrides, SITE_CODE_KEYS.head),
          siteCodeValue(overrides, SITE_CODE_KEYS.bodyStart),
        ]
      : [siteCodeValue(overrides, SITE_CODE_KEYS.bodyEnd)];

  return <>{snippets.map((snippet, index) => render(parseSiteCode(snippet), `${slot}-${index}`))}</>;
}
