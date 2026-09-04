'use client';

import { Callout } from '@/components/ui/callout';
import { useLocale } from '@/lib/i18n/locale-provider';

/**
 * Legal pages carry a visible draft notice until a real professional review is
 * recorded in the admin. The page still renders - hiding it would be worse -
 * but nobody can mistake it for approved wording.
 *
 * The heading stays in English in both languages on purpose: it is the exact
 * marker the specification asks for, and the owner greps for it.
 */
export function LegalDraftNotice({ awaiting }: { awaiting: boolean }) {
  const { t } = useLocale();

  if (!awaiting) {
    return null;
  }

  return (
    <Callout tone="warning" title="DRAFT — PROFESSIONAL REVIEW REQUIRED" role="status">
      {t.ui.legalDraftBody}
    </Callout>
  );
}

export function LegalReviewedNote({
  reviewer,
  reviewedAt,
}: {
  reviewer: string | null;
  reviewedAt: string | null;
}) {
  const { t } = useLocale();

  if (!reviewer) {
    return null;
  }

  return (
    <p className="text-xs text-muted">
      {t.ui.reviewedBy} {reviewer}
      {reviewedAt ? ` · ${reviewedAt}` : ''}
    </p>
  );
}
