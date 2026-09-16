import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { number } from '@/lib/format';
import type { Dictionary } from '@/lib/i18n/dictionary';
import type { Locale } from '@/lib/i18n/locale';
import { analyzeSeo, type SeoInput } from '@/lib/seo-analysis/analyze';

/*
  The SEO score of one row, so a list answers "how is this page doing?" without
  opening every record in turn.

  It is the editor's own analysis - the same function, the same thresholds -
  run over what the list already fetched. One check is left out: whether
  another page is written for the same focus keyword is a question for the
  database, and the editor asks it while you type. A row can therefore read a
  point or two away from the panel it links to, which is the one that counts.
*/
export function SeoScore({
  input,
  href,
  t,
  locale,
}: {
  input: SeoInput;
  href: string;
  t: Dictionary;
  locale: Locale;
}) {
  const analysis = analyzeSeo(input, t);

  // Without a focus keyword there is nothing to measure against, and the
  // editor's panel says so rather than inventing a number. So does this.
  if (analysis.keywordMissing) {
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

  const tone = analysis.score >= 80 ? 'success' : analysis.score >= 50 ? 'warning' : 'danger';

  return (
    <Link
      href={href}
      aria-label={`${t.admin.seoPanel.title}: ${analysis.score}`}
      className="inline-flex rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
    >
      <Badge tone={tone}>{number(analysis.score, locale)}</Badge>
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
