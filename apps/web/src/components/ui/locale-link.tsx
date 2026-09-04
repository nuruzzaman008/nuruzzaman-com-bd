'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';

import { useLocale } from '@/lib/i18n/locale-provider';
import { DEFAULT_LOCALE, isPrivatePath, localizePath, type Locale } from '@/lib/i18n/locale';

/**
 * Rewrites an in-site path for the language the reader is currently in.
 *
 * Without this, every card and every inline link on `/en/...` sends the reader
 * back to the Bengali site on the first click - the page they land on is
 * correct, but the language they chose is silently discarded.
 *
 * Left untouched: external URLs, fragments, the signed-in applications (which
 * are deliberately outside the bilingual tree) and anything already prefixed.
 * Query strings and hashes are split off first, because `localizePath` works on
 * path segments and would otherwise fold `?track=x` into one.
 */
export function localizeHref(href: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE || !href.startsWith('/')) {
    return href;
  }

  const cut = href.search(/[?#]/);
  const path = cut === -1 ? href : href.slice(0, cut);
  const suffix = cut === -1 ? '' : href.slice(cut);

  if (isPrivatePath(path)) {
    return href;
  }

  return `${localizePath(path, locale)}${suffix}`;
}

/** `next/link` that keeps the reader in the language they are reading in. */
export function LocaleLink({ href, ...props }: Omit<ComponentProps<typeof Link>, 'href'> & { href: string }) {
  const { locale } = useLocale();

  return <Link href={localizeHref(href, locale)} {...props} />;
}
