import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { number } from '@/lib/format';
import type { Dictionary } from '@/lib/i18n/dictionary';
import type { Locale } from '@/lib/i18n/locale';

/**
 * A row's SEO score, linked to the analysis it comes from.
 *
 * Kept apart from seo-score.tsx, which runs the analysis: a list that computes
 * its scores on the server passes the number down, and this is all the browser
 * needs to show it.
 *
 * `null` is what the editor's panel calls "no score": without a focus keyword
 * there is nothing to measure the page against, and inventing a number would
 * be worse than saying so.
 */
export function SeoScoreBadge({
  score,
  href,
  t,
  locale,
}: {
  score: number | null;
  href: string;
  t: Dictionary;
  locale: Locale;
}) {
  if (score === null) {
    return (
      <Link
        href={href}
        title={t.admin.seoPanel.scoreLockedHint}
        className="text-xs font-semibold text-muted underline-offset-2 hover:underline"
      >
        {t.admin.seoPanel.scoreLocked}
      </Link>
    );
  }

  const tone = score >= 80 ? 'success' : score >= 50 ? 'warning' : 'danger';

  return (
    <Link
      href={href}
      aria-label={`${t.admin.seoPanel.title}: ${score}`}
      className="inline-flex rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
    >
      <Badge tone={tone}>{number(score, locale)}</Badge>
    </Link>
  );
}

/** The live page of a record, or a muted note when there is not one yet. */
export function ViewLink({
  href,
  label,
  draftLabel,
}: {
  href: string | null;
  label: string;
  draftLabel: string;
}) {
  if (!href) {
    return <span className="text-xs text-muted">{draftLabel}</span>;
  }

  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener"
      className="inline-flex min-h-8 items-center rounded-md border border-line px-2.5 text-xs font-semibold text-navy hover:border-blue hover:text-blue"
    >
      {label} ↗
    </Link>
  );
}
