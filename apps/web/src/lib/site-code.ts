/*
  Snippets the owner pastes into Settings - a Search Console verification tag,
  an AdSense loader, Google Analytics, a chat widget - turned into elements the
  page can actually run.

  Why parse at all: HTML written into a page with `innerHTML` never runs its
  scripts. A pasted `<script>` would sit in the document doing nothing, which
  is the one failure that looks like success. So the snippet is read here and
  rendered as real elements instead.

  What is recognised: script, style, meta, link and noscript. Anything else is
  kept as markup, which is right for the noscript iframe a tag manager asks for
  and for a banner, and wrong for a script - hence the list.
*/

export type SiteCodeNode =
  | { kind: 'script'; attributes: Record<string, unknown>; code: string | null }
  | { kind: 'style'; code: string }
  | { kind: 'meta' | 'link'; attributes: Record<string, unknown> }
  | { kind: 'markup'; html: string };

/** HTML names React spells differently. Anything not here is passed through. */
const REACT_NAMES: Record<string, string> = {
  class: 'className',
  for: 'htmlFor',
  charset: 'charSet',
  crossorigin: 'crossOrigin',
  'http-equiv': 'httpEquiv',
  referrerpolicy: 'referrerPolicy',
  fetchpriority: 'fetchPriority',
  integrity: 'integrity',
  nomodule: 'noModule',
  srcset: 'srcSet',
  imagesrcset: 'imageSrcSet',
  imagesizes: 'imageSizes',
};

/** Present means true; `async=""` is still an async script. */
const FLAGS = new Set(['async', 'defer', 'nomodule', 'hidden', 'itemscope']);

const ATTRIBUTE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g;

function attributesOf(source: string): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};

  for (const match of source.matchAll(ATTRIBUTE)) {
    const name = match[1].toLowerCase();
    const raw = match[2] ?? '';
    const value = raw.startsWith('"') || raw.startsWith("'") ? raw.slice(1, -1) : raw;

    // An event handler as a string does nothing in React, and a snippet that
    // needs one can use a <script> instead of hiding code in an attribute.
    if (name.startsWith('on')) {
      continue;
    }

    attributes[REACT_NAMES[name] ?? name] = FLAGS.has(name) ? true : value;
  }

  return attributes;
}

const TAGS =
  /<script\b([^>]*)>([\s\S]*?)<\/script\s*>|<style\b[^>]*>([\s\S]*?)<\/style\s*>|<(meta|link)\b([^>]*?)\/?>|<noscript\b[^>]*>[\s\S]*?<\/noscript\s*>/gi;

/** Reads one snippet into the elements a page can render. */
export function parseSiteCode(source: string): SiteCodeNode[] {
  const nodes: SiteCodeNode[] = [];
  const text = (source ?? '').trim();

  if (!text) {
    return nodes;
  }

  let index = 0;

  const keepMarkup = (html: string) => {
    const trimmed = html.trim();

    // An HTML comment on its own is not worth an element.
    if (trimmed && trimmed.replace(/<!--[\s\S]*?-->/g, '').trim()) {
      nodes.push({ kind: 'markup', html: trimmed });
    }
  };

  for (const match of text.matchAll(TAGS)) {
    keepMarkup(text.slice(index, match.index));
    index = (match.index ?? 0) + match[0].length;

    if (match[0].toLowerCase().startsWith('<script')) {
      const code = match[2].trim();

      nodes.push({ kind: 'script', attributes: attributesOf(match[1] ?? ''), code: code || null });
    } else if (match[0].toLowerCase().startsWith('<style')) {
      nodes.push({ kind: 'style', code: match[3] ?? '' });
    } else if (match[4]) {
      const kind = match[4].toLowerCase() as 'meta' | 'link';

      nodes.push({ kind, attributes: attributesOf(match[5] ?? '') });
    } else {
      // <noscript>: markup a browser without JavaScript shows, nothing to run.
      nodes.push({ kind: 'markup', html: match[0] });
    }
  }

  keepMarkup(text.slice(index));

  return nodes;
}

/** The three boxes in Settings, and the file AdSense asks a site to serve. */
export const SITE_CODE_KEYS = {
  head: 'code.head',
  bodyStart: 'code.body_start',
  bodyEnd: 'code.body_end',
  adsTxt: 'code.ads_txt',
} as const;

/** One saved snippet, from the public settings the layouts already fetch. */
export function siteCodeValue(
  overrides: Record<string, unknown> | undefined,
  key: (typeof SITE_CODE_KEYS)[keyof typeof SITE_CODE_KEYS],
): string {
  const value = overrides?.[key];

  return typeof value === 'string' ? value : '';
}
