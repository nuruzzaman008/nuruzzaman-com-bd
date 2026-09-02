import { Callout } from '@/components/ui/callout';

/**
 * Legal pages carry a visible draft notice until a real professional review is
 * recorded in the admin. The page still renders - hiding it would be worse -
 * but nobody can mistake it for approved wording.
 */
export function LegalDraftNotice({ awaiting }: { awaiting: boolean }) {
  if (!awaiting) {
    return null;
  }

  return (
    <Callout tone="warning" title="DRAFT — PROFESSIONAL REVIEW REQUIRED" role="status">
      এই নীতিটি এখনো আইনজীবী বা যোগ্য পেশাজীবীর পর্যালোচনা পায়নি। চূড়ান্ত পর্যালোচনার
      পরে এই নোটিশটি সরে যাবে এবং পর্যালোচকের নাম ও তারিখ এখানে দেখানো হবে।
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
  if (!reviewer) {
    return null;
  }

  return (
    <p className="text-xs text-muted">
      পর্যালোচনা করেছেন {reviewer}
      {reviewedAt ? ` · ${reviewedAt}` : ''}
    </p>
  );
}
