'use client';

import Image from 'next/image';
import type { Author } from '@nuruzzaman/contracts';

import { Card } from '@/components/ui/card';
import { useLocale } from '@/lib/i18n/locale-provider';

/**
 * The biography is owner-supplied. When it has not been written yet the card
 * shows the headline alone rather than filler text.
 */
export function AuthorBio({
  author,
  reviewer,
}: {
  author?: Author | null;
  reviewer?: Author | null;
}) {
  const { t } = useLocale();

  if (!author) {
    return null;
  }

  return (
    <Card className="p-5">
      <div className="flex items-start gap-4">
        {author.photo_url ? (
          <Image
            src={author.photo_url}
            alt=""
            width={64}
            height={64}
            className="size-16 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="font-latin grid size-16 shrink-0 place-items-center rounded-full bg-navy text-lg font-bold text-white"
          >
            {author.name.slice(0, 2)}
          </span>
        )}

        <div>
          <p className="font-bold text-navy">
            {author.name}
            {author.credentials ? (
              <span className="font-latin ms-1 text-sm font-medium text-muted">
                {author.credentials}
              </span>
            ) : null}
          </p>
          {author.headline ? (
            <p data-authored="true" className="mt-1 text-sm text-muted">
              {author.headline}
            </p>
          ) : null}
          {author.bio ? (
            <p data-authored="true" className="mt-2 text-sm text-ink">
              {author.bio}
            </p>
          ) : null}
          {reviewer && reviewer.name !== author.name ? (
            <p className="mt-3 text-xs text-muted">
              {t.ui.technicalReview}: {reviewer.name}
              {reviewer.credentials ? ` ${reviewer.credentials}` : ''}
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
