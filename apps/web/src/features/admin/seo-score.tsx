import { SeoScoreBadge } from '@/features/admin/seo-score-badge';
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

/** The number a list shows, or null when there is no focus keyword to score against. */
export function seoScoreOf(input: SeoInput, t: Dictionary): number | null {
  const analysis = analyzeSeo(input, t);

  return analysis.keywordMissing ? null : analysis.score;
}

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
  return <SeoScoreBadge score={seoScoreOf(input, t)} href={href} t={t} locale={locale} />;
}

export { ViewLink } from '@/features/admin/seo-score-badge';
