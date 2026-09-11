'use client';

import { LocaleLink } from '@/components/ui/locale-link';
import { cn } from '@/lib/cn';
import { taxonomyLabel } from '@/lib/i18n/labels';
import { useLocale } from '@/lib/i18n/locale-provider';
import { COURSE_TRACK_SLUGS } from '@/features/courses/tracks';


/**
 * Track filter rendered as links rather than a client-side control, so each
 * filtered view has its own shareable URL.
 */
export function TrackFilter({ active }: { active?: string }) {
  const { locale, t } = useLocale();
  const options = [
    { slug: '', name: t.taxonomy.trackFilter },
    ...COURSE_TRACK_SLUGS.map((slug) => ({
      slug,
      name: taxonomyLabel(t, slug, null, locale),
    })),
  ];

  return (
    <nav aria-label={t.taxonomy.filterLabel} className="mt-6">
      <ul className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isActive = (active ?? '') === option.slug;

          return (
            <li key={option.slug || 'all'}>
              <LocaleLink
                href={option.slug ? `/courses?track=${option.slug}` : '/courses'}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'inline-block rounded-full border px-3.5 py-1.5 text-sm transition-colors',
                  isActive
                    ? 'border-blue bg-blue text-white'
                    : 'border-line bg-white text-navy hover:border-blue hover:text-blue',
                )}
              >
                {option.name}
              </LocaleLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
