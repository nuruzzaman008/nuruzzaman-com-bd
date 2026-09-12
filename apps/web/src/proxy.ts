import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { PATHNAME_HEADER } from '@/lib/i18n/locale';

/**
 * Tells the root layout which path is being rendered.
 *
 * The root layout renders the single `<html>` element for the whole site, and
 * a layout is not given the path, so its `lang` was hardcoded to `bn`. Every
 * English page therefore declared itself Bengali - contradicting the hreflang
 * and the JSON-LD `inLanguage` sitting beside it in the same document, and
 * telling a screen reader to pronounce English with Bengali rules.
 *
 * LocaleProvider already fixes the attribute on a later client navigation. The
 * gap was the first server render, which is the only one a crawler sees.
 *
 * Named `proxy`, not `middleware`: the middleware convention is deprecated in
 * Next 16 and this file replaces it.
 */
export function proxy(request: NextRequest) {
  // Set on every matched request rather than only the English ones, so a
  // header of this name arriving from a client is always overwritten instead
  // of being trusted.
  const headers = new Headers(request.headers);
  headers.set(PATHNAME_HEADER, request.nextUrl.pathname);

  return NextResponse.next({ request: { headers } });
}

export const config = {
  /*
    Only what renders the shell. Static assets, the image optimiser and the
    metadata routes never render `<html>`, so they have no reason to pay for
    this on every request.
  */
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)'],
};
